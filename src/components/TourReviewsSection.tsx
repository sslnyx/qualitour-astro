/**
 * TourReviewsSection - Display smart-matched Google reviews for a specific tour
 * Uses scoring algorithm to match reviews to tour content
 */

import PremiumReviewsGrid from './PremiumReviewsGrid';
import type { GoogleReview } from '../lib/wordpress/types';

interface TourReviewsSectionProps {
    reviews: GoogleReview[];
    tourTitle: string;
    lang: 'en' | 'zh';
}

export default function TourReviewsSection({ reviews, tourTitle, lang }: TourReviewsSectionProps) {
    if (!reviews || reviews.length === 0) {
        return null;
    }

    const t = {
        title: lang === 'zh' ? '客户评价' : 'What Travelers Are Saying',
        subtitle: lang === 'zh'
            ? '看看其他旅客如何评价我们的服务'
            : 'Real experiences from our valued customers',
        viewAll: lang === 'zh' ? '查看所有评论' : 'View All Reviews',
    };

    return (
        <section className="py-16 mt-16 bg-gradient-to-br from-gray-900 to-gray-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/20 rounded-full mb-4">
                        <span className="material-icons text-orange-400 text-sm">star</span>
                        <span className="text-orange-300 text-sm font-medium">
                            {lang === 'zh' ? '5星好评' : '5-Star Reviews'}
                        </span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                        {t.title}
                    </h2>
                    <p className="text-white/70 text-lg max-w-2xl mx-auto">
                        {t.subtitle}
                    </p>
                    <div className="w-20 h-1 bg-gradient-to-r from-orange-500 to-amber-500 mx-auto mt-6 rounded-full" />
                </div>

                {/* Reviews Grid */}
                <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-6 md:p-10 border border-white/10">
                    <PremiumReviewsGrid reviews={reviews} />
                </div>

                {/* View All Link */}
                <div className="text-center mt-10">
                    <a
                        href={lang === 'zh' ? '/zh/reviews' : '/reviews'}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-sm text-white font-medium rounded-full border border-white/20 hover:bg-white/20 transition-all duration-300"
                    >
                        <span className="material-icons text-sm">reviews</span>
                        {t.viewAll}
                        <span className="material-icons text-sm">arrow_forward</span>
                    </a>
                </div>
            </div>
        </section>
    );
}
