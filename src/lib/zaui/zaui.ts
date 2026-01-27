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

/**
 * Get all private transfers with pricing, grouped by route
 */
export async function getPrivateTransfersWithPricing(): Promise<TransferRoute[]> {
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

    // Fetch details in parallel (batch of 5 at a time to avoid rate limiting)
    const activityArray = Array.from(allActivityIds);
    for (let i = 0; i < activityArray.length; i += 5) {
        const batch = activityArray.slice(i, i + 5);
        const results = await Promise.all(batch.map(id => getActivityDetails(id)));
        results.forEach((details, idx) => {
            if (details) {
                const id = batch[idx];
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
        });
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
