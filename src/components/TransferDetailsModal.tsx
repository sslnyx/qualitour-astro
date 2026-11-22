/**
 * TransferDetailsModal - Modal showing activity details
 * 
 * Uses the saved Zaui snapshot as a fallback for the website details managed in PT Admin.
 */

import { useEffect, useId, useState } from 'react';
import { resolveTransferWebsiteDetails } from '../lib/booking/transfer-website-details';
import type { TransferVehicle } from '../lib/zaui/zaui';
import { getCfTransformUrl, wpUrl } from '../lib/wp-url';

interface TransferDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    activity?: TransferVehicle;
    variants?: TransferVehicle[];
    onSelectActivity: (activityId: string) => void;
    lang: 'en' | 'zh';
}

export default function TransferDetailsModal({
    isOpen,
    onClose,
    activity,
    variants,
    onSelectActivity,
    lang,
}: TransferDetailsModalProps) {
    const titleId = useId();
    const activityId = activity?.activityId;
    const [saved, setSaved] = useState<{ activityId: string; value: unknown }>();

    useEffect(() => {
        if (!isOpen || !activityId || !/^[0-9]{1,12}$/.test(activityId)) return;
        const controller = new AbortController();
        void fetch(`/api/transfer/details/${activityId}`, {
            credentials: 'omit',
            signal: controller.signal,
            headers: { Accept: 'application/json' },
        }).then(response => response.ok ? response.json() : null).then(value => {
            if (!controller.signal.aborted) setSaved({ activityId, value });
        }).catch(() => {});
        return () => controller.abort();
    }, [isOpen, activityId]);

    // Handle escape key and body scroll lock
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const t = {
        title: lang === 'zh' ? '行程詳情' : 'Transfer Details',
        close: lang === 'zh' ? '關閉' : 'Close',
        price: lang === 'zh' ? '價格' : 'Price',
        perVehicle: lang === 'zh' ? '每車' : 'per vehicle',
        includes: lang === 'zh' ? '包含' : 'Includes',
        vehicle: lang === 'zh' ? '車型' : 'Vehicle',
        seats: lang === 'zh' ? '座' : ' seats',
        noData: lang === 'zh' ? '暫無詳情' : 'No details available',
    };

    const details = activity && resolveTransferWebsiteDetails(
        activity.details, saved?.activityId === activityId ? saved?.value : null, lang,
    );
    const price = activity?.price;

    return (
        <div className="fixed inset-0 z-50">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={titleId}
                    className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-[#f7941e] to-[#ff6b35] p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                    <span className="material-icons text-white text-2xl">info</span>
                                </div>
                                <h2 id={titleId} className="text-xl font-bold text-white">{t.title}</h2>
                            </div>
                            <button
                                type="button"
                                aria-label={t.close}
                                onClick={onClose}
                                className="w-10 h-10 flex items-center justify-center hover:bg-white/20 rounded-full transition-colors"
                            >
                                <span className="material-icons text-white">close</span>
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto flex-1">
                        {!activity || !details ? (
                            <div className="text-center py-12 text-gray-500">
                                <span className="material-icons text-4xl">info_outline</span>
                                <p className="mt-2">{t.noData}</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {variants && variants.length > 1 && (
                                    <label className="flex items-center flex-wrap gap-2 text-sm text-gray-600">
                                        <span>{t.vehicle}</span>
                                        <select
                                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                                            value={activity.activityId}
                                            onChange={event => onSelectActivity(event.currentTarget.value)}
                                        >
                                            {variants.map(vehicle => (
                                                <option key={vehicle.activityId} value={vehicle.activityId}>
                                                    {vehicle.seater}{t.seats}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                )}
                                {/* Activity Name */}
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900">
                                        {details.activityName}
                                    </h3>
                                </div>

                                {/* Image */}
                                {details.imageUrl && (
                                    <div className="rounded-xl overflow-hidden">
                                        <img
                                            src={getCfTransformUrl(wpUrl(details.imageUrl), { width: 800, height: 400, format: 'webp' })}
                                            alt={details.activityName}
                                            referrerPolicy="no-referrer"
                                            className="w-full h-48 object-cover"
                                        />
                                    </div>
                                )}

                                {/* Price */}
                                {price && (
                                    <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4">
                                        <div className="text-sm text-gray-600 mb-1">{t.price}</div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-4xl font-bold text-[#f7941e]">
                                                {price === 'Contact for price'
                                                    ? (lang === 'zh' ? '請聯絡詢價' : 'Contact for price')
                                                    : new Intl.NumberFormat(lang === 'zh' ? 'zh-Hant' : 'en-CA', {
                                                        style: 'currency', currency: activity.currency, currencyDisplay: 'code',
                                                    }).format(Number(price))}
                                            </span>
                                            <span className="text-gray-500">{t.perVehicle}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">
                                            {lang === 'zh'
                                                ? `參考價（${activity.priceDate}）；最新價格及供應情況請以預訂頁為準。`
                                                : `Reference price (${activity.priceDate}). Confirm current rates and availability when booking.`}
                                        </p>
                                    </div>
                                )}

                                {/* Description */}
                                {details.description && (
                                    <div className="prose prose-gray max-w-none">
                                        <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                                            {details.description}
                                        </p>
                                    </div>
                                )}

                                {details.includes.length > 0 && (
                                    <div>
                                        <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                                            <span className="material-icons text-green-500">check_circle</span>
                                            {t.includes}
                                        </h4>
                                        <ul className="space-y-2 text-gray-600">
                                            {details.includes.map((item, index) => (
                                                <li key={`${index}-${item}`} className="flex items-center gap-2">
                                                    <span className="material-icons text-green-500 text-sm">check</span>
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl transition-colors"
                        >
                            {t.close}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
