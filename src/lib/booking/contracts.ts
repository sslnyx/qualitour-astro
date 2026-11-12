export type CatalogSource = { activityId: string; capturedDate: string };
export type RouteLocation = { id: string; nameZh: string; nameEn: string };
export type RouteServiceRules = {
  validFrom: string;
  validTo: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  intervalMinutes: number;
  pickupOptions: RouteLocation[];
  dropoffOptions: RouteLocation[];
};
export type TransferRoute = {
  /** Stable public-directory identity used to preselect an exact product. */
  directoryProductId?: string;
  serviceRules?: RouteServiceRules;
  source?: CatalogSource;
  id: string;
  code: string;
  direction: string;
  nameZh: string;
  nameEn: string;
  pickupZh: string;
  pickupEn: string;
  dropoffZh: string;
  dropoffEn: string;
  base: string;
  durationMinutes: number;
  active: boolean;
  version: number;
};
export type RouteInput = Omit<TransferRoute, "id" | "version" | "source">;
export type TransferRate = {
  source?: CatalogSource;
  id: string;
  routeId: string;
  vehicleClass: string;
  nameZh: string;
  nameEn: string;
  maxPassengers: number;
  amountMinor: number;
  currency: "cad";
  validFrom: string;
  validTo: string;
  vehicleIds: string[];
  active: boolean;
  version: number;
};
export type RateInput = Omit<
  TransferRate,
  "id" | "version" | "currency" | "source"
> & { sourcePriceConfirmed?: boolean };
export type CatalogAdmin = {
  routes: TransferRoute[];
  rates: TransferRate[];
  vehicles: {
    id: string;
    label: string;
    verified?: boolean;
    isDemo?: boolean;
    capacity: number;
    base: string;
    active: boolean;
  }[];
};
export type PublicCatalog = {
  routes: Omit<TransferRoute, "base" | "version" | "source">[];
  rates: Omit<TransferRate, "vehicleIds" | "version" | "source">[];
  sandbox: true;
  paymentEnabled: boolean;
};
export type QuoteInput = {
  returnTo?: "transfers" | "contact";
  routeId: string;
  rateId: string;
  departureLocal: string;
  passengers: number;
};
export type BookingQuote = {
  pickupOptions?: RouteLocation[];
  dropoffOptions?: RouteLocation[];
  returnTo: "transfers" | "contact";
  id: string;
  routeId: string;
  rateId: string;
  routeNameZh: string;
  routeNameEn: string;
  pickupZh: string;
  pickupEn: string;
  dropoffZh: string;
  dropoffEn: string;
  rateNameZh: string;
  rateNameEn: string;
  departureLabel: string;
  departureLocal: string;
  departureUtc: number;
  passengers: number;
  amountMinor: number;
  currency: "cad";
  expiresAt: number;
};
export type CustomerInput = {
  pickupLocationId?: string;
  dropoffLocationId?: string;
  name: string;
  email: string;
  phone: string;
  pickupAddress: string;
  dropoffAddress: string;
  flightNumber: string;
  notes: string;
};
export type ReservationInput = {
  quoteId: string;
  idempotencyKey: string;
  sandboxAcknowledged: true;
  customer: CustomerInput;
};
export type GuestBooking = {
  pickupLocation?: RouteLocation;
  dropoffLocation?: RouteLocation;
  paymentNotification?: { kind: "payment_confirmed"; createdAt: number };
  returnTo: "transfers" | "contact";
  id: string;
  reference: string;
  routeNameZh: string;
  routeNameEn: string;
  departureLabel: string;
  passengers: number;
  amountMinor: number;
  currency: "cad";
  status: "pending" | "confirmed" | "cancelled";
  paymentState: "unpaid" | "pending" | "paid" | "review";
  holdUntil: number;
  sandbox: true;
  canPay: boolean;
  canCancel: boolean;
};
export type BookingReceipt = {
  pickupLocation?: RouteLocation;
  dropoffLocation?: RouteLocation;
  reference: string;
  bookingReference: string;
  routeNameZh: string;
  routeNameEn: string;
  departureLabel: string;
  passengers: number;
  amountMinor: number;
  currency: "cad";
  confirmedAt: number;
  sandbox: true;
};

export type MaintenanceResult = {
  outcome: "ok" | "degraded" | "failed" | "skipped";
  unsent?: number;
  providerUnavailable?: boolean;
  providerFailures?: number;
  jobs?: { processed: number; attempts: number; unsent: number } | null;
};

export type MaintenanceState = {
  startedAt: number | null;
  finishedAt: number | null;
  outcome: string;
  stale: boolean;
  result: MaintenanceResult | null;
};
