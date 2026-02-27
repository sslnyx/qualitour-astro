import React, { useState, useEffect } from "react";
import type { WPTour } from "../lib/wordpress/types";
import TourInquiryForm from "./forms/TourInquiryForm";

interface TourInquiryModalProps {
    isOpen: boolean;
    onClose: () => void;
    tour: WPTour | null;
    tourCode?: string;
    lang: string;
}

export default function TourInquiryModal({
    isOpen,
    onClose,
    tour,
    tourCode: tourCodeProp,
    lang,
}: TourInquiryModalProps) {
    const [isSuccess, setIsSuccess] = useState(false);

    // Reset success state when modal opens/closes or tour changes
    useEffect(() => {
        if (isOpen) {
            setIsSuccess(false);
        }
    }, [isOpen, tour]);

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
    const currency = tour.tour_meta?.["tourmaster-tour-currency"] || "USD";

    const t = {
        title: lang === "zh" ? "發送咨詢" : "Send Inquiry",
        inquiringAbout: lang === "zh" ? "咨詢項目：" : "Inquiring about:",
        success: lang === "zh" ? "發送成功！我們會儘快聯繫您。" : "Sent successfully! We will contact you shortly.",
        bestPrice: lang === "zh" ? "最優價格" : "Best Price",
        support: lang === "zh" ? "24/7 支持" : "24/7 Support",
        secure: lang === "zh" ? "安全支付" : "Secure",
        startFrom: lang === "zh" ? "起價" : "Starting from",
        perPerson: lang === "zh" ? "每人" : "per person",
        close: lang === "zh" ? "關閉" : "Close",
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up">
                {/* Header / Price Strip */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-white shrink-0">
                    <div className="flex justify-between items-start">
                        {price && (
                            <div>
                                <p className="text-sm opacity-90 mb-1">{t.startFrom}</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-bold">{price}</span>
                                    <span className="text-sm opacity-90">{currency}</span>
                                </div>
                            </div>
                        )}
                        {!price && (
                            <div>
                                <h2 className="text-xl font-bold">{t.title}</h2>
                            </div>
                        )}
                        {price && <p className="text-sm opacity-90 self-end mb-1">{t.perPerson}</p>}
                    </div>
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
                    >
                        <span className="material-icons">close</span>
                    </button>
                </div>

                {/* Scrollable Form Area */}
                <div className="p-6 overflow-y-auto">
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
                                <h3 className="font-bold text-gray-900 line-clamp-2">{tourTitle}</h3>
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

                {/* Footer Trust Badges */}
                <div className="bg-gray-50 p-4 border-t border-gray-100 shrink-0">
                    <div className="flex justify-between items-center text-sm text-gray-600 px-2">
                        <div className="flex items-center gap-1.5">
                            <span className="material-icons text-green-500 text-lg">verified</span>
                            {t.bestPrice}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="material-icons text-green-500 text-lg">support_agent</span>
                            {t.support}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="material-icons text-green-500 text-lg">lock</span>
                            {t.secure}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
