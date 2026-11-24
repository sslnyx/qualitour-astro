import useEmblaCarousel from "embla-carousel-react";
import { useEffect, useState, type ReactNode } from "react";
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
  const [viewportRef, carousel] = useEmblaCarousel({
    align: "start",
    breakpoints: { "(prefers-reduced-motion: reduce)": { duration: 0 } },
  });
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);
  const trackId = "home-transfer-routes";
  const zh = lang === "zh";

  useEffect(() => {
    if (!carousel) return;

    const updateControls = () => {
      setCanScrollBack(carousel.canScrollPrev());
      setCanScrollForward(carousel.canScrollNext());
    };
    const revealLinkedRoute = () => {
      const id = window.location.hash.slice(1);
      if (!id) return;

      const index = carousel.slideNodes().findIndex(slide => slide.firstElementChild?.id === id);
      if (index < 0) return;
      // The browser may have scrolled the hidden viewport to the fragment before hydration.
      carousel.rootNode().scrollLeft = 0;
      carousel.scrollTo(Math.min(index, carousel.scrollSnapList().length - 1), true);
    };

    revealLinkedRoute();
    updateControls();
    carousel.on("select", updateControls).on("reInit", updateControls);
    window.addEventListener("hashchange", revealLinkedRoute);

    return () => {
      carousel.off("select", updateControls).off("reInit", updateControls);
      window.removeEventListener("hashchange", revealLinkedRoute);
    };
  }, [carousel]);

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
          onClick={() => carousel?.scrollPrev()}
        >
          <span className="material-icons" aria-hidden="true">chevron_left</span>
        </button>
        <button
          type="button"
          aria-controls={trackId}
          aria-label={zh ? "下一條接送路線" : "Next transfer route"}
          aria-disabled={!canScrollForward}
          className={buttonStyle}
          onClick={() => carousel?.scrollNext()}
        >
          <span className="material-icons" aria-hidden="true">chevron_right</span>
        </button>
      </div>
      <div ref={viewportRef} className="-mx-1 overflow-hidden px-1">
        <ul
          id={trackId}
          aria-label={zh ? "私人接送路線" : "Private transfer routes"}
          tabIndex={0}
          onKeyDown={event => {
            if (event.target !== event.currentTarget) return;
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            if (event.key === "ArrowLeft") carousel?.scrollPrev();
            else carousel?.scrollNext();
          }}
          className="grid auto-cols-[88%] grid-flow-col gap-4 pt-8 pb-4 [touch-action:pan-y_pinch-zoom] focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-orange-700 sm:auto-cols-[calc((100%-1.5rem)/2)] sm:gap-6 lg:auto-cols-[calc((100%-3rem)/3)]"
        >
          {children}
        </ul>
      </div>
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
          <li key={route.id} className="min-w-0 [&>article]:h-full">
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
