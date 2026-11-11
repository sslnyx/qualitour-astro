/** Compatibility for older build commands: validate saved data without contacting Zaui. */
import { getTransferSnapshot } from '../src/lib/zaui/zaui.ts';

const snapshot = getTransferSnapshot();
console.log(`[Zaui] Using the saved ${snapshot.routes.length}-route snapshot from ${snapshot.fetchedAt}. Run npm run sync:zaui separately to refresh it.`);
