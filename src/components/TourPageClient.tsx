/**
 * TourPageClient
 *
 * Client-side tour detail page. Fetches tour data and reviews dynamically
 * so Astro does NOT need to generate 300+ static pages at build time.
 *
 * Trade-off: Meta tags (title, description, OG image) are generic on first paint.
 * The user explicitly accepted this SEO trade-off for dramatically faster builds.
 */

import { useState, useEffect, useMemo } from "react";
import type { WPTour, GoogleReview } from "../lib/wordpress/types";
import { wpUrl, getCfTransformUrl } from "../lib/wp-url";
import { TourDetail } from "./TourDetail";
import TourSidebarForm from "./TourSidebarForm";
import TourReviewsSection from "./TourReviewsSection";
import MobileInquiryCTA from "./MobileInquiryCTA";

interface TourPageClientProps {
  slug: string;
  lang: "en" | "zh";
  localePrefix: string;
}

function getApiBase(lang: string): string {
  const base =
    (typeof import.meta !== "undefined" && import.meta.env?.PUBLIC_WORDPRESS_CUSTOM_API_URL) ||
    "https://qualitour.ca/wp-json/qualitour/v1";
  if (lang === "zh" && !base.includes("/zh/")) {
    return base.replace("qualitour.ca/wp-json", "qualitour.ca/zh/wp-json");
  }
  return base;
}

const tLoading = {
  en: { loading: "Loading tour...", error: "Error Loading Tour", back: "Back to Tours" },
  zh: { loading: "載入行程中...", error: "載入行程錯誤", back: "返回行程" },
};

