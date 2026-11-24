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

export default function TransferRoutesGrid({ routes, lang, hrefs, covers, groupByDestination }: Props) {
  const renderCards = (items: TransferRoute[]) => (
    <div className="grid grid-cols-1 gap-x-6 gap-y-10 pt-6 md:grid-cols-2 lg:grid-cols-3">
      {items.map(route => (
        <TransferRouteCard
          key={route.id}
          route={route}
          lang={lang}
          hrefs={hrefs}
          cover={covers?.[route.id]}
          source={groupByDestination ? undefined : "home"}
        />
      ))}
    </div>
  );

  if (!groupByDestination) return renderCards(routes);

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
