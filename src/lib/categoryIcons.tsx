import constructionImg from "@/assets/categories/construction.png";
import automotiveImg from "@/assets/categories/automotive.png";
import electronicsImg from "@/assets/categories/electronics.png";
import itServicesImg from "@/assets/categories/it-services.png";
import homeServicesImg from "@/assets/categories/home-services.png";
import businessServicesImg from "@/assets/categories/business-services.png";
import educationImg from "@/assets/categories/education.png";
import healthWellnessImg from "@/assets/categories/health-wellness.png";
import hospitalityImg from "@/assets/categories/hospitality.png";
import securityLogisticsImg from "@/assets/categories/security-logistics.png";
import agricultureImg from "@/assets/categories/agriculture.png";
import beautyLifestyleImg from "@/assets/categories/beauty-lifestyle.png";
import mediaCreativeImg from "@/assets/categories/media-creative.png";
import transportImg from "@/assets/categories/transport.png";
import retailTradeImg from "@/assets/categories/retail-trade.png";

const categoryImages: Record<string, string> = {
  construction: constructionImg,
  automotive: automotiveImg,
  electronics: electronicsImg,
  "it-services": itServicesImg,
  "home-services": homeServicesImg,
  "business-services": businessServicesImg,
  education: educationImg,
  "health-wellness": healthWellnessImg,
  hospitality: hospitalityImg,
  "security-logistics": securityLogisticsImg,
  agriculture: agricultureImg,
  "beauty-lifestyle": beautyLifestyleImg,
  "media-creative": mediaCreativeImg,
  transport: transportImg,
  "retail-trade": retailTradeImg,
};

export const getCategoryIcon = (slug: string, size = 28) => {
  const src = categoryImages[slug];
  if (src) {
    return (
      <img
        src={src}
        alt={slug}
        width={size}
        height={size}
        loading="lazy"
        className="object-contain"
      />
    );
  }
  return <span className="text-xl">📦</span>;
};
