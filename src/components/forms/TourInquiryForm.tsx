/**
 * TourInquiryForm - React component for Astro
 * 
 * Interactive form for tour inquiries.
 * Submits to WordPress Contact Form 7.
 */

import { useState } from 'react';
import { submitTourInquiryForm, type TourInquiryFormData, type CF7Response } from '../../lib/contact-form';

interface TourInquiryFormProps {
    tourId: string | number;
    tourCode?: string;
    tourTitle: string;
    className?: string;
    compact?: boolean;
    hideTourInfo?: boolean;
    hideResult?: boolean;
    onSuccess?: () => void;
    lang?: string;
}

const translations = {
    en: {
        inquiringAbout: "Inquiring about:",
        tourCode: "Tour Code:",
        fullName: "Full Name*",
        email: "Email*",
        phone: "Phone Number*",
        travelDate: "Travel Date*",
        travelers: "Travelers*",
        message: "Message (Optional)",
        sendInquiry: "Send Inquiry",
        sending: "Sending...",
        errors: {
            nameRequired: "Name is required",
            emailRequired: "Email is required",
            emailInvalid: "Please enter a valid email address",
            dateRequired: "Travel date is required",
            travelersRequired: "At least 1 traveler is required",
            unexpected: "Message could not be sent. Please check your connection or try emailing us directly."
        }
    },
    zh: {
        inquiringAbout: "咨詢項目：",
        tourCode: "團號：",
        fullName: "姓名*",
        email: "電子郵箱*",
        phone: "電話號碼*",
        travelDate: "出發日期*",
        travelers: "人數*",
        message: "留言 (選填)",
        sendInquiry: "發送咨詢",
        sending: "發送中...",
        errors: {
            nameRequired: "請輸入姓名",
            emailRequired: "請輸入電子郵箱",
            emailInvalid: "請輸入有效的電子郵箱地址",
            dateRequired: "請選擇出發日期",
            travelersRequired: "至少需要1名旅客",
            unexpected: "無法發送訊息，請檢查網絡連線，或直接透過電子郵件與我們聯絡。"
        }
    }
};

