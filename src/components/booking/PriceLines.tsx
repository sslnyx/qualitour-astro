import { FUEL_PERCENT, GST_PERCENT } from "../../lib/booking/pricing";

type Price = {
  amountMinor: number;
  baseMinor?: number;
  fuelMinor?: number;
  taxMinor?: number;
  discountMinor?: number;
  couponCode?: string;
  complimentary?: boolean;
};

/**
 * Base price, fuel surcharge, GST and total. Shown only when the breakdown is complete and adds up to the total, so a
 * booking made before the surcharge existed never displays a misleading split.
 */
export default function PriceLines({
  lang,
  price,
  currency = "cad",
  inline = false,
}: {
  lang: "zh" | "en";
  price: Price;
  currency?: string;
  /** Rows only (no list, no total), for use inside a <dl> that already shows the total. */
  inline?: boolean;
}) {
  const { amountMinor, baseMinor, fuelMinor, taxMinor } = price;
  const discount = price.discountMinor ?? 0;
  if (
    baseMinor === undefined ||
    fuelMinor === undefined ||
    taxMinor === undefined ||
    baseMinor + fuelMinor + taxMinor !== amountMinor
  )
    return null;
  const money = (minor: number) =>
    new Intl.NumberFormat(lang === "zh" ? "zh-CA" : "en-CA", {
      style: "currency",
      currency: currency.toUpperCase(),
      currencyDisplay: "code",
    }).format(minor / 100);
  const t = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const discountLabel = (indent: string) =>
    price.complimentary
      ? indent + t("免費安排", "Complimentary")
      : indent +
        (price.couponCode
          ? t(`優惠碼 ${price.couponCode}`, `Promo code ${price.couponCode}`)
          : t("優惠", "Discount"));
  if (inline)
    return (
      <>
        <div>
          <dt>{t("　標價", "　Base price")}</dt>
          <dd>{money(baseMinor + discount)}</dd>
        </div>
        {discount > 0 ? (
          <div>
            <dt>{discountLabel("　")}</dt>
            <dd>{"−" + money(discount)}</dd>
          </div>
        ) : null}
        <div>
          <dt>
            {t(
              `　燃油附加費（${FUEL_PERCENT}%）`,
              `　Fuel surcharge (${FUEL_PERCENT}%)`,
            )}
          </dt>
          <dd>{money(fuelMinor)}</dd>
        </div>
        <div>
          <dt>{t(`　GST（${GST_PERCENT}%）`, `　GST (${GST_PERCENT}%)`)}</dt>
          <dd>{money(taxMinor)}</dd>
        </div>
      </>
    );
  return (
    <dl className="qb-price-lines">
      <div>
        <dt>{t("標價", "Base price")}</dt>
        <dd>{money(baseMinor + discount)}</dd>
      </div>
      {discount > 0 ? (
        <div>
          <dt>{discountLabel("")}</dt>
          <dd>{"−" + money(discount)}</dd>
        </div>
      ) : null}
      <div>
        <dt>
          {t(
            `燃油附加費（${FUEL_PERCENT}%）`,
            `Fuel surcharge (${FUEL_PERCENT}%)`,
          )}
        </dt>
        <dd>{money(fuelMinor)}</dd>
      </div>
      <div>
        <dt>{t(`GST（${GST_PERCENT}%）`, `GST (${GST_PERCENT}%)`)}</dt>
        <dd>{money(taxMinor)}</dd>
      </div>
      <div className="qb-price-total">
        <dt>{t("合計", "Total")}</dt>
        <dd>{money(amountMinor)}</dd>
      </div>
    </dl>
  );
}
