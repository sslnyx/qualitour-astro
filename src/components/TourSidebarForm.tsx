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
}

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
}: TourSidebarFormProps) {
    return (
        <div className="space-y-4">
            {/* Price Card */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                {/* Compact Price Header */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-white flex items-center justify-between">
                    <div>
                        <div className="text-xs opacity-90">Starting from</div>
                        {price ? (
                            <div className="text-2xl font-bold">${price}</div>
                        ) : (
                            <div className="text-lg font-bold">Contact for Price</div>
                        )}
                    </div>
                    <div className="text-xs opacity-80 text-right">per person</div>
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
                        Send Inquiry
                    </h3>
                    <TourInquiryForm
                        tourId={tourId}
                        tourTitle={tourTitle}
                        tourCode={tourCodeDetail}
                        hidePhone={true}
                        compact={true}
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
                            Download Itinerary
                        </a>
                    </div>
                )}
            </div>

            {/* Trust Badges - Compact horizontal layout */}
            <div className="bg-white rounded-xl p-3 border border-gray-100">
                <div className="flex items-center justify-around text-xs text-gray-600">
                    <div className="flex items-center gap-1.5">
                        <span className="material-icons text-green-500 text-base">verified</span>
                        <span className="hidden sm:inline">Best Price</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="material-icons text-green-500 text-base">support_agent</span>
                        <span className="hidden sm:inline">24/7 Support</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="material-icons text-green-500 text-base">credit_score</span>
                        <span className="hidden sm:inline">Secure</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
