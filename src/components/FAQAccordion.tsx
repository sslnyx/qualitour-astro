/**
 * FAQAccordion - React component for Astro
 * 
 * Interactive FAQ accordion with categories and expandable items.
 * Uses client:load directive in Astro for client-side interactivity.
 */

import { useState } from 'react';

// FAQ data organized by categories
export const faqCategories = [
    {
        id: 'booking',
        title: 'Booking & Reservations',
        icon: 'calendar_today',
        faqs: [
            {
                question: 'How do I book a tour?',
                answer: `To book a tour with Qualitour, you have several options:
• Contact us by phone at (778) 945-6000 during business hours
• Send us an email at info@qualitour.ca with your tour preferences
• Visit the tour page you're interested in and click the "Book Now" button to submit an inquiry
• Fill out the contact form on our website with your travel dates and group size

Our team will respond within 24-48 hours to confirm availability, provide a quote, and guide you through the booking process.`
            },
            {
                question: 'Can I book a tour for a group?',
                answer: 'Yes! We accommodate group bookings of all sizes. For groups larger than 10 people, we recommend contacting us directly for special rates and customized itineraries. Email us at info@qualitour.ca for group inquiries.'
            },
            {
                question: 'Do I need to print my booking confirmation?',
                answer: 'While a printed confirmation is not required, we recommend having a digital or printed copy of your booking confirmation available on the day of your tour. You can show the confirmation email on your mobile device.'
            },
            {
                question: 'Can I modify my booking after confirmation?',
                answer: 'Yes, modifications are possible depending on availability and how close to the tour date you are. Please contact us as soon as possible if you need to change your booking. Modifications made within 15 days of the tour may be subject to additional fees.'
            },
        ]
    },
    {
        id: 'cancellation',
        title: 'Cancellation & Refunds',
        icon: 'credit_card',
        faqs: [
            {
                question: 'What is your cancellation policy?',
                answer: `Our standard cancellation policy is as follows:
• Cancellations made 45 days or more in advance: USD $100 handling fee per person
• Cancellations made 15-45 days in advance: 50% refund
• Cancellations made within 15 days: Non-refundable
• No-shows are non-refundable

Note: Some tours may have specific cancellation policies. Please check the individual tour page for details.`
            },
            {
                question: "What happens if I don't show up for my tour?",
                answer: 'No-shows are defined as passengers who do not arrive at the designated pick-up point at the scheduled time. In this case, your booking will be cancelled and you will not receive a refund. Please ensure you arrive at least 15 minutes before the scheduled departure time.'
            },
            {
                question: 'What if my tour is cancelled due to weather?',
                answer: 'If a tour must be cancelled due to severe weather or unforeseen circumstances, we will notify you no later than the evening before the tour by email or SMS. In such cases, you will be offered a full refund or the option to reschedule.'
            },
            {
                question: 'How long does it take to receive a refund?',
                answer: 'Refunds are typically processed within 5-10 business days after approval. The refund will be credited to the original payment method used during booking. Credit card refunds may take an additional 3-5 business days to appear on your statement.'
            },
        ]
    },
    {
        id: 'travel',
        title: 'Travel Requirements',
        icon: 'flight',
        faqs: [
            {
                question: 'What age restrictions apply to tours?',
                answer: 'Children under the age of 18 must be accompanied by an adult. Infants (under 2 years) can sit on laps and share existing bedding with adults at no additional charge. Some adventure tours may have specific age requirements - please check individual tour details.'
            },
            {
                question: 'What should I bring on the tour?',
                answer: `We recommend bringing:
• Valid ID or passport
• Comfortable walking shoes
• Weather-appropriate clothing
• Camera
• Sufficient cash for meals, beverages, souvenirs, and tips
• Any necessary medications
• Sunscreen and sunglasses (for outdoor tours)`
            },
            {
                question: 'Is travel insurance included?',
                answer: 'Travel insurance is not included in the tour price. We strongly recommend purchasing comprehensive travel insurance that covers trip cancellation, medical emergencies, and lost luggage before your departure.'
            },
            {
                question: 'What documents do I need for international tours?',
                answer: 'For international tours, you will need a valid passport with at least 6 months validity beyond your travel dates. Some destinations may require a visa. We recommend checking the entry requirements for your destination country well in advance of your trip.'
            },
        ]
    },
    {
        id: 'accessibility',
        title: 'Accessibility & Special Needs',
        icon: 'accessible',
        faqs: [
            {
                question: 'Are your tours wheelchair accessible?',
                answer: "Accessibility varies by tour. Many of our tours involve significant walking and may not be suitable for wheelchair users or those with mobility difficulties. Please contact us before booking to discuss your specific needs, and we'll help you find a suitable tour."
            },
            {
                question: 'Can you accommodate dietary restrictions?',
                answer: 'Yes, we can accommodate most dietary restrictions with advance notice. Please inform us of any dietary requirements (vegetarian, vegan, halal, kosher, allergies, etc.) at the time of booking so we can make appropriate arrangements.'
            },
            {
                question: 'Do you offer tours for travelers with disabilities?',
                answer: 'We strive to make travel accessible for everyone. While some tours may have physical requirements, we offer alternatives and can help you plan a trip that meets your needs. Contact us directly to discuss your requirements.'
            },
        ]
    },
    {
        id: 'payment',
        title: 'Payment & Pricing',
        icon: 'payments',
        faqs: [
            {
                question: 'What payment methods do you accept?',
                answer: 'We accept all major credit cards (Visa, MasterCard, American Express), PayPal, and bank transfers for online bookings. For in-person transactions, we also accept cash (CAD and USD).'
            },
            {
                question: 'What currency are prices listed in?',
                answer: 'Our prices are listed in USD (United States Dollars) unless otherwise specified. For tours in Canada, prices may also be displayed in CAD. The currency will be clearly indicated on each tour page.'
            },
            {
                question: 'Are there any hidden fees?',
                answer: 'All mandatory fees are included in the displayed tour price. However, please note that optional activities, meals not specified in the itinerary, tips for guides/drivers, personal expenses, and travel insurance are not included.'
            },
            {
                question: 'Do I need to bring cash during the tour?',
                answer: 'Yes, we recommend carrying sufficient cash for meals, beverages, souvenirs, and tips. Many convenience stores, local eateries, and small vendors do not accept credit cards. ATMs may not always be readily available at tour destinations.'
            },
        ]
    },
    {
        id: 'accommodation',
        title: 'Accommodation & Transportation',
        icon: 'hotel',
        faqs: [
            {
                question: 'How are room assignments handled on multi-day tours?',
                answer: 'For multi-day tours, room assignments are typically: 2 people share 1 twin room. For groups with an odd number of individuals, 3 people will share a triple room. Single room supplements are available upon request for an additional fee.'
            },
            {
                question: 'What type of transportation is used?',
                answer: 'We use comfortable, air-conditioned coaches or vans depending on the group size. All vehicles are regularly maintained and driven by experienced professionals. For some tours, we may also use boats, gondolas, or local transportation as specified in the itinerary.'
            },
            {
                question: 'Is hotel pickup included?',
                answer: 'Hotel pickup is included for many tours, particularly in major cities. The pickup location and time will be confirmed in your booking email. For some tours, you may need to meet at a central departure point - this will be clearly stated in the tour description.'
            },
            {
                question: 'Can the tour itinerary change?',
                answer: 'Yes, the sequence and duration of stops may be adjusted due to traffic conditions, weather, or other unforeseen circumstances. Our guides will always do their best to ensure you have the best possible experience while keeping your safety as the top priority.'
            },
        ]
    },
];

