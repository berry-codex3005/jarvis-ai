
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;
const MODEL =
  process.env.GROQ_MODEL || "openai/gpt-oss-20b";

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
  timeout: 60000,
  maxRetries: 2
});

// Home route
app.get("/", (req, res) => {
  res.json({
    status: "online",
    assistant: "JARVIS AI",
    provider: "Groq"
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    provider: "Groq"
  });
});

// AI chat route
app.post("/api/chat", async (req, res) => {
  try {
    const message = req.body?.message;
    const mode = req.body?.mode || "blue";

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        error: "Groq API key is not configured in Render."
      });
    }

    if (
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        error: "Please enter a message."
      });
    }

    const isRed =
      String(mode).toLowerCase() === "red";

    console.log("[REQUEST] Groq chat");

    const systemInstruction = isRed
      ? `You are JARVIS, an advanced intelligent AI assistant.

Give detailed, comprehensive and accurate answers.
Explain concepts clearly and use examples when useful.
Organize longer answers with headings or lists when appropriate.
Avoid unnecessary repetition.`
      : `You are JARVIS, a helpful and intelligent AI assistant.

Give short, natural answers in one small paragraph.
Usually use 2 to 4 sentences.
Answer the exact question directly.
Avoid unnecessary explanations, long lists and repetition.
Keep answers clear, friendly and informative.
If the user asks for a longer explanation, provide it.`;

    const completion =
      await client.chat.completions.create({
        model: MODEL,

        messages: [
          {
            role: "system",
            content: systemInstruction
          },
          {
            role: "user",
            content: message.trim()
          }
        ],

        max_tokens: isRed ? 3000 : 350,

        temperature: 0.6
      });

    const answer =
      completion.choices?.[0]?.message?.content;

    if (
      !answer ||
      typeof answer !== "string"
    ) {
      throw new Error(
        "Groq returned an empty response."
      );
    }

    console.log("[SUCCESS] Groq response received");

    return res.json({
      reply: answer,
      answer: answer,
      provider: "Groq"
    });

  } catch (error) {
    console.error(
      "JARVIS Groq error:",
      error.status || "",
      error.message
    );

    return res.status(
      error.status || 500
    ).json({
      error:
        error.message ||
        "Groq is temporarily unavailable.",

      reply:
        "SYSTEM ERROR: Groq is temporarily unavailable. Please try again shortly."
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(
    `JARVIS AI listening on port ${PORT}`
  );

  console.log("AI provider: Groq");
});
