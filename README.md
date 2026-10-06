# Creative Studio

A local web app for making social posts for several companies. Each company is a **workspace**; inside it you create **campaigns** (key visual inputs and background images) and then **posts** (text laid out on a background, exported as PNG).

## Run

Requires Node.js 20.19+ or 22.12+.

```powershell
npm install
npm run dev
```

Open the URL Vite prints. On first launch you set a password (8+ characters); it is hashed with scrypt and stored in `data/auth.json`.

To generate backgrounds with AI, copy `.env.example` to `.env.local` and set `AI_PROVIDER` and `AI_API_KEY`. Without a key you can still upload your own backgrounds and export posts.

## Workflow

1. **Workspace**: one per company. Holds company info (name, industry, audience, tone, default footer line) and logos.
2. **Campaign**: holds the key visual inputs: concept, main element, palette, accent color, text tone, fonts (Google Fonts name or an uploaded font file), things to avoid and up to 4 reference images. Generate or upload a few background images here, one per aspect ratio you need.
3. **Post**: pick a format (Feed 1080×1350, Square, Story 1080×1920 with 250px safe zones, Cover 1640×624), write the label, headline, accent line, lead text, CTA and footer, choose a background and export the PNG.

The AI only produces the background; it is told never to render text. Text, logo and CTA are drawn by one renderer (`src/lib/render.ts`) shared by the preview and the export.

## Data

Everything lives in `data/` (ignored by Git): `store.json` (workspaces, campaigns, posts), `assets/` (uploads and generated images) and `auth.json`. Back up that folder to back up your work.

## Scripts

- `npm run dev`: API server and Vite together.
- `npm run build`, `npm run preview`, `npm run lint`.
