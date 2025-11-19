// pages/api/generate.js
export const config = {
  api: { bodyParser: { sizeLimit: "6mb" } }, // allow slightly bigger JSON bodies if needed
};

/**
 * Safe OpenAI image generator endpoint.
 * - Uses a safe default model (gpt-4o-mini-image-latest) to avoid org-locked models like gpt-image-1.
 * - Honors OPENAI_IMAGE_MODEL env var if set.
 * - Returns image/png binary on success.
 * - Returns helpful JSON on error (includes OpenAI body when available).
 *
 * Env:
 * - OPENAI_API_KEY (required)
 * - OPENAI_IMAGE_MODEL (optional) - if not set, defaults to "gpt-4o-mini-image-latest"
 */

const SAFE_DEFAULT_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-4o-mini-image-latest";

async function callOpenAIImages({ apiKey, model, prompt, n = 1, size = "1024x1024" }) {
  const url = "https://api.openai.com/v1/images/generations";
  const payload = { model, prompt, n, size };

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

function sendJson(res, status, obj) {
  res.status(status).json(obj);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { error: "Method not allowed" });
    }

    const {
      prompt = "",
      negative = "text, watermark, low quality, jpeg artifacts, extra fingers, missing limbs",
      mode = "romantic",
      size = "1024x1024",
      n = 1,
    } = req.body || {};

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return sendJson(res, 500, { error: "OPENAI_API_KEY missing in environment." });
    }

    // sanitize size
    const [wRaw, hRaw] = String(size).split("x");
    const width = Math.max(256, Math.min(2048, parseInt(wRaw, 10) || 1024));
    const height = Math.max(256, Math.min(2048, parseInt(hRaw, 10) || 1024));
    const normSize = `${width}x${height}`;

    // select model: env override -> safe default
    const model = process.env.OPENAI_IMAGE_MODEL || SAFE_DEFAULT_IMAGE_MODEL;

    // build final prompt with style hints
    let finalPrompt = String(prompt || "").trim();
    if (!finalPrompt) return sendJson(res, 400, { error: "Prompt is required." });

    if (mode === "romantic") {
      finalPrompt = `${finalPrompt}, romantic, warm cinematic lighting, soft bokeh, delicate color grading, portrait`;
    } else if (mode === "anime") {
      finalPrompt = `${finalPrompt}, anime style, vibrant colors, clean line art, expressive eyes, cinematic composition`;
    } else if (mode === "realistic") {
      finalPrompt = `${finalPrompt}, photorealistic, studio lighting, ultra-detailed, high resolution`;
    } else if (mode === "product") {
      finalPrompt = `${finalPrompt}, product shot, white background, sharp details, studio lighting`;
    }

    if (negative && String(negative).trim()) finalPrompt = `${finalPrompt}. Avoid: ${negative}`;

    // call OpenAI
    const openaiResp = await callOpenAIImages({
      apiKey: OPENAI_API_KEY,
      model,
      prompt: finalPrompt,
      n: Math.max(1, Math.min(4, Number(n) || 1)),
      size: normSize,
    });

    const text = await openaiResp.text().catch(() => "");

    // if not ok -> parse and return OpenAI error (with helpful fields)
    if (!openaiResp.ok) {
      let body;
      try { body = JSON.parse(text); } catch (e) { body = { raw: text }; }

      // If forbidden / 403 with org-verify hint, convert to friendly message
      if (openaiResp.status === 403) {
        const friendly = body?.error?.message ||
          "Access forbidden for this image model. Try using a different model or verify your organization.";
        return sendJson(res, 403, { error: friendly, openai: body });
      }

      return sendJson(res, openaiResp.status, { error: body?.error?.message || `OpenAI error ${openaiResp.status}`, openai: body });
    }

    // parse success body
    let bodyJson;
    try { bodyJson = JSON.parse(text); } catch (e) { bodyJson = null; }

    if (!bodyJson || !Array.isArray(bodyJson.data) || !bodyJson.data.length) {
      return sendJson(res, 500, { error: "OpenAI returned no image data.", raw: bodyJson || text.slice(0, 1000) });
    }

    // first image base64
    const b64 = bodyJson.data[0].b64_json;
    if (!b64) return sendJson(res, 500, { error: "OpenAI response missing b64_json.", raw: bodyJson });

    const buf = Buffer.from(b64, "base64");
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    return res.status(200).send(buf);
  } catch (err) {
    console.error("[/api/generate] unexpected error:", err && (err.stack || err.message || err));
    return sendJson(res, 500, { error: String(err?.message || err) });
  }
}
