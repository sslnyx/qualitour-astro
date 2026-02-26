/**
 * Zaui API Client
 * 
 * Fetches activities and pricing from Zaui ZAPI for private transfers.
 * Used at build time to populate transfer route cards.
 */

// Types
export interface ZauiActivity {
    activityId: string;
    activityName: string;
    activityType: string;
    imageUrl: string | Record<string, never>;
    categoryName?: string;
}

export interface ZauiActivityDetails extends ZauiActivity {
    priceCodeId?: string;
    basePrice?: string;
    description?: string;
    shortDescription?: string;
    pickupLocations?: unknown;
    dropOffLocations?: unknown;
    activityTimes?: ZauiActivityTime[];
}

export interface ZauiActivityTime {
    activityTimeStart: string;
    activityTimeSpotsRemaining: string;
    status: string;
}

export interface ZauiCategory {
    categoryId: string;
    categoryName: string;
    numberOfActivities: string;
    activities: {
        activity: ZauiActivity | ZauiActivity[];
    };
}

export interface TransferRoute {
    id: string;
    name: string;
    fromLocation: string;
    toLocation: string;
    imageUrl: string;
    vehicles: TransferVehicle[];
    // For reverse direction
    reverseActivityIds?: TransferVehicle[];
}

export interface TransferVehicle {
    seater: '11' | '14';
    activityId: string;
    price: string;
    // Full activity details for modal (fetched at build time)
    details?: {
        activityName: string;
        description: string;
        imageUrl: string;
    };
}

// API Configuration
const ZAUI_API_URL = import.meta.env.ZAUI_API_URL || 'https://qualitour.zaui.net/zapi/';
const ZAUI_TOKEN = import.meta.env.ZAUI_API_TOKEN;
const ZAUI_ACCOUNT_ID = parseInt(import.meta.env.ZAUI_ACCOUNT_ID || '1');
const ZAUI_USER_ID = parseInt(import.meta.env.ZAUI_USER_ID || '7');

/**
 * Make a ZAPI request
 */
