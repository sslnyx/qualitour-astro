/**
 * TourInquiryForm - React component for Astro
 * 
 * Interactive form for tour inquiries.
 * Submits to WordPress Contact Form 7.
 */

import { useState, useEffect, useId } from 'react';
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
        fullName: "Full Name",
        email: "Email address",
        phone: "Phone number",
        travelDate: "Travel date",
        travelers: "Travelers",
        message: "Message (Optional)",
        required: "Required",
        sendInquiry: "Send Inquiry",
        sending: "Sending...",
        errors: {
            nameRequired: "Name is required",
            emailRequired: "Email is required",
            emailInvalid: "Please enter a valid email address",
            phoneRequired: "Phone number is required",
            dateRequired: "Travel date is required",
            travelersRequired: "At least 1 traveler is required",
            unexpected: "Message could not be sent. Please check your connection or try emailing us directly."
        }
    },
    zh: {
        inquiringAbout: "查詢項目：",
        tourCode: "團號：",
        fullName: "姓名",
        email: "電郵地址",
        phone: "電話號碼",
        travelDate: "出發日期",
        travelers: "旅客人數",
        message: "留言（選填）",
        required: "必填",
        sendInquiry: "提交查詢",
        sending: "發送中...",
        errors: {
            nameRequired: "請輸入姓名",
            emailRequired: "請輸入電郵地址",
            emailInvalid: "請輸入有效的電郵地址",
            phoneRequired: "請輸入電話號碼",
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
    const formId = useId();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
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
        if (!formData.phone.trim()) {
            newErrors.phone = t.errors.phoneRequired;
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
                phone: formData.phone,
                travelDate: formData.travelDate,
                numTravelers: formData.numTravelers,
                message: formData.message,
            };

            const response = await submitTourInquiryForm(data);

            // Translate common CF7 English messages to Chinese if needed
            if (lang === 'zh' && response.message) {
                if (response.message.includes("One or more fields have an error")) {
                    response.message = "內容輸入有誤，請檢查後重試。";
                } else if (response.message.includes("Thank you for your message")) {
                    response.message = "感謝您的查詢，我們將儘快聯絡您。";
                }
            }

            setResult(response);

            if (response.status === 'mail_sent') {
                setFormData({
                    name: '',
                    email: '',
                    phone: '',
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
                    if (lang === 'zh') {
                        const chineseErrors: Record<string, string> = {
                            name: t.errors.nameRequired,
                            email: t.errors.emailInvalid,
                            phone: t.errors.phoneRequired,
                            travelDate: t.errors.dateRequired,
                            numTravelers: t.errors.travelersRequired,
                        };
                        serverErrors[fieldName] = chineseErrors[fieldName] || '內容輸入有誤，請檢查後重試。';
                    } else {
                        serverErrors[fieldName] = field.message;
                    }
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

    // Keep SSR and first hydration deterministic, then use the visitor's local day.
    const [today, setToday] = useState<string>();
    useEffect(() => {
        const date = new Date();
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        setToday(date.toISOString().slice(0, 10));
    }, []);

    const inputClasses = compact
        ? "w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg transition-all duration-200 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 disabled:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
        : "w-full px-4 py-3 text-base text-gray-900 bg-white border border-gray-200 rounded-lg transition-all duration-200 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 disabled:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70";
    const inputErrorClasses = "border-red-500 focus:border-red-500 focus:ring-red-500/20";
    const errorTextClasses = "text-xs text-red-600 mt-0.5";
    const labelClasses = compact ? "text-xs font-medium text-gray-700 mb-0.5" : "text-sm font-medium text-gray-700 mb-1";

    return (
        <form method="post" noValidate onSubmit={handleSubmit} className={`flex flex-col ${compact ? 'gap-2.5' : 'gap-4'} ${className || ''}`}>
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
                    role={result.status === 'mail_sent' ? 'status' : 'alert'} aria-live="polite">
                    <div className="flex items-center gap-2">
                        <span className="material-icons text-lg">
                            {result.status === 'mail_sent' ? 'check_circle' : 'error'}
                        </span>
                        {result.message}
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-1">
                <label htmlFor={`${formId}-name`} className={labelClasses}>{t.fullName} <span className="text-red-700">({t.required})</span></label>
                <input
                    id={`${formId}-name`}
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder={t.fullName} required aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? `${formId}-name-error` : undefined}
                    className={`${inputClasses} ${errors.name ? inputErrorClasses : ''}`}
                    disabled={isSubmitting}
                />
                {errors.name && <span id={`${formId}-name-error`} role="alert" className={errorTextClasses}>{errors.name}</span>}
            </div>

            <div className="flex flex-col gap-1">
                <label htmlFor={`${formId}-email`} className={labelClasses}>{t.email} <span className="text-red-700">({t.required})</span></label>
                <input
                    id={`${formId}-email`}
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder={t.email} required aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? `${formId}-email-error` : undefined}
                    className={`${inputClasses} ${errors.email ? inputErrorClasses : ''}`}
                    disabled={isSubmitting}
                />
                {errors.email && <span id={`${formId}-email-error`} role="alert" className={errorTextClasses}>{errors.email}</span>}
            </div>

            <div className="flex flex-col gap-1">
                <label htmlFor={`${formId}-phone`} className={labelClasses}>{t.phone} <span className="text-red-700">({t.required})</span></label>
                <input
                    id={`${formId}-phone`}
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder={t.phone} required aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? `${formId}-phone-error` : undefined}
                    className={`${inputClasses} ${errors.phone ? inputErrorClasses : ''}`}
                    disabled={isSubmitting}
                />
                {errors.phone && <span id={`${formId}-phone-error`} role="alert" className={errorTextClasses}>{errors.phone}</span>}
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-3">
                <div className="flex flex-col gap-1">
                    <label htmlFor={`${formId}-travel-date`} className={labelClasses}>{t.travelDate} <span className="text-red-700">({t.required})</span></label>
                    <input
                        type="date"
                        id={`${formId}-travel-date`} name="travelDate"
                        value={formData.travelDate}
                        onChange={handleChange}
                        onClick={(e) => (e.target as any).showPicker?.()}
                        min={today}
                        required aria-invalid={Boolean(errors.travelDate)} aria-describedby={errors.travelDate ? `${formId}-travel-date-error` : undefined} className={`${inputClasses} ${errors.travelDate ? inputErrorClasses : ''}`}
                        disabled={isSubmitting}
                    />
                    {errors.travelDate && <span id={`${formId}-travel-date-error`} role="alert" className={errorTextClasses}>{errors.travelDate}</span>}
                </div>

                <div className="flex flex-col gap-1">
                    <label htmlFor={`${formId}-travelers`} className={labelClasses}>{t.travelers} <span className="text-red-700">({t.required})</span></label>
                    <input
                        type="number"
                        id={`${formId}-travelers`} name="numTravelers"
                        value={formData.numTravelers}
                        onChange={handleChange}
                        min={1}
                        max={50}
                        required aria-invalid={Boolean(errors.numTravelers)} aria-describedby={errors.numTravelers ? `${formId}-travelers-error` : undefined} className={`${inputClasses} ${errors.numTravelers ? inputErrorClasses : ''}`}
                        disabled={isSubmitting}
                    />
                    {errors.numTravelers && <span id={`${formId}-travelers-error`} role="alert" className={errorTextClasses}>{errors.numTravelers}</span>}
                </div>
            </div>

            <div className="flex flex-col gap-1">
                <label htmlFor={`${formId}-message`} className={labelClasses}>{t.message}</label>
                <textarea
                    id={`${formId}-message`}
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
                className={`w-full ${compact ? 'px-4 py-2.5' : 'px-6 py-4'} bg-[#a8410b] text-white font-bold ${compact ? 'rounded-lg text-sm' : 'rounded-xl'} hover:bg-[#883608] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a8410b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                disabled={isSubmitting}
            >
                {isSubmitting ? (
                    <>
                        <span className="material-icons animate-spin text-lg" aria-hidden="true">refresh</span>
                        {t.sending}
                    </>
                ) : (
                    <>
                        <span className="material-icons text-lg" aria-hidden="true">send</span>
                        {t.sendInquiry}
                    </>
                )}
            </button>
        </form>
    );
}
