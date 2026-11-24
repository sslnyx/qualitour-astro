import type { Dispatch, ReactNode, SetStateAction } from "react";
import type {
  PublicCatalog,
  BookingQuote,
  QuoteInput,
  AvailabilityInput,
  AvailabilityResult,
  CustomerInput,
  GuestBooking,
} from "./contracts";

export type BookingTripDraft = { serviceDate: string; passengers: number; coupon: string };

export type BookingJourney = {
  title: string;
  pickup: string;
  intendedDropoff?: string;
  seater: "11" | "14";
  serviceArea?: string;
  referencePrice?: string;
};

export type BookingViewProps = {
  showBooking: boolean;
  showReceipt: boolean;
  lang: "en" | "zh";
  fixedProduct: boolean;
  journey?: BookingJourney;
  vehicleSelector?: ReactNode;
  catalog?: PublicCatalog;
  quote?: BookingQuote;
  booking?: GuestBooking;
  customer: CustomerInput;
  setCustomer: Dispatch<SetStateAction<CustomerInput>>;
  loading: boolean;
  busy: boolean;
  error: string;
  focusError: boolean;
  checkoutError: string;
  paymentSetupFailed: boolean;
  initialRouteId?: string;
  initialRateId?: string;
  tripDraft?: BookingTripDraft;
  onTripDraftChange?: (patch: Partial<BookingTripDraft>) => void;
  onAvailability?: (
    value: AvailabilityInput,
    signal?: AbortSignal,
  ) => Promise<AvailabilityResult>;
  onQuote: (value: QuoteInput) => void;
  onReserve: (customer: CustomerInput) => void;
  onCheckout: () => void;
  onCancel: () => void;
  onRefresh: () => void;
  onNew: () => void;
  onReceipt: () => void;
};
