/**
 * VisaInquiryForm - React component for Astro
 * 
 * Interactive form for China visa inquiries.
 * Submits to WordPress Contact Form 7.
 */

import { useState } from 'react';
import { submitVisaInquiryForm, type VisaInquiryFormData, type CF7Response } from '../../lib/contact-form';

const VISA_TYPES = [
    { value: 'Tourist Visa', label: 'Tourist Visa' },
    { value: 'Business Visa', label: 'Business Visa' },
    { value: 'Work Visa', label: 'Work Visa' },
    { value: 'Student Visa', label: 'Student Visa' },
    { value: 'Transit Visa', label: 'Transit Visa' },
    { value: 'Other', label: 'Other' },
];

interface VisaInquiryFormProps {
    className?: string;
    onSuccess?: () => void;
}

export default function VisaInquiryForm({ className, onSuccess }: VisaInquiryFormProps) {
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
            newErrors.name = 'Name is required';
        }
        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }
        if (!formData.phone.trim()) {
            newErrors.phone = 'Phone number is required';
        }
        if (!formData.destination.trim()) {
            newErrors.destination = 'Destination country is required';
        }
        if (!formData.nationality.trim()) {
            newErrors.nationality = 'Nationality is required';
        }
        if (!formData.visaType) {
            newErrors.visaType = 'Visa type is required';
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
                for (const field of response.invalid_fields) {
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
    const labelClasses = "text-sm font-medium text-gray-600 mb-1";

    return (
        <form onSubmit={handleSubmit} className={`flex flex-col gap-4 w-full ${className || ''}`}>
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
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Phone Number*"
                    className={`${inputClasses} ${errors.phone ? inputErrorClasses : ''}`}
                    disabled={isSubmitting}
                />
                {errors.phone && <span className={errorTextClasses}>{errors.phone}</span>}
            </div>

            <div className="flex flex-col gap-1">
                <input
                    type="text"
                    name="destination"
                    value={formData.destination}
                    onChange={handleChange}
                    placeholder="Destination Country*"
                    className={`${inputClasses} ${errors.destination ? inputErrorClasses : ''}`}
                    disabled={isSubmitting}
                />
                {errors.destination && <span className={errorTextClasses}>{errors.destination}</span>}
            </div>

            <div className="flex flex-col gap-1">
                <input
                    type="text"
                    name="nationality"
                    value={formData.nationality}
                    onChange={handleChange}
                    placeholder="Nationality / Passport Country*"
                    className={`${inputClasses} ${errors.nationality ? inputErrorClasses : ''}`}
                    disabled={isSubmitting}
                />
                {errors.nationality && <span className={errorTextClasses}>{errors.nationality}</span>}
            </div>

            <div className="flex flex-col gap-1">
                <label className={labelClasses}>Visa Type*</label>
                <select
                    name="visaType"
                    value={formData.visaType}
                    onChange={handleChange}
                    className={`${inputClasses} appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E")] bg-no-repeat bg-[right_1rem_center] pr-10 cursor-pointer ${errors.visaType ? inputErrorClasses : ''}`}
                    disabled={isSubmitting}
                >
                    {VISA_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                            {type.label}
                        </option>
                    ))}
                </select>
                {errors.visaType && <span className={errorTextClasses}>{errors.visaType}</span>}
            </div>

            <div className="flex flex-col gap-1">
                <label className={labelClasses}>Planned Travel Date</label>
                <input
                    type="date"
                    name="travelDate"
                    value={formData.travelDate}
                    onChange={handleChange}
                    className={inputClasses}
                    disabled={isSubmitting}
                />
            </div>

            <div className="flex flex-col gap-1">
                <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Additional Details (Optional)"
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
                {isSubmitting ? 'Submitting...' : 'Submit Visa Inquiry'}
            </button>
        </form>
    );
}