// Accordion Item Component
function FAQAccordionItem({
    question,
    answer,
    isOpen,
    onToggle
}: {
    question: string;
    answer: string;
    isOpen: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="border-b border-gray-100 last:border-b-0">
            <button
                onClick={onToggle}
                className="w-full py-5 px-4 flex items-center justify-between text-left transition-colors hover:bg-orange-50/50 focus:outline-none rounded-xl group"
            >
                <span className="text-lg font-medium text-gray-900 pr-8 group-hover:text-[#f7941e] transition-colors">{question}</span>
                <span className={`flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[#f7941e] to-[#ff6b35] flex items-center justify-center text-white shadow-lg shadow-orange-200/50 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                    <span className="material-icons text-xl">expand_more</span>
                </span>
            </button>
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="px-4 pb-6 text-gray-600 whitespace-pre-line leading-relaxed">
                    {answer}
                </div>
            </div>
        </div>
    );
}

// Category Section Component
export function FAQCategorySection({ category }: { category: typeof faqCategories[0] }) {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <div id={category.id} className="scroll-mt-32 mb-10">
            {/* Category Header */}
            <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#f7941e] to-[#ff6b35] flex items-center justify-center shadow-lg shadow-orange-200/50">
                    <span className="material-icons text-white text-2xl">{category.icon}</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900">{category.title}</h2>
            </div>
            {/* FAQ Items */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {category.faqs.map((faq, index) => (
                    <FAQAccordionItem
                        key={index}
                        question={faq.question}
                        answer={faq.answer}
                        isOpen={openIndex === index}
                        onToggle={() => setOpenIndex(openIndex === index ? null : index)}
                    />
                ))}
            </div>
        </div>
    );
}

// Quick Jump Links Component
export function FAQQuickLinks() {
    return (
        <div className="flex flex-wrap justify-center gap-3">
            {faqCategories.map((category) => (
                <a
                    key={category.id}
                    href={`#${category.id}`}
                    className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-full px-5 py-2.5 text-sm font-medium transition-all hover:scale-105 border border-white/20"
                >
                    <span className="material-icons text-lg">{category.icon}</span>
                    <span>{category.title}</span>
                </a>
            ))}
        </div>
    );
}

// All Categories Component
export function FAQCategories() {
    return (
        <div className="max-w-4xl mx-auto">
            {faqCategories.map((category) => (
                <FAQCategorySection key={category.id} category={category} />
            ))}
        </div>
    );
}
