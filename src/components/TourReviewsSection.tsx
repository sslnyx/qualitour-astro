/**
 * TourReviewsSection - Display smart-matched Google reviews for a specific tour
 * Uses scoring algorithm to match reviews to tour content
 */

import SimpleReviewsGrid from './SimpleReviewsGrid';
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
        <section className="py-16 mt-16 bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 rounded-full mb-4">
                        <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-orange-600 text-sm font-medium">
                            {lang === 'zh' ? '5星好评' : '5-Star Reviews'}
                        </span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                        {t.title}
                    </h2>
                    <p className="text-gray-600 text-lg max-w-2xl mx-auto">
                        {t.subtitle}
                    </p>
                    <div className="w-20 h-1 bg-gradient-to-r from-orange-500 to-amber-500 mx-auto mt-6 rounded-full" />
                </div>

                {/* Reviews Grid */}
                <SimpleReviewsGrid reviews={reviews} initialCount={6} showLoadMore={false} />

                {/* View All Link */}
                <div className="text-center mt-10">
                    <a
                        href={`${import.meta.env.BASE_URL}${lang === 'zh' ? 'zh/' : ''}reviews`}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-[#f7941e] hover:bg-[#e8850f] text-white font-medium rounded-full transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {t.viewAll}
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </a>
                </div>
            </div>
        </section>
    );
}
