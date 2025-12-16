/**
 * TourSidebarForm - React component for Astro
 * 
 * Displays tour information and inquiry form in the tour detail sidebar.
 * Uses TourInquiryForm for the actual form submission.
 */

import { useState } from 'react';
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
    const [showForm, setShowForm] = useState(false);

    return (
        <div className="space-y-6">
            {/* Price Card */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                {/* Price Header */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-white">
                    <div className="text-sm opacity-90 mb-1">Starting from</div>
                    {price ? (
                        <div className="text-4xl font-bold">${price}</div>
                    ) : (
                        <div className="text-2xl font-bold">Contact for Price</div>
                    )}
                    <div className="text-sm opacity-80 mt-1">per person</div>
                </div>

                {/* Quick Details */}
                <div className="p-6 space-y-4">
                    {duration && (
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                                <span className="material-icons text-orange-500">schedule</span>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500 uppercase">Duration</div>
                                <div className="font-semibold text-gray-900">{duration}</div>
                            </div>
                        </div>
                    )}

                    {groupSize && (
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                <span className="material-icons text-blue-500">groups</span>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500 uppercase">Group Size</div>
                                <div className="font-semibold text-gray-900">{groupSize}</div>
                            </div>
                        </div>
                    )}

                    {datesDetail && (
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                                <span className="material-icons text-green-500">event</span>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500 uppercase">Departure</div>
                                <div className="font-semibold text-gray-900">{datesDetail}</div>
                            </div>
                        </div>
                    )}

                    {tourCodeDetail && (
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                                <span className="material-icons text-purple-500">confirmation_number</span>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500 uppercase">Tour Code</div>
                                <div className="font-semibold text-gray-900">{tourCodeDetail}</div>
                            </div>
                        </div>
                    )}

                    {/* Categories */}
                    {categories.length > 0 && (
                        <div className="pt-4 border-t border-gray-100">
                            <div className="flex flex-wrap gap-2">
                                {categories.map((cat) => (
                                    <span
                                        key={cat.id}
                                        className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full"
                                    >
                                        {cat.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* CTA Buttons */}
                <div className="p-6 pt-0 space-y-3">
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="w-full px-6 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-orange-200/50 transition-all flex items-center justify-center gap-2"
                    >
                        <span className="material-icons">mail</span>
                        {showForm ? 'Hide Form' : 'Send Inquiry'}
                    </button>

                    <a
                        href="tel:+17789456000"
                        className="w-full px-6 py-4 bg-gray-100 text-gray-800 font-bold rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                    >
                        <span className="material-icons">call</span>
                        +1 (778) 945-6000
                    </a>

                    {pdfUrl && (
                        <a
                            href={pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full px-6 py-3 border-2 border-orange-500 text-orange-500 font-semibold rounded-xl hover:bg-orange-50 transition-all flex items-center justify-center gap-2"
                        >
                            <span className="material-icons">picture_as_pdf</span>
                            Download Itinerary
                        </a>
                    )}
                </div>
            </div>

            {/* Inquiry Form (Expandable) */}
            {showForm && (
                <div id="inquiry-form" className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100 animate-fadeIn">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="material-icons text-orange-500">edit_note</span>
                        Send Inquiry
                    </h3>
                    <TourInquiryForm
                        tourId={tourId}
                        tourTitle={tourTitle}
                        tourCode={tourCodeDetail}
                        onSuccess={() => {
                            // Optionally close form after success
                        }}
                    />
                </div>
            )}

            {/* Trust Badges */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                        <span className="material-icons text-green-500 text-lg">verified</span>
                        Best Price Guarantee
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                        <span className="material-icons text-green-500 text-lg">support_agent</span>
                        24/7 Customer Support
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                        <span className="material-icons text-green-500 text-lg">credit_score</span>
                        Secure Payment
                    </div>
                </div>
            </div>
        </div>
    );
}
