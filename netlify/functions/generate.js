// Using Groq with Llama 3.1 - FREE, fast, reliable
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  
  try {
    const { userQuery, systemPrompt } = JSON.parse(event.body);
    if (!userQuery || !systemPrompt) {
      return { statusCode: 400, body: "Missing prompt data" };
    }
    
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: "Groq API key not configured" };
    }
    
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.1-70b-versatile",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userQuery
          }
        ],
        temperature: 0.7,
        max_tokens: 1024
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return { statusCode: response.status, body: errorText };
    }
    
    const data = await response.json();
    
    // Convert Groq/OpenAI format to match your frontend expectations
    const formattedResponse = {
      candidates: [{
        content: {
          parts: [{
            text: data.choices[0].message.content
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
