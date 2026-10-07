# Creative Studio

A local web app for making social posts for several companies. Each company is a **workspace**; inside it you create **campaigns** (key visual inputs and background images) and then **posts** (text laid out on a background, exported as PNG).

## Run

Requires Node.js 20.19+ or 22.12+.

```powershell
npm install
npm run dev
```

Open the URL Vite prints. On first launch you set a password (8+ characters); it is hashed with scrypt and stored in `data/auth.json`.

To generate backgrounds with AI, click **API** in the top bar and add one or more keys (OpenAI or Gemini). Keys are stored on this machine in `data/keys.json`, are never sent back to the browser (only the last 4 characters are shown), and you pick which key to use each time you generate. Without a key you can still upload your own backgrounds and export posts. A key in `.env.local` (see `.env.example`) also works and shows up in the list.

## Workflow

1. **Workspace**: one per company. Holds company info (name, industry, audience, tone, default footer line) and logos.
2. **Campaign**: holds the key visual inputs (a PDF can fill them in: **Nhập từ PDF Key Visual**): concept, main element, palette, accent color, text tone, fonts (Google Fonts name or an uploaded font file), things to avoid and up to 4 reference images. Generate or upload a few background images here, one per aspect ratio you need. **Thành phần đồ họa**: importing a key visual PDF finds and cuts out the graphic elements (stars, flight paths, cards, stamps, logos…) automatically, removing the background and the caption text, and lets you tick which to keep and which become the workspace logo. For fine-tuning, drag a box around an element on any page or image ("Cắt từ ảnh/PDF"): the background is removed so only the element stays, and "Tự tách nhiều thành phần" splits an area into pieces. Saved components can be placed, dragged, resized, rotated and faded on any post.
3. **Post**: pick a format (Feed 1080×1350, Square, Story 1080×1920 with 250px safe zones, Cover 1640×624), write the label, headline, accent line, lead text, CTA and footer, choose a background and export the PNG.

### Content plan
In a campaign, **Nhập kế hoạch (Excel)** reads a content-plan workbook (sheets for strategy, calendar, captions, visual brief and checklist). It creates one *piece* per planned item with its caption, hashtags, pre-publish checklist, visual brief and draft slides (carousels are split from the "S1, S2…" structure). Reels are listed and tracked but parked: no visuals are made for them.

- **Variables**: every `[PLACEHOLDER]` found in the copy is listed once under *Biến chiến dịch*. Fill it once and it is substituted in the preview, the exported PNGs and the caption.
- **Checks**: risky claims (guaranteed results, "cứu hồ sơ", scholarship wording…) are flagged in the caption and slides, plus the campaign's own banned phrases. A piece can only be marked *Sẵn sàng* when no variable is empty and its checklist is done.
- **AI draft** (OpenAI or Gemini, per key): writes the on-image copy for each slide from the plan, strategy and "do not say" list. Set the text model per key in the API dialog.
- **Pack**: exports the slide PNGs plus `caption.txt` as one zip.
- **Schedule table**: switch the plan list to *Bảng theo ngày* to set each piece's date and time, change its status, and see warnings (missing variables, open checks, due soon, outside the campaign window, same-day clashes). *Gợi ý lịch* spreads undated pieces evenly across the window found in the strategy, and the table exports to CSV.

The AI only produces the background; it is told never to render text. Text, logo and CTA are drawn by one renderer (`src/lib/render.ts`) shared by the preview and the export.

## Data

Everything lives in `data/` (ignored by Git): `store.json` (workspaces, campaigns, posts), `assets/` (uploads and generated images) and `auth.json`. Back up that folder to back up your work.

## Scripts

- `npm run dev`: API server and Vite together.
- `npm run build`, `npm run preview`, `npm run lint`.
