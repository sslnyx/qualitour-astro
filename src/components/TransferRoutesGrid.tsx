import { useEffect, useRef, useState, type ReactNode } from "react";
import TransferRouteCard from "./TransferRouteCard";
import type { TransferRoute } from "../lib/zaui/zaui";
import type { DirectionalTransferCovers } from "../lib/transfer-covers";

const categories = [
  { id: "airport", zh: "機場與溫哥華市區", en: "Airport & city", icon: "flight" },
  { id: "mountains", zh: "威士拿與太陽峰", en: "Whistler & Sun Peaks", icon: "terrain" },
  { id: "cruise", zh: "郵輪碼頭", en: "Cruise terminal", icon: "directions_boat" },
  { id: "seattle", zh: "西雅圖", en: "Seattle", icon: "directions_car" },
] as const;

function categoryFor(route: TransferRoute): (typeof categories)[number]["id"] {
  const stops = [route.fromLocation, route.toLocation];
  if (stops.includes("Whistler") || stops.includes("Sun Peaks")) return "mountains";
  if (stops.includes("Canada Place Cruise Terminal")) return "cruise";
  if (stops.includes("Seattle")) return "seattle";
  return "airport";
}

function renderCategoryTitle(group: (typeof categories)[number], lang: "en" | "zh") {
  const title = group[lang];
  if (group.id !== "airport") return title;
  const [start, end] = title.split(lang === "zh" ? "與" : " & ");
  if (!end) return title;
  return (
    <span className="inline-flex items-center gap-1">
      {start}
      <span className="material-icons text-lg text-orange-700" aria-hidden="true">swap_horiz</span>
      {end}
    </span>
  );
}

interface Props {
  routes: TransferRoute[];
  lang: "en" | "zh";
  hrefs: Record<string, string>;
  covers?: Record<string, DirectionalTransferCovers>;
  groupByDestination?: boolean;
}

function TransferRoutesCarousel({ children, lang }: { children: ReactNode; lang: Props["lang"] }) {
  const track = useRef<HTMLUListElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);
  const trackId = "home-transfer-routes";
  const zh = lang === "zh";

  useEffect(() => {
    const element = track.current;
    if (!element) return;

    const updateControls = () => {
      setCanScrollBack(element.scrollLeft > 1);
      setCanScrollForward(element.scrollWidth - element.clientWidth - element.scrollLeft > 1);
    };
    const observer = new ResizeObserver(updateControls);
    observer.observe(element);
    element.addEventListener("scroll", updateControls, { passive: true });
    updateControls();

    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", updateControls);
    };
  }, []);

  const scrollOneCard = (direction: -1 | 1) => {
    const element = track.current;
    if (!element || (direction === -1 ? !canScrollBack : !canScrollForward)) return;

    const [first, second] = element.children;
    const step = second.getBoundingClientRect().left - first.getBoundingClientRect().left;
    element.scrollBy({ left: direction * step });
  };

  const buttonStyle = "inline-flex size-11 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-800 hover:border-orange-600 hover:text-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700 aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:border-gray-300 aria-disabled:hover:text-gray-800";

  return (
    <>
      <div className={`mb-2 flex justify-end gap-2 ${canScrollBack || canScrollForward ? "" : "invisible"}`}>
        <button
          type="button"
          aria-controls={trackId}
          aria-label={zh ? "上一條接送路線" : "Previous transfer route"}
          aria-disabled={!canScrollBack}
          className={buttonStyle}
          onClick={() => scrollOneCard(-1)}
        >
          <span className="material-icons" aria-hidden="true">chevron_left</span>
        </button>
        <button
          type="button"
          aria-controls={trackId}
          aria-label={zh ? "下一條接送路線" : "Next transfer route"}
          aria-disabled={!canScrollForward}
          className={buttonStyle}
          onClick={() => scrollOneCard(1)}
        >
          <span className="material-icons" aria-hidden="true">chevron_right</span>
        </button>
      </div>
      <ul
        id={trackId}
        ref={track}
        aria-label={zh ? "私人接送路線" : "Private transfer routes"}
        tabIndex={0}
        className="-mx-1 grid snap-x snap-mandatory auto-cols-[88%] grid-flow-col gap-4 overflow-x-auto overscroll-x-contain scroll-px-1 scroll-smooth px-1 pt-8 pb-4 focus-visible:outline-2 focus-visible:outline-orange-700 motion-reduce:scroll-auto sm:auto-cols-[calc((100%-1.5rem)/2)] sm:gap-6 lg:auto-cols-[calc((100%-3rem)/3)]"
      >
        {children}
      </ul>
    </>
  );
}

export default function TransferRoutesGrid({ routes, lang, hrefs, covers, groupByDestination }: Props) {
  const renderCard = (route: TransferRoute) => (
    <TransferRouteCard
      key={route.id}
      route={route}
      lang={lang}
      hrefs={hrefs}
      cover={covers?.[route.id]}
      source={groupByDestination ? undefined : "home"}
    />
  );
  const renderCards = (items: TransferRoute[]) => (
    <div className="grid grid-cols-1 gap-x-6 gap-y-10 pt-6 md:grid-cols-2 lg:grid-cols-3">
      {items.map(renderCard)}
    </div>
  );

  if (!groupByDestination) {
    if (routes.length < 2) return renderCards(routes);

    return (
      <TransferRoutesCarousel lang={lang}>
        {routes.map(route => (
          <li key={route.id} className="min-w-0 snap-start [&>article]:h-full">
            {renderCard(route)}
          </li>
        ))}
      </TransferRoutesCarousel>
    );
  }

  const groups = categories
    .map(category => ({
      ...category,
      routes: routes.filter(route => categoryFor(route) === category.id),
    }))
    .filter(group => group.routes.length > 0);

  return (
    <>
      <nav
        aria-label={lang === "zh" ? "接送線路分類" : "Transfer route categories"}
        className="flex flex-wrap gap-2 border-b border-gray-200 pb-6"
      >
        {groups.map(group => (
          <a
            key={group.id}
            href={`#transfers-${group.id}`}
            aria-label={group[lang]}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 hover:border-orange-400 hover:text-orange-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
          >
            <span className="material-icons text-lg text-orange-700" aria-hidden="true">{group.icon}</span>
            {renderCategoryTitle(group, lang)}
          </a>
        ))}
      </nav>
      {groups.map(group => (
        <section
          key={group.id}
          id={`transfers-${group.id}`}
          aria-labelledby={`transfers-${group.id}-heading`}
          className="mt-8 scroll-mt-24 sm:mt-10"
        >
          <h3 id={`transfers-${group.id}-heading`} aria-label={group[lang]} className="mb-4 text-xl font-bold tracking-tight">
            {renderCategoryTitle(group, lang)}
          </h3>
          {renderCards(group.routes)}
        </section>
      ))}
    </>
  );
}
