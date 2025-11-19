// server/ai-service.js
// Provider-agnostic wrapper: OpenAI by default; falls back to a tiny mock.
// Uses global fetch (Node 18+/20+ on Render). If not present, lazy-loads node-fetch.
const fetchFn = (typeof fetch !== "undefined")
  ? fetch
  : (...args) => import("node-fetch").then(({ default: f }) => f(...args));

const PROVIDER = process.env.AI_PROVIDER || "openai";   // "openai" | "mock"
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_CHAT_MODEL = process.env.AI_MODEL || "gpt-4o-mini";
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || process.env.AI_IMAGE_MODEL || "gpt-image-1"; // default image model

// --- Chat (existing) ---
async function openaiChat(messages) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  const res = await fetchFn("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_CHAT_MODEL,
      messages,
      temperature: 0.8,
      max_tokens: 180
    })
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`OpenAI chat error: ${res.status} ${t}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() || "Okay!";
}

/**
 * openaiImage(options)
 *  - prompt: string (required)
 *  - size: "1024x1024" etc.
 *  - n: number of images
 *  - negative: negative prompt (appended as instruction)
 *  - returnType: "datauri" | "buffer"  (default: "datauri")
 *
 * Returns either a data URI string or a Buffer depending on returnType.
 */
async function openaiImage({ prompt, size = "1024x1024", n = 1, negative = "", returnType = "datauri" } = {}) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  if (!prompt || !String(prompt).trim()) throw new Error("Prompt is required");

  const body = {
    model: OPENAI_IMAGE_MODEL,
    prompt,
    n,
    size,
    ...(negative ? { negative_prompt: negative } : {})
  };

  const res = await fetchFn("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    // Note: you can add timeout logic externally if needed
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`OpenAI Images error: ${res.status} ${t}`);
  }

  const json = await res.json();
  if (!json?.data?.length) throw new Error("No image returned from OpenAI");

  const b64 = json.data[0].b64_json;
  if (!b64) throw new Error("OpenAI returned no base64 image");

  if (returnType === "buffer") {
    return Buffer.from(b64, "base64");
  }
  // default: data uri
  return `data:image/png;base64,${b64}`;
}

// alias for convenience (explicit binary)
async function openaiImageBuffer(opts = {}) {
  return openaiImage({ ...opts, returnType: "buffer" });
}

// Tiny backup if provider/key not available (keeps chat fallback behavior)
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

module.exports = { generateReply, openaiImage, openaiImageBuffer };
