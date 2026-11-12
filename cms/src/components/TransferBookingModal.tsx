/**
 * TransferBookingModal - Quick booking modal for 11-seater transfers
 */

import { useState } from 'react';

interface TransferBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    route?: {
        from: string;
        to: string;
        price: string;
    };
}

export default function TransferBookingModal({ isOpen, onClose, route }: TransferBookingModalProps) {
    const [vehicle, setVehicle] = useState('11-seater');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Simulate form submission
        await new Promise(resolve => setTimeout(resolve, 1000));

        setIsSubmitting(false);
        setSubmitted(true);

        // Close modal after 2 seconds
        setTimeout(() => {
            onClose();
            setSubmitted(false);
        }, 2000);
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                <div
                    className="bg-white rounded-2xl shadow-2xl max-w-lg w-full pointer-events-auto transform transition-all"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 rounded-t-2xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                    <span className="material-icons text-white text-2xl">directions_car</span>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Quick Booking</h3>
                                    <p className="text-white/80 text-sm">11-Seater Transfer</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 flex items-center justify-center hover:bg-white/20 rounded-full transition-colors"
                            >
                                <span className="material-icons text-white">close</span>
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {submitted ? (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="material-icons text-green-600 text-3xl">check_circle</span>
                                </div>
                                <h4 className="text-xl font-bold text-gray-900 mb-2">Request Sent!</h4>
                                <p className="text-gray-600">We'll contact you shortly with a quote.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Route Info */}
                                {route && (
                                    <div className="bg-gray-50 rounded-xl p-4 mb-4">
                                        <div className="flex items-center gap-3 text-sm">
                                            <div className="flex-1">
                                                <div className="font-semibold text-gray-900">{route.from}</div>
                                                <div className="text-orange-500 font-bold my-1">↓</div>
                                                <div className="font-semibold text-gray-900">{route.to}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-2xl font-bold text-gray-900">${route.price}</div>
                                                <div className="text-xs text-gray-500">per vehicle</div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Vehicle Selection */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Vehicle Type
                                    </label>
                                    <select
                                        value={vehicle}
                                        onChange={(e) => setVehicle(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                                    >
                                        <option value="11-seater">11-Seater (Recommended)</option>
                                        <option value="14-seater">14-Seater</option>
                                        <option value="7-seater">7-Seater</option>
                                    </select>
                                </div>

                                {/* Name */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Full Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                                        placeholder="John Doe"
                                    />
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Email *
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                                        placeholder="john@example.com"
                                    />
                                </div>

                                {/* Phone */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Phone *
                                    </label>
                                    <input
                                        type="tel"
                                        required
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                                        placeholder="+1 (555) 123-4567"
                                    />
                                </div>

                                {/* Date */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Travel Date *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                                    />
                                </div>

                                {/* Passengers */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Number of Passengers *
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="14"
                                        required
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                                        placeholder="4"
                                    />
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <span className="material-icons animate-spin">sync</span>
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-icons">send</span>
                                            Request Quote
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
