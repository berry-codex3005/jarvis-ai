
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.path}`);
  next();
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    assistant: "JARVIS AI",
    provider: "Gemini"
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, mode } = req.body || {};

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "Please enter a message."
      });
    }

    const apiKey = process.env.JARVIS_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        error: "JARVIS_API_KEY is missing from Render Environment."
      });
    }

    const model =
      process.env.GEMINI_MODEL || "gemini-2.5-flash";

    const instructions =
      "You are JARVIS, a helpful futuristic AI assistant. " +
      "Answer clearly and accurately. Help with general knowledge, " +
      "coding, and electronics safety. Warn about dangerous voltages " +
      "and recommend adult supervision for risky electronics work. " +
      (mode === "red"
        ? "Give a thorough answer with useful details."
        : "");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: instructions }]
          },
          contents: [
            {
              role: "user",
              parts: [{ text: message.trim() }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Gemini API error:",
        response.status,
        data.error?.message || "Unknown error"
      );

      return res.status(502).json({
        error:
          data.error?.message ||
          "Gemini could not process the request."
      });
    }

    const answer = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!answer) {
      return res.status(502).json({
        error: "Gemini returned no text. Please try again."
      });
    }

    return res.json({ answer });
  } catch (error) {
    console.error("JARVIS server error:", error.message);

    return res.status(500).json({
      error: "JARVIS encountered a server error."
    });
  }
});

app.listen(PORT, () => {
  console.log(`JARVIS AI server running on port ${PORT}`);
});
