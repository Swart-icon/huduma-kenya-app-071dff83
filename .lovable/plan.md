

## Fix: Duplicate Role Error on Sign-In

### Problem
The user `mwirigievans17@gmail.com` already has an `admin` role (inserted via migration). When signing in and landing on `/register`, the role selection screen appears briefly before the redirect fires, and clicking "Continue" tries to INSERT a second role row, violating the unique constraint.

### Root Cause
`setUserRole` in `AuthContext.tsx` does a raw `insert` without checking if a role already exists. Additionally, the Register page shows the role selector momentarily even when a role is already assigned.

### Fix (2 changes)

**1. `src/contexts/AuthContext.tsx` — Make `setUserRole` handle existing roles**
- Change from `.insert()` to `.upsert()` (or check existing role first and skip insert)
- This prevents the duplicate key error

**2. `src/pages/Register.tsx` — Don't show role selection if role is loading**
- Add a loading guard so the role picker doesn't flash while `fetchRole` is still running
- The existing `useEffect` already redirects when `user && role` — just need to prevent interaction during the loading window

### Technical Details
- In `setUserRole`: use `supabase.from("user_roles").upsert({ user_id: user.id, role: selectedRole }, { onConflict: "user_id,role" })` or first check if role exists
- In Register: show a spinner/loading state while `loading` is true instead of immediately rendering the role picker

