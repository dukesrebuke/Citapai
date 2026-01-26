// Updated: Jan 26, 2026 - Fixed export syntax for Netlify Functions
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed"
    };
  }
  try {
    const { userQuery, systemPrompt } = JSON.parse(event.body);
    if (!userQuery || !systemPrompt) {
      return {
        statusCode: 400,
        body: "Missing prompt data"
      };
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: "Gemini API key not configured"
      };
    }
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: userQuery }]
            }
          ],
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          }
        })
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      return {
        statusCode: response.status,
        body: errorText
      };
    }
    const data = await response.json();
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: err.message
    };
  }
};
