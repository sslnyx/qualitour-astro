/**
 * Pre-fetch Zaui API data before the main Astro build starts.
 * This runs as a single-process step to avoid concurrency issues and rate limits.
 */
import { getPrivateTransfersWithPricing } from '../src/lib/zaui/zaui.ts';

async function prefetch() {
    console.log('[Zaui Prefetch] Starting single-process data fetch...');
    try {
        const start = Date.now();
        const routes = await getPrivateTransfersWithPricing();
        const duration = Math.round((Date.now() - start) / 1000);
        console.log(`[Zaui Prefetch] SUCCESS: Fetched ${routes.length} routes in ${duration}s`);
        process.exit(0);
    } catch (e) {
        console.error('[Zaui Prefetch] CRITICAL FAILURE:', e);
        process.exit(1);
    }
}

prefetch();
