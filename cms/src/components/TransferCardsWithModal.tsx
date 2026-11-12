/**
 * TransferCardsWithModal - Client component for transfer cards with booking modal
 */

import { useState } from 'react';
import TransferBookingModal from './TransferBookingModal';

interface TransferRoute {
    from: string;
    to: string;
    price: string;
    icon: string;
}

interface TransferCardsWithModalProps {
    routes: TransferRoute[];
    localePrefix: string;
    bookNowText: string;
    perVehicleText: string;
}

export default function TransferCardsWithModal({
    routes,
    localePrefix,
    bookNowText,
    perVehicleText
}: TransferCardsWithModalProps) {
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedRoute, setSelectedRoute] = useState<TransferRoute | undefined>();

    const handleBookNow = (route: TransferRoute) => {
        setSelectedRoute(route);
        setModalOpen(true);
    };

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {routes.map((route, index) => (
                    <div
                        key={index}
                        className="group relative bg-white rounded-2xl border border-gray-200 p-6 hover:border-orange-300 hover:shadow-xl transition-all duration-300 overflow-hidden"
                    >
                        {/* Decorative corner */}
                        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-orange-100 to-transparent rounded-bl-full"></div>

                        {/* Icon */}
                        <div className="w-14 h-14 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <span className="material-icons text-orange-500 text-2xl">{route.icon}</span>
                        </div>

                        {/* Route */}
                        <div className="mb-4">
                            <div className="font-bold text-gray-900 text-lg leading-relaxed">
                                {route.from}
                            </div>
                            <div className="text-orange-500 font-bold my-1">→</div>
                            <div className="font-bold text-gray-900 text-lg">
                                {route.to}
                            </div>
                        </div>

                        {/* Price */}
                        <div className="mb-6">
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-bold text-gray-900">${route.price}</span>
                                <span className="text-gray-500 text-sm">{perVehicleText}</span>
                            </div>
                            <div className="text-xs text-orange-600 font-semibold mt-1">11-Seater Available</div>
                        </div>

                        {/* Booking button */}
                        <button
                            onClick={() => handleBookNow(route)}
                            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl hover:shadow-lg transition-all"
                        >
                            <span className="material-icons">event_available</span>
                            {bookNowText}
                        </button>
                    </div>
                ))}
            </div>

            {/* Booking Modal */}
            <TransferBookingModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                route={selectedRoute}
            />
        </>
    );
}