export default function TourInquiryForm({
    tourId,
    tourCode,
    tourTitle,
    className,
    compact = false,
    hideTourInfo = false,
    hideResult = false,
    onSuccess,
    lang = 'en',
}: TourInquiryFormProps) {
    const t = translations[lang as keyof typeof translations] || translations.en;
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        travelDate: '',
        numTravelers: 2,
        message: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<CF7Response | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.name.trim()) {
            newErrors.name = t.errors.nameRequired;
        }
        if (!formData.email.trim()) {
            newErrors.email = t.errors.emailRequired;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = t.errors.emailInvalid;
        }
        if (!formData.travelDate) {
            newErrors.travelDate = t.errors.dateRequired;
        }
        if (formData.numTravelers < 1) {
            newErrors.numTravelers = t.errors.travelersRequired;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value, type } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'number' ? parseInt(value, 10) || 0 : value,
        }));
        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: '' }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);
        setResult(null);

        try {
            const data: TourInquiryFormData = {
                tourId: String(tourId),
                tourCode: tourCode || '',
                tourTitle,
                name: formData.name,
                email: formData.email,
                travelDate: formData.travelDate,
                numTravelers: formData.numTravelers,
                message: tourCode ? `${t.tourCode} ${tourCode}\n${formData.message}` : formData.message,
            };

            const response = await submitTourInquiryForm(data);

            // Translate common CF7 English messages to Chinese if needed
            if (lang === 'zh' && response.message) {
                if (response.message.includes("One or more fields have an error")) {
                    response.message = "內容輸入有誤，請檢查後重試。";
                } else if (response.message.includes("Thank you for your message")) {
                    response.message = "感謝您的咨詢，我們將儘快聯絡您。";
                }
            }

            setResult(response);

            if (response.status === 'mail_sent') {
                setFormData({
                    name: '',
                    email: '',
                    travelDate: '',
                    numTravelers: 2,
                    message: '',
                });
                onSuccess?.();
            } else if (response.status === 'validation_failed' && response.invalid_fields) {
                const serverErrors: Record<string, string> = {};

                // Safely handle both Array (new plugin version) and Object (old plugin version) formats
                const fieldsForLoop = Array.isArray(response.invalid_fields)
                    ? response.invalid_fields
                    : Object.entries(response.invalid_fields).map(([key, value]) => ({
                        field: key,
                        message: typeof value === 'string' ? value : (value as any).reason || '',
                    }));

                for (const field of fieldsForLoop) {
                    const fieldMap: Record<string, string> = {
                        'your-name': 'name',
                        'your-email': 'email',
                        'your-phone': 'phone',
                        'travel-date': 'travelDate',
                        'num-travelers': 'numTravelers',
                        'your-message': 'message',
                    };
                    const fieldName = fieldMap[field.field] || field.field;
                    serverErrors[fieldName] = field.message;
                }
                setErrors(serverErrors);
            }
        } catch (error) {
            setResult({
                status: 'mail_failed',
                message: t.errors.unexpected,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const today = new Date().toISOString().split('T')[0];

    const inputClasses = compact
        ? "w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg transition-all duration-200 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 disabled:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
        : "w-full px-4 py-3 text-base text-gray-900 bg-white border border-gray-200 rounded-lg transition-all duration-200 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 disabled:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70";
    const inputErrorClasses = "border-red-500 focus:border-red-500 focus:ring-red-500/20";
    const errorTextClasses = "text-xs text-red-600 mt-0.5";
    const labelClasses = compact ? "text-xs font-medium text-gray-700 mb-0.5" : "text-sm font-medium text-gray-700 mb-1";

    return (
        <form onSubmit={handleSubmit} className={`flex flex-col ${compact ? 'gap-2.5' : 'gap-4'} ${className || ''}`}>
            {/* Tour info */}
            {!hideTourInfo && (
                <div className={`bg-orange-50 rounded-lg ${compact ? 'p-2' : 'p-3'} border border-orange-100`}>
                    <span className="text-xs text-gray-600">{t.inquiringAbout}</span>
                    <div className={`font-semibold text-gray-900 ${compact ? 'text-xs' : 'text-sm'}`}>{tourTitle}</div>
                    {tourCode && (
                        <span className="text-xs text-orange-600">{t.tourCode} {tourCode}</span>
                    )}
                </div>
            )}

            {!hideResult && result && (
                <div
                    className={`p-4 rounded-lg text-sm ${result.status === 'mail_sent'
                        ? 'bg-green-50 text-green-800 border border-green-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <span className="material-icons text-lg">
                            {result.status === 'mail_sent' ? 'check_circle' : 'error'}
                        </span>
                        {result.message}
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-1">
                <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder={t.fullName}
                    className={`${inputClasses} ${errors.name ? inputErrorClasses : ''}`}
                    disabled={isSubmitting}
                />
                {errors.name && <span className={errorTextClasses}>{errors.name}</span>}
            </div>

            <div className="flex flex-col gap-1">
                <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder={t.email}
                    className={`${inputClasses} ${errors.email ? inputErrorClasses : ''}`}
                    disabled={isSubmitting}
                />
                {errors.email && <span className={errorTextClasses}>{errors.email}</span>}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                    <label className={labelClasses}>{t.travelDate}</label>
                    <input
                        type="date"
                        name="travelDate"
                        value={formData.travelDate}
                        onChange={handleChange}
                        min={today}
                        className={`${inputClasses} ${errors.travelDate ? inputErrorClasses : ''}`}
                        disabled={isSubmitting}
                    />
                    {errors.travelDate && <span className={errorTextClasses}>{errors.travelDate}</span>}
                </div>

                <div className="flex flex-col gap-1">
                    <label className={labelClasses}>{t.travelers}</label>
                    <input
                        type="number"
                        name="numTravelers"
                        value={formData.numTravelers}
                        onChange={handleChange}
                        min={1}
                        max={50}
                        className={`${inputClasses} ${errors.numTravelers ? inputErrorClasses : ''}`}
                        disabled={isSubmitting}
                    />
                    {errors.numTravelers && <span className={errorTextClasses}>{errors.numTravelers}</span>}
                </div>
            </div>

            <div className="flex flex-col gap-1">
                <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder={t.message}
                    rows={3}
                    className={`${inputClasses} resize-none`}
                    disabled={isSubmitting}
                />
            </div>

            <button
                type="submit"
                className={`w-full ${compact ? 'px-4 py-2.5' : 'px-6 py-4'} bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold ${compact ? 'rounded-lg text-sm' : 'rounded-xl'} hover:shadow-lg hover:shadow-orange-200/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                disabled={isSubmitting}
            >
                {isSubmitting ? (
                    <>
                        <span className="material-icons animate-spin text-lg">refresh</span>
                        {t.sending}
                    </>
                ) : (
                    <>
                        <span className="material-icons text-lg">send</span>
                        {t.sendInquiry}
                    </>
                )}
            </button>
        </form>
    );
}
