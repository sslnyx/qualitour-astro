export interface NativeBookingEnvironment {
 TRANSFER_DB?: unknown;
 TRANSFER_SANDBOX_KEY?: string;
 ASSETS?: {fetch(request: Request): Promise<Response>};
 [binding:string]: unknown;
}
export function routeNativeBooking(request:Request,env:NativeBookingEnvironment,context:unknown):Promise<Response|null>;
