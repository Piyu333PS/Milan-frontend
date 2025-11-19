// pages/api/generate.js
export const config = {
  api: { bodyParser: { sizeLimit: "4mb" } }, // allow slightly bigger JSON bodies if needed
};

const DEFAULT_MODELS = {
  romantic: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
  realistic: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
  anime: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
  product: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
};

const MAX_STEPS = 50;

async function callOpenAIImages({ apiKey, model, prompt, n = 1, size = "1024x1024" }) {
  // OpenAI Images endpoint that returns base64 json (b64_json)
  const url = "https://api.openai.com/v1/images/generations";
  const payload = {
    model,
    prompt,
    n,
    size,
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return resp;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const {
      prompt = "",
      negative = "text, watermark, low quality, jpeg artifacts, extra fingers, missing limbs",
      mode = "romantic",
      size = "1024x1024",
      steps = 25,
      guidance = 7,
    } = req.body || {};

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY missing. Add it to your environment variables.",
      });
    }

    // Basic size sanitization (width x height)
    const [widthRaw, heightRaw] = String(size).split("x");
    const width = Math.max(256, Math.min(2048, parseInt(widthRaw, 10) || 1024));
    const height = Math.max(256, Math.min(2048, parseInt(heightRaw, 10) || 1024));
    const normSize = `${width}x${height}`;

    // Select model (you can override via OPENAI_IMAGE_MODEL)
    const model = DEFAULT_MODELS[String(mode)] || DEFAULT_MODELS.romantic;

    // Tweak prompt based on mode and negative prompt
    let finalPrompt = (prompt || "").trim();
    if (!finalPrompt) return res.status(400).json({ error: "Prompt is required" });

    // Append stylistic hints
    if (mode === "romantic") {
      finalPrompt = `${finalPrompt}, romantic, warm cinematic lighting, soft bokeh, delicate color grading, portrait`;
    } else if (mode === "anime") {
      finalPrompt = `${finalPrompt}, anime style, vibrant colors, clean line art, expressive eyes, cinematic composition`;
    } else if (mode === "realistic") {
      finalPrompt = `${finalPrompt}, photorealistic, studio lighting, ultra-detailed, high resolution`;
    } else if (mode === "product") {
      finalPrompt = `${finalPrompt}, product shot, white background, sharp details, studio lighting`;
    }

    // negative prompt: OpenAI Images API may not have a direct field; append as instruction to avoid elements
    if (negative && String(negative).trim()) {
      finalPrompt = `${finalPrompt}. Avoid: ${negative}`;
    }

    // Call OpenAI images endpoint
    const resp = await callOpenAIImages({
      apiKey: OPENAI_API_KEY,
      model,
      prompt: finalPrompt,
      n: 1,
      size: normSize,
    });

    const ctype = resp.headers.get("content-type") || "";

    // OpenAI normally returns JSON with b64_json in data
    if (!resp.ok) {
      // attempt to read json for error details
      const txt = await resp.text().catch(() => "");
      try {
        const j = JSON.parse(txt);
        return res.status(resp.status).json({ error: j.error || j });
      } catch {
        return res.status(resp.status).json({ error: `OpenAI error: ${resp.status}`, details: txt.slice(0, 500) });
      }
    }

    const json = await resp.json().catch(() => null);
    if (!json || !Array.isArray(json.data) || !json.data.length) {
      return res.status(500).json({ error: "OpenAI returned no image data", raw: json });
    }

    const b64 = json.data[0].b64_json;
    if (!b64) return res.status(500).json({ error: "OpenAI response missing b64_json" });

    const buf = Buffer.from(b64, "base64");
    // Return binary image; keep same Content-Type behavior as HF flow (image/png)
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(buf);
  } catch (err) {
    console.error("[/api/generate] error:", err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
