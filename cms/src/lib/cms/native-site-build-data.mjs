import {getAllTours} from './native-site-api.mjs';
// Used only if a shared component requests the old build helper: never retain
// a catalogue in a module-level promise across publication events.
export const getTourBuildData=lang=>getAllTours(lang);
