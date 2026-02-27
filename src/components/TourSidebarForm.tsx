/**
 * TourSidebarForm - React component for Astro
 * 
 * Displays tour information and inquiry form in the tour detail sidebar.
 * Uses TourInquiryForm for the actual form submission.
 */

import TourInquiryForm from './forms/TourInquiryForm';

interface TourSidebarFormProps {
    tourId: number | string;
    tourTitle: string;
    price?: string | number;
    duration?: string;
    groupSize?: string;
    datesDetail?: string;
    tourCodeDetail?: string;
    categories?: Array<{ id: number; name: string }>;
    pdfUrl?: string;
    currency?: string;
    lang?: string;
}

const translations = {
    en: {
        startingFrom: "Starting from",
        contactForPrice: "Contact for Price",
        perPerson: "per person",
        sendInquiry: "Send Inquiry",
        downloadItinerary: "Download Itinerary",
        bestPrice: "Best Price",
        support: "24/7 Support",
        secure: "Secure",
    },
    zh: {
        startingFrom: "起價",
        contactForPrice: "聯繫詢價",
        perPerson: "每人",
        sendInquiry: "發送咨詢",
        downloadItinerary: "下載行程單",
        bestPrice: "最優價格",
        support: "24/7 支持",
        secure: "安全支付",
    },
};

export default function TourSidebarForm({
    tourId,
    tourTitle,
    price,
    duration,
    groupSize,
    datesDetail,
    tourCodeDetail,
    categories = [],
    pdfUrl,
    currency,
    lang = 'en',
}: TourSidebarFormProps) {
    const t = translations[lang as keyof typeof translations] || translations.en;

    return (
        <div className="space-y-4">
            {/* Price Card */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                {/* Compact Price Header */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-white flex items-center justify-between">
                    <div>
                        <div className="text-xs opacity-90">{t.startingFrom}</div>
                        {price ? (
                            <div className="text-2xl font-bold">
                                ${price} <span className="text-sm font-medium opacity-80">{currency}</span>
                            </div>
                        ) : (
                            <div className="text-lg font-bold">{t.contactForPrice}</div>
                        )}
                    </div>
                    <div className="text-xs opacity-80 text-right">{t.perPerson}</div>
                </div>

                {/* Categories - compact inline display */}
                {categories.length > 0 && (
                    <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
                        <div className="flex flex-wrap gap-1.5">
                            {categories.map((cat) => (
                                <span
                                    key={cat.id}
                                    className="px-2 py-0.5 bg-white text-gray-600 text-xs font-medium rounded-full border border-gray-200"
                                >
                                    {cat.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Inline Inquiry Form */}
                <div className="p-4">
                    <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="material-icons text-orange-500 text-lg">edit_note</span>
                        {t.sendInquiry}
                    </h3>
                    <TourInquiryForm
                        tourId={tourId}
                        tourTitle={tourTitle}
                        tourCode={tourCodeDetail}
                        compact={true}
                        lang={lang}
                    />
                </div>

                {/* PDF Download if available */}
                {pdfUrl && (
                    <div className="px-4 pb-4">
                        <a
                            href={pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full px-4 py-2.5 border-2 border-orange-500 text-orange-500 font-semibold rounded-lg hover:bg-orange-50 transition-all flex items-center justify-center gap-2 text-sm"
                        >
                            <span className="material-icons text-lg">picture_as_pdf</span>
                            {t.downloadItinerary}
                        </a>
                    </div>
                )}
            </div>

            {/* Trust Badges - Compact horizontal layout */}
            <div className="bg-white rounded-xl p-3 border border-gray-100">
                <div className="flex items-center justify-around text-xs text-gray-600">
                    <div className="flex items-center gap-1.5">
                        <span className="material-icons text-green-500 text-base">verified</span>
                        <span className="hidden sm:inline">{t.bestPrice}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="material-icons text-green-500 text-base">support_agent</span>
                        <span className="hidden sm:inline">{t.support}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="material-icons text-green-500 text-base">credit_score</span>
                        <span className="hidden sm:inline">{t.secure}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
