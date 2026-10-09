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
2. **Campaign**: holds the key visual inputs (a PDF can fill them in: **Nhập moodboard từ PDF**): concept, main element, palette, accent color, text tone, fonts (Google Fonts name or an uploaded font file), things to avoid and up to 4 reference images. Generate or upload a few background images here, one per aspect ratio you need. **Thành phần đồ họa**: importing a key visual PDF finds and cuts out the graphic elements (stars, flight paths, cards, stamps, logos…) automatically, removing the background and the caption text, and lets you tick which to keep and which become the workspace logo. For fine-tuning, drag a box around an element on any page or image ("Cắt từ ảnh/PDF"): the background is removed so only the element stays, and "Tự tách nhiều thành phần" splits an area into pieces. Saved components can be placed, dragged, resized, rotated and faded on any post.
3. **Post**: pick a format (Feed 1080×1350, Square, Story 1080×1920 with 250px safe zones, Cover 1640×624), write the label, headline, accent line, lead text, CTA and footer, choose a background and export the PNG.

### Content plan
In a campaign, **Nhập kế hoạch (Excel)** reads a content-plan workbook (sheets for strategy, calendar, captions, visual brief and checklist). It creates one *piece* per planned item with its caption, hashtags, pre-publish checklist, visual brief and draft slides (carousels are split from the "S1, S2…" structure). Reels are listed and tracked, with a **production** field: a reel whose brief shows real people (mentor, A-roll) is marked *Bên ngoài* and handled by another team (the app downloads a hand-off brief `.md` with the timed beats, copy, visual brief, assets and checklist); a reel without people is marked *Nội bộ* and is meant to be made in this app (storyboard and motion, planned). The plan's calendar sheet may carry an optional column named *Bên sản xuất* (or *Production*, *Bàn giao*) with values like "Nội bộ" or "Bên ngoài - Studio X"; it is read on import, shown in the schedule table and exported in the CSV.

- **Variables**: every `[PLACEHOLDER]` found in the copy is listed once under *Thông tin cần điền*, grouped (contact, offer, mentor), with where each is used and an example sentence. Fill it once and it is substituted in the preview, the exported PNGs and the caption.
- **Piece resources**: each piece lists the material the plan says it needs (*Tài nguyên cần chuẩn bị*: mentor portrait, logo, credential, consent…). Upload real photos there, optionally cut the background (plain backdrops only), and place them on a slide as a layer. Real photos are composited, never AI-generated.
- **Main visual**: *Hình ảnh/biểu tượng chính* in the campaign holds the hero images (picked automatically from the key visual PDF, editable). They are sent first as references when generating backgrounds.
- **Checks**: risky claims (guaranteed results, "cứu hồ sơ", scholarship wording…) are flagged in the caption and slides, plus the campaign's own banned phrases. A piece can only be marked *Sẵn sàng* when no variable is empty and its checklist is done.
- **AI draft** (OpenAI or Gemini, per key): writes the on-image copy for each slide from the plan, strategy and "do not say" list. Set the text model per key in the API dialog.
- **Finished images**: each piece has an *Ảnh hoàn chỉnh* gallery showing every slide exactly as it will be exported (background, components, text); click one to enlarge and download it. Backgrounds can be enlarged the same way. *Xuất ảnh hoàn chỉnh* on the campaign page zips every piece's PNGs and caption into one folder per piece.
- **Edit by comment**: in the Studio, *Khoanh vùng + ghi chú để chỉnh* lets you drag **several** boxes on the slide (numbered 1, 2, 3…), write a comment for each, and apply them in one go. By default each run creates a **new revised copy** next to the original (marked *Bản chỉnh*, not exported until you click *Dùng bản này*); you can also edit in place. The same comments can be applied to many slides at once (*Cùng nền* picks every slide sharing the background; slides sharing a background share one edited background, so it is paid for once). The AI sees each slide with your boxes outlined. The AI sees the slide with your box outlined and returns minimal edits: wording, text size/position, soft darkening behind text, moving or removing components, and, only when the picture itself must change, an image edit limited to the outlined area (saved as a new background version, so the old one stays). Every step can be undone. Needs an API key; background edits cost one image.
- **Legibility**: the renderer fits the headline to three lines, balances line breaks, gives Vietnamese diacritics extra line height and darkens locally behind text where the background is bright or busy. Generated backgrounds are asked to keep the upper 55% calm and the focal point low.
- **Reels made in the app** (no people): the plan's timed beats become *scenes* (one 1080×1920 frame each, with its own duration); they use the same editor, AI draft, backgrounds, components and comment-edits as slides. *Xuất storyboard (zip)* gives a PNG per scene, a contact sheet and a script table; *Xuất MP4* renders an H.264 1080×1920 30 fps file in the browser (WebCodecs, Chrome/Edge): slow push-in on the background, text rising in and out per scene, the CTA popping in, and a route line with a travelling star along the bottom. No audio: add music and voice-over in a video editor.
- **Pack**: exports the slide PNGs plus `caption.txt` as one zip.
- **Schedule table**: switch the plan list to *Bảng theo ngày* to set each piece's date and time, change its status, and see warnings (missing variables, open checks, due soon, outside the campaign window, same-day clashes). *Gợi ý lịch* spreads undated pieces evenly across the window found in the strategy, and the table exports to CSV.

The AI only produces the background; it is told never to render text. Text, logo and CTA are drawn by one renderer (`src/lib/render.ts`) shared by the preview and the export.

## Data

Everything lives in `data/` (ignored by Git): `store.json` (workspaces, campaigns, posts), `assets/` (uploads and generated images) and `auth.json`. Back up that folder to back up your work.

## Scripts

- `npm run dev`: API server and Vite together.
- `npm run build`, `npm run preview`, `npm run lint`.
