/**
 * TransferRouteCard - React component for transfer route cards
 * 
 * Features:
 * - Toggle direction button (swaps from/to)
 * - Dynamic pricing display
 * - Vehicle size options (11-seater, 14-seater)
 * - Details modal trigger
 * - Booking buttons (open Zaui iframe)
 */

import { useState } from 'react';
import type { TransferRoute } from '../lib/zaui/zaui';

interface TransferRouteCardProps {
    route: TransferRoute;
    lang: 'en' | 'zh';
    localePrefix: string;
    onDetailsClick?: (activityId: string) => void;
}

export default function TransferRouteCard({
    route,
    lang,
    localePrefix,
    onDetailsClick,
}: TransferRouteCardProps) {
    const [isReversed, setIsReversed] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedVehicle, setSelectedVehicle] = useState<{ activityId: string; seater: string } | null>(null);

    // Get current direction's data
    const vehicles = isReversed ? route.reverseActivityIds : route.vehicles;
    const fromLocation = isReversed ? route.toLocation : route.fromLocation;
    const toLocation = isReversed ? route.fromLocation : route.toLocation;

    // Get the lowest price for display
    const lowestPrice = vehicles?.reduce((min, v) => {
        const price = parseFloat(v.price.replace(/[^0-9.]/g, ''));
        return price < min ? price : min;
    }, Infinity) || 0;

    const hasMultipleVehicles = vehicles && vehicles.length > 1;
    const hasReverseDirection = route.reverseActivityIds && route.reverseActivityIds.length > 0;

    const t = {
        from: lang === 'zh' ? '从' : 'From',
        perVehicle: lang === 'zh' ? '每车' : 'per vehicle',
        details: lang === 'zh' ? '详情' : 'Details',
        book: lang === 'zh' ? '预订' : 'Book',
        seater: lang === 'zh' ? '座' : '-seater',
        swapDirection: lang === 'zh' ? '切换方向' : 'Swap direction',
    };

    const handleToggleDirection = () => {
        if (hasReverseDirection) {
            setIsReversed(!isReversed);
        }
    };

    const handleBookClick = (vehicle: { activityId: string; seater: string }) => {
        setSelectedVehicle(vehicle);
        setIsModalOpen(true);
    };

    const getBookingUrl = (activityId: string): string => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        return `https://qualitour.zaui.net/booking/web/#/default/activity/${activityId}?date=${dateStr}`;
    };

    return (
        <>
            <div className="group relative bg-white rounded-2xl border border-gray-200 p-6 hover:border-[#f7941e]/50 hover:shadow-xl transition-all duration-300 overflow-hidden">
                {/* Decorative corner */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-[#f7941e]/10 to-transparent rounded-bl-full" />

                {/* Toggle Direction Button */}
                {hasReverseDirection && (
                    <button
                        onClick={handleToggleDirection}
                        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-[#f7941e] hover:text-white rounded-full transition-all duration-300 z-10"
                        title={t.swapDirection}
                    >
                        <span className="material-icons text-lg">swap_vert</span>
                    </button>
                )}

                {/* Route Icon */}
                <div className="w-14 h-14 bg-gradient-to-br from-[#f7941e]/10 to-orange-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <span className="material-icons text-[#f7941e] text-2xl">airport_shuttle</span>
                </div>

                {/* Route Display */}
                <div className="mb-4">
                    <div className="font-bold text-gray-900 text-lg leading-relaxed">
                        {fromLocation}
                    </div>
                    <div className="text-[#f7941e] font-bold my-1 flex items-center gap-2">
                        <span className="material-icons text-sm">arrow_downward</span>
                    </div>
                    <div className="font-bold text-gray-900 text-lg">
                        {toLocation}
                    </div>
                </div>

                {/* Price Display */}
                <div className="mb-4">
                    {lowestPrice > 0 && lowestPrice !== Infinity ? (
                        <div className="flex items-baseline gap-1">
                            <span className="text-sm text-gray-500">{t.from}</span>
                            <span className="text-3xl font-bold text-gray-900">
                                ${lowestPrice.toFixed(0)}
                            </span>
                            <span className="text-gray-500 text-sm">{t.perVehicle}</span>
                        </div>
                    ) : (
                        <div className="text-gray-500">{lang === 'zh' ? '请联系询价' : 'Contact for price'}</div>
                    )}
                </div>

                {/* Details Button */}
                <button
                    onClick={() => onDetailsClick?.(vehicles?.[0]?.activityId || '')}
                    className="w-full mb-4 px-4 py-2 text-[#f7941e] border border-[#f7941e] rounded-lg hover:bg-[#f7941e] hover:text-white transition-all duration-300 flex items-center justify-center gap-2"
                >
                    <span className="material-icons text-lg">info</span>
                    {t.details}
                </button>

                {/* Vehicle/Booking Buttons */}
                <div className="flex flex-wrap gap-2">
                    {vehicles?.map((vehicle) => (
                        <button
                            key={vehicle.activityId}
                            onClick={() => handleBookClick(vehicle)}
                            className="flex-1 min-w-[100px] px-4 py-2 bg-gradient-to-r from-[#f7941e] to-[#ff6b35] text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-300"
                        >
                            {vehicle.seater}{t.seater}
                            {hasMultipleVehicles && (
                                <span className="block text-xs opacity-80">
                                    {vehicle.price}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Booking Modal (Zaui iframe) */}
            {isModalOpen && selectedVehicle && (
                <div className="fixed inset-0 z-50">
                    <div
                        className="absolute inset-0 bg-black/50"
                        onClick={() => setIsModalOpen(false)}
                    />
                    <div className="absolute inset-0 flex items-center justify-center p-4">
                        <div
                            className="w-full max-w-5xl bg-white rounded-lg shadow-xl overflow-hidden border border-gray-200"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-200">
                                <div className="min-w-0">
                                    <h2 className="text-lg font-bold text-gray-900 truncate">
                                        {lang === 'zh' ? '预订' : 'Booking'}
                                    </h2>
                                    <p className="text-sm text-gray-500">
                                        {fromLocation} → {toLocation} ({selectedVehicle.seater}{t.seater})
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <a
                                        href={getBookingUrl(selectedVehicle.activityId)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-2 rounded-md bg-[#f7941e] hover:bg-[#e68a1c] text-white font-semibold transition-colors"
                                    >
                                        {lang === 'zh' ? '新窗口打开' : 'Open in new tab'}
                                    </a>
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-50 text-gray-900 font-semibold transition-colors"
                                    >
                                        {lang === 'zh' ? '关闭' : 'Close'}
                                    </button>
                                </div>
                            </div>
                            <div className="bg-gray-50">
                                <iframe
                                    title={lang === 'zh' ? 'Zaui 预订' : 'Zaui booking'}
                                    src={getBookingUrl(selectedVehicle.activityId)}
                                    className="w-full"
                                    style={{ height: '80vh' }}
                                    sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation-by-user-activation"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
