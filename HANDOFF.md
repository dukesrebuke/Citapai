# Citapai — Handoff v1

## WHAT WAS DONE — 2026-04-14 (session 1)

### Registered in claude_desktop_config.json
- Added `citapai` to the `projects` array in `~/Library/Application Support/Claude/claude_desktop_config.json`
- Fields: `id`, `name`, `description`, `path`, `url`, `tech`, `tags`

---

### index.html — Landing Page (full rewrite)
- Replaced the old single-page app with a proper **landing page** following the GoDateChi pattern
- **Design system:** La Ciudad Primavera Eterna — Medellín's eternal spring identity
  - `--forest: #0d2218` — deep jungle dark background
  - `--canopy: #12301f` — rich forest secondary bg
  - `--bloom: #9b4f8e` — orchid purple as primary accent (replaces GoDate's red)
  - `--gold: #e8a020` — Medellín sunlight (available for future use)
  - `--text: #e8f0e2` — soft botanical white
- **Typography:** Bebas Neue + Cormorant Garamond + DM Mono (identical stack to GoDateChi)
- **Sections:**
  - Fixed topbar (scroll-aware frosted glass, `CIUDAD PRIMAVERA ETERNA` tag)
  - Hero: ghost `MDE` letterform, botanical leaf emoji accents, staggered fade-up animations
  - Neighborhood ticker strip (Medellín barrios scrolling on loop)
  - Stats: 16+ Comunas / 4 Parámetros / 0 Registro
  - 3-column Features (Elige el vibe / La IA lee el ambiente / Aparece)
  - Pull quote with ghost `"` letterform in orchid
  - How-it-works (4 ruled steps)
  - Final CTA with radial bloom glow
  - Footer
- CTAs link to `/app.html`
- Grain overlay via inline SVG filter

---

### app.html — Full React App (new file)
- **New file** — old monolithic `index.html` app logic now lives at `/app.html` (same pattern as GoDateChi: landing at root, app at `/app.html`)
- React 18 + Babel CDN — no build step
- **Primavera Eterna tokens** applied to all UI elements:
  - Dark mode: `--bg: #0d2218` (Bosque Nocturno)
  - Light mode: `--bg: #f4f8f0` (Tarde de Primavera), warm botanical off-white
  - Accent: `--bloom: #9b4f8e` on pills, card accent bar, buttons
- **Features (parity with GoDateChi app.html):**
  - Sticky topbar with logo link + Saved toggle + Lang toggle + Theme toggle
  - Dark/light mode (default: light), persisted to `localStorage`
  - **Language toggle (EN/ES)** — unique to Citapai; full i18n via `T` object; persisted to `localStorage`; all labels, filter options, loading lines, toasts switch instantly
  - Filter pills: Date Type, Time of Day, Atmosphere, Price Range, Neighborhood (12 Medellín barrios)
  - Animated loading state: 5 bilingual loading lines cycle during API call
  - Result card: Location (neighborhood), Title (Bebas Neue), italic Description, Pro Tip callout, meta grid (Hours, Best Time, Cost, Crowd), citation box from Gemini grounding
  - Result actions: View on Map / Save / Share / Try Another
  - Save to localStorage (`citapai_saved_v1`), max 20 items
  - Share via base64-encoded `?shared=` URL param, clipboard copy with fallback
  - Saved drawer in topbar with Map / Share / Remove per item
  - Toast notifications for all feedback actions
  - Shared link handler: decodes on load, renders result, cleans URL

---

### generate.js — Unchanged
- Existing Netlify function at `netlify/functions/generate.js` — no changes needed
- App now passes `userQuery` and `systemPrompt` built client-side (same shape as before)
- System prompt upgraded: "La Ciudad Primavera Eterna" expert persona, bilingual response support, 7-field format with MapQuery for Google Maps deep link

---

### netlify.toml — Updated
- Added `/app → /app.html` redirect
- Catch-all `/* → /index.html` retained (landing catches unknown paths)

---

## File Structure
```
citapai/
├── index.html              ← Landing page (Primavera Eterna dark editorial)
├── app.html                ← React app (Gemini-powered date curator, EN/ES)
├── netlify.toml            ← /app redirect + catch-all
├── images/
│   └── citapai.png         ← Logo
├── netlify/functions/
│   └── generate.js         ← Serverless Gemini proxy (unchanged)
├── .gitignore
├── README.md
└── HANDOFF.md              ← This file
```

## Design Tokens — La Ciudad Primavera Eterna
```css
/* Dark (Bosque Nocturno) */
--forest:     #0d2218;   /* deep jungle background */
--canopy:     #12301f;   /* secondary surface */
--leaf:       #1a3a2a;   /* card/hover surface */
--bloom:      #9b4f8e;   /* orchid — primary accent */
--bloom-hot:  #b45fa6;   /* orchid hover */
--bloom-glow: rgba(155,79,142,0.22);
--gold:       #e8a020;   /* Medellín sunlight (available) */
--text:       #e8f0e2;   /* soft botanical white */

/* Light (Tarde de Primavera) */
--bg:         #f4f8f0;   /* warm botanical off-white */
--bg-card:    #ffffff;
--text:       #0d2218;   /* deep forest charcoal */
```

Fonts: **Bebas Neue** (display/headlines) · **Cormorant Garamond** (body/italic) · **DM Mono** (labels/UI)

## Environment Variables
| Variable | Where Set | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | Netlify → Site Settings → Env Vars | Authenticates Gemini 2.5 Flash |

## Architecture
- `citapai.netlify.app` → landing page (`index.html`)
- `citapai.netlify.app/app.html` → React date curator
- `citapai.netlify.app/app` → redirects to `/app.html`
- `/.netlify/functions/generate` → Gemini 2.5 Flash proxy with Google Search Grounding

## Local Dev
```bash
# No build step needed
netlify dev
# Requires GEMINI_API_KEY in .env
```

## Known Limitations / Next Steps
- `ProTip` and `PriceNote` fields added to system prompt but not yet returned by current prompt format — could upgrade generate.js system prompt to add these fields
- Neighborhood filter limited to 12 barrios — could expand to corregimientos and Área Metropolitana
- No streaming — result appears after full response
- Could add a "shuffle neighborhood" button for discovery mode
- Consider adding Medellín-specific categories: Metrocable, El Peñol day trip, Parque Arví
