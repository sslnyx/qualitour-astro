import { useState } from 'react';

interface FAQItem {
    question: string;
    answer: string;
}

interface FAQCategory {
    id: string;
    title: string;
    icon: string;
    faqs: FAQItem[];
}

// FAQ data organized by categories with translations
export const faqTranslations = {
    en: [
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
    ],
    zh: [
        {
            id: 'booking',
            title: '预订与预约',
            icon: 'calendar_today',
            faqs: [
                {
                    question: '如何预订行程？',
                    answer: `预订 Qualitour 行程有以下几种方式：
• 在办公时间内拨打 (778) 945-6000 与我们联系
• 发送电子邮件至 info@qualitour.ca，说明您的行程偏好
• 访问您感兴趣的行程页面，点击“立即预订”按钮提交咨询
• 填写网站上的联系表格，注明您的旅行日期和团队人数

我们的团队将在 24-48 小时内回复，确认名额、提供报价并指导您完成预订流程。`
                },
                {
                    question: '我可以预订团队行程吗？',
                    answer: '是的！我们受理各种规模的团队预订。对于 10 人以上的团队，我们建议您直接联系我们，以获得优惠价格和定制行程。团队咨询请发送邮件至 info@qualitour.ca。'
                },
                {
                    question: '我需要打印预订确认单吗？',
                    answer: '虽然不强制要求打印确认单，但我们建议在行程当天准备好预订确认的电子版或打印版。您可以在移动设备上出示预订确认邮件。'
                },
                {
                    question: '确认后我可以修改预订吗？',
                    answer: '是的，修改视名额情况以及距离行程日期的时间而定。如果您需要更改预订，请尽快与我们联系。行程前 15 天内进行的修改可能会产生额外费用。'
                },
            ]
        },
        {
            id: 'cancellation',
            title: '取消与退款',
            icon: 'credit_card',
            faqs: [
                {
                    question: '你们的取消政策是什么？',
                    answer: `我们的标准取消政策如下：
• 提前 45 天或以上取消：每人收取 100 美元手续费
• 提前 15-45 天取消：退款 50%
• 15 天内取消：不予退款
• 未按时参加者（No-shows）：不予退款

注：部分行程可能有特定的取消政策。请查看具体行程页面了解详情。`
                },
                {
                    question: "如果我没有按时参加行程会怎样？",
                    answer: '未按时参加（No-shows）定义为未在预定时间到达指定上车点的旅客。在这种情况下，您的预订将被取消，且不予退款。请确保至少在预定出发时间前 15 分米到达。'
                },
                {
                    question: '如果行程因天气原因取消怎么办？',
                    answer: '如果行程因恶劣天气或不可预见的情况必须取消，我们最迟会在行程前一天晚上通过电子邮件或短信通知您。在这种情况下，您可以选择全额退款或重新安排行程。'
                },
                {
                    question: '收到退款需要多长时间？',
                    answer: '退款通常在批准后 5-10 个工作日内处理。退款将退还至预订时使用的原始付款方式。信用卡退款可能需要额外的 3-5 个工作日才能显示在您的账单上。'
                },
            ]
        },
        {
            id: 'travel',
            title: '旅行要求',
            icon: 'flight',
            faqs: [
                {
                    question: '行程有哪些年龄限制？',
                    answer: '18 岁以下的未成年人必须由成年人陪同。婴儿（2 岁以下）可以由成人抱坐，并与成人共用现有寝具，无需额外费用。部分探险行程可能由特定的年龄要求，请查看具体行程详情。'
                },
                {
                    question: '参加行程需要带什么？',
                    answer: `我们建议携带：
• 有效身份证件或护照
• 舒适的步行鞋
• 适合天气的衣物
• 照相机
• 足够的现金用于用餐、饮料、纪念品和小费
• 任何必要的药物
• 防晒霜和太阳镜（户外行程）`
                },
                {
                    question: '包含旅游保险吗？',
                    answer: '行程价格不包含旅游保险。我们强烈建议您在出发前购买全面的旅游保险，涵盖行程取消、医疗急救和行李丢失等项。'
                },
                {
                    question: '国际旅行需要哪些文件？',
                    answer: '对于国际行程，您需要持有有效期在回程日期后至少 6 个月的有效护照。部分目的地可能需要签证。我们建议您在旅行前尽早检查目的地国家的入境要求。'
                },
            ]
        },
        {
            id: 'accessibility',
            title: '无障碍与特殊需求',
            icon: 'accessible',
            faqs: [
                {
                    question: '你们的行程支持轮椅通行吗？',
                    answer: "无障碍程度因行程而异。我们的许多行程涉及大量步行，可能不适合轮椅使用者或行动不便的人士。请在预订前联系我们讨论您的具体需求，我们将帮助您寻找合适的行程。"
                },
                {
                    question: '你们能满足特殊饮食需求吗？',
                    answer: '是的，如有提前通知，我们可以满足大多数饮食限制。请在预订时告知我们您的任何饮食要求（素食、纯素、清真、犹太洁食、过敏等），以便我们做出适当安排。'
                },
                {
                    question: '你们为身障旅客提供行程吗？',
                    answer: '我们致力于让旅行惠及每一个人。虽然部分行程由体力要求，但我们提供替代方案，并可以帮助您规划符合您需求的旅行。请直接与我们联系讨论。'
                },
            ]
        },
        {
            id: 'payment',
            title: '付款与价格',
            icon: 'payments',
            faqs: [
                {
                    question: '你们接受哪些付款方式？',
                    answer: '我们接受所有主流信用卡（Visa、MasterCard、American Express）、PayPal 以及在线预订的银行转账。对于线下交易，我们也接受现金（加元和美元）。'
                },
                {
                    question: '价格以哪种货币标示？',
                    answer: '除非另有说明，我们的价格以美元 (USD) 标示。对于加拿大的行程，价格也可能以加元 (CAD) 显示。货币将在每个行程页面上明确注明。'
                },
                {
                    question: '是否有任何隐藏费用？',
                    answer: '所有强制性费用均已包含在显示的行程价格中。但是请注意，可选活动、行程中未注明的餐费、导游/司机的小费、个人开支和旅游保险均不包含在内。'
                },
                {
                    question: '我在行程中需要携带现金吗？',
                    answer: '是的，我们建议携带足够的现金用于用餐、饮料、纪念品和小费。许多便利店、当地餐馆和小摊贩不接受信用卡。在行程目的地，ATM 并不总是随处可见。'
                },
            ]
        },
        {
            id: 'accommodation',
            title: '住宿与交通',
            icon: 'hotel',
            faqs: [
                {
                    question: '多日行程中房间如何分配？',
                    answer: '对于多日行程，房间分配通常为：2 人共用 1 间双人间。对于人数为奇数的团队，3 人将共用一个三人间。可根据要求提供单人间补差价，需支付额外费用。'
                },
                {
                    question: '使用哪种交通工具？',
                    answer: '我们根据团队规模使用舒适的空调大巴或面包车。所有车辆均定期保养，并由经验丰富的专业人员驾驶。对于部分行程，我们还可能使用船只、缆车或行程中注明的当地交通工具。'
                },
                {
                    question: '包含酒店接送吗？',
                    answer: '许多行程都包含酒店接送，特别是在主要城市。接送地点和时间将在您的预订确认邮件中。对于部分行程，您可能需要到中央出发点集合——这将在行程说明中明确标出。'
                },
                {
                    question: '行程会发生变化吗？',
                    answer: '是的，由于交通状况、天气或其他不可预见的情况，停留的顺序和时长可能会有所调整。我们的导游始终会竭尽全力确保您获得最佳体验，同时将您的安全放在首位。'
                },
            ]
        },
    ]
};

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
    // Helper to render text with clickable links (emails and phones)
    const renderAnswer = (text: string) => {
        // Regex for email and phone numbers
        const parts = text.split(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})|(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g);

        return parts.map((part, i) => {
            if (!part) return null;

            // Email detection
            if (part.includes('@') && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(part)) {
                return (
                    <a key={i} href={`mailto:${part}`} className="text-[#f7941e] hover:underline font-medium">
                        {part}
                    </a>
                );
            }

            // Phone detection (e.g., (778) 945-6000)
            if (/^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(part)) {
                return (
                    <a key={i} href={`tel:${part.replace(/[^\d+]/g, '')}`} className="text-[#f7941e] hover:underline font-medium">
                        {part}
                    </a>
                );
            }

            return part;
        });
    };

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
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="px-4 pb-6 text-gray-600 whitespace-pre-line leading-relaxed">
                    {renderAnswer(answer)}
                </div>
            </div>
        </div>
    );
}

// Category Section Component
export function FAQCategorySection({ category }: { category: FAQCategory }) {
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
                {category.faqs.map((faq: FAQItem, index: number) => (
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

interface FAQProps {
    lang?: string;
}

// Quick Jump Links Component
export function FAQQuickLinks({ lang = 'en' }: FAQProps) {
    const categories = (faqTranslations[lang as keyof typeof faqTranslations] || faqTranslations.en);

    return (
        <div className="flex flex-wrap justify-center gap-3">
            {categories.map((category) => (
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
export function FAQCategories({ lang = 'en' }: FAQProps) {
    const categories = (faqTranslations[lang as keyof typeof faqTranslations] || faqTranslations.en);

    return (
        <div className="max-w-4xl mx-auto">
            {categories.map((category) => (
                <FAQCategorySection key={category.id} category={category} />
            ))}
        </div>
    );
}

