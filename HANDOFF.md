# Citapai — Handoff v3

## WHAT WAS DONE — 2026-06-20 (session 3)

### 1. Closed-business hallucination fix → two-stage Finder/Writer split
- **Problem:** a single Gemini call at temp 1.1 was both picking the venue and writing creative copy. High temp + "hidden gem" framing increased the odds of recommending a closed/non-existent venue, and Google Search grounding was available as a tool but not mandatory — the model could skip it.
- **Fix:** split `generate.js` into two sequential calls:
  - **Finder** (temp 0.4, Google Search grounded, retried internally up to 3x) — only job is to pick ONE real venue and verify via search it's currently open. Returns `Title`/`Location`/`MapQuery`/`Verified` (terse, no creative writing).
  - **Writer** (temp 1.3, no search needed) — takes the already-verified venue and writes `Description`/`Hours`/`BestTime`/`Occupancy` as creatively as it wants, since the facts are locked in by the time it writes.
  - Frontend checks the `Verified` field and retries (up to 2x) if not "Yes".
  - This is the architecture the parallel "session 2" reliability pass (below) was built on top of.

### 2. Blank-screen fix → self-contained JS bundle
- **Problem:** `app.html` loaded React + ReactDOM + Babel live from unpkg.com on every visit and JIT-compiled JSX in-browser. On flaky Colombian mobile connections this could leave a permanent blank screen with no error — survived cache-busting, hard refresh, and incognito, since it wasn't a cache problem.
- **Fix:** `build/src/app.jsx` is now the actual source of truth for the app's JS. Bundled with esbuild into `assets/app.bundle.js` (committed to the repo, ~150kb minified). `app.html`'s `<head>` now loads just one same-origin script:
  ```html
  <script defer src="/assets/app.bundle.js"></script>
  ```
  Zero external runtime dependencies, zero in-browser compile step.
- **IMPORTANT — app.html no longer contains the inline `<script type="text/babel">` block.** All future JS/JSX changes must be made in `build/src/app.jsx`, then rebuilt and copied over:
  ```bash
  npx esbuild build/src/app.jsx --bundle --minify --format=iife --jsx=transform \
    --define:process.env.NODE_ENV='"production"' --outfile=assets/app.bundle.js
  ```
  (run from repo root; needs `react` + `react-dom` installed in `node_modules`)

### 3. Merged with a parallel reliability commit
- A separate Claude session pushed commit `a8334f1` ("Reliability + system prompt improvements," documented as "session 2" below) directly to GitHub while this session's push was blocked by a revoked token. Both commits branched from the same parent and both touched `app.html`, so they conflicted.
- Resolution: took `generate.js` and `HANDOFF.md` from `a8334f1` as-is (untouched by this session). For `app.html`, kept this session's bundle-based version and manually ported their `shownVenues`/`excludedVenues` exclusion logic into `build/src/app.jsx`, then rebuilt the bundle.
- Verified via jsdom simulation (see below) before pushing, since the user has no computer to test on.

### Verification method used this session
No computer/browser devtools available to the user (mobile-only). Verified all JS changes without a real browser by: (1) Babel-transforming the JSX offline to catch syntax errors, (2) `node --check` on `generate.js`, (3) actually executing the real production bundle inside a jsdom + React 18 environment and confirming it mounts content into `#root`. Recommend continuing this pattern for any change that can't be visually tested on-device — it would have caught the blank-screen issue before it shipped if used proactively.

### NEXT UP — scoped, not yet built: WhatsApp reservation CTA
**Why:** discussed this session as the lowest-effort path toward restaurants-pay-per-reservation revenue. Big reservation platforms (OpenTable/Resy/TheFork) charge restaurants, not discovery apps, and have near-zero penetration in Medellín — most venues take reservations via WhatsApp/phone with no formal booking system. Citapai can plausibly become that referral layer manually, without building real booking infra.

**Scope for v1:**
1. Add a "Reservar por WhatsApp" button to the result card (alongside View on Map / Save / Share / Try Another).
   - Needs a phone number per venue, which isn't in the data model yet (Finder currently returns Title/Location/MapQuery/Hours/Verified, no phone). Add a `Phone` field to the Finder's required output, verified during the same search step as Hours/open-status. If not found, hide the button rather than guessing a number.
   - Link format: `https://wa.me/<number>?text=<prefilled message referencing the venue + date context>`
