/**
 * VisaInquiryForm - React component for Astro
 * 
 * Interactive form for China visa inquiries.
 * Submits to WordPress Contact Form 7.
 */

import { useId, useState } from 'react';
import { submitVisaInquiryForm, type VisaInquiryFormData, type CF7Response } from '../../lib/contact-form';

const VISA_TYPES = [
    { value: 'Tourist Visa (L)', en: 'Tourist Visa (L)', zh: '旅遊簽證（L）' },
    { value: 'Business Visa (M)', en: 'Business Visa (M)', zh: '商務簽證（M）' },
    { value: 'Work Visa (Z)', en: 'Work Visa (Z)', zh: '工作簽證（Z）' },
    { value: 'Student Visa (X)', en: 'Student Visa (X)', zh: '學生簽證（X）' },
    { value: 'Transit Visa (G)', en: 'Transit Visa (G)', zh: '過境簽證（G）' },
    { value: 'Other', en: 'Other', zh: '其他' },
];

const copy = {
    en: { name: 'Full name', email: 'Email address', phone: 'Phone number', destination: 'Destination country', nationality: 'Nationality / passport country', visaType: 'Visa type', travelDate: 'Planned travel date (optional)', message: 'Additional details (optional)', required: 'Required', submit: 'Submit visa inquiry', submitting: 'Submitting…', failed: 'Message could not be sent. Please check your connection or try emailing us directly.' },
    zh: { name: '姓名', email: '電郵地址', phone: '電話號碼', destination: '目的地國家', nationality: '國籍／護照簽發國', visaType: '簽證類別', travelDate: '預計出發日期（選填）', message: '補充資料（選填）', required: '必填', submit: '提交簽證查詢', submitting: '提交中…', failed: '無法發送訊息，請檢查網絡連線，或直接透過電郵與我們聯絡。' },
} as const;

interface VisaInquiryFormProps {
    className?: string;
    onSuccess?: () => void;
    lang?: 'en' | 'zh';
}

