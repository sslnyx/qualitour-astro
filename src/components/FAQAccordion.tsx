import { useId, useState } from 'react';

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
            title: '預訂與預約',
            icon: 'calendar_today',
            faqs: [
                {
                    question: '如何預訂行程？',
                    answer: `預訂 Qualitour 行程有以下幾種方式：
• 在辦公時間內撥打 (778) 945-6000 與我們聯繫
• 發送電子郵件至 info@qualitour.ca，說明您的行程偏好
• 訪問您感興趣的行程頁面，點擊“立即預訂”按鈕提交諮詢
• 填寫網站上的聯繫表格，註明您的旅行日期和團隊人數

我們的團隊將在 24-48 小時內回覆，確認名額、提供報價並指導您完成預訂流程。`
                },
                {
                    question: '我可以預訂團隊行程嗎？',
                    answer: '是的！我們受理各種規模的團隊預訂。對於 10 人以上的團隊，我們建議您直接聯繫我們，以獲得優惠價格和定製行程。團隊諮詢請發送郵件至 info@qualitour.ca。'
                },
                {
                    question: '我需要打印預訂確認單嗎？',
                    answer: '雖然不強制要求打印確認單，但我們建議在行程當天準備好預訂確認的電子版或打印版。您可以在移動設備上出示預訂確認郵件。'
                },
                {
                    question: '確認後我可以修改預訂嗎？',
                    answer: '是的，修改視名額情況以及距離行程日期的時間而定。如果您需要更改預訂，請儘快與我們聯繫。行程前 15 天內進行的修改可能會產生額外費用。'
                },
            ]
        },
        {
            id: 'cancellation',
            title: '取消與退款',
            icon: 'credit_card',
            faqs: [
                {
                    question: '你們的取消政策是什麼？',
                    answer: `我們的標準取消政策如下：
• 提前 45 天或以上取消：每人收取 100 美元手續費
• 提前 15-45 天取消：退款 50%
• 15 天內取消：不予退款
• 未按時參加者（No-shows）：不予退款

注：部分行程可能有特定的取消政策。請查看具體行程頁面瞭解詳情。`
                },
                {
                    question: "如果我沒有按時參加行程會怎樣？",
                    answer: '未按時參加（No-shows）定義爲未在預定時間到達指定上車點的旅客。在這種情況下，您的預訂將被取消，且不予退款。請確保至少在預定出發時間前 15 分米到達。'
                },
                {
                    question: '如果行程因天氣原因取消怎麼辦？',
                    answer: '如果行程因惡劣天氣或不可預見的情況必須取消，我們最遲會在行程前一天晚上通過電子郵件或短信通知您。在這種情況下，您可以選擇全額退款或重新安排行程。'
                },
                {
                    question: '收到退款需要多長時間？',
                    answer: '退款通常在批准後 5-10 個工作日內處理。退款將退還至預訂時使用的原始付款方式。信用卡退款可能需要額外的 3-5 個工作日才能顯示在您的賬單上。'
                },
            ]
        },
        {
            id: 'travel',
            title: '旅行要求',
            icon: 'flight',
            faqs: [
                {
                    question: '行程有哪些年齡限制？',
                    answer: '18 歲以下的未成年人必須由成年人陪同。嬰兒（2 歲以下）可以由成人抱坐，並與成人共用現有寢具，無需額外費用。部分探險行程可能由特定的年齡要求，請查看具體行程詳情。'
                },
                {
                    question: '參加行程需要帶什麼？',
                    answer: `我們建議攜帶：
• 有效身份證件或護照
• 舒適的步行鞋
• 適合天氣的衣物
• 照相機
• 足夠的現金用於用餐、飲料、紀念品和小費
• 任何必要的藥物
• 防曬霜和太陽鏡（戶外行程）`
                },
                {
                    question: '包含旅遊保險嗎？',
                    answer: '行程價格不包含旅遊保險。我們強烈建議您在出發前購買全面的旅遊保險，涵蓋行程取消、醫療急救和行李丟失等項。'
                },
                {
                    question: '國際旅行需要哪些文件？',
                    answer: '對於國際行程，您需要持有有效期在回程日期後至少 6 個月的有效護照。部分目的地可能需要簽證。我們建議您在旅行前儘早檢查目的地國家的入境要求。'
                },
            ]
        },
        {
            id: 'accessibility',
            title: '無障礙與特殊需求',
            icon: 'accessible',
            faqs: [
                {
                    question: '你們的行程支持輪椅通行嗎？',
                    answer: "無障礙程度因行程而異。我們的許多行程涉及大量步行，可能不適合輪椅使用者或行動不便的人士。請在預訂前聯繫我們討論您的具體需求，我們將幫助您尋找合適的行程。"
                },
                {
                    question: '你們能滿足特殊飲食需求嗎？',
                    answer: '是的，如有提前通知，我們可以滿足大多數飲食限制。請在預訂時告知我們您的任何飲食要求（素食、純素、清真、猶太潔食、過敏等），以便我們做出適當安排。'
                },
                {
                    question: '你們爲身障旅客提供行程嗎？',
                    answer: '我們致力於讓旅行惠及每一個人。雖然部分行程由體力要求，但我們提供替代方案，並可以幫助您規劃符合您需求的旅行。請直接與我們聯繫討論。'
                },
            ]
        },
        {
            id: 'payment',
            title: '付款與價格',
            icon: 'payments',
            faqs: [
                {
                    question: '你們接受哪些付款方式？',
                    answer: '我們接受所有主流信用卡（Visa、MasterCard、American Express）、PayPal 以及在線預訂的銀行轉賬。對於線下交易，我們也接受現金（加元和美元）。'
                },
                {
                    question: '價格以哪種貨幣標示？',
                    answer: '除非另有說明，我們的價格以美元 (USD) 標示。對於加拿大的行程，價格也可能以加元 (CAD) 顯示。貨幣將在每個行程頁面上明確註明。'
                },
                {
                    question: '是否有任何隱藏費用？',
                    answer: '所有強制性費用均已包含在顯示的行程價格中。但是請注意，可選活動、行程中未註明的餐費、導遊/司機的小費、個人開支和旅遊保險均不包含在內。'
                },
                {
                    question: '我在行程中需要攜帶現金嗎？',
                    answer: '是的，我們建議攜帶足夠的現金用於用餐、飲料、紀念品和小費。許多便利店、當地餐館和小攤販不接受信用卡。在行程目的地，ATM 並不總是隨處可見。'
                },
            ]
        },
        {
            id: 'accommodation',
            title: '住宿與交通',
            icon: 'hotel',
            faqs: [
                {
                    question: '多日行程中房間如何分配？',
                    answer: '對於多日行程，房間分配通常爲：2 人共用 1 間雙人間。對於人數爲奇數的團隊，3 人將共用一個三人間。可根據要求提供單人間補差價，需支付額外費用。'
                },
                {
                    question: '使用哪種交通工具？',
                    answer: '我們根據團隊規模使用舒適的空調大巴或麪包車。所有車輛均定期保養，並由經驗豐富的專業人員駕駛。對於部分行程，我們還可能使用船隻、纜車或行程中註明的當地交通工具。'
                },
                {
                    question: '包含酒店接送嗎？',
                    answer: '許多行程都包含酒店接送，特別是在主要城市。接送地點和時間將在您的預訂確認郵件中。對於部分行程，您可能需要到中央出發點集合——這將在行程說明中明確標出。'
                },
                {
                    question: '行程會發生變化嗎？',
                    answer: '是的，由於交通狀況、天氣或其他不可預見的情況，停留的順序和時長可能會有所調整。我們的導遊始終會竭盡全力確保您獲得最佳體驗，同時將您的安全放在首位。'
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
    const answerId = useId();
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
                type="button"
                aria-expanded={isOpen}
                aria-controls={answerId}
                onClick={onToggle}
                className="w-full py-5 px-4 flex items-center justify-between text-left transition-colors hover:bg-orange-50/50 focus-visible:outline-2 focus-visible:outline-orange-700 rounded-xl group"
            >
                <span className="text-lg font-medium text-gray-900 pr-8 group-hover:text-[#f7941e] transition-colors">{question}</span>
                <span className={`flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[#f7941e] to-[#ff6b35] flex items-center justify-center text-white shadow-lg shadow-orange-200/50 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                    <span className="material-icons text-xl" aria-hidden="true">expand_more</span>
                </span>
            </button>
            <div id={answerId} inert={!isOpen} className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="min-h-0 overflow-hidden">
                    <div className="max-w-[75ch] px-4 pb-6 text-gray-600 whitespace-pre-line leading-relaxed">
                        {renderAnswer(answer)}
                    </div>
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

