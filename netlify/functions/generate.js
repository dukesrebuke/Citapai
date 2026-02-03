// Using Gemini 2.5 Flash - FREE and powerful
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  
  try {
    const { userQuery, systemPrompt } = JSON.parse(event.body);
    if (!userQuery || !systemPrompt) {
      return { statusCode: 400, body: "Missing prompt data" };
    }
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: "Gemini API key not configured" };
    }
    
    // Combine system and user prompts for Gemini
    const combinedPrompt = `${systemPrompt}\n\n${userQuery}`;
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: combinedPrompt
            }]
          }],
          generationConfig: {
            temperature: 1.1,
            maxOutputTokens: 1024
          }
        })
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      return { 
        statusCode: response.status, 
        body: JSON.stringify({ error: "Gemini API failed", details: errorText })
      };
    }
    
    const data = await response.json();
    
    // Gemini already returns in the format your frontend expects!
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    };
    
  } catch (err) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: err.message })
    };
  }
};
