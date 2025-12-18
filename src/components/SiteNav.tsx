/**
 * SiteNav Component for Astro
 * 
 * Premium navigation with megamenu, mobile drawer, and smooth animations.
 * Uses React for interactivity with Astro's island architecture.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { WPTourDestination, WPTourActivity, WPTourType } from '../lib/wordpress/types';

interface TourTranslation {
    id: number;
    slug: string;
}

interface SiteNavProps {
    lang?: 'en' | 'zh';
    destinations?: WPTourDestination[];
    activities?: WPTourActivity[];
    types?: WPTourType[];
    tourTranslations?: {
        en?: TourTranslation;
        zh?: TourTranslation;
    };
}



export function SiteNav({
    lang = 'en',
    destinations = [],
    activities = [],
    types = [],
    tourTranslations
}: SiteNavProps) {
    const localePrefix = lang === 'en' ? '' : `/${lang}`;

    const [megaOpen, setMegaOpen] = useState(false);
    const [servicesOpen, setServicesOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [mobileToursOpen, setMobileToursOpen] = useState(false);
    const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [currentPath, setCurrentPath] = useState('');
    const [hoveredDestId, setHoveredDestId] = useState<number | null>(null);
    const [expandedChildId, setExpandedChildId] = useState<number | null>(null);

    const megaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const servicesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Get current path
    useEffect(() => {
        setCurrentPath(window.location.pathname);
    }, []);

    // Initialize hoveredDestId with first destination or active destination
    useEffect(() => {
        if (destinations.length === 0 || hoveredDestId !== null) return;

        const parentDestinations = destinations.filter(d => d.parent === 0);
        if (parentDestinations.length === 0) return;

        // Find active destination (current page or parent of current page)
        const activeDest = parentDestinations.find(dest => {
            const isActive = currentPath.includes(`/tours/destination/${dest.slug}`);
            const children = destinations.filter(c => c.parent === dest.id);
            const isChildActive = children.some(c => currentPath.includes(`/tours/destination/${c.slug}`));
            return isActive || isChildActive;
        });

        // Set to active destination or first destination
        setHoveredDestId(activeDest?.id || parentDestinations[0].id);
    }, [destinations, currentPath, hoveredDestId]);

    // Track scroll for nav styling
    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Close mobile menu on navigation
    const handleMobileNavClick = useCallback(() => {
        setMobileOpen(false);
    }, []);



    // Tour types with icons
    const tourTypeLinks = [
        { label: lang === 'zh' ? '陆地游' : 'Land Tours', slug: 'land-tours', icon: 'hiking' },
        { label: lang === 'zh' ? '邮轮' : 'Cruises', slug: 'cruises', icon: 'sailing' },
        { label: lang === 'zh' ? '票务 & 通票' : 'Tickets & Passes', slug: 'attraction-tickets', icon: 'confirmation_number' },
    ];

    // Service links
    const serviceLinks = [
        { label: lang === 'zh' ? '私人接送' : 'Private Transfers', href: `${localePrefix}/private-transfers`, icon: 'airport_shuttle', desc: lang === 'zh' ? '机场、游轮和滑雪接送' : 'Airport, cruise & ski transfers' },
        { label: lang === 'zh' ? '中国签证' : 'China Visa', href: `${localePrefix}/visa`, icon: 'badge', desc: lang === 'zh' ? '签证申请协助' : 'Visa application assistance' },
    ];

    // Hot destinations (hardcoded for now)
    const hotDestinations = [
        { label: lang === 'zh' ? '黄刀镇 (极光)' : 'Yellowknife (Aurora)', type: 'destination', value: 'yellowknife', icon: 'ac_unit' },
        { label: lang === 'zh' ? '白马市 (极光)' : 'Whitehorse (Aurora)', type: 'destination', value: 'whitehorse', icon: 'auto_awesome' },
        { label: lang === 'zh' ? '落基山脉' : 'Rocky Mountains', type: 'destination', value: 'banff', icon: 'landscape' },
        { label: lang === 'zh' ? '海洋三省' : 'Maritimes', type: 'destination', value: 'atlantic-canada', icon: 'sailing' },
    ];

    return (
        <>
            <nav className={`w-full sticky top-0 z-50 transition-all duration-300 ${scrolled
                ? 'bg-white/95 backdrop-blur-lg shadow-lg shadow-black/5'
                : 'bg-white border-b border-gray-100'
                }`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-18 py-3">
                        {/* Logo */}
                        <a href={`${localePrefix}/`} className="flex items-center group">
                            <img
                                src="/logo.svg"
                                alt="Qualitour"
                                width={175}
                                height={48}
                                className="w-[160px] lg:w-[175px] h-auto -ml-4 transition-transform duration-300 group-hover:scale-[1.02]"
                            />
                        </a>

                        {/* Desktop Nav */}
                        <ul className="hidden lg:flex items-center">
                            <li>
                                <a
                                    href={`${localePrefix}/`}
                                    className="relative px-4 py-2 text-gray-700 hover:text-orange-500 font-medium transition-colors group"
                                >
                                    {lang === 'zh' ? '首页' : 'Home'}
                                    <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-orange-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-full" />
                                </a>
                            </li>

                            {/* Services Dropdown */}
                            <li
                                className="relative"
                                onMouseEnter={() => {
                                    if (servicesTimerRef.current) clearTimeout(servicesTimerRef.current);
                                    setServicesOpen(true);
                                }}
                                onMouseLeave={() => {
                                    servicesTimerRef.current = setTimeout(() => setServicesOpen(false), 200);
                                }}
                            >
                                <button className="relative px-4 py-2 text-gray-700 hover:text-orange-500 font-medium flex items-center gap-1 transition-colors group">
                                    {lang === 'zh' ? '服务' : 'Services'}
                                    <span className={`material-icons text-lg transition-transform duration-300 ${servicesOpen ? 'rotate-180' : ''}`}>
                                        expand_more
                                    </span>
                                    <span className={`absolute bottom-0 left-4 right-4 h-0.5 bg-orange-500 transform transition-transform duration-300 origin-left rounded-full ${servicesOpen ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`} />
                                </button>

                                {/* Services Dropdown Panel */}
                                <div className={`absolute left-1/2 -translate-x-1/2 top-full pt-2 transition-all duration-300 ${servicesOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'
                                    }`}>
                                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden min-w-[320px]">
                                        <div className="p-2">
                                            {serviceLinks.map((item) => (
                                                <a
                                                    key={item.href}
                                                    href={item.href}
                                                    className="flex items-start gap-4 p-4 rounded-xl hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 transition-all group"
                                                >
                                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-orange-200/50 group-hover:scale-110 transition-transform">
                                                        <span className="material-icons text-white text-xl">{item.icon}</span>
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold text-gray-900 group-hover:text-orange-500 transition-colors block">{item.label}</span>
                                                        <span className="text-sm text-gray-500">{item.desc}</span>
                                                    </div>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </li>

                            {/* Tours Megamenu */}
                            <li
                                className="relative"
                                onMouseEnter={() => {
                                    if (megaTimerRef.current) clearTimeout(megaTimerRef.current);
                                    setMegaOpen(true);
                                }}
                                onMouseLeave={() => {
                                    megaTimerRef.current = setTimeout(() => setMegaOpen(false), 200);
                                }}
                            >
                                <button className="relative px-4 py-2 text-gray-700 hover:text-orange-500 font-medium flex items-center gap-1 transition-colors group">
                                    {lang === 'zh' ? '行程' : 'Tours'}
                                    <span className={`material-icons text-lg transition-transform duration-300 ${megaOpen ? 'rotate-180' : ''}`}>
                                        expand_more
                                    </span>
                                    <span className={`absolute bottom-0 left-4 right-4 h-0.5 bg-orange-500 transform transition-transform duration-300 origin-left rounded-full ${megaOpen ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`} />
                                </button>

                                {/* Mega Menu Panel */}
                                <div className={`fixed left-0 right-0 top-[72px] z-[100] flex justify-center transition-all duration-300 ease-out ${megaOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-4 pointer-events-none'
                                    }`}>
                                    <div className="w-full max-w-6xl mx-4 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                                        {/* Gradient Header */}
                                        <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 px-8 py-5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                                                        <span className="material-icons text-white text-2xl">explore</span>
                                                    </div>
                                                    <div>
                                                        <h3 className="text-white font-bold text-xl">{lang === 'zh' ? '开启您的下一段旅程' : 'Discover Your Next Adventure'}</h3>
                                                        <p className="text-white/80 text-sm">{lang === 'zh' ? '探索我们精心策划的行程' : 'Explore our curated tours'}</p>
                                                    </div>
                                                </div>
                                                <a
                                                    href={`${localePrefix}/tours`}
                                                    onClick={() => setMegaOpen(false)}
                                                    className="bg-white text-orange-500 px-6 py-3 rounded-full font-bold text-sm hover:shadow-lg hover:scale-105 transition-all flex items-center gap-2"
                                                >
                                                    {lang === 'zh' ? '浏览所有行程' : 'Browse All Tours'}
                                                    <span className="material-icons text-lg">arrow_forward</span>
                                                </a>
                                            </div>
                                        </div>

                                        <div className="p-8">
                                            <div className="grid grid-cols-12 gap-8">
                                                {/* Tour Types */}
                                                <div className="col-span-3">
                                                    <h4 className="font-bold text-gray-900 text-xs uppercase tracking-widest mb-5 flex items-center gap-2">
                                                        <span className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                                                            <span className="material-icons text-orange-500 text-lg">category</span>
                                                        </span>
                                                        {lang === 'zh' ? '旅游类型' : 'Tour Types'}
                                                    </h4>
                                                    <ul className="space-y-1">
                                                        {tourTypeLinks.map((link) => (
                                                            <li key={link.slug}>
                                                                <a
                                                                    href={`${localePrefix}/tours/type/${link.slug}`}
                                                                    onClick={() => setMegaOpen(false)}
                                                                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 hover:text-orange-500 transition-all group"
                                                                >
                                                                    <span className="w-10 h-10 rounded-lg bg-gray-100 group-hover:bg-white group-hover:shadow-md flex items-center justify-center transition-all">
                                                                        <span className="material-icons text-lg text-gray-500 group-hover:text-orange-500 transition-colors">{link.icon}</span>
                                                                    </span>
                                                                    <span className="font-medium">{link.label}</span>
                                                                </a>
                                                            </li>
                                                        ))}
                                                    </ul>

                                                    {/* Featured Tours */}
                                                    <div className="mt-6 pt-6 border-t border-gray-100">
                                                        <a
                                                            href={`${localePrefix}/tours/featured`}
                                                            onClick={() => setMegaOpen(false)}
                                                            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 hover:from-amber-100 hover:to-yellow-100 transition-all group"
                                                        >
                                                            <span className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-200/50">
                                                                <span className="material-icons text-white text-lg">star</span>
                                                            </span>
                                                            <div>
                                                                <span className="font-bold block">{lang === 'zh' ? '精选行程' : 'Featured Tours'}</span>
                                                                <span className="text-xs text-amber-600/70">{lang === 'zh' ? '我们的首选推荐' : 'Our top picks'}</span>
                                                            </div>
                                                        </a>
                                                    </div>
                                                </div>

                                                {/* Destinations */}
                                                <div className="col-span-6 border-x border-gray-100 px-8">
                                                    <h4 className="font-bold text-gray-900 text-xs uppercase tracking-widest mb-5 flex items-center gap-2">
                                                        <span className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                                            <span className="material-icons text-blue-600 text-lg">public</span>
                                                        </span>
                                                        {lang === 'zh' ? '热门目的地' : 'Popular Destinations'}
                                                    </h4>
                                                    <div className="flex gap-6">
                                                        {/* Parent destinations - left column */}
                                                        <div className="flex-1 space-y-1">
                                                            {destinations.filter(d => d.parent === 0).slice(0, 8).map((dest) => {
                                                                const children = destinations.filter(c => c.parent === dest.id);
                                                                const hasChildren = children.length > 0;
                                                                const isActive = currentPath.includes(`/tours/destination/${dest.slug}`);
                                                                const isChildActive = children.some(c => currentPath.includes(`/tours/destination/${c.slug}`));
                                                                const shouldHighlight = isActive || isChildActive;

                                                                return (
                                                                    <div
                                                                        key={dest.id}
                                                                        className="relative"
                                                                        onMouseEnter={() => setHoveredDestId(dest.id)}
                                                                    >
                                                                        <a
                                                                            href={`${localePrefix}/tours/destination/${dest.slug}`}
                                                                            onClick={() => setMegaOpen(false)}
                                                                            className={`flex items-center justify-between gap-3 py-2 px-3 rounded-xl transition-all group ${hoveredDestId === dest.id || shouldHighlight
                                                                                ? 'bg-gradient-to-r from-orange-50 to-amber-50 text-orange-600'
                                                                                : 'text-gray-800 hover:bg-gray-50 hover:text-orange-500'
                                                                                }`}
                                                                        >
                                                                            <div className="flex items-center gap-3">
                                                                                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-all shadow-sm ${hoveredDestId === dest.id || shouldHighlight
                                                                                    ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white'
                                                                                    : 'bg-gradient-to-br from-orange-500/10 to-amber-500/10 text-orange-500 group-hover:from-orange-500 group-hover:to-amber-500 group-hover:text-white'
                                                                                    }`}>
                                                                                    {dest.name.charAt(0)}
                                                                                </span>
                                                                                <span className="font-medium">{dest.name}</span>
                                                                            </div>
                                                                            {hasChildren && (
                                                                                <span className="material-icons text-sm text-gray-400">chevron_right</span>
                                                                            )}
                                                                        </a>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Child destinations - right column (always visible) */}
                                                        <div className="flex-1 transition-all duration-200">
                                                            {destinations.filter(d => d.parent === 0).map((parent) => {
                                                                const children = destinations.filter(c => c.parent === parent.id);
                                                                if (children.length === 0 || hoveredDestId !== parent.id) return null;
                                                                return (
                                                                    <div
                                                                        key={`children-${parent.id}`}
                                                                        className="bg-gray-50 rounded-xl p-4 animate-fadeIn"
                                                                        onMouseEnter={() => setHoveredDestId(parent.id)}
                                                                    >
                                                                        <h5 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                            <span className="material-icons text-sm text-orange-500">subdirectory_arrow_right</span>
                                                                            {parent.name}
                                                                        </h5>
                                                                        <div className="space-y-1">
                                                                            {children.map((child) => {
                                                                                const isChildLinkActive = currentPath.includes(`/tours/destination/${child.slug}`);
                                                                                const grandchildren = destinations.filter(gc => gc.parent === child.id);
                                                                                const hasGrandchildren = grandchildren.length > 0;
                                                                                const isExpanded = expandedChildId === child.id;
                                                                                // const isGrandchildActive = grandchildren.some(gc => currentPath.includes(`/tours/destination/${gc.slug}`));
                                                                                const isGrandchildActive = grandchildren.some(gc => currentPath.includes(`/tours/destination/${gc.slug}`));

                                                                                return (
                                                                                    <div key={child.id}>
                                                                                        <div className="flex items-center gap-1">
                                                                                            <a
                                                                                                href={`${localePrefix}/tours/destination/${child.slug}`}
                                                                                                onClick={() => setMegaOpen(false)}
                                                                                                className={`flex-1 flex items-center gap-2 py-1.5 px-2 rounded-lg transition-all text-sm ${isChildLinkActive || isGrandchildActive
                                                                                                    ? 'text-orange-600 bg-white font-semibold shadow-sm'
                                                                                                    : 'text-gray-700 hover:text-orange-500 hover:bg-white'
                                                                                                    }`}
                                                                                            >
                                                                                                <span className={`w-5 h-5 rounded-full shadow-sm flex items-center justify-center text-xs font-bold ${isChildLinkActive || isGrandchildActive
                                                                                                    ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white'
                                                                                                    : 'bg-white text-orange-400'
                                                                                                    }`}>
                                                                                                    {child.name.charAt(0)}
                                                                                                </span>
                                                                                                <span className="font-medium">{child.name}</span>
                                                                                                {child.count > 0 && (
                                                                                                    <span className="ml-auto text-xs text-gray-400">{child.count}</span>
                                                                                                )}
                                                                                            </a>
                                                                                            {hasGrandchildren && (
                                                                                                <button
                                                                                                    onClick={() => setExpandedChildId(isExpanded ? null : child.id)}
                                                                                                    className="p-1 hover:bg-white rounded transition-colors"
                                                                                                    aria-label={`Toggle ${child.name} sub-regions`}
                                                                                                >
                                                                                                    <span className={`material-icons text-sm text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                                                                                        expand_more
                                                                                                    </span>
                                                                                                </button>
                                                                                            )}
                                                                                        </div>

                                                                                        {/* Third level - Grandchildren accordion */}
                                                                                        {hasGrandchildren && (
                                                                                            <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-96' : 'max-h-0'}`}>
                                                                                                <div className="ml-6 mt-1 space-y-1 border-l-2 border-orange-100 pl-3">
                                                                                                    {grandchildren.map((grandchild) => {
                                                                                                        const isGrandchildLinkActive = currentPath.includes(`/tours/destination/${grandchild.slug}`);
                                                                                                        return (
                                                                                                            <a
                                                                                                                key={grandchild.id}
                                                                                                                href={`${localePrefix}/tours/destination/${grandchild.slug}`}
                                                                                                                onClick={() => setMegaOpen(false)}
                                                                                                                className={`flex items-center gap-2 py-1 px-2 rounded-lg transition-all text-xs ${isGrandchildLinkActive
                                                                                                                    ? 'text-orange-600 bg-white font-semibold'
                                                                                                                    : 'text-gray-600 hover:text-orange-500 hover:bg-white/50'
                                                                                                                    }`}
                                                                                                            >
                                                                                                                <span className="w-1 h-1 rounded-full bg-orange-300"></span>
                                                                                                                <span className="font-medium">{grandchild.name}</span>
                                                                                                                {grandchild.count > 0 && (
                                                                                                                    <span className="ml-auto text-xs text-gray-400">{grandchild.count}</span>
                                                                                                                )}
                                                                                                            </a>
                                                                                                        );
                                                                                                    })}
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            {/* Placeholder when no children */}
                                                            {hoveredDestId && destinations.filter(c => c.parent === hoveredDestId).length === 0 && (
                                                                <div className="bg-gray-50 rounded-xl p-4 text-center text-gray-500 text-sm">
                                                                    <span className="material-icons text-2xl mb-2 text-gray-300 block">explore</span>
                                                                    {lang === 'zh' ? '无子区域' : 'No sub-regions'}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Hot Locations */}
                                                <div className="col-span-3">
                                                    <h4 className="font-bold text-gray-900 text-xs uppercase tracking-widest mb-5 flex items-center gap-2">
                                                        <span className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                                                            <span className="material-icons text-red-600 text-lg">whatshot</span>
                                                        </span>
                                                        {lang === 'zh' ? '热门地点' : 'Hot Locations'}
                                                    </h4>

                                                    <div className="space-y-3">
                                                        {hotDestinations.map((dest, idx) => (
                                                            <a
                                                                key={idx}
                                                                href={`${localePrefix}/tours?${dest.type === 'destination' ? 'destination' : 'q'}=${encodeURIComponent(dest.value)}`}
                                                                onClick={() => setMegaOpen(false)}
                                                                className="flex items-center gap-3 p-2 rounded-xl hover:bg-red-50 transition-all group"
                                                            >
                                                                <span className="w-10 h-10 rounded-lg bg-white shadow-sm border border-gray-100 group-hover:border-red-200 flex items-center justify-center transition-colors">
                                                                    <span className="material-icons text-gray-500 group-hover:text-red-500 transition-colors">{dest.icon}</span>
                                                                </span>
                                                                <span className="font-medium text-gray-700 group-hover:text-red-600 transition-colors">{dest.label}</span>
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </li>

                            <li>
                                <a href={`${localePrefix}/about-us`} className="relative px-4 py-2 text-gray-700 hover:text-orange-500 font-medium transition-colors group">
                                    {lang === 'zh' ? '关于我们' : 'About'}
                                    <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-orange-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-full" />
                                </a>
                            </li>
                            <li>
                                <a href={`${localePrefix}/contact`} className="relative px-4 py-2 text-gray-700 hover:text-orange-500 font-medium transition-colors group">
                                    {lang === 'zh' ? '联系我们' : 'Contact'}
                                    <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-orange-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-full" />
                                </a>
                            </li>
                            <li>
                                <a href={`${localePrefix}/faq`} className="relative px-4 py-2 text-gray-700 hover:text-orange-500 font-medium transition-colors group">
                                    {lang === 'zh' ? '常见问题' : 'FAQ'}
                                    <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-orange-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-full" />
                                </a>
                            </li>
                        </ul>

                        {/* Right Side: Language & CTA */}
                        <div className="hidden lg:flex items-center gap-4">
                            {/* Language Toggle */}
                            <button
                                onClick={() => {
                                    const targetLang = lang === 'en' ? 'zh' : 'en';
                                    const currentPath = window.location.pathname;

                                    // Check if we're on a tour detail page and have translations
                                    const isTourPage = currentPath.includes('/tours/') &&
                                        !currentPath.includes('/tours/destination/') &&
                                        !currentPath.includes('/tours/activity/') &&
                                        !currentPath.includes('/tours/type/') &&
                                        !currentPath.includes('/tours/duration/') &&
                                        !currentPath.includes('/tours/featured') &&
                                        currentPath !== '/tours' &&
                                        currentPath !== '/zh/tours';

                                    if (isTourPage && tourTranslations && tourTranslations[targetLang]) {
                                        // Use the translated tour's slug
                                        const translatedSlug = tourTranslations[targetLang]!.slug;
                                        const newPath = targetLang === 'en'
                                            ? `/tours/${encodeURIComponent(translatedSlug)}`
                                            : `/zh/tours/${encodeURIComponent(translatedSlug)}`;
                                        window.location.href = newPath;
                                    } else {
                                        // Default behavior for non-tour pages
                                        if (lang === 'en') {
                                            window.location.href = `/zh${currentPath}`;
                                        } else {
                                            const path = currentPath.replace(/^\/zh/, '');
                                            window.location.href = path || '/';
                                        }
                                    }
                                }}
                                className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 hover:text-orange-500 transition-all text-sm"
                                aria-label={lang === 'en' ? "Switch to Chinese" : "Switch to English"}
                            >
                                <span className="material-icons text-xl">language</span>
                                <span>{lang === 'en' ? '中文' : 'EN'}</span>
                            </button>
                            <a
                                href={`${localePrefix}/tours`}
                                className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-6 py-2.5 rounded-full font-semibold text-sm hover:shadow-lg hover:shadow-orange-300/40 hover:scale-105 transition-all flex items-center gap-2"
                            >
                                <span className="material-icons text-lg">explore</span>
                                {lang === 'zh' ? '探索行程' : 'Explore Tours'}
                            </a>
                        </div>

                        {/* Mobile Hamburger */}
                        <button
                            className="lg:hidden p-2.5 hover:bg-gray-100 rounded-xl transition-colors -mr-2"
                            onClick={() => setMobileOpen(!mobileOpen)}
                        >
                            <span className="sr-only">Open menu</span>
                            <div className="w-6 h-5 flex flex-col justify-between">
                                <span className={`w-full h-0.5 bg-gray-700 rounded-full transform transition-all duration-300 ${mobileOpen ? 'rotate-45 translate-y-2' : ''}`} />
                                <span className={`w-full h-0.5 bg-gray-700 rounded-full transition-all duration-300 ${mobileOpen ? 'opacity-0' : ''}`} />
                                <span className={`w-full h-0.5 bg-gray-700 rounded-full transform transition-all duration-300 ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`} />
                            </div>
                        </button>
                    </div>
                </div>
            </nav>

            {/* Mobile Menu Drawer - OUTSIDE nav for proper fixed positioning */}
            <div className={`fixed inset-0 z-[200] lg:hidden transition-all duration-300 ${mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                {/* Backdrop */}
                <div
                    className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
                    onClick={() => setMobileOpen(false)}
                />

                {/* Drawer */}
                <div className={`absolute right-0 top-0 bottom-0 w-[90%] max-w-md bg-white shadow-2xl transition-transform duration-300 ease-out flex flex-col ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                        <img src="/logo.svg" alt="Qualitour" className="h-10 w-auto -ml-2" />
                        <button
                            onClick={() => setMobileOpen(false)}
                            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-xl transition-colors"
                        >
                            <span className="material-icons text-gray-600">close</span>
                        </button>
                    </div>

                    {/* Menu Content */}
                    <div className="flex-1 overflow-y-auto">
                        <nav className="py-4">
                            {/* Home */}
                            <a
                                href={`${localePrefix}/`}
                                onClick={handleMobileNavClick}
                                className="flex items-center gap-4 px-6 py-4 text-gray-800 font-medium hover:bg-gray-50 transition-colors"
                            >
                                <span className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                                    <span className="material-icons text-orange-500">home</span>
                                </span>
                                {lang === 'zh' ? '首页' : 'Home'}
                            </a>

                            {/* Services Accordion */}
                            <div className="border-t border-gray-100">
                                <button
                                    onClick={() => setMobileServicesOpen(!mobileServicesOpen)}
                                    className="flex items-center justify-between w-full px-6 py-4 text-gray-800 font-medium hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <span className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                            <span className="material-icons text-blue-600">support_agent</span>
                                        </span>
                                        {lang === 'zh' ? '服务' : 'Services'}
                                    </div>
                                    <span className={`material-icons text-gray-400 transition-transform duration-300 ${mobileServicesOpen ? 'rotate-180' : ''}`}>
                                        expand_more
                                    </span>
                                </button>
                                <div className={`overflow-hidden transition-all duration-300 ${mobileServicesOpen ? 'max-h-60' : 'max-h-0'}`}>
                                    <div className="bg-gray-50 py-3 px-6 space-y-2">
                                        {serviceLinks.map((item) => (
                                            <a
                                                key={item.href}
                                                href={item.href}
                                                onClick={handleMobileNavClick}
                                                className="flex items-center gap-4 p-3 rounded-xl hover:bg-white transition-colors"
                                            >
                                                <span className="w-9 h-9 rounded-lg bg-white shadow flex items-center justify-center">
                                                    <span className="material-icons text-orange-500 text-lg">{item.icon}</span>
                                                </span>
                                                <div>
                                                    <span className="font-medium text-gray-800 block">{item.label}</span>
                                                    <span className="text-xs text-gray-500">{item.desc}</span>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Tours Accordion */}
                            <div className="border-t border-gray-100">
                                <button
                                    onClick={() => setMobileToursOpen(!mobileToursOpen)}
                                    className="flex items-center justify-between w-full px-6 py-4 text-gray-800 font-medium hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-200/50">
                                            <span className="material-icons text-white">explore</span>
                                        </span>
                                        {lang === 'zh' ? '行程' : 'Tours'}
                                    </div>
                                    <span className={`material-icons text-gray-400 transition-transform duration-300 ${mobileToursOpen ? 'rotate-180' : ''}`}>
                                        expand_more
                                    </span>
                                </button>
                                <div className={`overflow-hidden transition-all duration-300 ${mobileToursOpen ? 'max-h-[1000px]' : 'max-h-0'}`}>
                                    <div className="bg-gray-50">
                                        {/* Browse All CTA */}
                                        <div className="p-4 bg-gradient-to-r from-orange-500 to-amber-500">
                                            <a
                                                href={`${localePrefix}/tours`}
                                                onClick={handleMobileNavClick}
                                                className="flex items-center justify-center gap-2 bg-white text-orange-500 px-5 py-3 rounded-xl font-bold text-sm shadow-lg"
                                            >
                                                {lang === 'zh' ? '浏览所有行程' : 'Browse All Tours'}
                                                <span className="material-icons text-lg">arrow_forward</span>
                                            </a>
                                        </div>

                                        {/* Tour Types */}
                                        <div className="px-6 py-5 border-b border-gray-200">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">{lang === 'zh' ? '旅游类型' : 'Tour Types'}</h4>
                                            <div className="space-y-2">
                                                {tourTypeLinks.map((link) => (
                                                    <a
                                                        key={link.slug}
                                                        href={`${localePrefix}/tours/type/${link.slug}`}
                                                        onClick={handleMobileNavClick}
                                                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-white transition-colors"
                                                    >
                                                        <span className="w-9 h-9 rounded-lg bg-white shadow flex items-center justify-center">
                                                            <span className="material-icons text-gray-500 text-lg">{link.icon}</span>
                                                        </span>
                                                        <span className="font-medium text-gray-700">{link.label}</span>
                                                    </a>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Destinations */}
                                        <div className="px-6 py-5">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">{lang === 'zh' ? '热门目的地' : 'Destinations'}</h4>
                                            <div className="grid grid-cols-2 gap-3">
                                                {destinations.filter(d => d.parent === 0).slice(0, 6).map((dest) => (
                                                    <a
                                                        key={dest.id}
                                                        href={`${localePrefix}/tours/destination/${dest.slug}`}
                                                        onClick={handleMobileNavClick}
                                                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-white transition-colors"
                                                    >
                                                        <span className="w-7 h-7 rounded-full bg-orange-500/10 flex items-center justify-center text-xs font-bold text-orange-500">
                                                            {dest.name.charAt(0)}
                                                        </span>
                                                        <span className="text-sm font-medium text-gray-700">{dest.name}</span>
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Other Links */}
                            <a href={`${localePrefix}/about-us`} onClick={handleMobileNavClick} className="flex items-center gap-4 px-6 py-4 text-gray-800 font-medium hover:bg-gray-50 transition-colors border-t border-gray-100">
                                <span className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                                    <span className="material-icons text-green-600">info</span>
                                </span>
                                {lang === 'zh' ? '关于我们' : 'About Us'}
                            </a>
                            <a href={`${localePrefix}/contact`} onClick={handleMobileNavClick} className="flex items-center gap-4 px-6 py-4 text-gray-800 font-medium hover:bg-gray-50 transition-colors border-t border-gray-100">
                                <span className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                                    <span className="material-icons text-purple-600">mail</span>
                                </span>
                                {lang === 'zh' ? '联系我们' : 'Contact Us'}
                            </a>
                            <a href={`${localePrefix}/faq`} onClick={handleMobileNavClick} className="flex items-center gap-4 px-6 py-4 text-gray-800 font-medium hover:bg-gray-50 transition-colors border-t border-gray-100">
                                <span className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
                                    <span className="material-icons text-cyan-600">help</span>
                                </span>
                                {lang === 'zh' ? '常见问题' : 'FAQ'}
                            </a>
                        </nav>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-gray-100 px-6 py-5 bg-gradient-to-r from-gray-50 to-white">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-medium text-gray-600">{lang === 'zh' ? '语言' : 'Language'}</span>
                            <div className="flex items-center">
                                <button
                                    onClick={() => {
                                        const targetLang = lang === 'en' ? 'zh' : 'en';
                                        const currentPath = window.location.pathname;

                                        // Check if we're on a tour detail page and have translations
                                        const isTourPage = currentPath.includes('/tours/') &&
                                            !currentPath.includes('/tours/destination/') &&
                                            !currentPath.includes('/tours/activity/') &&
                                            !currentPath.includes('/tours/type/') &&
                                            !currentPath.includes('/tours/duration/') &&
                                            !currentPath.includes('/tours/featured') &&
                                            currentPath !== '/tours' &&
                                            currentPath !== '/zh/tours';

                                        if (isTourPage && tourTranslations && tourTranslations[targetLang]) {
                                            // Use the translated tour's slug
                                            const translatedSlug = tourTranslations[targetLang]!.slug;
                                            const newPath = targetLang === 'en'
                                                ? `/tours/${encodeURIComponent(translatedSlug)}`
                                                : `/zh/tours/${encodeURIComponent(translatedSlug)}`;
                                            window.location.href = newPath;
                                        } else {
                                            // Default behavior for non-tour pages
                                            if (lang === 'en') {
                                                window.location.href = `/zh${currentPath}`;
                                            } else {
                                                const path = currentPath.replace(/^\/zh/, '');
                                                window.location.href = path || '/';
                                            }
                                        }
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-700 font-medium hover:bg-white hover:shadow-sm transition-all text-sm"
                                >
                                    <span className="material-icons text-lg">language</span>
                                    <span>{lang === 'en' ? '中文' : 'EN'}</span>
                                </button>
                            </div>
                        </div>
                        <a
                            href={`${localePrefix}/tours`}
                            onClick={handleMobileNavClick}
                            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3.5 rounded-xl font-bold text-center flex items-center justify-center gap-2 shadow-lg shadow-orange-200/50"
                        >
                            <span className="material-icons text-lg">explore</span>
                            {lang === 'zh' ? '探索所有行程' : 'Explore All Tours'}
                        </a>
                    </div>
                </div>
            </div>
        </>
    );
}
