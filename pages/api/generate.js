// pages/api/generate.js
// Milan AI Studio — Hugging Face text-to-image (binary safe + timeouts + clear errors)

export const config = {
  api: {
    bodyParser: { sizeLimit: "1mb" },
    responseLimit: false, // allow returning base64
  },
};

const DEFAULT_MODEL = process.env.HF_MODEL || "black-forest-labs/FLUX.1-schnell";
const HF_TOKEN = process.env.HF_TOKEN;

/** Small helper to abort long HF calls (prevents 504 on Vercel) */
function fetchWithTimeout(url, opts = {}, ms = 9000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(id));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    prompt = "",
    negative = "",
    size = "1024x1024",
    steps,
    guidance,
    mode,
    model = DEFAULT_MODEL,
  } = req.body || {};

  // Safety: empty prompt → early exit
  if (!prompt.trim()) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  // If token missing → do not hard fail; front-end will show demo fallback
  if (!HF_TOKEN) {
    return res.status(200).json({
      imageUrl: null,
      note: "HF_TOKEN missing on server. Frontend should use demo fallback.",
      source: "server",
    });
  }

  // Parse size
  const [w, h] = (size || "1024x1024")
    .split("x")
    .map((n) => parseInt(n, 10))
    .map((n) => (Number.isFinite(n) ? n : 1024));

  // HF payload — works for FLUX / SD-Turbo style text2img
  const payload = {
    inputs: prompt,
    parameters: {
      width: w,
      height: h,
      negative_prompt: negative || undefined,
      num_inference_steps: steps || undefined,
      guidance_scale: guidance || undefined,
    },
    options: {
      wait_for_model: true, // queue until model is warm (prevents 503)
      use_cache: true,
    },
  };

  const url = `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`;

  try {
    const hfRes = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
      9000 // 9s; Vercel serverless default limit ~10s → avoid 504
    );

    const ctype = (hfRes.headers.get("content-type") || "").toLowerCase();

    // HF sometimes returns JSON object with error/queue info
    if (ctype.includes("application/json")) {
      const j = await hfRes.json().catch(() => ({}));

      // Common gated/queued/errors from HF
      if (j.error) {
        // Surface the real reason back to UI
        return res.status(502).json({
          error: "Hugging Face generation failed",
          details: j.error,
          hint:
            "If the model is gated, open it on Hugging Face and click ‘Agree and access’. Or switch to a public model in HF_MODEL.",
        });
      }
      // Unexpected JSON shape
      return res.status(502).json({
        error: "Unexpected JSON response from model",
        details: j,
      });
    }

    // Image bytes path
    if (ctype.startsWith("image/")) {
      const ab = await hfRes.arrayBuffer();
      const b64 = Buffer.from(ab).toString("base64");
      const mime = ctype || "image/png";
      return res.status(200).json({
        imageUrl: `data:${mime};base64,${b64}`,
        mode,
        size: `${w}x${h}`,
        model,
      });
    }

    // Neither JSON nor image → bail out clearly
    const text = await hfRes.text().catch(() => "");
    return res.status(502).json({
      error: "Unexpected response from Hugging Face",
      status: hfRes.status,
      contentType: ctype || "unknown",
      body: text.slice(0, 4000),
    });
  } catch (err) {
    // AbortError or network → clean message so UI can show fallback
    const isAbort = `${err?.name}`.includes("Abort");
    return res.status(isAbort ? 504 : 500).json({
      error: isAbort ? "Timeout waiting for model" : "Server error while generating image",
      details: `${err}`,
    });
  }
}
