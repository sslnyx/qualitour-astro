import NativeBookingDialog from "./booking/NativeBookingDialog";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  lang?: "en" | "zh";
  route?: {
    from: string;
    to: string;
    price: string;
    activityId?: string;
  };
};

/** Legacy card adapter. The form and API are shared with the full booking page. */
export default function TransferBookingModal({
  isOpen,
  onClose,
  lang = "en",
  route,
}: Props) {
  return (
    <NativeBookingDialog
      open={isOpen}
      onClose={onClose}
      lang={lang}
      productId={
        route?.activityId ? `transfer-product-${route.activityId}` : undefined
      }
      title={route ? `${route.from} → ${route.to}` : undefined}
    />
  );
}
