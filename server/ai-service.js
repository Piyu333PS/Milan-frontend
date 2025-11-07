// server/ai-service.js
// Provider-agnostic wrapper: OpenAI by default; falls back to a tiny mock.
// Uses global fetch (Node 18+/20+ on Render). If not present, lazy-loads node-fetch.
const fetchFn = (typeof fetch !== "undefined")
  ? fetch
  : (...args) => import("node-fetch").then(({ default: f }) => f(...args));

const PROVIDER = process.env.AI_PROVIDER || "openai";   // "openai" | "mock"
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.AI_MODEL || "gpt-4o-mini";

async function openaiChat(messages) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  const res = await fetchFn("https://api.openai.com/v1/chat/completions", {
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
    const t = await res.text().catch(() => "");
    throw new Error(`OpenAI error: ${res.status} ${t}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() || "Okay!";
}

// Tiny backup if provider/key not available
function mockReply(userText, persona) {
  const female = persona === "female";
  const hi = female ? "Heyy 😊" : "Hey 👋";
  const lower = String(userText || "").toLowerCase();
  if (/name|naam/.test(lower)) return `${hi} I’m ${female ? "Aisha" : "Arjun"}. Tumhara naam?`;
  if (/how are you|kaise ho|kya haal/.test(lower)) return `${hi} I’m good! Tum batao, din kaisa gaya?`;
  if (/\?$/.test(lower)) return "Good question! Tumhari kya राय है?";
  return female ? "Nice! aur batao, aaj kya exciting hua? ✨" : "Sahi! aaj ka din kaisa tha?";
}

async function generateReply({ history = [], persona = "neutral" }) {
  if (PROVIDER === "openai" && OPENAI_API_KEY) {
    const system = {
      role: "system",
      content: `You are a flirty, warm ${persona === "female" ? "female" : persona === "male" ? "male" : "friendly"} chat partner for a dating app called Milan.
Mirror the user's language (Hindi/English/Hinglish), keep replies short (1–2 sentences), no explicit content, be positive.`
    };
    const msgs = [system, ...history.slice(-10)];
    try { return await openaiChat(msgs); }
    catch (e) { console.warn("[ai-service] OpenAI failed, using mock:", e.message); }
  }
  const lastUser = [...history].reverse().find(m => m.role === "user")?.content || "";
  return mockReply(lastUser, persona);
}

module.exports = { generateReply };
