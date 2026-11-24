import type { BookingQuote, CustomerInput, RouteLocation } from "./contracts";

function reconcileLocation(
  selectedId: string | undefined,
  address: string,
  options: readonly RouteLocation[] | undefined,
) {
  const selected = options?.find((option) => option.id === selectedId);
  const next = selected ?? (options?.length === 1 ? options[0] : undefined);
  return {
    id: next?.id,
    address: next?.id === selectedId && next?.requiresAddress !== false ? address : "",
  };
}

export function reconcileBookingCustomer(
  customer: CustomerInput,
  quote: Pick<BookingQuote, "pickupOptions" | "dropoffOptions">,
): CustomerInput {
  const pickup = reconcileLocation(customer.pickupLocationId, customer.pickupAddress, quote.pickupOptions);
  const dropoff = reconcileLocation(customer.dropoffLocationId, customer.dropoffAddress, quote.dropoffOptions);
  return {
    ...customer,
    pickupLocationId: pickup.id,
    pickupAddress: pickup.address,
    dropoffLocationId: dropoff.id,
    dropoffAddress: dropoff.address,
  };
}
