/**
 * Qualitour's two offices: addresses as given by the team (WeChat, 2026-11-18); names and opening hours as shown on the
 * offices' Google Maps listings (checked 2026-11-19; the Richmond listing is in Lansdowne Centre). One list feeds the
 * contact page, the footer and the maps so they cannot drift apart. The main phone number is the Vancouver office's.
 */
export interface CompanyBranch {
    id: "vancouver" | "richmond";
    name: { en: string; zh: string };
    street: string;
    city: string;
    province: string;
    postal: string;
    phone: string;
    hours: { en: string; zh: string };
}

export const COMPANY_BRANCHES: CompanyBranch[] = [
    {
        id: "vancouver",
        name: { en: "Vancouver Branch", zh: "溫哥華分店" },
        street: "8283 Granville St",
        city: "Vancouver",
        province: "BC",
        postal: "V6P 4Z6",
        phone: "17789456000",
        hours: { en: "Mon-Fri 11am-5pm PST", zh: "週一至週五 11am-5pm PST" },
    },
    {
        id: "richmond",
        name: { en: "Richmond Branch (Lansdowne Centre)", zh: "列治文分店（Lansdowne Centre）" },
        street: "5300 Number 3 Rd #919",
        city: "Richmond",
        province: "BC",
        postal: "V6X 2X9",
        phone: "17789457000",
        hours: {
            en: "Sun-Thu 10am-7pm, Fri-Sat 10am-8pm PST",
            zh: "週日至週四 10am-7pm，週五、週六 10am-8pm PST",
        },
    },
];

export const branchAddressLine = (branch: CompanyBranch): string =>
    `${branch.street}, ${branch.city}, ${branch.province} ${branch.postal}, Canada`;

/** Keyless Google Maps embed for an address. */
export const branchMapUrl = (branch: CompanyBranch): string =>
    `https://www.google.com/maps?q=${encodeURIComponent(branchAddressLine(branch))}&output=embed`;
