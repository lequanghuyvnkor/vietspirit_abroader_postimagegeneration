# Creative Studio

An independent web app for preparing brand and campaign context, adding key visual references and real assets, generating an art-directed image background, composing editable social post layers, and exporting a full-size PNG.

## Run locally

Requirements: Node.js 20.19+ or 22.12+.

```powershell
npm install
npm run dev
```

Open the URL printed by Vite (usually http://127.0.0.1:5173). The app can also run without an API key so you can prepare the brief, upload assets, adjust the canvas and export the layout preview. Image generation supports OpenAI and Google Gemini. Keys stay on the local server and are not stored in the browser.

## Workflow

1. Create a campaign folder, then create a post inside it.
2. Add brand and campaign context, HEX brand colors, key visual references, photos, logos and visual components.
3. Generate an image, review the editable post preview, and export a full-size PNG.
4. Update your personal defaults and choose OpenAI or Google Gemini in Settings, then paste that provider's API key. Alternatively, configure it in `.env.local`.

Generated output is used as the background. Campaign copy and the uploaded logo/product photo are composed as separate layers so they remain legible and faithful to the supplied assets.

Campaigns, briefs, and personal settings are stored in the current browser; image assets use that browser's IndexedDB. This prototype has no sign-in, cloud sync, or shared workspaces, so use the same browser profile and back up important exports.

## Configuration

`.env.local` is ignored by Git. Available settings are listed in `.env.example`. Gemini image requests use Google's fixed Generative Language API endpoint; provider URLs cannot be customized. Selected model and quality must be enabled for your API key. Gemini supports image references; output aspect ratio is approximated to the closest supported ratio.

## Build

```powershell
npm run build
npm run preview
```
