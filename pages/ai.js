// pages/ai.js
import { useState } from "react";

export default function MilanAIStudio() {
  const [prompt, setPrompt] = useState(
    "romantic cinematic portrait, warm tones, soft bokeh, masterpiece"
  );
  const [img, setImg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  async function generate() {
    setLoading(true); setErr(null); setImg(null);
    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, width: 1024, height: 1024 })
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "failed");
      setImg(j.image);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!img) return;
    const a = document.createElement("a");
    a.href = img; a.download = "milan-ai.png"; a.click();
  }

  // quick style
  const box = { background:'#0f1320', border:'1px solid #3a4157', borderRadius:12, color:'#fff', padding:12 };

  // optional presets to speed up testing
  const presets = [
    { t: "Romantic", p: "romantic cinematic portrait, warm tones, soft bokeh, masterpiece, 85mm lens" },
    { t: "Realistic", p: "highly detailed realistic portrait, natural light, film grain, 8k" },
    { t: "Anime", p: "anime ghibli style, soft watercolor shading, vibrant colors, whimsical" },
    { t: "Product", p: "studio shot of product on reflective surface, minimal background, editorial lighting" },
  ];

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", color: "#fff", background:"#0b0f1a", minHeight:"100vh" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>💖 Milan AI Studio — Text → Image</h1>
        <p style={{ opacity: .8, marginBottom: 16 }}>Describe your image below and hit generate.</p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {presets.map(x => (
            <button key={x.t} onClick={() => setPrompt(x.p)}
              style={{ padding:"6px 10px", borderRadius:10, border:"1px solid #3a4157", background:"#151a27", color:"#fff", cursor:"pointer" }}>
              {x.t}
            </button>
          ))}
        </div>

        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
          placeholder="Describe your image…"
          style={{ width:"100%", ...box }} />

        <div style={{ display:"flex", gap:12, marginTop:12 }}>
          <button onClick={generate} disabled={loading}
            style={{ padding:"10px 14px", borderRadius:12, background:"#e91e63", border:"none", color:"#fff", fontWeight:700 }}>
            {loading ? "Generating…" : "✨ Create with Milan"}
          </button>
          {img && (
            <button onClick={download}
              style={{ padding:"10px 14px", borderRadius:12, background:"#2f3a55", border:"1px solid #3a4157", color:"#fff" }}>
              ⬇️ Download
            </button>
          )}
        </div>

        {err && (
          <div style={{ marginTop:12, background:"#3a2030", border:"1px solid #5a2a3a", borderRadius:10, padding:10 }}>
            ⚠️ {err}
          </div>
        )}

        {img && (
          <div style={{ marginTop:16 }}>
            <img src={img} alt="result" style={{ width:"100%", maxWidth:1024, borderRadius:12, border:"1px solid #39405a" }} />
          </div>
        )}
      </div>
    </div>
  );
}
