
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;
const MODEL = process.env.OPENAI_MODEL || "gpt-5.5";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000,
  maxRetries: 2
});

app.get("/", (req, res) => {
  res.json({
    status: "online",
    assistant: "JARVIS AI",
    provider: "OpenAI"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    provider: "OpenAI"
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const message = req.body?.message;
    const mode = req.body?.mode || "blue";

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OpenAI API key is not configured in Render."
      });
    }

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "Please enter a message."
      });
    }

    console.log("[REQUEST] OpenAI chat");

    const isRed = String(mode).toLowerCase() === "red";

    const response = await client.responses.create({
      model: MODEL,

      instructions: isRed
        ? "You are JARVIS, an advanced AI assistant. Give detailed, clear, well-organized answers with explanations when useful."
        : "You are JARVIS, a helpful and intelligent AI assistant. Give clear, accurate and concise answers.",

      input: message.trim(),

      tools: [
        { type: "web_search" }
      ],

      max_output_tokens: isRed ? 3000 : 1500
    });

    const answer = response.output_text;

    if (!answer) {
      throw new Error("OpenAI returned an empty response.");
    }

    console.log("[SUCCESS] OpenAI response received");

    return res.json({
      reply: answer,
      answer: answer,
      provider: "OpenAI"
    });

  } catch (error) {
    console.error(
      "JARVIS OpenAI error:",
      error.status || "",
      error.message
    );

    const status = error.status || 500;

    return res.status(status).json({
      error: error.message || "OpenAI is temporarily unavailable.",
      reply: "SYSTEM ERROR: OpenAI is temporarily unavailable. Please try again shortly."
    });
  }
});

app.listen(PORT, () => {
  console.log(`JARVIS AI listening on port ${PORT}`);
  console.log(`AI provider: OpenAI`);
});
