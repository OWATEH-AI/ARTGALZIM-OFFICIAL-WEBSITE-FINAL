# ARTGALZIM CENTER - Contemporary African Art Gallery

**Location:** Mverechena Business Center, Domboshava, Zimbabwe
**Website:** <https://artgalzim.com>
**Email:** <info@artgalzim.com>
**Phone:** +263 77 633 0869

## Development

npm install && npm run build

## Sanity content backend

The custom admin dashboard writes to the Sanity `production` dataset through the same-origin API. Artwork, exhibitions, posts, and media edits are saved as drafts. Use **Push & Sync Changes** to publish them. Public gallery and exhibition pages read published Sanity content. The API token is server-side only.

1. Revoke the API token previously shared in chat and create a replacement with write access to this dataset.
1. For local development, add the variables from `.env.example` to `.env`; preserve any existing database settings. Fill in `SANITY_API_TOKEN`, `ADMIN_PASSWORD`, and a random `ADMIN_SESSION_SECRET`.
1. For Cloudflare, authenticate Wrangler and set secrets without pasting them into chat:

```powershell
npx wrangler secret put SANITY_API_TOKEN
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put ADMIN_SESSION_SECRET
```

1. Import the existing `ARTISTS` folder to Sanity once with `npm run migrate:sanity` while the local `.env` is configured.
1. Publish the site and Worker with `npm run deploy`.

The Sanity dataset must allow public read access for published documents. Never add the write token to frontend JavaScript, HTML, or `wrangler.jsonc`.

### Sanity Studio

This repository includes the Studio configuration and document schemas in `sanity-studio/`. The schemas cover the artist, album/folder, artwork, exhibition, blog post, media library, and site content documents used by the API.

1. Install the Studio dependencies with `npm install --prefix sanity-studio`.
1. Start the Studio with `npm run studio`, then sign in with a Sanity account that has access to the configured project.
1. Run `npm run studio:build` to validate a production Studio build, or `npm run studio:deploy` to deploy the Studio to Sanity.

The Studio defaults to project `2a274c3r` and dataset `production`; override these with `SANITY_STUDIO_PROJECT_ID` and `SANITY_STUDIO_DATASET` if needed. The Studio and dashboard share the same Sanity documents. Dashboard deletes remain staged until **Push & Sync Changes** is used; publishing applies the removal in Sanity.

## Sanity API

- `GET /api/public-gallery` serves published artwork to gallery pages.
- `GET /api/public-content` serves published exhibitions, posts, and media.
- Admin API routes require the HttpOnly dashboard session and server-side secrets.
- `POST /api/sync` promotes Sanity drafts to published documents.

## License

MIT License - 2026 ARTGALZIM CENTER
