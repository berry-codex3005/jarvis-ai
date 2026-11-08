import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();

app.use(cors());
app.use(express.json({ limit: "12mb" }));

const PORT = process.env.PORT || 3000;
const TEXT_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
const VISION_MODEL = process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b";

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
  timeout: 120000,
  maxRetries: 2
});

app.get("/", (req, res) => {
  res.json({
    status: "online",
    assistant: "JARVIS AI",
    provider: "Groq"
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", provider: "Groq" });
});

function getInstruction(isRed) {
  return isRed
    ? `You are JARVIS, an advanced intelligent AI assistant. Give detailed, comprehensive and accurate answers. Explain clearly and use examples when useful. Organize longer answers with headings or lists. Avoid unnecessary repetition.`
    : `You are JARVIS, a helpful intelligent AI assistant. Give short, natural answers in one small paragraph, usually 2 to 4 sentences. Answer directly and avoid unnecessary explanations. If the user asks for detail, provide it.`;
}

app.post("/api/chat", async (req, res) => {
  try {
    const message = req.body?.message;
    const mode = req.body?.mode || "blue";

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        error: "Groq API key is not configured in Render."
      });
    }

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "Please enter a message."
      });
    }

    const isRed = String(mode).toLowerCase() === "red";

    const completion = await client.chat.completions.create({
      model: TEXT_MODEL,
      messages: [
        { role: "system", content: getInstruction(isRed) },
        { role: "user", content: message.trim() }
      ],
      max_tokens: isRed ? 3000 : 350,
      temperature: 0.6
    });

    const answer = completion.choices?.[0]?.message?.content;

    if (!answer || typeof answer !== "string") {
      throw new Error("Groq returned an empty response.");
    }

    return res.json({
      reply: answer,
      answer,
      provider: "Groq"
    });

  } catch (error) {
    console.error(
      "JARVIS Groq chat error:",
      error.status || "",
      error.message
    );

    return res.status(error.status || 500).json({
      error: error.message || "Groq is temporarily unavailable.",
      reply: "SYSTEM ERROR: Groq is temporarily unavailable. Please try again shortly."
    });
  }
});

app.post("/api/analyze", async (req, res) => {
  try {
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        error: "Groq API key is not configured in Render."
      });
    }

    const {
      prompt,
      fileName,
      mimeType,
      dataBase64,
      mode = "blue"
    } = req.body || {};

    if (typeof dataBase64 !== "string" || !dataBase64) {
      return res.status(400).json({
        error: "No file data was received."
      });
    }

    if (dataBase64.length > 10000000) {
      return res.status(413).json({
        error: "File is too large. Please choose a smaller file."
      });
    }

    const isRed = String(mode).toLowerCase() === "red";
    const safeName = String(fileName || "uploaded file").slice(0, 120);
    const type = String(mimeType || "").toLowerCase();

    let userContent;

    if (["image/jpeg", "image/png", "image/webp"].includes(type)) {
      userContent = [
        {
          type: "text",
          text: `The user uploaded an image named "${safeName}". ${
            String(prompt || "Describe and explain this image.").slice(0, 2000)
          }`
        },
        {
          type: "image_url",
          image_url: {
            url: `data:${type};base64,${dataBase64}`
          }
        }
      ];

    } else if (
      ["text/plain", "text/markdown", "text/csv", "application/json"].includes(type) ||
      /\.(txt|md|csv|json)$/i.test(safeName)
    ) {
      const fileText = Buffer
        .from(dataBase64, "base64")
        .toString("utf8");

      if (!fileText.trim()) {
        return res.status(400).json({
          error: "The selected document is empty or could not be read as text."
        });
      }

      userContent =
        `The user uploaded "${safeName}". ${
          String(prompt || "Summarize and explain this document.").slice(0, 2000)
        }\n\nDOCUMENT CONTENT:\n${fileText.slice(0, 30000)}`;

    } else {
      return res.status(415).json({
        error: "Supported files: JPG, PNG, WEBP, TXT, MD, CSV and JSON. PDF and other formats are not supported yet."
      });
    }

    const completion = await client.chat.completions.create({
      model: type.startsWith("image/") ? VISION_MODEL : TEXT_MODEL,
      messages: [
        { role: "system", content: getInstruction(isRed) },
        { role: "user", content: userContent }
      ],
      max_tokens: isRed ? 3000 : 700,
      temperature: 0.5
    });

    const answer = completion.choices?.[0]?.message?.content;

    if (!answer || typeof answer !== "string") {
      throw new Error("Groq returned an empty file analysis.");
    }

    console.log("[SUCCESS] File analyzed:", safeName);

    return res.json({
      reply: answer,
      answer,
      provider: "Groq"
    });

  } catch (error) {
    console.error(
      "JARVIS file analysis error:",
      error.status || "",
      error.message
    );

    return res.status(error.status || 500).json({
      error: error.message || "File analysis is temporarily unavailable."
    });
  }
});

app.listen(PORT, () => {
  console.log(`JARVIS AI listening on port ${PORT}`);
  console.log("AI provider: Groq");
  console.log(`Text model: ${TEXT_MODEL}`);
  console.log(`Vision model: ${VISION_MODEL}`);
});
