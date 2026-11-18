/**
 * MobileInquiryCTA - Fixed bottom bar for mobile tour detail pages.
 *
 * Shows the tour price + an enquiry button that opens the shared
 * TourInquiryModal.  Hidden on lg+ screens where the sidebar form
 * is already visible.
 */

import { useRef, useState } from "react";
import type { WPTour } from "../lib/wordpress/types";
import TourInquiryModal from "./TourInquiryModal";

interface MobileInquiryCTAProps {
    tour: WPTour;
    tourCode?: string;
    lang: string;
}

export default function MobileInquiryCTA({ tour, tourCode, lang }: MobileInquiryCTAProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const triggerRef = useRef<HTMLAnchorElement>(null);

    const price = tour.tour_meta?.["tour-price-text"] || tour.tour_meta?.price;
    const currency = tour.tour_meta?.["tourmaster-tour-currency"] || "";

    const btnLabel = lang === "zh" ? "查詢行程" : "Enquire about this tour";
    const fromLabel = lang === "zh" ? "起" : "From";

    return (
        <>
            {/* Fixed bottom bar — visible only below lg breakpoint */}
            <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden">
                {/* Subtle top shadow */}
                <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />

                <div className="bg-white/95 backdrop-blur-lg border-t border-gray-100 px-4 py-3 flex items-center justify-between gap-4 safe-area-bottom">
                    {/* Price info */}
                    {price ? (
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs text-gray-500 leading-tight">{fromLabel}</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-bold text-gray-900 truncate">{price}</span>
                                <span className="text-xs text-gray-500">{currency}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1" />
                    )}

                    <a
                        href="#tour-enquiry"
                        ref={triggerRef}
                        onClick={(event) => {
                            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                            event.preventDefault();
                            setIsModalOpen(true);
                        }}
                        className="flex-shrink-0 inline-flex items-center gap-2 px-6 py-3 bg-[#a8410b] text-white font-bold rounded-full shadow-lg shadow-orange-500/25 hover:bg-[#883608] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a8410b] transition-colors"
                    >
                        <span className="material-icons text-lg" aria-hidden="true">event_available</span>
                        {btnLabel}
                    </a>
                </div>
            </div>

            {/* Inquiry Modal */}
            <TourInquiryModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                tour={tour}
                tourCode={tourCode}
                lang={lang}
                returnFocusTo={triggerRef.current}
            />
        </>
    );
}
