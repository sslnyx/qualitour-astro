import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CategoryTerm } from '../lib/wordpress/types';
import { decodeHtml } from '../lib/utils';

const PAGE_SIZE = 8;

const searchText = (text: string) => decodeHtml(text).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

interface DestinationPickerProps {
    destinations: CategoryTerm[];
    value: string;
    lang: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onChange: (destination: string) => void;
}

export default function TourDestinationPicker({ destinations, value, lang, open, onOpenChange, onChange }: DestinationPickerProps) {
    const pickerId = useId();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const backRef = useRef<HTMLButtonElement>(null);
    const regionButtons = useRef(new Map<string, HTMLButtonElement>());
    const previousRegion = useRef('');
    const nextVisibleOption = useRef('');
    const [regionSlug, setRegionSlug] = useState('');
    const [query, setQuery] = useState('');
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    const zh = lang === 'zh';
    const t = {
        destination: zh ? '目的地' : 'Destination',
        all: zh ? '所有目的地' : 'All destinations',
        clear: zh ? '清除目的地' : 'Clear destination',
        searchDestination: zh ? '搜尋目的地' : 'Search destinations',
        browseRegions: zh ? '按地區瀏覽' : 'Browse by region',
        back: zh ? '所有地區' : 'All regions',
        entireRegion: (name: string) => zh ? `整個${name}` : `All of ${name}`,
        noMatches: zh ? '找不到符合的目的地' : 'No matching destinations',
        more: zh ? '顯示更多目的地' : 'Show more destinations',
    };

    const { regions, searchable } = useMemo(() => {
        const countries = new Map<CategoryTerm['id'], CategoryTerm[]>();
        for (const term of destinations) {
            if (term.parent === 0 || (term.level ?? 2) > 2) continue;
            const siblings = countries.get(term.parent) ?? [];
            siblings.push(term);
            countries.set(term.parent, siblings);
        }
        const regions = destinations.filter(term => term.parent === 0).map(term => ({
            term,
            countries: countries.get(term.id) ?? [],
        }));
        const searchable = regions.flatMap(({ term, countries }) => [
            { term, context: '' },
            ...countries.map(country => ({ term: country, context: decodeHtml(term.name) })),
        ]);
        return { regions, searchable };
    }, [destinations]);

    const selected = destinations.find(term => term.slug === value);
    const region = regions.find(({ term }) => term.slug === regionSlug);
    const needle = searchText(query.trim());
    const options = needle
        ? searchable.filter(({ term }) => searchText(term.name).includes(needle))
        : (region?.countries.map(term => ({ term, context: '' })) ?? []);

    useEffect(() => {
        if (!open) return;
        if (regionSlug) backRef.current?.focus();
        else if (previousRegion.current) regionButtons.current.get(previousRegion.current)?.focus();
        previousRegion.current = regionSlug;
    }, [open, regionSlug]);

    useEffect(() => {
        if (!nextVisibleOption.current) return;
        document.getElementById(`${pickerId}-${nextVisibleOption.current}`)?.focus();
        nextVisibleOption.current = '';
    }, [pickerId, visibleCount]);

    const resetPicker = () => {
        setQuery('');
        setRegionSlug('');
        setVisibleCount(PAGE_SIZE);
        previousRegion.current = '';
        nextVisibleOption.current = '';
    };

    const choose = (slug: string) => {
        onChange(slug);
        onOpenChange(false);
        resetPicker();
        triggerRef.current?.focus();
    };

    const optionButton = (term: CategoryTerm, label: string, context = '') => (
        <button
            key={term.slug}
            id={`${pickerId}-${term.slug}`}
            type="button"
            aria-pressed={value === term.slug}
            onClick={() => choose(term.slug)}
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm text-gray-900 hover:bg-orange-50 aria-pressed:bg-orange-50 aria-pressed:font-semibold focus-visible:outline-2 focus-visible:outline-[#a8410b]"
        >
            <span className="min-w-0 break-words">
                <span className="block">{label}</span>
                {context && <span className="block text-xs text-gray-600">{context}</span>}
            </span>
            <span className="shrink-0 tabular-nums text-xs text-gray-600">{term.count}</span>
        </button>
    );

    if (!regions.length) return null;

    return (
        <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
                <h3 id={`${pickerId}-label`} className="text-sm font-semibold text-gray-900">{t.destination}</h3>
                {value && (
                    <button
                        type="button"
                        onClick={() => choose('')}
                        className="min-h-11 rounded-lg px-2 text-xs font-semibold text-[#a8410b] hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-[#a8410b]"
                    >
                        {t.clear}
                    </button>
                )}
            </div>
            <button
                ref={triggerRef}
                type="button"
                aria-labelledby={`${pickerId}-label ${pickerId}-value`}
                aria-expanded={open}
                aria-controls={open ? pickerId : undefined}
                className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 hover:border-gray-500 focus-visible:outline-2 focus-visible:outline-[#a8410b]"
                onClick={() => {
                    resetPicker();
                    onOpenChange(!open);
                }}
            >
                <span id={`${pickerId}-value`} className="min-w-0 break-words">{selected ? decodeHtml(selected.name) : value || t.all}</span>
                <span aria-hidden="true" className={`material-icons shrink-0 text-gray-600 ${open ? 'rotate-180' : ''}`}>expand_more</span>
            </button>

            {open && (
                <div id={pickerId} className="mt-2 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-2.5">
                    <label className="sr-only" htmlFor={`${pickerId}-search`}>{t.searchDestination}</label>
                    <input
                        id={`${pickerId}-search`}
                        type="search"
                        placeholder={t.searchDestination}
                        value={query}
                        onChange={event => {
                            setQuery(event.target.value);
                            setVisibleCount(PAGE_SIZE);
                        }}
                        className="min-h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-2.5 text-base text-gray-900 placeholder-gray-500 focus-visible:outline-2 focus-visible:outline-[#a8410b] sm:text-sm"
                    />
                    {!needle && !region && (
                        <div className="divide-y divide-gray-200">
                            <p className="px-2 py-1 text-xs font-semibold text-gray-600">{t.browseRegions}</p>
                            {regions.map(({ term, countries }) => countries.length === 0
                                ? optionButton(term, decodeHtml(term.name))
                                : (
                                    <button
                                        key={term.slug}
                                        type="button"
                                        ref={element => {
                                            if (element) regionButtons.current.set(term.slug, element);
                                            else regionButtons.current.delete(term.slug);
                                        }}
                                        onClick={() => {
                                            setRegionSlug(term.slug);
                                            setVisibleCount(PAGE_SIZE);
                                        }}
                                        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm text-gray-900 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-[#a8410b]"
                                    >
                                        <span className="min-w-0 break-words">{decodeHtml(term.name)}</span>
                                        <span className="flex shrink-0 items-center gap-1 text-xs text-gray-600">
                                            {term.count}<span className="material-icons" aria-hidden="true">chevron_right</span>
                                        </span>
                                    </button>
                                ))}
                        </div>
                    )}
                    {!needle && region && (
                        <>
                            <button
                                type="button"
                                ref={backRef}
                                onClick={() => setRegionSlug('')}
                                className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[#a8410b] hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-[#a8410b]"
                            >
                                <span className="material-icons" aria-hidden="true">chevron_left</span>{t.back}
                            </button>
                            <p className="px-2 text-xs font-semibold text-gray-600">{decodeHtml(region.term.name)}</p>
                            {optionButton(region.term, t.entireRegion(decodeHtml(region.term.name)))}
                        </>
                    )}
                    {needle && options.length === 0 && <p className="px-2 py-2 text-sm text-gray-600" role="status">{t.noMatches}</p>}
                    {options.slice(0, visibleCount).map(({ term, context }) => optionButton(term, decodeHtml(term.name), context))}
                    {options.length > visibleCount && (
                        <button
                            type="button"
                            onClick={() => {
                                nextVisibleOption.current = options[visibleCount].term.slug;
                                setVisibleCount(visibleCount + PAGE_SIZE);
                            }}
                            className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm font-semibold text-[#a8410b] hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-[#a8410b]"
                        >
                            {t.more}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
