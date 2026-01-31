import React, { useState, useEffect } from "react";
import type { WPTour } from "../lib/wordpress/types";

interface TourInquiryModalProps {
    isOpen: boolean;
    onClose: () => void;
    tour: WPTour | null;
    lang: string;
}

export default function TourInquiryModal({
    isOpen,
    onClose,
    tour,
    lang,
}: TourInquiryModalProps) {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        date: "",
        travelers: "2",
        message: "",
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Reset form when modal opens/closes or tour changes
    useEffect(() => {
        if (isOpen) {
            setFormData({
                name: "",
                email: "",
                date: "",
                travelers: "2",
                message: "",
            });
            setIsSuccess(false);
        }
    }, [isOpen, tour]);

    if (!isOpen || !tour) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1500));

        console.log("Inquiry submitted:", {
            tourId: tour.id,
            tourName: tour.title.rendered,
            ...formData,
        });

        setIsSubmitting(false);
        setIsSuccess(true);
    };

    const t = {
        title: lang === "zh" ? "發送咨詢" : "Send Inquiry",
        inquiringAbout: lang === "zh" ? "咨詢項目：" : "Inquiring about:",
        name: lang === "zh" ? "姓名*" : "Full Name*",
        email: lang === "zh" ? "電子郵箱*" : "Email*",
        date: lang === "zh" ? "出發日期*" : "Travel Date*",
        travelers: lang === "zh" ? "人數*" : "Travelers*",
        message: lang === "zh" ? "留言 (選填)" : "Message (Optional)",
        send: lang === "zh" ? "發送咨詢" : "Send Inquiry",
        sending: lang === "zh" ? "發送中..." : "Sending...",
        success: lang === "zh" ? "發送成功！我們會儘快聯繫您。" : "Sent successfully! We will contact you shortly.",
        bestPrice: lang === "zh" ? "最優價格" : "Best Price",
        support: lang === "zh" ? "24/7 支持" : "24/7 Support",
        secure: lang === "zh" ? "安全支付" : "Secure",
        startFrom: lang === "zh" ? "起價" : "Starting from",
        perPerson: lang === "zh" ? "每人" : "per person",
        close: lang === "zh" ? "關閉" : "Close",
    };

    let price = tour.tour_meta?.["tour-price-text"];
    if (!price && tour.tour_meta?.price) {
        price = tour.tour_meta.price;
    }
    const currency = tour.tour_meta?.["tourmaster-tour-currency"] || "USD";

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
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="flex items-center gap-2 mb-6">
                                <span className="material-icons text-orange-500">edit_note</span>
                                <h2 className="text-xl font-bold text-gray-900">{t.title}</h2>
                            </div>

                            {/* Inquiring About Box */}
                            <div className="bg-orange-50 rounded-xl p-4 border border-orange-100 mb-6">
                                <span className="text-sm text-gray-500 block mb-1">{t.inquiringAbout}</span>
                                <h3 className="font-bold text-gray-900 line-clamp-2" dangerouslySetInnerHTML={{ __html: tour.title.rendered }} />
                            </div>

                            <div>
                                <input
                                    type="text"
                                    required
                                    placeholder={t.name}
                                    className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <input
                                    type="email"
                                    required
                                    placeholder={t.email}
                                    className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">{t.date}</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">{t.travelers}</label>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        placeholder="2"
                                        className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all"
                                        value={formData.travelers}
                                        onChange={(e) => setFormData({ ...formData, travelers: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <textarea
                                    rows={3}
                                    placeholder={t.message}
                                    className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all resize-none"
                                    value={formData.message}
                                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-orange-500/30 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
                            >
                                {isSubmitting ? (
                                    <>
                                        <span className="w-5 h-5 border-2 border-white/30 border-b-white rounded-full animate-spin" />
                                        {t.sending}
                                    </>
                                ) : (
                                    <>
                                        <span className="material-icons">send</span>
                                        {t.send}
                                    </>
                                )}
                            </button>
                        </form>
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
