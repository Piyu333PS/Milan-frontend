// pages/api/generate.js
export const config = { api: { bodyParser: { sizeLimit: "6mb" } } };

/**
 * Robust image generation endpoint with model fallbacks.
 * - Tries OPENAI_IMAGE_MODEL (if set) then a fallback list.
 * - Returns image/png binary on success.
 * - Returns helpful JSON on error.
 */

const DEFAULT_MODEL_CANDIDATES = [
  // recommended order: prefer dall-e-3 (best quality), fallback to dall-e-2
  "dall-e-3",
  "dall-e-2"
];

async function callOpenAIImage(apiKey, model, prompt, n = 1, size = "1024x1024") {
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
  const text = await resp.text().catch(() => "");
  let json = null;
  try { json = JSON.parse(text); } catch (e) { json = null; }
  return { resp, text, json };
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

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) return sendJson(res, 500, { error: "OPENAI_API_KEY missing in environment." });

    const {
      prompt = "",
      negative = "text, watermark, low quality, jpeg artifacts, extra fingers, missing limbs",
      mode = "romantic",
      size = "1024x1024",
      n = 1,
    } = req.body || {};

    if (!String(prompt || "").trim()) return sendJson(res, 400, { error: "Prompt is required." });

    // normalize size
    const [wRaw] = String(size).split("x");
    const width = Math.max(256, Math.min(2048, parseInt(wRaw, 10) || 1024));
    const normSize = `${width}x${width}`;

    // build final prompt
    let finalPrompt = String(prompt).trim();
    if (mode === "romantic") finalPrompt = `${finalPrompt}, romantic, warm cinematic lighting, soft bokeh, delicate color grading`;
    else if (mode === "anime") finalPrompt = `${finalPrompt}, anime style, vibrant colors, clean line art, expressive eyes`;
    else if (mode === "realistic") finalPrompt = `${finalPrompt}, photorealistic, studio lighting, ultra-detailed`;
    else if (mode === "product") finalPrompt = `${finalPrompt}, product shot, white background, studio lighting`;
    if (negative) finalPrompt = `${finalPrompt}. Avoid: ${negative}`;

    // model candidates: ENV override first, then defaults
    const envModel = process.env.OPENAI_IMAGE_MODEL;
    const candidates = Array.from(new Set([envModel, ...DEFAULT_MODEL_CANDIDATES].filter(Boolean)));

    // try sequence
    let lastError = null;
    for (const model of candidates) {
      try {
        const { resp, text, json } = await callOpenAIImage(OPENAI_API_KEY, model, finalPrompt, Math.max(1, Math.min(4, Number(n) || 1)), normSize);

        if (!resp.ok) {
          // parse error body
          const body = json || { raw: text };
          // If model invalid (OpenAI returns message "Invalid value"), try next model silently
          const msg = body?.error?.message || (typeof text === "string" ? text : JSON.stringify(body)).slice(0, 600);
          lastError = { model, status: resp.status, body };

          // 403 forbidden => stop and return friendly message (needs verification/permission)
          if (resp.status === 403) {
            const friendly = body?.error?.message || "Access forbidden for this model. Please verify your organization or try another model.";
            return sendJson(res, 403, { error: friendly, triedModel: model, openai: body });
          }

          // if invalid model value -> try next
          if (typeof msg === "string" && /invalid value|Unsupported values|Invalid model/i.test(msg)) {
            // try next model
            continue;
          }

          // other errors -> return the error body (not model-invalid)
          return sendJson(res, resp.status, { error: body?.error?.message || `OpenAI error (${resp.status})`, model, openai: body });
        }

        // success path
        const okJson = json;
        if (!okJson || !Array.isArray(okJson.data) || !okJson.data.length) {
          lastError = { model, status: resp.status, body: okJson || text };
          continue;
        }
        const b64 = okJson.data[0].b64_json;
        if (!b64) {
          lastError = { model, status: resp.status, body: okJson };
          continue;
        }
        const buf = Buffer.from(b64, "base64");
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        return res.status(200).send(buf);
      } catch (err) {
        lastError = { model, error: String(err?.message || err) };
        // continue to next candidate
        continue;
      }
    } // end for candidates

    // all models exhausted – return helpful message and lastError for debugging
    console.error("[/api/generate] all models failed:", lastError);
    return sendJson(res, 502, { error: "All image models failed or are unsupported for this API key.", details: lastError, tried: candidates });
  } catch (err) {
    console.error("[/api/generate] unexpected:", err && (err.stack || err.message || err));
    return sendJson(res, 500, { error: String(err?.message || err) });
  }
}