export default function VisaInquiryForm({ className, onSuccess, lang = 'en' }: VisaInquiryFormProps) {
    const t = copy[lang];
    const formId = useId();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        destination: '',
        nationality: '',
        visaType: VISA_TYPES[0].value,
        travelDate: '',
        message: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<CF7Response | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.name.trim()) {
            newErrors.name = lang === 'zh' ? '請輸入姓名' : 'Name is required';
        }
        if (!formData.email.trim()) {
            newErrors.email = lang === 'zh' ? '請輸入電郵地址' : 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = lang === 'zh' ? '請輸入有效的電郵地址' : 'Please enter a valid email address';
        }
        if (!formData.phone.trim()) {
            newErrors.phone = lang === 'zh' ? '請輸入電話號碼' : 'Phone number is required';
        }
        if (!formData.destination.trim()) {
            newErrors.destination = lang === 'zh' ? '請輸入目的地國家' : 'Destination country is required';
        }
        if (!formData.nationality.trim()) {
            newErrors.nationality = lang === 'zh' ? '請輸入國籍或護照簽發國' : 'Nationality is required';
        }
        if (!formData.visaType) {
            newErrors.visaType = lang === 'zh' ? '請選擇簽證類別' : 'Visa type is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
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
            const data: VisaInquiryFormData = {
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                destination: formData.destination,
                nationality: formData.nationality,
                visaType: formData.visaType,
                travelDate: formData.travelDate,
                message: formData.message,
            };

            const response = await submitVisaInquiryForm(data);
            setResult(response);

            if (response.status === 'mail_sent') {
                setFormData({
                    name: '',
                    email: '',
                    phone: '',
                    destination: '',
                    nationality: '',
                    visaType: VISA_TYPES[0].value,
                    travelDate: '',
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
                        'destination': 'destination',
                        'nationality': 'nationality',
                        'visa-type': 'visaType',
                        'travel-date': 'travelDate',
                        'your-message': 'message',
                    };
                    const fieldName = fieldMap[field.field] || field.field;
                    serverErrors[fieldName] = lang === 'zh' ? '請檢查此欄位後重試。' : field.message;
                }
                setErrors(serverErrors);
            }
        } catch (error) {
            setResult({
                status: 'mail_failed',
                message: t.failed,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputClasses = "w-full px-4 py-3.5 text-base text-gray-900 bg-white border border-gray-200 rounded-lg transition-all duration-200 focus:outline-none focus:border-[#f7941e] focus:ring-2 focus:ring-[#f7941e]/20 disabled:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70";
    const inputErrorClasses = "border-red-500 focus:border-red-500 focus:ring-red-500/20";
    const errorTextClasses = "text-sm text-red-600 mt-1";
    const labelClasses = "text-sm font-medium text-gray-600 mb-1";

    return (
        <form method="post" noValidate onSubmit={handleSubmit} className={`flex flex-col gap-4 w-full ${className || ''}`}>
            {result && (
                <div
                    className={`p-4 rounded-lg text-sm leading-relaxed ${result.status === 'mail_sent'
                        ? 'bg-green-50 text-green-800 border border-green-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                        }`}
                >
                    <span role={result.status === 'mail_sent' ? 'status' : 'alert'} aria-live="polite">{result.status === 'mail_sent' && lang === 'zh' ? '謝謝，您的簽證查詢已提交。' : result.message}</span>
                </div>
            )}

            <div className="flex flex-col gap-1">
                <label htmlFor={`${formId}-name`} className={labelClasses}>{t.name} <span className="text-red-700">({t.required})</span></label><input
                    id={`${formId}-name`}
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder={t.name} required aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? `${formId}-name-error` : undefined}
                    className={`${inputClasses} ${errors.name ? inputErrorClasses : ''}`}
                    disabled={isSubmitting}
                />
                {errors.name && <span id={`${formId}-name-error`} role="alert" className={errorTextClasses}>{errors.name}</span>}
            </div>

            <div className="flex flex-col gap-1">
                <label htmlFor={`${formId}-email`} className={labelClasses}>{t.email} <span className="text-red-700">({t.required})</span></label><input
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
                <label htmlFor={`${formId}-phone`} className={labelClasses}>{t.phone} <span className="text-red-700">({t.required})</span></label><input
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

            <div className="flex flex-col gap-1">
                <label htmlFor={`${formId}-destination`} className={labelClasses}>{t.destination} <span className="text-red-700">({t.required})</span></label><input
                    id={`${formId}-destination`}
                    type="text"
                    name="destination"
                    value={formData.destination}
                    onChange={handleChange}
                    placeholder={t.destination} required aria-invalid={Boolean(errors.destination)} aria-describedby={errors.destination ? `${formId}-destination-error` : undefined}
                    className={`${inputClasses} ${errors.destination ? inputErrorClasses : ''}`}
                    disabled={isSubmitting}
                />
                {errors.destination && <span id={`${formId}-destination-error`} role="alert" className={errorTextClasses}>{errors.destination}</span>}
            </div>

            <div className="flex flex-col gap-1">
                <label htmlFor={`${formId}-nationality`} className={labelClasses}>{t.nationality} <span className="text-red-700">({t.required})</span></label><input
                    id={`${formId}-nationality`}
                    type="text"
                    name="nationality"
                    value={formData.nationality}
                    onChange={handleChange}
                    placeholder={t.nationality} required aria-invalid={Boolean(errors.nationality)} aria-describedby={errors.nationality ? `${formId}-nationality-error` : undefined}
                    className={`${inputClasses} ${errors.nationality ? inputErrorClasses : ''}`}
                    disabled={isSubmitting}
                />
                {errors.nationality && <span id={`${formId}-nationality-error`} role="alert" className={errorTextClasses}>{errors.nationality}</span>}
            </div>

            <div className="flex flex-col gap-1">
                <label htmlFor={`${formId}-visa-type`} className={labelClasses}>{t.visaType} <span className="text-red-700">({t.required})</span></label>
                <select
                    id={`${formId}-visa-type`} name="visaType" required aria-invalid={Boolean(errors.visaType)} aria-describedby={errors.visaType ? `${formId}-visa-type-error` : undefined}
                    value={formData.visaType}
                    onChange={handleChange}
                    className={`${inputClasses} appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E")] bg-no-repeat bg-[right_1rem_center] pr-10 cursor-pointer ${errors.visaType ? inputErrorClasses : ''}`}
                    disabled={isSubmitting}
                >
                    {VISA_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                            {type[lang]}
                        </option>
                    ))}
                </select>
                {errors.visaType && <span id={`${formId}-visa-type-error`} role="alert" className={errorTextClasses}>{errors.visaType}</span>}
            </div>

            <div className="flex flex-col gap-1">
                <label htmlFor={`${formId}-travel-date`} className={labelClasses}>{t.travelDate}</label>
                <input
                    type="date"
                    id={`${formId}-travel-date`} name="travelDate"
                    value={formData.travelDate}
                    onChange={handleChange}
                    onClick={(e) => (e.target as any).showPicker?.()}
                    className={inputClasses}
                    disabled={isSubmitting}
                />
            </div>

            <div className="flex flex-col gap-1">
                <label htmlFor={`${formId}-message`} className={labelClasses}>{t.message}</label><textarea
                    id={`${formId}-message`}
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder={t.message}
                    rows={4}
                    className={`${inputClasses} resize-y min-h-[100px]`}
                    disabled={isSubmitting}
                />
            </div>

            <button
                type="submit"
                className="mt-2 px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-[#f7941e] to-[#d67a1a] rounded-lg uppercase tracking-wide transition-all duration-200 hover:translate-y-[-2px] hover:shadow-lg hover:shadow-orange-500/30 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                disabled={isSubmitting}
            >
                {isSubmitting ? t.submitting : t.submit}
            </button>
        </form>
    );
}
