/**
 * ContactForm - React component for Astro
 * 
 * Interactive contact form that submits to WordPress Contact Form 7.
 * Uses client:load directive in Astro for client-side interactivity.
 */

import { useState } from 'react';
import { submitContactForm, type ContactFormData, type CF7Response } from '../../lib/contact-form';

interface ContactFormProps {
    className?: string;
}

export default function ContactForm({ className }: ContactFormProps) {
    const [formData, setFormData] = useState<ContactFormData>({
        name: '',
        email: '',
        subject: '',
        message: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<CF7Response | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Name is required';
        }
        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }
        if (!formData.subject.trim()) {
            newErrors.subject = 'Subject is required';
        }
        if (!formData.message.trim()) {
            newErrors.message = 'Message is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        // Clear error when user starts typing
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
            const response = await submitContactForm(formData);
            setResult(response);

            if (response.status === 'mail_sent') {
                // Reset form on success
                setFormData({
                    name: '',
                    email: '',
                    subject: '',
                    message: '',
                });
            } else if (response.status === 'validation_failed' && response.invalid_fields) {
                // Map server-side validation errors
                const serverErrors: Record<string, string> = {};

                // Safely handle both Array (new plugin version) and Object (old plugin version) formats
                const fieldsForLoop = Array.isArray(response.invalid_fields)
                    ? response.invalid_fields
                    : Object.entries(response.invalid_fields).map(([key, value]) => ({
                        field: key,
                        message: typeof value === 'string' ? value : (value as any).reason || '',
                    }));

                for (const field of fieldsForLoop) {
                    const fieldName = field.field.replace('your-', '');
                    serverErrors[fieldName] = field.message;
                }
                setErrors(serverErrors);
            }
        } catch (error) {
            setResult({
                status: 'mail_failed',
                message: 'An unexpected error occurred. Please try again.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputClasses = "w-full px-4 py-3.5 text-base text-gray-900 bg-white border border-gray-200 rounded-lg transition-all duration-200 focus:outline-none focus:border-[#f7941e] focus:ring-2 focus:ring-[#f7941e]/20 disabled:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70";
    const inputErrorClasses = "border-red-500 focus:border-red-500 focus:ring-red-500/20";
    const errorTextClasses = "text-sm text-red-600 mt-1";

    return (
        <form onSubmit={handleSubmit} className={`flex flex-col gap-4 w-full max-w-xl ${className || ''}`}>
            {result && (
                <div
                    className={`p-4 rounded-lg text-sm leading-relaxed ${result.status === 'mail_sent'
                        ? 'bg-green-50 text-green-800 border border-green-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                        }`}
                >
                    {result.message}
                </div>
            )}

            <div className="flex flex-col gap-1">
                <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Full Name*"
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
                    placeholder="Email*"
                    className={`${inputClasses} ${errors.email ? inputErrorClasses : ''}`}
                    disabled={isSubmitting}
                />
                {errors.email && <span className={errorTextClasses}>{errors.email}</span>}
            </div>

            <div className="flex flex-col gap-1">
                <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    placeholder="Subject*"
                    className={`${inputClasses} ${errors.subject ? inputErrorClasses : ''}`}
                    disabled={isSubmitting}
                />
                {errors.subject && <span className={errorTextClasses}>{errors.subject}</span>}
            </div>

            <div className="flex flex-col gap-1">
                <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Message*"
                    rows={5}
                    className={`${inputClasses} resize-y min-h-[120px] ${errors.message ? inputErrorClasses : ''}`}
                    disabled={isSubmitting}
                />
                {errors.message && <span className={errorTextClasses}>{errors.message}</span>}
            </div>

            <button
                type="submit"
                className="mt-2 px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-[#f7941e] to-[#d67a1a] rounded-lg uppercase tracking-wide transition-all duration-200 hover:translate-y-[-2px] hover:shadow-lg hover:shadow-orange-500/30 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                disabled={isSubmitting}
            >
                {isSubmitting ? 'Sending...' : 'Submit Now'}
            </button>
        </form>
    );
}
