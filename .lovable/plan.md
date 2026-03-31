

## Replace Emoji Category Icons with Lucide Icons

### Problem
Categories currently display emoji characters (🏗️, 🚗, etc.) as icons. The user wants real icons instead.

### Approach
Replace the emoji-based rendering with **Lucide React icons** mapped to each category slug. Lucide is already installed and used throughout the app. This avoids needing to source/host separate image files while giving a clean, consistent icon style.

### Categories to Map (15 total)

| Slug | Lucide Icon |
|------|-------------|
| construction | HardHat |
| automotive | Car |
| electronics | Cpu |
| it-services | Monitor |
| home-services | Home |
| business-services | Briefcase |
| education | GraduationCap |
| health-wellness | HeartPulse |
| hospitality | UtensilsCrossed |
| security-logistics | ShieldCheck |
| agriculture | Wheat |
| beauty-lifestyle | Sparkles |
| media-creative | Clapperboard |
| transport | Truck |
| retail-trade | ShoppingCart |

### Files to Change

1. **`src/pages/Welcome.tsx`**
   - Expand `categoryIcons` map to cover all 15 slugs with Lucide icons
   - Change the render logic: always use `categoryIcons[cat.slug]` instead of showing `cat.icon` (emoji)
   - Style icons with `text-primary` color for consistency

2. **`src/pages/Categories.tsx`**
   - Import the same icon map (or define inline) instead of rendering `{cat.icon}` emoji
   - Replace `<span className="text-3xl">{cat.icon}</span>` with the corresponding Lucide icon

### Result
All category icons will be clean, vector Lucide icons matching the app's design system — no emojis anywhere.

