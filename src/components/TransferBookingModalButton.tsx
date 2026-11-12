import { useRef, useState } from "react";
import NativeBookingDialog from "./booking/NativeBookingDialog";

type Props = {
  label: string;
  activityId: string;
  localePrefix: string;
  lang?: "en" | "zh";
  variant?: "primary" | "secondary";
};

export default function TransferBookingModalButton({
  label,
  activityId,
  lang = "en",
  variant = "primary",
}: Props) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const productId = `transfer-product-${activityId}`;
  const buttonClassName =
    variant === "primary"
      ? "block w-full px-4 py-2 rounded-md bg-[#f7941e] hover:bg-[#e68a1c] text-white font-semibold transition-colors"
      : "block w-full px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50 text-gray-900 font-semibold transition-colors";

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClassName}
      >
        {label}
      </button>
      <NativeBookingDialog
        open={open}
        onClose={() => {
          setOpen(false);
          requestAnimationFrame(() => trigger.current?.focus());
        }}
        lang={lang}
        productId={productId}
      />
    </>
  );
}
