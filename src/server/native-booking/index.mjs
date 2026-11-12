import api from './handler.mjs';
import { createNativeBookingRouter } from './router.mjs';
export const routeNativeBooking = createNativeBookingRouter(api);
