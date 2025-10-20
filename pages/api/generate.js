// pages/api/generate.js
export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } }, // small, safe
};

const DEFAULT_MODELS = {
  romantic: "stabilityai/stable-diffusion-2-1",
  realistic: "SG161222/Realistic_Vision_V5.1_noVAE",
  anime: "Linaqruf/anything-v3.0",
  product: "stabilityai/stable-diffusion-2-1",
};

const MAX_STEPS = 50;

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

    const HF_TOKEN = process.env.HF_TOKEN;
    const OVERRIDE_MODEL = process.env.HF_MODEL; // optional

    if (!HF_TOKEN) {
      return res.status(500).json({
        error:
          "HF_TOKEN is missing. Add your Hugging Face token in Vercel → Settings → Environment Variables.",
      });
    }

    const [width, height] = String(size)
      .split("x")
      .map((n) => Math.max(256, Math.min(1536, parseInt(n, 10) || 1024)));

    const model =
      OVERRIDE_MODEL ||
      DEFAULT_MODELS[String(mode)] ||
      DEFAULT_MODELS.romantic;

    const payload = {
      inputs: prompt?.trim(),
      parameters: {
        negative_prompt: negative || "",
        num_inference_steps: Math.min(MAX_STEPS, Math.max(10, Number(steps) || 25)),
        guidance_scale: Math.max(1, Math.min(20, Number(guidance) || 7)),
        width,
        height,
      },
      options: { wait_for_model: true }, // prefer image on first go
    };

    // function to call HF, handling 409 warmup by polling
    const callHF = async (tries = 0) => {
      const r = await fetch(`https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "image/png", // force binary image
        },
        body: JSON.stringify(payload),
      });

      // Model still loading
      if (r.status === 409 && tries < 6) {
        // wait then retry (exponential-ish)
        await new Promise((s) => setTimeout(s, 1200 + tries * 500));
        return callHF(tries + 1);
      }
      return r;
    };

    const resp = await callHF();

    const ctype = resp.headers.get("content-type") || "";

    // If HF returns an error JSON
    if (!resp.ok && ctype.includes("application/json")) {
      const j = await resp.json().catch(() => ({}));
      return res
        .status(resp.status)
        .json({ error: j.error || `HF error ${resp.status}`, details: j });
    }

    // If HF returns HTML (e.g., auth/URL wrong)
    if (ctype.includes("text/html")) {
      const text = await resp.text();
      return res.status(400).json({
        error:
          "Upstream returned HTML instead of an image. Check HF token/model or headers.",
        snippet: text.slice(0, 300),
      });
    }

    // Success: Binary image
    if (ctype.startsWith("image/")) {
      const buf = Buffer.from(await resp.arrayBuffer());
      res.setHeader("Content-Type", ctype);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).send(buf);
    }

    // Fallback: try to parse as JSON or text
    const txt = await resp.text();
    try {
      const j = JSON.parse(txt);
      return res
        .status(resp.ok ? 200 : resp.status || 500)
        .json(j);
    } catch {
      return res.status(resp.ok ? 200 : 500).json({
        error: "Unrecognized response from model.",
        snippet: txt.slice(0, 300),
      });
    }
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
