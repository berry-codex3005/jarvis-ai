
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "20kb" }));

app.get("/", (req, res) => {
  res.send("JARVIS AI backend is online.");
});

app.get("/api/health", (req, res) => {
  res.json({ status: "online", assistant: "JARVIS AI" });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, mode } = req.body ?? {};

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "Please enter a message."
      });
    }

    if (message.length > 8000) {
      return res.status(400).json({
        error: "Message is too long."
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: "The AI API key is not configured on the server."
      });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      instructions:
        "You are JARVIS, a helpful futuristic AI assistant. Help with general questions, coding, and electronics. Explain technical topics clearly and prioritize safety.",
      input:
        (mode === "red"
          ? "Use extra care and provide a thorough answer to this request:\n\n"
          : "") + message.trim()
    });

    res.json({
      answer: response.output_text || "JARVIS could not produce a text answer."
    });
  } catch (error) {
    console.error("JARVIS API error:", error.message);

    res.status(500).json({
      error: "JARVIS could not get an answer. Check the server logs and API settings."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`JARVIS AI listening on port ${PORT}`);
});
