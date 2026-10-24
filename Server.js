
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = "gemini-3.8-flash";

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
    provider: "Google Gemini"
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", provider: "Google Gemini" });
});

async function askGemini(apiKey, message, systemInstruction, mode) {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  let lastError = null;

  // Try up to 3 times for temporary failures.
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
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: mode === "red" ? 3072 : 1536
          }
        }),
        signal: AbortSignal.timeout(35000)
      });

      const data = await response.json();

      if (response.ok) {
        const answer = (data.candidates?.[0]?.content?.parts || [])
          .map(part => part.text || "")
          .join("")
          .trim();

        if (!answer) {
          throw new Error("Gemini returned no answer text.");
        }

        return answer;
      }

      const status = response.status;
      const detail = data.error?.message || "Unknown Gemini error";

      console.error(
        `Gemini attempt ${attempt} failed (${status}): ${detail}`
      );

      // Retry only temporary errors.
      if (![429, 500, 502, 503, 504].includes(status)) {
        throw new Error(`Gemini API ${status}: ${detail}`);
      }

      lastError = new Error(`Gemini API ${status}: ${detail}`);

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
      // Brief pause before trying again.
      await new Promise(resolve => setTimeout(resolve, attempt * 1500));
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
    return res.status(400).json({ error: "Please provide a message." });
  }

  if (message.length > 20000) {
    return res.status(413).json({ error: "Your message is too long." });
  }

  const systemInstruction = mode === "red"
    ? "You are JARVIS, a capable AI assistant. Give detailed answers, explanations, examples, and useful steps. Never claim actions you did not perform."
    : "You are JARVIS, a helpful and efficient AI assistant. Answer clearly and directly, with enough detail to be useful. Never claim actions you did not perform.";

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
      error: "Gemini is temporarily unavailable or the request failed after retries. Please try again shortly."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`JARVIS AI listening on port ${PORT}`);
});
                                 
