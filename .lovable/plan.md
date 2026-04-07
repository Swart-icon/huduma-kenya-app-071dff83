

## Plan: Add Location Detection to Provider Profile & Service Creation

### Problem
Providers currently enter city/county text but no latitude/longitude coordinates are saved on their profile or services. The map and nearby discovery features rely on these coordinates, so providers don't appear on the map.

### What We'll Build
A reusable "Location Section" in both the Provider Profile Edit and Create Service forms that lets providers either auto-detect their GPS location or manually pick a Kenyan city. The coordinates get saved to the database alongside the existing city/county fields.

### Technical Approach

**1. Update ProviderProfile type and save logic** (`src/pages/ProviderProfileEdit.tsx`)
- Add `latitude` and `longitude` to the local `ProviderProfile` type
- Load existing lat/lng from the database on fetch
- Add a "Location" section in the form UI with:
  - "Detect My Location" button (uses `navigator.geolocation`)
  - Manual city picker dropdown (reuse the `KENYAN_LOCATIONS` list from `LocationPicker.tsx`)
  - Display detected coordinates with a confirmation message
- Include lat/lng in the save payload to `provider_profiles` table

**2. Update CreateService page** (`src/pages/CreateService.tsx`)
- Add `latitude` and `longitude` state fields
- Add the same location detection UI (detect button + manual city fallback)
- Include lat/lng in the insert payload to `services` table
- When a provider selects a county/city manually from the existing dropdowns, auto-populate approximate coordinates from the known city list

**3. Auto-populate coordinates from city selection**
- Use the same `KENYAN_LOCATIONS` array (with lat/lng for 15 major cities) already defined in `LocationPicker.tsx`
- Extract it into a shared constant file or import it
- When a provider selects a county in the existing dropdown, attempt to match and pre-fill coordinates

**4. No database changes needed**
- `provider_profiles` already has `latitude` and `longitude` columns
- `services` already has `latitude` and `longitude` columns
- Both are nullable doubles, ready to use

### Files to Change
- `src/pages/ProviderProfileEdit.tsx` — Add location detection section and save lat/lng
- `src/pages/CreateService.tsx` — Add location detection and save lat/lng
- `src/lib/kenyanLocations.ts` (new) — Shared city coordinates constant

