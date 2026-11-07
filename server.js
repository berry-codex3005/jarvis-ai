
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
    internetSearch: true
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    provider: "Google Gemini",
    internetSearch: true
  });
});

async function askGemini(apiKey, message, systemInstruction, mode) {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
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

          // Enable live Google Search grounding.
          tools: [
            {
              google_search: {}
            }
          ],

          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: mode === "red" ? 3072 : 1536
          }
        }),
        signal: AbortSignal.timeout(60000)
      });

      const data = await response.json();

      if (!response.ok) {
        const detail =
          data.error?.message || "Unknown Gemini error";

        console.error(
          `Gemini attempt ${attempt} failed (${response.status}): ${detail}`
        );

        if (![429, 500, 502, 503, 504].includes(response.status)) {
          throw new Error(`Gemini API ${response.status}: ${detail}`);
        }

        lastError = new Error(
          `Gemini API ${response.status}: ${detail}`
        );
      } else {
        const answer = (
          data.candidates?.[0]?.content?.parts || []
        )
          .map(part => part.text || "")
          .join("")
          .trim();

        if (!answer) {
          throw new Error("Gemini returned no answer text.");
        }

        // Collect sources returned by Google Search.
        const chunks =
          data.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

        const sources = chunks
          .filter(chunk => chunk.web?.uri)
          .map(chunk => ({
            title: chunk.web.title || "Source",
            url: chunk.web.uri
          }));

        const uniqueSources = [
          ...new Map(
            sources.map(source => [source.url, source])
          ).values()
        ];

        let finalAnswer = answer;

        if (uniqueSources.length > 0) {
          finalAnswer += "\n\nSources:\n";

          finalAnswer += uniqueSources
            .slice(0, 5)
            .map(source => `${source.title}: ${source.url}`)
            .join("\n");
        }

        return finalAnswer;
      }

    } catch (error) {
      lastError = error;

      console.error(
        `Gemini attempt ${attempt} error: ${error.message}`
      );

      if (
        error.message.startsWith("Gemini API 4") &&
        !error.message.startsWith("Gemini API 429")
      ) {
        throw error;
      }
    }

    if (attempt < 3) {
      await new Promise(resolve =>
        setTimeout(resolve, attempt * 1500)
      );
    }
  }

  throw lastError || new Error("Gemini failed after retries.");
}

app.post("/api/chat", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is missing in Render environment settings."
    });
  }

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
    ? "You are JARVIS, an advanced AI assistant. Use Google Search when current information is needed. For news and recent events, search the web, give the date, summarise verified findings, and include sources. Never pretend to have searched if no search results were returned. Give detailed explanations and useful steps."
    : "You are JARVIS, a helpful AI assistant. Use Google Search whenever the user asks about current events, today's news, recent information, or facts that may have changed. Summarise findings clearly and include sources. Never pretend to have searched if no search results were returned.";

  try {
    const answer = await askGemini(
      apiKey,
      message.trim(),
      systemInstruction,
      mode
    );

    return res.json({ answer });

  } catch (error) {
    console.error("JARVIS final error:", error.message);

    return res.status(502).json({
      error: "Gemini or Google Search is temporarily unavailable. Please try again shortly."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`JARVIS AI listening on port ${PORT}`);
});
            
