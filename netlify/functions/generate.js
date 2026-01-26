// Using OpenAI GPT-4o-mini - stable and reliable
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
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: "OpenAI API key not configured"
      };
    }
    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
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
          temperature: 0.7
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
    
    // Convert OpenAI format to match your existing frontend
    const formattedResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: data.choices[0].message.content
              }
            ]
          }
        }
      ]
    };
    
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(formattedResponse)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: err.message
    };
  }
};
