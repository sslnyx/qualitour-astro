import { useEffect, useId, useRef, useState } from "react";
import type { WPTour } from "../lib/wordpress/types";
import TourInquiryForm from "./forms/TourInquiryForm";

interface TourInquiryModalProps {
    isOpen: boolean;
    onClose: () => void;
    tour: WPTour | null;
    tourCode?: string;
    lang: string;
    returnFocusTo: HTMLElement | null;
}

export default function TourInquiryModal({
    isOpen,
    onClose,
    tour,
    tourCode: tourCodeProp,
    lang,
    returnFocusTo,
}: TourInquiryModalProps) {
    const [isSuccess, setIsSuccess] = useState(false);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const titleId = useId();

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!isOpen || !tour || !dialog) return;

        setIsSuccess(false);
        const trigger = returnFocusTo;
        const previousOverflow = document.body.style.overflow;
        dialog.showModal();
        document.body.style.overflow = "hidden";
        closeRef.current?.focus();

        return () => {
            if (dialog.open) dialog.close();
            document.body.style.overflow = previousOverflow;
            trigger?.focus({ preventScroll: true });
        };
    }, [isOpen, tour, returnFocusTo]);

    if (!isOpen || !tour) return null;

    const cleanTitle = (html: string) => {
        return html
            .replace(/&#8211;/g, "-")
            .replace(/&#8217;/g, "'")
            .replace(/&amp;/g, "&")
            .replace(/<[^>]+>/g, "");
    };

    const tourTitle = cleanTitle(tour.title.rendered);
    const tourCode = tourCodeProp || tour.tour_meta?.tour_code || tour.tour_meta?.["tour-code"] || "";

    let price = tour.tour_meta?.["tour-price-text"];
    if (!price && tour.tour_meta?.price) {
        price = tour.tour_meta.price;
    }
    const currency = tour.tour_meta?.["tourmaster-tour-currency"] || "";

    const t = {
        title: lang === "zh" ? "查詢行程" : "Enquire about this tour",
        inquiringAbout: lang === "zh" ? "正在查詢：" : "Inquiring about:",
        success: lang === "zh" ? "已送出查詢，我們會儘快聯絡您。" : "Sent successfully! We will contact you shortly.",
        startFrom: lang === "zh" ? "起價" : "Starting from",
        perPerson: lang === "zh" ? "每人" : "per person",
        close: lang === "zh" ? "關閉" : "Close",
    };

    return (
        <dialog
            ref={dialogRef}
            aria-labelledby={titleId}
            className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-lg overflow-hidden rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-black/60"
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div className="relative flex max-h-[90dvh] flex-col">
                {/* Header / Price Strip */}
                <div className="shrink-0 bg-gray-900 p-4 pr-16 text-white sm:p-6 sm:pr-16">
                    <h2 id={titleId} className="text-xl font-bold">{t.title}</h2>
                    {price && (
                        <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-sm text-gray-200">
                            {t.startFrom}
                            <strong className="text-2xl text-orange-200">{price}</strong>
                            {currency && <span>{currency}</span>}
                            <span>{t.perPerson}</span>
                        </p>
                    )}
                    <button
                        ref={closeRef}
                        type="button"
                        aria-label={t.close}
                        onClick={onClose}
                        className="absolute top-2 right-2 grid size-11 place-items-center rounded-full text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
                    >
                        <span className="material-icons" aria-hidden="true">close</span>
                    </button>
                </div>

                {/* Scrollable Form Area */}
                <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
                    {isSuccess ? (
                        <div className="text-center py-12">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <span className="material-icons text-4xl text-green-500">check_circle</span>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">{t.success}</h3>
                            <button
                                onClick={onClose}
                                className="mt-8 px-8 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-medium"
                            >
                                {t.close}
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Inquiring About Box */}
                            <div className="bg-orange-50 rounded-xl p-4 border border-orange-100 mb-6">
                                <span className="text-sm text-gray-500 block mb-1">{t.inquiringAbout}</span>
                                <h3 className="break-words font-bold text-gray-900">{tourTitle}</h3>
                            </div>

                            {/* Shared Inquiry Form */}
                            <TourInquiryForm
                                tourId={tour.id}
                                tourCode={tourCode}
                                tourTitle={tourTitle}
                                lang={lang}
                                hideTourInfo={true}
                                hideResult={false}
                                onSuccess={() => setIsSuccess(true)}
                            />
                        </>
                    )}
                </div>

            </div>
        </dialog>
    );
}
