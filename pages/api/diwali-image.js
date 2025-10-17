// Next.js API route: Hugging Face Inference proxy
export const config = { api: { bodyParser: { sizeLimit: "2mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { prompt = "", guidance_scale = 7.5, num_inference_steps = 25, seed } = req.body || {};
  if (!process.env.HF_TOKEN) return res.status(500).json({ error: "HF_TOKEN missing in env" });
  if (!prompt.trim()) return res.status(400).json({ error: "Prompt required" });

  const model = "stabilityai/stable-diffusion-2-1"; // reliable public model

  try {
    const resp = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { guidance_scale, num_inference_steps, ...(seed ? { seed } : {}) },
        options: { wait_for_model: true },
      }),
    });

    if (!resp.ok) {
      const m = await resp.text();
      return res.status(resp.status).json({ error: m || "HF request failed" });
    }

    const buf = Buffer.from(await resp.arrayBuffer());
    const base64 = `data:image/png;base64,${buf.toString("base64")}`;
    res.status(200).json({ image: base64 });
  } catch (e) {
    res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
