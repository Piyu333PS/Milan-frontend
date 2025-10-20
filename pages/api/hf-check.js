export default async function handler(req, res) {
  const HF_TOKEN = process.env.HF_TOKEN;
  const HF_MODEL = process.env.HF_MODEL || "stabilityai/sdxl-turbo";
  if (!HF_TOKEN) return res.status(400).json({ ok:false, error:"HF_TOKEN missing" });

  try {
    const r = await fetch(
      `https://api-inference.huggingface.co/models/${encodeURIComponent(HF_MODEL)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
          // we won’t force image here; we want readable JSON if there’s an error
        },
        body: JSON.stringify({
          inputs: "a red ball",
          options: { wait_for_model: true },
          parameters: { width: 512, height: 512 }
        })
      }
    );

    const ct = r.headers.get("content-type") || "";
    let body;
    try { body = ct.includes("application/json") ? await r.json() : (await r.text()).slice(0, 1000); }
    catch { body = "unreadable"; }

    res.status(200).json({
      ok: r.ok,
      status: r.status,
      contentType: ct,
      model: HF_MODEL,
      body: typeof body === "string" ? body : (JSON.stringify(body).slice(0, 1000))
    });
  } catch (e) {
    res.status(500).json({ ok:false, error:e.message });
  }
}