async function zapiRequest<T>(methodName: string, params: Record<string, unknown> = {}): Promise<T> {
    const body = {
        zapiToken: ZAUI_TOKEN,
        zapiAccountId: ZAUI_ACCOUNT_ID,
        zapiUserId: ZAUI_USER_ID,
        zapiMethod: {
            methodName,
            ...params,
        },
    };

    const response = await fetch(ZAUI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`ZAPI request failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.response?.error !== '0') {
        throw new Error(`ZAPI error: ${data.response?.message || 'Unknown error'}`);
    }

    return data.response.methodResponse;
}

/**
 * Get all activity categories with their activities
 */
export async function getActivityCategories(): Promise<ZauiCategory[]> {
    const response = await zapiRequest<{ categories: { category: ZauiCategory[] } }>('zapiGetActivityCategories');
    return response.categories?.category || [];
}

/**
 * Get private transfer activities only (category ID: 6)
 */
export async function getPrivateTransferActivities(): Promise<ZauiActivity[]> {
    const categories = await getActivityCategories();
    const privateTransfers = categories.find(c => c.categoryId === '6');

    if (!privateTransfers) {
        return [];
    }

    const activities = privateTransfers.activities?.activity;
    if (!activities) return [];

    // Handle single activity or array
    return Array.isArray(activities) ? activities : [activities];
}

/**
 * Get activity details including pricing
 */
export async function getActivityDetails(activityId: string | number, date?: string): Promise<ZauiActivityDetails | null> {
    try {
        // Use tomorrow's date if not provided
        const activityDate = date || getTomorrowDate();

        const response = await zapiRequest<{ activity: ZauiActivityDetails }>('zapiGetActivityDetailsByActivityId', {
            activityId: Number(activityId),
            activityDate,
        });

        const activity = response.activity;

        // Extract base price from allowedPassengers
        const allowedPassengers = (activity as any).allowedPassengers;
        if (allowedPassengers?.passengerType) {
            const passengerType = allowedPassengers.passengerType;
            if (typeof passengerType === 'object' && passengerType.basePrice) {
                activity.basePrice = passengerType.basePrice;
            }
        }

        return activity;
    } catch (error) {
        console.error(`Failed to get activity details for ID ${activityId}:`, error);
        return null;
    }
}

/**
 * Get price for an activity
 */
export async function getActivityPrice(activityId: string | number): Promise<string | null> {
    const details = await getActivityDetails(activityId);
    return details?.basePrice || null;
}

import fs from 'fs';
import path from 'path';

// File-system cache for transfer routes (prevents rate limiting across Astro worker processes)
const CACHE_DIR = path.join(process.cwd(), '.astro', 'zaui-cache');
const CACHE_FILE = path.join(CACHE_DIR, 'transfer-routes.json');
const LOCK_FILE = path.join(CACHE_DIR, 'transfer-routes.lock');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Helper to wait
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Get all private transfers with pricing, grouped by route
 * Cached for 24 hours to prevent ZAPI rate limiting during build.
 * Uses file system caching with a lockfile to support concurrent Astro worker processes.
 */
export async function getPrivateTransfersWithPricing(): Promise<TransferRoute[]> {
    // Ensure cache directory exists
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }

    // Quick check if cache is valid
    if (fs.existsSync(CACHE_FILE)) {
        const stats = fs.statSync(CACHE_FILE);
        if (Date.now() - stats.mtimeMs < CACHE_TTL_MS) {
            try {
                const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
                console.log('[Zaui Build Cache] HIT: transfer routes (fs)');
                return data;
            } catch (e) {
                console.warn('[Zaui Build Cache] Failed to read cache, fetching fresh...', e);
            }
        }
    }

    const workerId = Math.random().toString(36).substring(2, 11);
    let retries = 0;
    const maxRetries = 240; // 2 minutes (240 * 500ms)
    let hasLock = false;

    while (retries < maxRetries) {
        // 1. Try to atomically acquire the lock
        try {
            // 'wx' flag fails if file exists
            const fd = fs.openSync(LOCK_FILE, 'wx');
            fs.writeSync(fd, `${Date.now()}-${workerId}`);
            fs.closeSync(fd);
            hasLock = true;
            break; // We got the lock!
        } catch (e: any) {
            if (e.code !== 'EEXIST') {
                console.warn('[Zaui Build Cache] Unexpected error trying to acquire lock:', e);
            }
            // Lock already exists, wait and retry
        }

        // 2. Lock is held by someone else, check if it's stale
        if (fs.existsSync(LOCK_FILE)) {
            const lockStats = fs.statSync(LOCK_FILE);
            if (Date.now() - lockStats.mtimeMs > 2 * 60 * 1000) {
                console.log(`[Zaui Build Cache] Lockfile is stale. Worker ${workerId} breaking lock.`);
                try { fs.unlinkSync(LOCK_FILE); } catch (e) { /* ignore */ }
                continue; // Immediately try to acquire lock again
            }
        }

        if (retries === 0) {
            console.log(`[Zaui Build Cache] Worker ${workerId} waiting for another process to finish fetching...`);
        }

        await delay(500);
        retries++;

        // 3. Check if the other process finished and created the cache
        if (fs.existsSync(CACHE_FILE)) {
            const stats = fs.statSync(CACHE_FILE);
            if (Date.now() - stats.mtimeMs < CACHE_TTL_MS) {
                try {
                    const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
                    console.log(`[Zaui Build Cache] HIT: Worker ${workerId} used cache after waiting`);
                    return data;
                } catch (e) {
                    // Cache is malformed, we'll loop around and try to acquire lock again if needed
                    console.warn(`[Zaui Build Cache] Worker ${workerId} failed to read cache after wait`, e);
                }
            }
        }
    }

    if (!hasLock) {
        console.warn(`[Zaui Build Cache] Worker ${workerId} timed out waiting for lock. Fetching fresh anyway.`);
    }

    console.log(`[Zaui Build Cache] MISS: Worker ${workerId} fetching fresh transfer routes from ZAPI`);

    try {
        const routes = await _fetchPrivateTransfersWithPricing();

        // Save to cache
        fs.writeFileSync(CACHE_FILE, JSON.stringify(routes), 'utf-8');
        console.log(`[Zaui Build Cache] Worker ${workerId} saved transfer routes to fs cache`);

        return routes;
    } catch (e) {
        console.error(`[Zaui Build Cache] Worker ${workerId} failed to fetch from ZAPI:`, e);
        throw e;
    } finally {
        // Release lock
        if (hasLock) {
            try {
                if (fs.existsSync(LOCK_FILE)) {
                    // Only delete it if we still own it
                    const lockData = fs.readFileSync(LOCK_FILE, 'utf-8');
                    if (lockData.includes(workerId)) {
                        fs.unlinkSync(LOCK_FILE);
                        console.log(`[Zaui Build Cache] Worker ${workerId} released lock`);
                    }
                }
            } catch (e) {
                console.warn(`[Zaui Build Cache] Worker ${workerId} failed to remove lockfile`, e);
            }
        }
    }
}

async function _fetchPrivateTransfersWithPricing(): Promise<TransferRoute[]> {
    const activities = await getPrivateTransferActivities();

    // Define route groups (pairs of directions with their activity IDs)
    const routeGroups = [
        {
            name: 'YVR ↔ Whistler',
            from: 'Vancouver Airport (YVR)',
            to: 'Whistler',
            forward: { '11': '18', '14': '54' },
            reverse: { '11': '20', '14': '55' },
        },
        {
            name: 'Greater Vancouver ↔ Whistler',
            from: 'Greater Vancouver',
            to: 'Whistler',
            forward: { '11': '16', '14': '53' },
            reverse: { '11': '16', '14': '53' }, // Same IDs, one-way only?
        },
        {
            name: 'YVR ↔ Greater Vancouver Zone 1',
            from: 'Vancouver Airport (YVR)',
            to: 'Greater Vancouver (Zone 1)',
            forward: { '11': '22', '14': '45' },
            reverse: { '11': '28', '14': '49' },
        },
        {
            name: 'YVR ↔ Greater Vancouver Zone 2',
            from: 'Vancouver Airport (YVR)',
            to: 'Greater Vancouver (Zone 2)',
            forward: { '11': '24', '14': '47' },
            reverse: { '11': '30', '14': '50' },
        },
        {
            name: 'YVR ↔ Greater Vancouver Zone 3',
            from: 'Vancouver Airport (YVR)',
            to: 'Greater Vancouver (Zone 3)',
            forward: { '11': '26', '14': '48' },
            reverse: { '11': '32', '14': '51' },
        },
        {
            name: 'Vancouver ↔ Sun Peaks',
            from: 'Vancouver / YVR',
            to: 'Sun Peaks',
            forward: { '11': '82' },
            reverse: { '11': '83' },
        },
        {
            name: 'Vancouver ↔ Seattle',
            from: 'Vancouver',
            to: 'Seattle',
            forward: { '11': '84', '14': '97' },
            reverse: { '11': '85', '14': '98' },
        },
        {
            name: 'YVR ↔ Canada Place Cruise',
            from: 'Vancouver Airport (YVR)',
            to: 'Canada Place Cruise Terminal',
            forward: { '11': '88', '14': '96' },
            reverse: { '11': '89', '14': '95' },
        },
        {
            name: 'YVR ↔ Abbotsford',
            from: 'Vancouver Airport (YVR)',
            to: 'Abbotsford (YXX) Airport',
            forward: { '11': '34', '14': '56' },
            reverse: { '11': '36', '14': '57' },
        },
    ];

    // Fetch prices for all activities
    const allActivityIds = new Set<string>();
    routeGroups.forEach(group => {
        Object.values(group.forward).forEach(id => allActivityIds.add(id));
        Object.values(group.reverse).forEach(id => allActivityIds.add(id));
    });

    const priceMap = new Map<string, string>();
    const imageMap = new Map<string, string>();
    const detailsMap = new Map<string, { activityName: string; description: string; imageUrl: string }>();

    // Fetch details sequentially with a delay to avoid rate limiting
    const activityArray = Array.from(allActivityIds);
    for (const id of activityArray) {
        console.log(`[Zaui Build Cache] Fetching details for activity: ${id}`);
        const details = await getActivityDetails(id);

        if (details) {
            if (details.basePrice) {
                priceMap.set(id, details.basePrice);
            }
            if (details.imageUrl && typeof details.imageUrl === 'string') {
                imageMap.set(id, details.imageUrl);
            }
            // Store full details for modal
            detailsMap.set(id, {
                activityName: details.activityName || '',
                description: details.description || details.shortDescription || '',
                imageUrl: typeof details.imageUrl === 'string' ? details.imageUrl : '',
            });
        }

        // Mandatory wait between requests to ZAPI
        await delay(500);
    }

    // Build transfer routes with full details
    const routes: TransferRoute[] = routeGroups.map((group, index) => {
        const forwardVehicles: TransferVehicle[] = Object.entries(group.forward).map(([seater, activityId]) => ({
            seater: seater as '11' | '14',
            activityId,
            price: priceMap.get(activityId) || 'Contact for price',
            details: detailsMap.get(activityId),
        }));

        const reverseVehicles: TransferVehicle[] = Object.entries(group.reverse).map(([seater, activityId]) => ({
            seater: seater as '11' | '14',
            activityId,
            price: priceMap.get(activityId) || 'Contact for price',
            details: detailsMap.get(activityId),
        }));

        // Get image from first forward activity
        const firstActivityId = Object.values(group.forward)[0];
        const imageUrl = imageMap.get(firstActivityId) || '';

        return {
            id: `route-${index}`,
            name: group.name,
            fromLocation: group.from,
            toLocation: group.to,
            imageUrl,
            vehicles: forwardVehicles,
            reverseActivityIds: reverseVehicles,
        };
    });

    return routes;
}

/**
 * Get tomorrow's date in YYYY-MM-DD format
 */
function getTomorrowDate(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
}
