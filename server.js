// Student Support Chatbot - backend
// Flow: browser -> POST /api/chat -> this server -> Groq API -> reply -> browser
require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODELS_URL = "https://api.groq.com/openai/v1/models";
// Preferred models, in order. The server uses the first one your key can access.
const PREFERRED = [
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
];
let MODEL = process.env.GROQ_MODEL || "";

// Ask Groq which models are active for this key and pick a chat model
async function pickModel(apiKey) {
  const r = await fetch(MODELS_URL, { headers: { Authorization: `Bearer ${apiKey}` } });
  const data = await r.json().catch(() => ({}));
  const ids = (data.data || []).map((m) => m.id);
  const chosen =
    PREFERRED.find((id) => ids.includes(id)) ||
    ids.find((id) => !/whisper|tts|guard|embed|orpheus|playai/i.test(id));
  return chosen || "";
}

async function callGroq(apiKey, history) {
  return fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
      temperature: 0.6,
      max_tokens: 1024,
    }),
  });
}

const SYSTEM_PROMPT = `You are a friendly Student Support Assistant for college students.
- Explain concepts step by step in simple language, with small examples.
- Help with programming questions: give short, correct code and explain it.
- Suggest practical study plans, revision tips and exam strategies.
- Give general academic guidance (projects, labs, placements, time management).
- Keep answers concise and well structured. If you are unsure, say so instead of guessing.
- For health, legal or personal-crisis topics, give brief general guidance and suggest talking to a qualified person or the college counsellor.`;

app.use(express.json({ limit: "50kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, model: MODEL || "(auto-select on first request)", keyConfigured: Boolean(process.env.GROQ_API_KEY) });
});

app.post("/api/chat", async (req, res) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === "your_groq_api_key_here") {
    return res.status(500).json({
      error: "Groq API key is missing. Add GROQ_API_KEY to the .env file and restart the server.",
    });
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Please send at least one message." });
  }

  // Keep only valid roles, trim content, and limit history to the last 12 turns
  const history = messages
    .filter((m) => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    .slice(-12);

  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return res.status(400).json({ error: "The last message must be from the student." });
  }

  try {
    if (!MODEL) MODEL = await pickModel(apiKey);
    let response = await callGroq(apiKey, history);

    // If the model is missing or retired, pick an active one automatically and retry once
    if (response.status === 404 || response.status === 400) {
      const probe = await response.clone().json().catch(() => ({}));
      if (/model/i.test(probe?.error?.message || "") || probe?.error?.code === "model_not_found") {
        const fresh = await pickModel(apiKey);
        if (fresh && fresh !== MODEL) {
          console.warn(`Model "${MODEL}" unavailable. Switching to "${fresh}".`);
          MODEL = fresh;
          response = await callGroq(apiKey, history);
        }
      }
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = data?.error?.message || `Groq API returned status ${response.status}.`;
      let friendly = detail;
      if (response.status === 401) friendly = "Groq rejected the API key. Check GROQ_API_KEY in .env.";
      if (response.status === 429) friendly = "Rate limit reached. Wait a few seconds and try again.";
      return res.status(response.status).json({ error: friendly });
    }

    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) return res.status(502).json({ error: "Groq returned an empty response. Try again." });

    res.json({ reply });
  } catch (err) {
    console.error("Groq request failed:", err.message);
    res.status(502).json({ error: "Could not reach the Groq API. Check your internet connection." });
  }
});

app.listen(PORT, () => {
  console.log(`Student Support Chatbot running at http://localhost:${PORT}`);
  if (!process.env.GROQ_API_KEY) console.warn("Warning: GROQ_API_KEY is not set (see .env.example).");
});
