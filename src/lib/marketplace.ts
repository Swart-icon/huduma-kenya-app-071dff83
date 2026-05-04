export type MarketplaceMode = "services" | "goods";

export type MarketplaceCategoryCopy = {
  title: string;
  subtitle: string;
};

type CategoryRecord = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sort_order: number;
};

type DecoratedCategory = CategoryRecord & {
  displayName: string;
  helperText: string;
};

type CategoryModeMeta = {
  modes: MarketplaceMode[];
  services: MarketplaceCategoryCopy;
  goods: MarketplaceCategoryCopy;
};

export const DEFAULT_MARKETPLACE_MODE: MarketplaceMode = "services";

export const MARKETPLACE_MODE_COPY: Record<MarketplaceMode, { title: string; subtitle: string }> = {
  services: {
    title: "Buying Services",
    subtitle: "Find skilled providers, technicians, and service businesses.",
  },
  goods: {
    title: "Buying Goods",
    subtitle: "Shop from sellers, stores, and product-based businesses.",
  },
};

const CATEGORY_MODE_META: Record<string, CategoryModeMeta> = {
  construction: {
    modes: ["services", "goods"],
    services: { title: "Construction", subtitle: "Builders, masons, painters, and contractors" },
    goods: { title: "Hardware", subtitle: "Building materials, tools, and site supplies" },
  },
  automotive: {
    modes: ["services", "goods"],
    services: { title: "Automotive Repair", subtitle: "Mechanics, diagnostics, and installers" },
    goods: { title: "Auto Parts", subtitle: "Spare parts, tyres, batteries, and accessories" },
  },
  electronics: {
    modes: ["services", "goods"],
    services: { title: "Electronics Repair", subtitle: "Repair technicians, installers, and device support" },
    goods: { title: "Electronics Shops", subtitle: "Phones, TVs, appliances, and gadgets" },
  },
  "it-services": {
    modes: ["services", "goods"],
    services: { title: "IT Services", subtitle: "Software setup, networking, websites, and support" },
    goods: { title: "Office Tech", subtitle: "Computers, printers, routers, and business devices" },
  },
  "home-services": {
    modes: ["services", "goods"],
    services: { title: "Cleaning & Plumbing", subtitle: "Cleaners, plumbers, electricians, and movers" },
    goods: { title: "Furniture & Home", subtitle: "Furniture, décor, fittings, and household items" },
  },
  "business-services": {
    modes: ["services", "goods"],
    services: { title: "Business Services", subtitle: "Printing, consulting, admin, and business support" },
    goods: { title: "Office Supplies", subtitle: "Packaging, stationery, shelves, and shop equipment" },
  },
  education: {
    modes: ["services", "goods"],
    services: { title: "Education Services", subtitle: "Tutors, trainers, and exam preparation" },
    goods: { title: "Books & Stationery", subtitle: "Books, revision materials, and school supplies" },
  },
  "health-wellness": {
    modes: ["services", "goods"],
    services: { title: "Health & Wellness", subtitle: "Therapists, trainers, and wellness professionals" },
    goods: { title: "Wellness Products", subtitle: "Supplements, skincare, and self-care essentials" },
  },
  hospitality: {
    modes: ["services", "goods"],
    services: { title: "Hospitality Services", subtitle: "Caterers, event teams, and accommodation support" },
    goods: { title: "Kitchenware", subtitle: "Cookware, utensils, catering gear, and dining items" },
  },
  "security-logistics": {
    modes: ["services", "goods"],
    services: { title: "Security & Logistics", subtitle: "Guards, couriers, and delivery operations" },
    goods: { title: "Safety Equipment", subtitle: "CCTV, locks, uniforms, and protective gear" },
  },
  agriculture: {
    modes: ["services", "goods"],
    services: { title: "Agriculture Services", subtitle: "Farm labor, spraying, irrigation, and advisory" },
    goods: { title: "Farm Supplies", subtitle: "Seeds, feeds, tools, fertilizers, and equipment" },
  },
  "beauty-lifestyle": {
    modes: ["services", "goods"],
    services: { title: "Beauty Services", subtitle: "Salons, barbers, makeup, and styling professionals" },
    goods: { title: "Fashion & Mitumba", subtitle: "Clothes, shoes, beauty products, and thrift items" },
  },
  "media-creative": {
    modes: ["services", "goods"],
    services: { title: "Media & Creative", subtitle: "Photographers, designers, editors, and creators" },
    goods: { title: "Print & Branding", subtitle: "Branded merchandise, signage, and printed materials" },
  },
  transport: {
    modes: ["services", "goods"],
    services: { title: "Transport Services", subtitle: "Movers, riders, drivers, and delivery providers" },
    goods: { title: "Transport Equipment", subtitle: "Helmets, racks, accessories, and travel gear" },
  },
  "retail-trade": {
    modes: ["goods", "services"],
    services: { title: "Retail Support", subtitle: "Shop setup, attendants, merchandising, and POS help" },
    goods: { title: "Wholesale Suppliers", subtitle: "Bulk stock, shop inventory, and resale products" },
  },
};

export const getMarketplaceMode = (value: string | null | undefined): MarketplaceMode => {
  return value === "goods" ? "goods" : DEFAULT_MARKETPLACE_MODE;
};

export const getMarketplaceCategoryCopy = (
  slug: string,
  mode: MarketplaceMode,
  fallbackName: string,
): MarketplaceCategoryCopy => {
  const meta = CATEGORY_MODE_META[slug];
  if (!meta) return { title: fallbackName, subtitle: fallbackName };
  return meta[mode];
};

export const getMarketplaceCategories = (
  categories: CategoryRecord[],
  mode: MarketplaceMode,
  search: string,
): DecoratedCategory[] => {
  const query = search.trim().toLowerCase();

  return categories
    .map((category) => {
      const copy = getMarketplaceCategoryCopy(category.slug, mode, category.name);
      return {
        ...category,
        displayName: copy.title,
        helperText: copy.subtitle,
      };
    })
    .filter((category) => {
      if (!query) return true;
      return [category.displayName, category.helperText, category.name]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .sort((a, b) => a.sort_order - b.sort_order);
};

export const getProviderTypesForMode = (mode: MarketplaceMode) => {
  return mode === "goods"
    ? ["selling_goods", "both"]
    : ["providing_services", "both"];
};
