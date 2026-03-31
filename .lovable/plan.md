

## Kenyan Service Marketplace — Mobile App (Phase 1: Auth & Roles)

### Visual Identity
- **Bold & colorful** design inspired by Kenyan aesthetics — vibrant greens, reds, and warm earth tones
- Mobile-first layout with large touch targets, rounded cards, and smooth transitions

### Authentication & Onboarding Flow
1. **Welcome/Splash Screen** — App branding with "Get Started" and "Sign In" buttons
2. **Registration Screen**
   - Email & password fields (with strength validation)
   - Google sign-in button
   - **Role selection step** — user picks one of: Service Provider, Job Seeker, or Client (visual cards with icons)
3. **Login Screen** — Email/password + Google sign-in
4. **Logout** — accessible from profile/settings

### User Roles & Access Control
- Roles stored in a dedicated `user_roles` table (not on profiles) with RLS policies
- Security-definer function `has_role()` for safe role checks
- Role-based UI: after login, users see only features matching their role

### Database Structure
- **profiles** table — name, avatar, phone, location (linked to auth.users)
- **user_roles** table — user_id + role enum (provider / job_seeker / client)
- Auto-create profile + role on signup via database trigger

### Pages & Components
| Page | Description |
|------|-------------|
| Welcome | Splash with branding, Get Started / Sign In |
| Register | Email/password, Google, role selection |
| Login | Email/password + Google |
| Dashboard | Role-specific home (placeholder content for future modules) |
| Profile | View/edit profile, logout |

### Capacitor (Native App)
- Install Capacitor with iOS & Android targets
- Configure for hot-reload during development
- Ready for app store builds

### Backend (Lovable Cloud)
- Supabase auth with email/password + Google
- RLS policies enforcing role-based access
- Secure password handling (built-in)

