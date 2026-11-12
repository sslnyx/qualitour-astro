import type {
  PublicCatalog,
  BookingQuote,
  QuoteInput,
  CustomerInput,
  GuestBooking,
} from "./contracts";

export type BookingViewProps = {
  showBooking: boolean;
  websiteUrl: string;
  lang: "en" | "zh";
  onLanguage: (lang: "en" | "zh") => void;
  catalog?: PublicCatalog;
  quote?: BookingQuote;
  booking?: GuestBooking;
  loading: boolean;
  busy: boolean;
  error: string;
  initialRouteId?: string;
  initialRateId?: string;
  onQuote: (value: QuoteInput) => void;
  onReserve: (customer: CustomerInput) => void;
  onCheckout: () => void;
  onCancel: () => void;
  onRefresh: () => void;
  onNew: () => void;
  onReceipt: () => void;
  recent?: GuestBooking[];
  recoveryLoading?: boolean;
  recoveryError?: string;
  onRecover: () => void;
};
