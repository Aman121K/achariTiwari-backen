# AI Blog Automation deployment setup

The backend now exposes a protected daily generator at:

`POST /api/blog/automation/cron`

The included GitHub Actions workflow checks the endpoint hourly. The backend runs only during the UTC hour selected in admin (default `03`, approximately 08:30–09:30 IST) and is idempotent for an India-calendar day, so retries do not create a second daily post.

## 1. Backend environment variables

Add these to the production backend environment and redeploy:

```env
GEMINI_API_KEY=your_rotated_server_side_gemini_key
GEMINI_TEXT_MODEL=gemini-3.6-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-lite-image
CRON_SECRET=a_long_random_secret_at_least_32_characters
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name
SITE_URL=https://acharitiwari.vercel.app
```

Never put `GEMINI_API_KEY`, `CRON_SECRET`, or `CLOUDINARY_URL` in Vite/frontend environment variables. Gemini image generation requires a billing-enabled Google AI project.

Generate a suitable cron secret locally with:

```bash
openssl rand -hex 32
```

## 2. GitHub Actions repository secrets

In the backend GitHub repository, open **Settings → Secrets and variables → Actions** and add:

- `API_BASE_URL`: the backend origin only, for example `https://api-achar.phoneclubs.com`
- `CRON_SECRET`: exactly the same value used by the backend

The workflow is `.github/workflows/daily-blog.yml`. It can also be tested manually from the repository’s **Actions** tab with **Run workflow**.

## 3. Google AI account

- Create or select a Google AI Studio / Gemini API project.
- Enable billing for native image generation.
- Create a new API key and use it only in the backend environment. Revoke any key that was posted in chat or otherwise exposed.
- Set project usage limits/alerts appropriate for one text generation plus one medium landscape image per day.

## 4. Cloudinary

The generated image is uploaded to the existing `media/blogs` folder. Confirm the production backend already has a working `CLOUDINARY_URL`.

## 5. Admin controls

After the backend and admin are deployed:

- **Generate Blog** creates an AI draft immediately.
- **Schedule** enables/disables daily runs and chooses auto-publish or draft mode.
- Editing a post exposes **Regenerate Blog**, **Regenerate Image**, **Publish**, and **Draft**.

## 6. Safe first-run recommendation

Set the schedule to **Save as draft**, manually run the workflow, inspect the generated article/image/internal links, and publish it from admin. Change to automatic publishing only after the first few drafts meet the brand standard.

## Troubleshooting

- `401 Invalid cron authorization`: GitHub and backend `CRON_SECRET` values differ.
- `GEMINI_API_KEY is not configured`: add the backend environment variable and redeploy.
- `Cloudinary is not configured`: add/fix `CLOUDINARY_URL`.
- Image access or billing error: enable billing for the Gemini API project and confirm access to `gemini-3.1-flash-lite-image`.
- `Today’s blog was already generated`: expected idempotency; use **Generate Blog** in admin for an additional manual draft.
