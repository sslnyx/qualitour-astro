/**
 * Qualitour's two offices, as given by the team (WeChat, 2026-11-18). One list feeds the contact page, the footer
 * and the maps so the addresses cannot drift apart. The Richmond office is in Lansdowne Mall.
 */
export interface CompanyBranch {
    id: "vancouver" | "richmond";
    name: { en: string; zh: string };
    street: string;
    city: string;
    province: string;
    postal: string;
    phone: string;
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
    },
    {
        id: "richmond",
        name: { en: "Richmond Branch (Lansdowne Mall)", zh: "列治文分店（Lansdowne Mall）" },
        street: "5300 Number 3 Rd #919",
        city: "Richmond",
        province: "BC",
        postal: "V6X 2X9",
        phone: "17789457000",
    },
];

export const branchAddressLine = (branch: CompanyBranch): string =>
    `${branch.street}, ${branch.city}, ${branch.province} ${branch.postal}, Canada`;

/** Keyless Google Maps embed for an address. */
export const branchMapUrl = (branch: CompanyBranch): string =>
    `https://www.google.com/maps?q=${encodeURIComponent(branchAddressLine(branch))}&output=embed`;
