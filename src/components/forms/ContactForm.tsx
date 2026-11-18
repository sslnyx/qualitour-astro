/**
 * Contact form backed by the existing WordPress Contact Form 7 endpoint.
 */

import { useId, useState } from 'react';
import { submitContactForm, type ContactFormData, type CF7Response } from '../../lib/contact-form';

const copy = {
    en: {
        name: 'Full name', email: 'Email address', subject: 'Subject', message: 'Message', required: 'Required',
        submit: 'Send message', sending: 'Sending…', nameRequired: 'Name is required', emailRequired: 'Email is required',
        emailInvalid: 'Please enter a valid email address', subjectRequired: 'Subject is required', messageRequired: 'Message is required',
        failed: 'Message could not be sent. Please check your connection or try emailing us directly.', sent: 'Thank you. Your message has been sent.', invalid: 'Please review the highlighted fields.',
    },
    zh: {
        name: '姓名', email: '電郵地址', subject: '主旨', message: '訊息內容', required: '必填',
        submit: '發送訊息', sending: '發送中…', nameRequired: '請輸入姓名', emailRequired: '請輸入電郵地址',
        emailInvalid: '請輸入有效的電郵地址', subjectRequired: '請輸入主旨', messageRequired: '請輸入訊息內容',
        failed: '無法發送訊息，請檢查網絡連線，或直接透過電郵與我們聯絡。', sent: '謝謝，您的訊息已發送。', invalid: '請檢查標示的欄位。',
    },
} as const;

interface ContactFormProps {
    className?: string;
    lang?: 'en' | 'zh';
}

export default function ContactForm({ className, lang = 'en' }: ContactFormProps) {
    const t = copy[lang];
    const formId = useId();
    const [formData, setFormData] = useState<ContactFormData>({ name: '', email: '', subject: '', message: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<CF7Response | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateForm = (): boolean => {
        const next: Record<string, string> = {};
        if (!formData.name.trim()) next.name = t.nameRequired;
        if (!formData.email.trim()) next.email = t.emailRequired;
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) next.email = t.emailInvalid;
        if (!formData.subject.trim()) next.subject = t.subjectRequired;
        if (!formData.message.trim()) next.message = t.messageRequired;
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = event.target;
        setFormData((previous) => ({ ...previous, [name]: value }));
        if (errors[name]) setErrors((previous) => ({ ...previous, [name]: '' }));
    };

    const localizeResponse = (response: CF7Response): CF7Response => {
        if (response.status === 'mail_sent') return { ...response, message: t.sent };
        if (response.status === 'validation_failed') return { ...response, message: t.invalid };
        return lang === 'zh' ? { ...response, message: t.failed } : response;
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!validateForm()) return;
        setIsSubmitting(true);
        setResult(null);
        try {
            const response = localizeResponse(await submitContactForm(formData));
            setResult(response);
            if (response.status === 'mail_sent') {
                setFormData({ name: '', email: '', subject: '', message: '' });
            } else if (response.status === 'validation_failed' && response.invalid_fields) {
                const serverErrors: Record<string, string> = {};
                const fields = Array.isArray(response.invalid_fields)
                    ? response.invalid_fields
                    : Object.entries(response.invalid_fields).map(([field, value]) => ({ field, message: typeof value === 'string' ? value : (value as { reason?: string }).reason || '' }));
                for (const field of fields) {
                    const fieldName = field.field.replace('your-', '');
                    serverErrors[fieldName] = lang === 'zh' ? t.invalid : field.message;
                }
                setErrors(serverErrors);
            }
        } catch {
            setResult({ status: 'mail_failed', message: t.failed });
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputClasses = 'w-full px-4 py-3.5 text-base text-gray-900 bg-white border border-gray-300 rounded-lg transition-all duration-200 focus:outline-none focus:border-[#b84e00] focus:ring-2 focus:ring-[#b84e00]/20 disabled:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70';
    const inputErrorClasses = 'border-red-600 focus:border-red-600 focus:ring-red-600/20';
    const errorTextClasses = 'text-sm text-red-700 mt-1';
    const fieldId = (name: string) => `${formId}-${name}`;
    const errorId = (name: string) => `${fieldId(name)}-error`;
    const requiredLabel = (label: string) => <>{label} <span className="text-red-700">({t.required})</span></>;

    return (
        <form method="post" noValidate onSubmit={handleSubmit} className={`flex flex-col gap-4 w-full max-w-xl ${className || ''}`}>
            {result && <div role={result.status === 'mail_sent' ? 'status' : 'alert'} aria-live="polite" className={`p-4 rounded-lg text-sm leading-relaxed ${result.status === 'mail_sent' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>{result.message}</div>}
            {(['name', 'email', 'subject'] as const).map((name) => (
                <div className="flex flex-col gap-1" key={name}>
                    <label htmlFor={fieldId(name)} className="text-sm font-medium text-gray-800">{requiredLabel(t[name])}</label>
                    <input id={fieldId(name)} type={name === 'email' ? 'email' : 'text'} name={name} value={formData[name]} onChange={handleChange} placeholder={t[name]} autoComplete={name === 'name' ? 'name' : name === 'email' ? 'email' : 'off'} required aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? errorId(name) : undefined} className={`${inputClasses} ${errors[name] ? inputErrorClasses : ''}`} disabled={isSubmitting} />
                    {errors[name] && <p id={errorId(name)} role="alert" className={errorTextClasses}>{errors[name]}</p>}
                </div>
            ))}
            <div className="flex flex-col gap-1">
                <label htmlFor={fieldId('message')} className="text-sm font-medium text-gray-800">{requiredLabel(t.message)}</label>
                <textarea id={fieldId('message')} name="message" value={formData.message} onChange={handleChange} placeholder={t.message} rows={5} required aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? errorId('message') : undefined} className={`${inputClasses} resize-y min-h-[120px] ${errors.message ? inputErrorClasses : ''}`} disabled={isSubmitting} />
                {errors.message && <p id={errorId('message')} role="alert" className={errorTextClasses}>{errors.message}</p>}
            </div>
            <button type="submit" className="mt-2 px-8 py-4 text-base font-semibold text-white bg-[#b84e00] rounded-lg uppercase tracking-wide transition-all duration-200 hover:bg-[#963f00] hover:translate-y-[-2px] hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none" disabled={isSubmitting}>{isSubmitting ? t.sending : t.submit}</button>
        </form>
    );
}
