// pages/api/generate.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }
  try {
    const { prompt, width = 1024, height = 1024, steps = 30, guidance = 7 } = req.body || {};
    if (!prompt || prompt.length < 3) {
      return res.status(400).json({ ok: false, error: "prompt_required" });
    }
    const token = process.env.HF_API_TOKEN;
    if (!token) {
      return res.status(500).json({ ok: false, error: "missing_HF_API_TOKEN" });
    }

    const model = process.env.HF_MODEL || "stabilityai/stable-diffusion-xl-base-1.0";
    const url = `https://api-inference.huggingface.co/models/${model}`;

    const hfRes = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          width, height,
          num_inference_steps: steps,
          guidance_scale: guidance
        },
        options: { wait_for_model: true }
      })
    });

    if (!hfRes.ok) {
      const text = await hfRes.text();
      return res.status(500).json({ ok: false, error: `hf_${hfRes.status}`, detail: text });
    }

    const buf = Buffer.from(await hfRes.arrayBuffer());
    // Some models return JSON; handle both. If JSON, try to pull base64 field.
    let b64;
    if (buf[0] === 0x7b) {
      const j = JSON.parse(buf.toString());
      b64 = (j?.data || j?.image || (j?.images && j.images[0]))?.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
    } else {
      b64 = buf.toString("base64");
    }
    if (!b64) return res.status(500).json({ ok: false, error: "no_image_returned" });

    return res.status(200).json({ ok: true, image: `data:image/png;base64,${b64}` });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "generation_failed" });
  }
}
