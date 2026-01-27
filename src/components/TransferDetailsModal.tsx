/**
 * TransferDetailsModal - Modal showing activity details
 * 
 * Now uses cached data from build time (no runtime API fetch).
 * Displays activity name, description, price, and inclusions.
 */

import { useEffect } from 'react';
import type { TransferVehicle } from '../lib/zaui/zaui';

interface TransferDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    activity?: TransferVehicle;
    lang: 'en' | 'zh';
}

export default function TransferDetailsModal({
    isOpen,
    onClose,
    activity,
    lang,
}: TransferDetailsModalProps) {

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
        title: lang === 'zh' ? '行程详情' : 'Transfer Details',
        close: lang === 'zh' ? '关闭' : 'Close',
        price: lang === 'zh' ? '价格' : 'Price',
        perVehicle: lang === 'zh' ? '每车' : 'per vehicle',
        includes: lang === 'zh' ? '包含' : 'Includes',
        noData: lang === 'zh' ? '暂无详情' : 'No details available',
    };

    // Get details from cached data
    const details = activity?.details;
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
                                <h2 className="text-xl font-bold text-white">{t.title}</h2>
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
                    <div className="p-6 overflow-y-auto flex-1">
                        {!details ? (
                            <div className="text-center py-12 text-gray-500">
                                <span className="material-icons text-4xl">info_outline</span>
                                <p className="mt-2">{t.noData}</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
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
                                            src={details.imageUrl}
                                            alt={details.activityName}
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
                                                {price}
                                            </span>
                                            <span className="text-gray-500">{t.perVehicle}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Description */}
                                {details.description && (
                                    <div className="prose prose-gray max-w-none">
                                        <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                                            {details.description.replace(/&#39;/g, "'")}
                                        </p>
                                    </div>
                                )}

                                {/* What's Included */}
                                <div>
                                    <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                                        <span className="material-icons text-green-500">check_circle</span>
                                        {t.includes}
                                    </h4>
                                    <ul className="space-y-2 text-gray-600">
                                        <li className="flex items-center gap-2">
                                            <span className="material-icons text-green-500 text-sm">check</span>
                                            {lang === 'zh' ? '专业司机' : 'Professional driver'}
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <span className="material-icons text-green-500 text-sm">check</span>
                                            {lang === 'zh' ? '门到门服务' : 'Door-to-door service'}
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <span className="material-icons text-green-500 text-sm">check</span>
                                            {lang === 'zh' ? '航班追踪' : 'Flight tracking'}
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <span className="material-icons text-green-500 text-sm">check</span>
                                            {lang === 'zh' ? '行李空间' : 'Luggage space'}
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <span className="material-icons text-green-500 text-sm">check</span>
                                            {lang === 'zh' ? '含税费' : 'All taxes included'}
                                        </li>
                                    </ul>
                                </div>
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
