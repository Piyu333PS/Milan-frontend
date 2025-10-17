"use client";
import { useState } from "react";

const EXAMPLES = [
  "Ultra-detailed diya rangoli, warm golden light, bokeh, festive backdrop",
  "Cute couple silhouettes under fireworks, dreamy night, soft glow, romantic",
  "Minimal diya with floral pattern, dark background, elegant, premium",
  "Traditional lanterns (kandil) hanging, depth of field, cinematic still",
  "Diwali sweets flatlay, moody soft light, festive props, photoreal",
];

export default function DiwaliAiStudio() {
  const [prompt, setPrompt] = useState(EXAMPLES[0]);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [steps, setSteps] = useState(25);
  const [scale, setScale] = useState(7.5);

  async function generate() {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const r = await fetch("/api/diwali-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, num_inference_steps: steps, guidance_scale: scale }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Failed");
      setImages((prev) => [data.image, ...prev].slice(0, 8));
    } catch (e) {
      alert(e.message || "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="ai-wrap">
      <header className="ai-head">
        <h3>✨ Diwali AI Studio</h3>
        <p className="ai-sub">“Simple prompt likho, aur image turant dekhlo.”</p>
      </header>

      <div className="ai-grid">
        <div className="ai-left">
          <label className="lbl">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your Diwali image idea…"
          />
          <div className="chips">
            {EXAMPLES.map((ex, i) => (
              <button key={i} className="chip" onClick={() => setPrompt(ex)}>
                {ex}
              </button>
            ))}
          </div>

          <div className="controls">
            <div>
              <label className="mini">Steps</label>
              <input type="range" min={10} max={50} value={steps} onChange={(e) => setSteps(+e.target.value)} />
              <span className="val">{steps}</span>
            </div>
            <div>
              <label className="mini">Guidance</label>
              <input type="range" min={4} max={12} step={0.5} value={scale} onChange={(e) => setScale(+e.target.value)} />
              <span className="val">{scale}</span>
            </div>
          </div>

          <button className="gen-btn" disabled={loading} onClick={generate}>
            {loading ? "Generating…" : "Generate Image"}
          </button>
          <p className="hint">
            Tip: “Hinglish me bhi likh sakte ho — jaise: ‘Royal diya with golden glow, soft fireworks bokeh, romantic mood’”
          </p>
        </div>

        <div className="ai-right">
          {!images.length ? (
            <div className="empty">
              <div>🪔</div>
              <p>Generated images will appear here.</p>
            </div>
          ) : (
            <div className="grid">
              {images.map((src, i) => (
                <figure key={i} className="card">
                  <img src={src} alt={`gen-${i}`} />
                  <a className="dl" href={src} download={`diwali-${i}.png`}>Download</a>
                </figure>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .ai-wrap {
          margin: 22px auto 10px;
          width: min(1020px, 96%);
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 18px;
          padding: 14px;
          backdrop-filter: blur(8px);
          color: #fff;
        }
        .ai-head h3 { margin: 0; font-size: 22px; font-weight: 900; }
        .ai-sub { margin: 4px 0 10px; opacity: .9; }
        .ai-grid { display: grid; grid-template-columns: 420px 1fr; gap: 14px; }
        .lbl { font-size: 13px; opacity: .9; }
        textarea {
          width: 100%; min-height: 110px; margin-top: 6px; padding: 10px 12px;
          border-radius: 12px; border: 1px solid rgba(255,255,255,.16);
          background: rgba(0,0,0,.25); color: #fff; resize: vertical;
        }
        .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
        .chip { border: 1px solid rgba(255,255,255,.16); background: rgba(255,255,255,.06); color: #fff; border-radius: 999px; padding: 6px 10px; font-size: 12px; cursor: pointer; }
        .controls { display: flex; gap: 14px; align-items: center; margin: 12px 0 8px; }
        .controls .mini { font-size: 12px; display: block; margin-bottom: 4px; }
        .controls .val { font-size: 12px; margin-left: 8px; opacity: .9; }
        .gen-btn { padding: 10px 14px; border-radius: 12px; font-weight: 900; border: 0; background: linear-gradient(90deg, #ff6ea7, #ff9fb0); color: #0b0a12; box-shadow: 0 10px 30px rgba(255,110,167,.2); cursor: pointer; }
        .hint { margin-top: 8px; font-size: 12px; opacity: .85; }
        .ai-right .empty { height: 100%; min-height: 200px; display: grid; place-items: center; opacity: .8; }
        .ai-right .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
        .card { position: relative; overflow: hidden; border-radius: 12px; border: 1px solid rgba(255,255,255,.12); background: rgba(0,0,0,.2); }
        .card img { width: 100%; height: 220px; object-fit: cover; display: block; }
        .dl { position: absolute; right: 8px; bottom: 8px; background: rgba(255,255,255,.9); color: #111; font-weight: 800; padding: 6px 8px; border-radius: 8px; font-size: 12px; }
        @media (max-width: 900px) { .ai-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
