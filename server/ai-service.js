// server/ai-service.js
// Lightweight AI wrapper: OpenAI by default; falls back to rule-based if no key.
const fetch = require("node-fetch");

const PROVIDER = process.env.AI_PROVIDER || "openai"; // "openai" | "mock"
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.AI_MODEL || "gpt-4o-mini"; // choose your model

async function openaiChat(messages) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: 0.8,
      max_tokens: 180
    })
  });
  if (!res.ok) {
    const t = await res.text().catch(()=> "");
    throw new Error(`OpenAI error: ${res.status} ${t}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() || "Okay!";
}

// Simple backup if no provider/key
function mockReply(userText, persona) {
  const female = persona === "female";
  const greet = female ? "Heyy 😊" : "Hey 👋";
  const lower = (userText || "").toLowerCase();
  if (/name|naam/.test(lower)) return `${greet} I’m ${female ? "Aisha" : "Arjun"}. Tumhara naam?`;
  if (/how are you|kaise ho|kya haal/.test(lower)) return `${greet} I’m good! Tum batao, din kaisa gaya?`;
  if (/\?$/.test(lower)) return "Good question! Tumhari kya राय है?";
  return female ? "Nice! aur batao, aaj kya exciting hua? ✨" : "Sahi! aaj ka din kaisa tha?";
}

async function generateReply({ history = [], persona = "neutral" }) {
  // history: [{role:"user"|"assistant", content:"..."}]
  if (PROVIDER === "openai" && OPENAI_API_KEY) {
    const system = {
      role: "system",
      content:
        `You are a flirty, warm ${persona === "female" ? "female" : persona === "male" ? "male" : "friendly"} chat partner for a dating app called Milan.
Mirror the user's language (Hindi/English/Hinglish), keep replies short (1–2 sentences), no explicit content, be positive.`
    };
    const msgs = [system, ...history.slice(-10)];
    try { return await openaiChat(msgs); }
    catch (e) { console.warn("[ai-service] OpenAI failed, using mock:", e.message); }
  }
  // fallback
  const lastUser = [...history].reverse().find(m => m.role === "user")?.content || "";
  return mockReply(lastUser, persona);
}

module.exports = { generateReply };
