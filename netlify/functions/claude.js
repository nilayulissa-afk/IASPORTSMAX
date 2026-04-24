exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body);
    const isStreaming = body.stream === true;

    let requestBody;
    if (body.content) {
      // Image analysis - no streaming needed
      requestBody = {
        model: "claude-sonnet-4-5",
        max_tokens: 1500,
        messages: [{ role: "user", content: body.content }],
      };
    } else {
      requestBody = {
        model: body.model || "claude-sonnet-4-5",
        max_tokens: body.max_tokens || 4000,
        stream: isStreaming,
        messages: body.messages,
      };
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
    });

    if (isStreaming && !body.content) {
      // Pass through the stream directly
      const chunks = [];
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      const text = new TextDecoder().decode(combined);
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache",
        },
        body: text,
      };
    }

    // Non-streaming response
    const data = await response.json();
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: { message: err.message } }),
    };
  }
};