export default function TourPageClient({ slug, lang, localePrefix }: TourPageClientProps) {
  const [tour, setTour] = useState<WPTour | null>(null);
  const [allReviews, setAllReviews] = useState<GoogleReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const apiBase = getApiBase(lang);
        const enApiBase = getApiBase("en");
        const [tourRes, reviewsRes] = await Promise.all([
          fetch(`${apiBase}/tours/slug/${encodeURIComponent(slug)}?lang=${lang}`),
          fetch(`${enApiBase}/google-reviews`).catch(() => null),
        ]);

        if (!tourRes.ok) {
          if (tourRes.status === 404) throw new Error(lang === "zh" ? "找不到行程" : "Tour not found");
          throw new Error(`${tourRes.status} ${tourRes.statusText}`);
        }

        const tourData: WPTour = await tourRes.json();
        const reviewsData: GoogleReview[] = reviewsRes?.ok ? await reviewsRes.json() : [];

        if (!cancelled) {
          setTour(tourData);
          setAllReviews(reviewsData);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [slug, lang]);

  const tourReviews = useMemo(() => {
    if (!tour || !allReviews.length) return [];

    let matched = allReviews.filter((r) => {
      const ids = r.related_tours;
      if (!ids) return false;
      return Array.isArray(ids) ? ids.includes(tour.id) : ids === tour.id;
    });

    if (matched.length < 3) {
      const generic = allReviews
        .filter((r) => r.rating >= 5 && r.text && r.text.length > 100)
        .slice(0, 6 - matched.length);
      matched = [...matched, ...generic].slice(0, 6);
    }

    return matched;
  }, [tour, allReviews]);

  function getRawImageUrl(img: any): string | undefined {
    if (!img) return undefined;
    if (typeof img === "string") return wpUrl(img);
    if (typeof img === "object") {
      const url = img.full?.url || img.full || img.large || img.medium;
      return url ? wpUrl(url) : undefined;
    }
    return undefined;
  }

  const meta = tour?.tour_meta;
  const price = meta?.["tour-price-text"] || meta?.price;
  const currency = meta?.["tourmaster-tour-currency"];
  const duration = meta?.duration_text || meta?.duration;
  const location = meta?.location;
  const country = meta?.country;
  const minPeople = meta?.min_people;
  const maxPeople = meta?.max_people;
  const groupSize =
    minPeople && maxPeople ? `${minPeople} - ${maxPeople}` : maxPeople || minPeople;
  const categories = tour?.tour_terms?.categories || [];
  const destinations = tour?.tour_terms?.destinations || [];

  let tourCode = meta?.tour_code || meta?.["tour-code"];
  if (!tourCode && tour?.goodlayers_data) {
    const gdString = JSON.stringify(tour.goodlayers_data);
    const match = gdString.match(/團號[:：]\s*([^"\\\s]+)/) || gdString.match(/Tour Code[:：]\s*([^"\\\s]+)/);
    if (match?.[1]) tourCode = match[1].trim();
  }

  const heroUrl = useMemo(() => {
    const raw = getRawImageUrl(tour?.featured_image_url);
    if (!raw) return undefined;
    return getCfTransformUrl(raw, { width: 1920, height: 1080, format: "webp", quality: 80 });
  }, [tour]);

  const txt = tLoading[lang] || tLoading.en;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">{txt.loading}</p>
        </div>
      </div>
    );
  }

  if (error || !tour) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="bg-white border border-red-200 rounded-2xl p-8 max-w-lg shadow-lg text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <span className="material-icons text-red-500 text-3xl">error_outline</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{txt.error}</h2>
          <p className="text-gray-500 mb-6">{error || (lang === "zh" ? "找不到行程" : "Tour not found")}</p>
          <a
            href={`${localePrefix}/tours`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors"
          >
            <span className="material-icons">arrow_back</span>
            {txt.back}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="tour-detail-page bg-white">
      <div className="min-h-screen bg-gray-50">
        <section className="relative min-h-[75vh] md:min-h-[85vh] overflow-hidden flex flex-col justify-end">
          {heroUrl && (
            <>
              <img
                src={heroUrl}
                alt={tour.title.rendered.replace(/<[^>]*>/g, "")}
                className="absolute inset-0 w-full h-full object-cover"
                loading="eager"
                decoding="async"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
            </>
          )}

          <div className="relative container mx-auto px-4 pb-12 md:pb-24">
            <div className="max-w-4xl">
              <nav className="flex items-center gap-2 text-white/70 text-sm mb-6 font-medium">
                <a href={localePrefix || "/"} className="hover:text-white transition-colors">
                  Home
                </a>
                <span className="material-icons text-xs">chevron_right</span>
                <a href={`${localePrefix}/tours`} className="hover:text-white transition-colors">
                  Tours
                </a>
                {destinations.length > 0 && (
                  <>
                    <span className="material-icons text-xs">chevron_right</span>
                    <a
                      href={`${localePrefix}/tours/destination/${destinations[0].slug}`}
                      className="hover:text-white transition-colors"
                    >
                      {destinations[0].name}
                    </a>
                  </>
                )}
              </nav>

              {/* Title */}
              <h1
                className="text-xl sm:text-3xl md:text-5xl lg:text-6xl font-black text-white mb-6 max-w-4xl leading-[1.15] drop-shadow-2xl"
                dangerouslySetInnerHTML={{ __html: tour.title.rendered }}
              />

              {/* Location */}
              {(location || country) && (
                <div className="flex items-center gap-2 text-white/90 mb-8">
                  <span className="material-icons text-orange-500">location_on</span>
                  <span className="text-lg md:text-xl font-medium">
                    {[location, country].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}

              {/* Quick Info Badges */}
              <div className="flex flex-wrap gap-4">
                {duration && (
                  <div className="flex items-center gap-2 px-5 py-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                    <span className="material-icons text-orange-400">schedule</span>
                    <span className="text-white font-bold">{duration}</span>
                  </div>
                )}
                {groupSize && (
                  <div className="flex items-center gap-2 px-5 py-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                    <span className="material-icons text-orange-400">groups</span>
                    <span className="text-white font-bold">{groupSize} Guests</span>
                  </div>
                )}
                {categories.length > 0 && (
                  <div className="flex items-center gap-2 px-5 py-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                    <span className="material-icons text-orange-400">category</span>
                    <span className="text-white font-bold">{categories[0].name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="py-12 md:py-20">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                  <TourDetail tour={tour} lang={lang} />
                </div>

                {/* Trust Indicators */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="p-6 bg-white rounded-2xl border border-gray-100 text-center group hover:shadow-lg transition-all">
                    <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                      <span className="material-icons text-green-600">verified_user</span>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">Safe Booking</h4>
                    <p className="text-sm text-gray-500">Secure payment & instant confirmation</p>
                  </div>
                  <div className="p-6 bg-white rounded-2xl border border-gray-100 text-center group hover:shadow-lg transition-all">
                    <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                      <span className="material-icons text-blue-600">support_agent</span>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">24/7 Support</h4>
                    <p className="text-sm text-gray-500">Expert assistance whenever you need</p>
                  </div>
                  <div className="p-6 bg-white rounded-2xl border border-gray-100 text-center group hover:shadow-lg transition-all">
                    <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                      <span className="material-icons text-orange-600">thumb_up</span>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">Authentic Exp</h4>
                    <p className="text-sm text-gray-500">Locally curated hidden gems</p>
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="lg:col-span-1">
                <div className="sticky top-24">
                  <TourSidebarForm
                    tourId={tour.id}
                    tourTitle={tour.title.rendered.replace(/<[^>]*>/g, "")}
                    tourCodeDetail={tourCode}
                    price={price}
                    currency={currency}
                    duration={duration}
                    lang={lang}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Customer Reviews Section */}
        {tourReviews.length > 0 && (
          <TourReviewsSection
            reviews={tourReviews}
            tourTitle={tour.title.rendered.replace(/<[^>]*>/g, "")}
            lang={lang}
          />
        )}

        {/* Contact CTA */}
        <section className="py-20 bg-orange-500">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-5xl font-black text-white mb-6">Still have questions?</h2>
            <p className="text-white/80 text-lg mb-12 max-w-2xl mx-auto">
              Our experts are here to help you plan the perfect journey. Contact us for custom
              itineraries and group inquiries.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href={`${localePrefix}/contact?tour=${encodeURIComponent(
                  tour.title.rendered.replace(/<[^>]*>/g, "")
                )}`}
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-orange-500 font-bold rounded-full hover:shadow-xl hover:scale-105 transition-all"
              >
                <span className="material-icons">mail</span>
                Contact Us
              </a>
              <a
                href="mailto:info@qualitour.ca"
                className="inline-flex items-center gap-2 px-8 py-4 bg-orange-600 text-white font-bold rounded-full hover:bg-orange-700 transition-all"
              >
                <span className="material-icons">email</span>
                info@qualitour.ca
              </a>
            </div>
          </div>
        </section>

        {/* Mobile bottom padding */}
        <div className="h-20 lg:hidden" />

        {/* Mobile Fixed CTA Bar */}
        <MobileInquiryCTA tour={tour} tourCode={tourCode} lang={lang} />
      </div>
    </div>
  );
}
