// Using Gemini 2.5 Flash - FREE and powerful
//
// TWO-STAGE GENERATION
// Temperature was previously one dial trying to do two jobs at once: picking a real,
// currently-open venue (wants low temp + tight grounding) and writing creative copy
// about it (wants high temp). Splitting it into two calls lets each job use the
// right setting:
//   1) FINDER  — low temperature, Google Search grounded. Only job: pick ONE real
//      venue matching the filters and verify via search that it's currently open.
//   2) WRITER  — high temperature, no search needed. Takes the already-verified
//      venue and writes the flavorful description/hours/vibe copy, as creative as
//      we want, since the facts are already locked in.
// The merged result is returned in the same shape the frontend already expects
// (a Gemini-style candidate with content.parts[0].text + groundingMetadata), so
// app.html's existing parsing code doesn't need to change.

const GEMINI_URL = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;

async function callGemini(apiKey, { userQuery, systemPrompt, temperature, maxOutputTokens, useSearch }) {
  const body = {
    contents: [{ parts: [{ text: userQuery }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { temperature, maxOutputTokens }
  };
  if (useSearch) body.tools = [{ googleSearch: {} }];

  const response = await fetch(GEMINI_URL(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  if (!candidate) throw new Error("No candidate returned");

  const text = candidate.content?.parts?.[0]?.text || "";
  const gm = candidate.groundingMetadata;
  const citations = gm?.groundingAttributions
    ? gm.groundingAttributions.map(a => ({ uri: a.web?.uri, title: a.web?.title })).filter(s => s.uri && s.title)
    : [];

  return { text, citations };
}

// Minimal line-based parser for the fields each stage returns.
function parseFields(text) {
  const data = {};
  text.split("\n").filter(l => l.trim()).forEach(line => {
    const [rawKey, ...rest] = line.split(":");
    if (!rawKey || rest.length === 0) return;
    const k = rawKey.trim().toLowerCase();
    const v = rest.join(":").trim();
    if (k.startsWith("title")) data.Title = v;
    else if (k.startsWith("location")) data.Location = v;
    else if (k.startsWith("map")) data.MapQuery = v;
    else if (k.startsWith("desc")) data.Description = v;
    else if (k.startsWith("hour") || k.startsWith("hora")) data.Hours = v;
    else if (k.includes("best") || k.includes("mejor")) data.BestTime = v;
    else if (k.includes("occup") || k.includes("afluen")) data.Occupancy = v;
    else if (k.startsWith("verif")) data.Verified = v;
  });
  return data;
}

function buildFinderPrompt({ dateType, timeOfDay, atmosphere, price, neighborhood, langFull, seed }) {
  const nbLabel = neighborhood === "any" ? "anywhere in Medellín" : `in ${neighborhood}`;
  const userQuery = `Find ONE specific real venue/activity ${nbLabel} matching: Type: ${dateType}, Time: ${timeOfDay}, Atmosphere: ${atmosphere}, Price: ${price}.`;
  const systemPrompt = `[Request ID: ${seed}] You are a meticulous local-knowledge researcher for Medellín, Colombia. Your ONLY job right now is to identify ONE specific, real, currently operating venue or activity that fits the request — favor hidden gems and neighborhood staples over obvious tourist traps, but accuracy beats novelty.

VERIFICATION IS MANDATORY: You MUST use Google Search to confirm the venue is CURRENTLY OPEN AND OPERATING — not permanently closed, not "temporarily closed" with no reopening date, not something you only recall from training data. Search the venue name plus "Medellín" plus terms like "horario" / "hours" / "cerrado permanentemente" / "permanently closed" and check results from the last 12 months.
- If confirmed open: report it, Verified = Yes.
- If you cannot confirm, or find any signal it may be closed: pick a different venue you CAN verify, or fall back to a category that can't "close" — a park, mirador, plaza, public trail, well-known long-running institution — and only set Verified = Yes once that fallback itself is confirmed.
- Never guess. Do not write any creative description here — that happens in a later step. Keep this factual and terse.

REQUIRED FORMAT (plain text, one field per line, no markdown, English labels even if place name is Spanish):
Title: [Name of venue/activity]
Location: [Neighborhood or address in Medellín]
MapQuery: [Exact venue name and address for Google Maps]
Verified: [Yes or No]`;

  return { userQuery, systemPrompt };
}

function buildWriterPrompt({ venue, langFull, seed }) {
  const userQuery = `Write the creative copy for this already-confirmed date spot: "${venue.Title}" — ${venue.Location} (${venue.MapQuery}). Respond fully in ${langFull}.`;
  const systemPrompt = `[Request ID: ${seed}] You are a world-class creative writer and local tastemaker for Medellín, Colombia — La Ciudad Primavera Eterna. The venue has ALREADY been verified as real and currently open — your only job is to make it sound irresistible. Be as vivid, specific, and creative as possible with tone, sensory detail, and local color. Do not invent facts that contradict the venue identity given to you, but feel free to be bold and evocative in how you describe the vibe and experience.

CRITICAL: ALL 4 fields are MANDATORY. Respond only in ${langFull}.

REQUIRED FORMAT (plain text, one field per line, no markdown):
Description: [2-3 vivid sentences on atmosphere and why it's a great date spot]
Hours: [Typical hours, e.g. Lunes-Sábado 8AM-10PM]
BestTime: [Specific best time/day, e.g. Martes en la tarde para menos gente]
Occupancy: [Estimate: Baja / Media / Alta — or Low / Medium / High]`;

  return { userQuery, systemPrompt };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { dateType, timeOfDay, atmosphere, price, neighborhood, lang } = JSON.parse(event.body);
    if (!dateType || !timeOfDay || !atmosphere || !price || !neighborhood) {
      return { statusCode: 400, body: "Missing filter data" };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: "Gemini API key not configured" };
    }

    const langFull = lang === "es" ? "Latin American Spanish" : "English";

    // --- Stage 1: FINDER (low temp, grounded, retried internally up to 3x) ---
    let venue = null;
    let citations = [];
    const FINDER_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= FINDER_ATTEMPTS; attempt++) {
      const seed = Math.floor(Math.random() * 100000);
      const { userQuery, systemPrompt } = buildFinderPrompt({ dateType, timeOfDay, atmosphere, price, neighborhood, langFull, seed });
      const { text, citations: c } = await callGemini(apiKey, {
        userQuery, systemPrompt,
        temperature: 0.4,
        maxOutputTokens: 1024,
        useSearch: true
      });
      const parsed = parseFields(text);
      if (parsed.Title && parsed.MapQuery) {
        venue = parsed;
        citations = c;
        if ((parsed.Verified || "").trim().toLowerCase().startsWith("y")) break;
      }
    }

    if (!venue) {
      return { statusCode: 502, body: JSON.stringify({ error: "Could not find a venue after retries" }) };
    }

    // --- Stage 2: WRITER (high temp, max creativity, no search needed) ---
    const writerSeed = Math.floor(Math.random() * 100000);
    const { userQuery: writerQuery, systemPrompt: writerSystem } = buildWriterPrompt({ venue, langFull, seed: writerSeed });
    const { text: writerText } = await callGemini(apiKey, {
      userQuery: writerQuery,
      systemPrompt: writerSystem,
      temperature: 1.3,
      maxOutputTokens: 2048,
      useSearch: false
    });
    const written = parseFields(writerText);

    // --- Merge into the original 8-field format the frontend already parses ---
    const mergedText = [
      `Title: ${venue.Title}`,
      `Location: ${venue.Location}`,
      `MapQuery: ${venue.MapQuery}`,
      `Description: ${written.Description || ""}`,
      `Hours: ${written.Hours || ""}`,
      `BestTime: ${written.BestTime || ""}`,
      `Occupancy: ${written.Occupancy || ""}`,
      `Verified: ${venue.Verified || "No"}`
    ].join("\n");

    // Respond in the same Gemini-response shape the frontend expects.
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidates: [{
          content: { parts: [{ text: mergedText }] },
          groundingMetadata: { groundingAttributions: citations.map(c => ({ web: { uri: c.uri, title: c.title } })) }
        }]
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
