import { getAllTours, getTourBySlug } from './api';
import type { WPTour } from './types';

type Locale = 'en' | 'zh';
const snapshots = new Map<Locale, Promise<WPTour[]>>();

/** One consistent full-content snapshot per language and build, bounded at four requests. */
export function getTourBuildData(lang: Locale): Promise<WPTour[]> {
    let snapshot = snapshots.get(lang);
    if (!snapshot) {
        snapshot = (async () => {
            const summaries = await getAllTours(lang);
            if (summaries.some(tour => 'status' in tour && tour.status !== 'publish')) throw new Error('Non-public tour in build catalogue');
            if (!summaries.length) throw new Error(`Refusing an empty ${lang} tour catalogue`);
            const details: WPTour[] = new Array(summaries.length);
            let next = 0;
            const started = performance.now();
            await Promise.all(Array.from({ length: Math.min(4, summaries.length) }, async () => {
                while (next < summaries.length) {
                    const index = next++;
                    const summary = summaries[index];
                    // WordPress returns percent-encoded slugs; encode exactly once in the API client.
                    const detail = await getTourBySlug(decodeURIComponent(summary.slug), lang);
                    if (!detail || detail.id !== summary.id || !detail.title?.rendered || !detail.goodlayers_data && !detail.content?.rendered) {
                        throw new Error(`Missing or inconsistent ${lang} content for tour ${summary.id}`);
                    }
                    details[index] = detail;
                }
            }));
            console.log(`[Tour snapshot] ${lang}: ${details.length} full tours in ${((performance.now() - started) / 1000).toFixed(2)}s`);
            return details;
        })();
        snapshots.set(lang, snapshot);
    }
    return snapshot;
}
