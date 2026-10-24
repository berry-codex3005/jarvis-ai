
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "online",
    assistant: "JARVIS AI",
    provider: "Google Gemini"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    provider: "Google Gemini"
  });
});

// Gemini AI chat
app.post("/api/chat", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("GEMINI_API_KEY is missing.");
      return res.status(500).json({
        error: "Gemini API key is not configured in Render."
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
        error: "Your message is too long. Please shorten it."
      });
    }

    const systemInstruction = mode === "red"
      ? "You are JARVIS, a capable AI assistant. Give detailed, thorough answers, explain your reasoning clearly, and use examples and steps when helpful. Do not claim to have performed actions you have not performed."
      : "You are JARVIS, a helpful and efficient AI assistant. Answer clearly and directly, with enough detail to be useful. Do not claim to have performed actions you have not performed.";

    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";

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
          parts: [{ text: message.trim() }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: mode === "red" ? 4096 : 2048
        }
      }),
      signal: AbortSignal.timeout(60000)
    });

    const data = await response.json();

    if (!response.ok) {
      const status = response.status;
      console.error(
        "Gemini API error:",
        status,
        JSON.stringify(data.error || {}).slice(0, 1500)
      );

      if (status === 401 || status === 403) {
        return res.status(502).json({
          error: "Gemini rejected the API key or access. Check your Render environment variable and Google AI Studio settings."
        });
      }

      if (status === 429) {
        return res.status(502).json({
          error: "Gemini API quota or rate limit reached. Check your Google AI Studio usage and limits."
        });
      }

      return res.status(502).json({
        error: "Gemini could not answer the request. Check the Render logs."
      });
    }

    const answer = (data.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || "")
      .join("")
      .trim();

    if (!answer) {
      console.error(
        "Gemini returned no text:",
        JSON.stringify(data.promptFeedback || {})
      );

      return res.status(502).json({
        error: "Gemini returned no text. Try rephrasing your message."
      });
    }

    return res.json({ answer });

  } catch (error) {
    console.error("JARVIS chat error:", error.message);

    if (error.name === "TimeoutError" ||
        error.name === "AbortError") {
      return res.status(504).json({
        error: "Gemini took too long to respond. Please try again."
      });
    }

    return res.status(500).json({
      error: "JARVIS could not get an answer. Check the server logs and API settings."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`JARVIS AI listening on port ${PORT}`);
});
          
