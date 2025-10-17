// Next.js API route: Hugging Face Inference proxy (secure, production-ready)
export const config = { api: { bodyParser: { sizeLimit: "2mb" } } };

const DEFAULT_MODEL = "stabilityai/stable-diffusion-2-1";
// Optionally allow a few known-safe models to be passed from client:
const ALLOWED_MODELS = new Set([
  "stabilityai/stable-diffusion-2-1",
  "runwayml/stable-diffusion-v1-5",
  // add more if needed
]);

export default async function handler(req, res) {
  // Health-check / debugging
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      model: DEFAULT_MODEL,
      tokenConfigured: Boolean(process.env.HUGGINGFACE_TOKEN),
    });
  }

  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const HF_TOKEN = process.env.HUGGINGFACE_TOKEN; // <- use env var from Vercel
  if (!HF_TOKEN)
    return res
      .status(500)
      .json({ error: "HUGGINGFACE_TOKEN missing in environment" });

  const {
    prompt = "",
    negative_prompt = "",
    guidance_scale = 7.5,
    num_inference_steps = 25,
    seed,
    width,
    height,
    model,
  } = req.body || {};

  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json({ error: "Prompt required" });
  }

  const modelToUse =
    model && ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL;

  try {
    const hfResp = await fetch(
      `https://api-inference.huggingface.co/models/${modelToUse}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
          // Optional: hint to not cache results
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            negative_prompt,
            guidance_scale,
            num_inference_steps,
            ...(seed ? { seed } : {}),
            ...(width ? { width } : {}),
            ...(height ? { height } : {}),
          },
          options: {
            wait_for_model: true,
            use_cache: false,
          },
        }),
      }
    );

    // Hugging Face sometimes returns JSON (error/loading) instead of image
    const ct = hfResp.headers.get("content-type") || "";
    if (!hfResp.ok) {
      const errText = await hfResp.text();
      return res
        .status(hfResp.status)
        .json({ error: errText || "HF request failed" });
    }

    if (ct.includes("application/json")) {
      const json = await hfResp.json();
      // common shape when the model is loading or rate-limited
      return res
        .status(502)
        .json({ error: "Model did not return an image", detail: json });
    }

    const buf = Buffer.from(await hfResp.arrayBuffer());
    const base64 = `data:image/png;base64,${buf.toString("base64")}`;

    return res.status(200).json({
      image: base64,
      model: modelToUse,
      prompt,
      negative_prompt,
    });
  } catch (e) {
    return res
      .status(500)
      .json({ error: e?.message || "Unknown server error" });
  }
}
