import { useEffect, useId, useRef } from "react";
import BookingExperience from "./BookingExperience";

type Props = {
  open: boolean;
  onClose: () => void;
  lang: "en" | "zh";
  productId?: string;
  title?: string;
};

export default function NativeBookingDialog({
  open,
  onClose,
  lang,
  productId,
  title,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const fullPageUrl = `${lang === "zh" ? "/zh/book" : "/book"}${
    productId ? `?product=${encodeURIComponent(productId)}` : ""
  }`;

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const handleClose = () => onClose();
    node.addEventListener("close", handleClose);
    return () => node.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={headingId}
      className="qb-native-dialog"
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current?.close();
      }}
    >
      <div className="qb-native-dialog__panel">
        <header className="qb-native-dialog__head">
          <div>
            <p className="qb-native-dialog__eyebrow">
              {lang === "zh" ? "Sandbox 測試預訂" : "Sandbox test booking"}
            </p>
            <h2 id={headingId}>
              {title ??
                (lang === "zh"
                  ? "私人接送快捷預訂"
                  : "Quick private transfer booking")}
            </h2>
          </div>
          <button
            type="button"
            className="qb-native-dialog__close"
            onClick={() => dialog.current?.close()}
            aria-label={lang === "zh" ? "關閉預訂" : "Close booking"}
          >
            ×
          </button>
        </header>
        <div className="qb-native-dialog__body">
          {open ? (
            <BookingExperience lang={lang} productId={productId} compact />
          ) : null}
        </div>
        <footer className="qb-native-dialog__foot">
          <a href={fullPageUrl}>
            {lang === "zh" ? "開啟完整預訂頁" : "Open full booking page"}
          </a>
        </footer>
      </div>
    </dialog>
  );
}
