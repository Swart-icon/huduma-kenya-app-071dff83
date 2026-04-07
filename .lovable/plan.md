

## Plan: First-Time User Onboarding Walkthrough

### Overview
Add a swipeable full-screen onboarding experience that shows once for new visitors before the Welcome page. Uses `localStorage` to track completion so it never shows again.

### Flow
1. User opens app for the first time → `Index.tsx` checks `localStorage` for `huduma-onboarded` flag
2. If not onboarded → redirect to `/onboarding`
3. User swipes through 4 slides, can skip or tap "Get Started" on the last slide
4. On completion → set `huduma-onboarded = true` in localStorage → navigate to `/welcome`

### Onboarding Slides (4 screens)
1. **Find Services** — "Discover trusted professionals near you" (Search/MapPin icon)
2. **Hire or Get Hired** — "Post jobs or apply as a skilled professional" (Briefcase icon)
3. **Share Your Work** — "Post videos and stories to showcase your skills" (Video icon)
4. **Secure Payments** — "Book and pay with confidence" (Shield icon)

### UI Design
- Full-screen slides with large centered icon, bold heading, short subtitle
- Dot indicators at the bottom showing current slide
- "Skip" link top-right on all slides except the last
- "Next" button on slides 1-3, "Get Started" button on slide 4
- Swipe gesture support via touch events
- Mobile-first, dark/light theme compatible

### Technical Details

**New file:** `src/pages/Onboarding.tsx`
- Swipeable carousel using touch event handlers (no extra dependency)
- Each slide is a full-viewport div with icon, title, subtitle
- Dot pagination + Next/Skip/Get Started buttons
- On complete: `localStorage.setItem("huduma-onboarded", "true")` then navigate to `/welcome`

**Edit:** `src/pages/Index.tsx`
- Before redirecting to `/welcome`, check if `localStorage.getItem("huduma-onboarded")` is falsy
- If not onboarded → navigate to `/onboarding` instead

**Edit:** `src/App.tsx`
- Add route: `<Route path="/onboarding" element={<Onboarding />} />`

### Files Changed
| File | Action |
|------|--------|
| `src/pages/Onboarding.tsx` | Create |
| `src/pages/Index.tsx` | Edit redirect logic |
| `src/App.tsx` | Add route |

