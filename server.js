
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = "gemini-3.5-flash-lite";

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.path}`);
  next();
});

app.get("/", (req, res) => {
  res.json({
    status: "online",
    assistant: "JARVIS AI",
    provider: "Google Gemini",
    multipleKeys: true,
    internetSearch: true
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    provider: "Google Gemini",
    multipleKeys: true,
    internetSearch: true
  });
});

async function askWithKey(apiKey, message, systemInstruction, mode) {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [{
        role: "user",
        parts: [{ text: message }]
      }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: mode === "red" ? 3072 : 1536
      }
    }),
    signal: AbortSignal.timeout(60000)
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(
      data.error?.message || "Gemini request failed."
    );
    error.status = response.status;
    throw error;
  }

  const candidate = data.candidates?.[0];

  const answer = (candidate?.content?.parts || [])
    .map(part => part.text || "")
    .join("")
    .trim();

  if (!answer) {
    throw new Error("Gemini returned no answer text.");
  }

  const chunks =
    candidate?.groundingMetadata?.groundingChunks || [];

  const sources = [
    ...new Map(
      chunks
        .filter(chunk => chunk.web?.uri)
        .map(chunk => [
          chunk.web.uri,
          {
            title: chunk.web.title || "Source",
            url: chunk.web.uri
          }
        ])
    ).values()
  ];

  let finalAnswer = answer;

  if (sources.length) {
    finalAnswer += "\n\nSources:\n";
    finalAnswer += sources
      .slice(0, 5)
      .map(source => `${source.title}: ${source.url}`)
      .join("\n");
  }

  return finalAnswer;
}

async function askGemini(message, systemInstruction, mode) {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2
  ].filter(Boolean);

  if (!keys.length) {
    throw new Error("No Gemini API keys configured in Render.");
  }

  for (let i = 0; i < keys.length; i++) {
    try {
      console.log(`Using Gemini key ${i + 1}`);

      return await askWithKey(
        keys[i],
        message,
        systemInstruction,
        mode
      );

    } catch (error) {
      console.error(
        `Gemini key ${i + 1} failed (${error.status || "error"}):`,
        error.message
      );

      // Do not rotate keys to bypass quota limits.
      if (error.status === 429) {
        throw error;
      }

      // Try the next key only for authentication errors.
      const authenticationError =
        error.status === 401 || error.status === 403;

      if (!authenticationError || i === keys.length - 1) {
        throw error;
      }

      console.log("Trying the second configured key.");
    }
  }

  throw new Error("All configured Gemini keys failed.");
}

app.post("/api/chat", async (req, res) => {
  const message = req.body?.message;
  const mode = req.body?.mode === "red" ? "red" : "blue";

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      error: "Please provide a message."
    });
  }

  if (message.length > 20000) {
    return res.status(413).json({
      error: "Your message is too long."
    });
  }

  const systemInstruction = mode === "red"
    ? "You are JARVIS, an advanced AI assistant. Give detailed explanations, examples and useful steps. Use Google Search for current information and today's news. Summarise findings and include sources. Never pretend to search if no results are returned."
    : "You are JARVIS, a helpful AI assistant. Answer clearly and directly. Use Google Search for current information and today's news. Summarise findings and include sources. Never pretend to search if no results are returned.";

  try {
    const answer = await askGemini(
      message.trim(),
      systemInstruction,
      mode
    );

    return res.json({ answer });

  } catch (error) {
    console.error("JARVIS final error:", error.message);

    return res.status(502).json({
      error: error.status === 429
        ? "Gemini API quota exceeded. Check your Google AI Studio usage and limits."
        : "Gemini is temporarily unavailable. Please try again shortly."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`JARVIS AI listening on port ${PORT}`);
});
