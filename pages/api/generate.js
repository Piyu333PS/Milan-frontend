// Hugging Face text->image (SDXL Turbo) with safe error parsing
export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const HF_TOKEN = process.env.HF_TOKEN;
  const HF_MODEL = process.env.HF_MODEL || "stabilityai/sdxl-turbo";
  if (!HF_TOKEN) {
    return res.status(400).json({ ok: false, error: "HF_TOKEN missing" });
  }

  try {
    const { prompt = "", negative = "", size = "1024x1024", steps, guidance } = req.body || {};
    if (!prompt || prompt.trim().length < 3) {
      return res.status(400).json({ ok: false, error: "Prompt is required" });
    }

    const [width, height] = parseSize(size);

    const payload = {
      inputs: prompt,
      options: { wait_for_model: true },
      parameters: {
        width, height,
        negative_prompt: negative || undefined,
        num_inference_steps: steps || undefined,
        guidance_scale: guidance || undefined,
      },
    };

    // one request (no re-read of same body)
    const resp = await fetch(`https://api-inference.huggingface.co/models/${encodeURIComponent(HF_MODEL)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "image/png",
      },
      body: JSON.stringify(payload),
    });

    const ct = resp.headers.get("content-type") || "";

    if (resp.ok && ct.startsWith("image/")) {
      const buf = Buffer.from(await resp.arrayBuffer());
      const b64 = buf.toString("base64");
      return res.status(200).json({
        ok: true,
        imageUrl: `data:${ct};base64,${b64}`,
        source: "huggingface",
        width, height,
      });
    }

    // SAFELY read error body: use a clone so we don't hit "already been read"
    const body = await safeReadClone(resp);
    return res.status(resp.status || 502).json({
      ok: false,
      error: "Hugging Face generation failed",
      status: resp.status,
      details: body,
    });

  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", message: e.message });
  }
}

/* utils */
function parseSize(s) {
  const [w, h] = String(s || "1024x1024").toLowerCase().split("x").map(n => parseInt(n, 10));
  return [clamp(w, 512, 1536), clamp(h, 512, 1536)];
}
function clamp(n, lo, hi){ const x = Number.isFinite(n) ? n : 1024; return Math.min(hi, Math.max(lo, x)); }
async function safeReadClone(resp) {
  try {
    const r = resp.clone();
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await r.json();
    return (await r.text()).slice(0, 2000);
  } catch {
    return "Unparsable error body";
  }
}
