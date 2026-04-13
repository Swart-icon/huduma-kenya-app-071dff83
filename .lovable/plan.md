

## Plan: In-App Camera Recording & User Video Profile

Two features to add:

### 1. In-App Camera Recording

Update `UploadVideoDialog.tsx` to offer two modes: **Record** (using `MediaRecorder` API with the phone camera) and **Upload** (existing file picker).

- Add a "Record Video" tab/button alongside "Upload Video"
- When "Record" is selected, show a live camera preview using `navigator.mediaDevices.getUserMedia({ video: true, audio: true })`
- Add record/stop controls with a timer display
- On stop, convert the recorded `Blob` to a `File` and feed it into the existing upload flow (description, category, location fields)
- The recorded video uses `video/webm` format (natively supported by `MediaRecorder`)
- Reuse the same metadata form and upload logic already in place

### 2. User Video Profile (My Videos)

Add a profile-style view showing all videos posted by a specific user, similar to TikTok's profile grid.

- Create a new page `src/pages/UserVideos.tsx` at route `/user/:userId/videos`
- Query `videos` table filtered by `user_id`, ordered by `created_at desc`
- Display as a grid of video thumbnails (3 columns) with view count overlay
- Tapping a thumbnail opens that video in a full-screen vertical player (reuse `VideoSlide`)
- Add a "My Videos" link/button on the Profile page and the bottom nav "Me" tab
- On each `VideoSlide`, make the username/avatar tappable to navigate to that user's video profile

### Files to create/edit

| File | Change |
|------|--------|
| `src/components/video/UploadVideoDialog.tsx` | Add camera recording tab with MediaRecorder logic |
| `src/pages/UserVideos.tsx` | New page: user's video grid + full-screen viewer |
| `src/App.tsx` | Add `/user/:userId/videos` route |
| `src/components/video/VideoSlide.tsx` | Make username/avatar tappable to navigate to user's videos |
| `src/pages/Profile.tsx` | Add "My Videos" navigation card |

### Technical details

- **MediaRecorder API**: Uses `getUserMedia` for camera access, records to `webm` blobs, converts to `File` for the existing Supabase storage upload pipeline
- **Video grid**: Uses CSS grid with `aspect-video` thumbnails; falls back to first frame via `<video>` element if no `thumbnail_url` exists
- **No database changes needed** -- all data already exists in the `videos` table

