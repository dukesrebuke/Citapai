// Using Anthropic Claude Haiku - fast, cheap, reliable
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  
  try {
    const { userQuery, systemPrompt } = JSON.parse(event.body);
    if (!userQuery || !systemPrompt) {
      return { statusCode: 400, body: "Missing prompt data" };
    }
    
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: "Anthropic API key not configured" };
    }
    
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userQuery
          }
        ]
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return { statusCode: response.status, body: errorText };
    }
    
    const data = await response.json();
    
    // Convert Claude format to match your frontend expectations
    const formattedResponse = {
      candidates: [{
        content: {
          parts: [{
            text: data.content[0].text
          }]
        }
      }]
    };
    
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formattedResponse)
    };
    
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
