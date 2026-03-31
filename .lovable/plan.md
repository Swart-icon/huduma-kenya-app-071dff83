

## Payment & Review System

### Database Changes (1 migration)

**`reviews` table:**
- `id`, `booking_id` (unique FK to bookings), `client_id`, `provider_id`, `rating` (1-5 integer), `comment` (text, nullable), timestamps
- RLS: clients can insert only for their own completed bookings (one review per booking); everyone can read; no update/delete

**`payments` table:**
- `id`, `booking_id` (unique FK to bookings), `client_id`, `provider_id`, `amount` (numeric), `status` (pending/completed/failed), `payment_method` (text), timestamps
- RLS: clients can insert for own bookings; both parties can view their own payments; no delete

**Validation:**
- Review insert trigger: verify booking status = 'completed' and client_id matches booking's client_id
- One review per booking enforced via unique constraint on `booking_id`

### New Pages

1. **`src/pages/PaymentScreen.tsx`** — Client pays for a booking
   - Shows booking summary, amount, simple payment confirmation (simulated for now — no real payment gateway yet)
   - Creates payment record linked to booking
   - Updates booking with payment reference

2. **`src/pages/ReviewForm.tsx`** — Client reviews a completed booking
   - Star rating (1-5), comment textarea
   - Only accessible for completed bookings without existing review
   - Submits to `reviews` table

3. **`src/pages/ProviderReviews.tsx`** — Public view of a provider's reviews
   - Average rating display, review list with client names

### Existing Page Updates

- **`MyBookings.tsx`** — Add "Pay" button for accepted bookings (clients), "Leave Review" button for completed bookings without a review
- **`ServiceDetail.tsx`** — Show provider's average rating and review count; link to full reviews
- **`ProviderProfilePreview.tsx`** — Display reviews section
- **`App.tsx`** — Add routes: `/payment/:bookingId`, `/review/:bookingId`, `/provider/:providerId/reviews`

### Technical Details

- Reviews query uses a join to `profiles` for client names
- Average rating computed client-side from reviews array (or a DB function if performance matters later)
- Payment is simulated (record-keeping only) — ready for Stripe integration later
- Star rating component built inline with interactive touch targets