2. Track clicks for future revenue conversations — log `{venue, mapQuery, neighborhood, timestamp}` somewhere on click (Netlify Blobs is the lowest-effort option since there's no DB in this repo yet; Supabase if more structure is wanted later). Fire-and-forget, must not block the WhatsApp navigation.
3. No automated billing or booking confirmation in v1 — this is purely a lead-gen tracker. The actual monetization step is manual outreach to venue owners using the click data, not code.
4. Stretch, only if v1 shows traction: a small `/admin` view showing per-venue click counts, so outreach pitches don't require pulling raw data by hand.

### 4. WhatsApp reservation CTA — shipped (button + Phone field only, no tracking yet)
- **What shipped:** Finder now also searches for and reports a `Phone` field (international format) alongside Hours/Verified, sourced the same way — verified during the search step, left blank rather than guessed if not found. `generate.js` passes it straight through to the frontend untouched by the Writer (a phone number doesn't need creative rephrasing).
- Result card now shows a "Reservar por WhatsApp" / "Reserve on WhatsApp" button (next to View on Map), only rendered when `result.Phone` is present. Builds a `wa.me/<digits>?text=<prefilled message>` link, message is bilingual based on `lang`.
- **Deliberately NOT shipped this session:** click tracking. Doing this properly means a new Netlify Function with a storage dependency (`@netlify/blobs` is the natural choice — needs a `package.json` in `netlify/functions/` declaring it so Netlify's build installs it). Adding an untested new dependency to a function with no way for either of us to verify the actual Netlify build/runtime behavior felt like the wrong tradeoff under time pressure — a broken function deploy is worse than a missing feature. **Next session: add `netlify/functions/package.json` with `@netlify/blobs`, a `track-click.js` function that appends `{venue, mapQuery, neighborhood, timestamp}` on click (fire-and-forget from the frontend, must not block the WhatsApp navigation), and actually verify the deploy succeeds before trusting it.**

---



## WHAT WAS DONE — 2026-06-20 (session 2)

System prompt + reliability pass on `netlify/functions/generate.js`, requested after a review of the two-stage Finder/Writer prompt design. No new files; targeted edits to `generate.js` and `app.html`.

### 1. Venue exclusion / no more repeats
- **Problem:** "Try Another" and the internal 3x Finder retry both called the model fresh each time with no memory of what had already been shown or already rejected — same venue could come back twice.
- **Fix:**
  - `app.html`: new `shownVenues` state (capped at last 12, persists for the session, not localStorage). `fetchOnce` now sends it as `excludedVenues` in the POST body. `generate()` also grows a local copy mid-call so its own 2-attempt safety-net retry doesn't repeat the first attempt's pick.
  - `generate.js`: handler accepts `excludedVenues`, seeds a `triedVenues` list from it, and pushes any Finder candidate that fails verification onto that list before the next internal attempt. `buildFinderPrompt` now takes `excludeList` and injects a "do not suggest any of these" line into the system prompt when non-empty.

### 2. Writer no longer re-guesses hours
- **Problem:** Finder verified the venue was open via search but discarded whatever hours it found; Writer (temp 1.3, no search) then invented "Hours" from scratch — the most likely place for hallucinated info.
- **Fix:** Finder's required output now includes an `Hours` field ("real opening hours found via search, or leave blank"). `parseFields` already captured this (no parser change needed). `buildWriterPrompt` checks `venue.Hours`: if present, it's handed to the Writer as ground truth ("use this exact information, do not invent different hours"); if absent, the Writer is told no verified hours were found and to stay general rather than oddly specific.
- Also added a light guardrail in the Writer prompt against fabricating specific prices/phone numbers/other hard facts not provided.

### 3. Fallback venue list — no more dead-end 502s
- **Problem:** If the Finder failed to return any parseable candidate across all 3 attempts (rare model formatting hiccup), the function 502'd and the user saw a bare error.
- **Fix:** Added `FALLBACK_VENUES` — 6 hand-picked, extremely-unlikely-to-ever-close Medellín institutions (Jardín Botánico, Parque Arví, Cerro Nutibara, Parque de los Pies Descalzos, Parque Lleras, Pueblito Paisa). `pickFallbackVenue(excludeList)` picks one not already shown. On total Finder failure, the handler now uses a fallback venue (`Verified: "Yes"`) and continues into the Writer stage normally instead of failing the request.

### 4. Rate limiting
- **Problem:** `/generate` is public, unauthenticated, and makes 2 Gemini calls per request — no protection against scripted abuse burning API quota.
- **Fix:** Added `exports.config` with Netlify's code-based rate limiting: 12 requests/IP/minute (`windowLimit: 12, windowSize: 60, aggregateBy: ["ip", "domain"]`). Per Netlify docs this must live in the function file itself (cannot be set via `netlify.toml`). Free tier allows 2 code-based rules/project — this uses 1.

### Not done / explicitly deferred
- Minor: `Verified` field parsing (`startsWith("y")`) is a bit fragile but low-risk since the format is English-only by instruction — left as-is.
- No changes to `index.html`, `netlify.toml`, or the design system in this session.

---

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
