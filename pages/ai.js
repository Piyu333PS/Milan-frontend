// pages/ai.js
import React, { useEffect, useRef, useState } from "react";

/**
 * Milan AI Studio — Futuristic Romantic + Cyberpunk UI
 * Single-file Next.js page (no Tailwind). Calls POST /api/generate
 * Expects image/png binary on success; error JSON on failure.
 */

export default function AIPage() {
  const [prompt, setPrompt] = useState("romantic cinematic portrait, soft warm light");
  const [mode, setMode] = useState("romantic");
  const [size, setSize] = useState("1024x1024");
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState("");
  const [recent, setRecent] = useState([]);
  const [variations, setVariations] = useState(1);
  const imgRef = useRef(null);

  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem("milan_recent") || "[]");
      setRecent(r || []);
    } catch (e) {}
  }, []);

  function saveRecent(p) {
    try {
      const arr = [p, ...(JSON.parse(localStorage.getItem("milan_recent") || "[]") || [])].filter(
        (v, i, a) => a.indexOf(v) === i
      );
      localStorage.setItem("milan_recent", JSON.stringify(arr.slice(0, 30)));
      setRecent(arr.slice(0, 10));
    } catch (e) {}
  }

  function boostPrompt() {
    const boost = `${prompt}, ultra-detailed, cinematic lighting, volumetric glow, soft bokeh, film grain`;
    setPrompt(boost);
  }

  async function generateImage() {
    setError("");
    setIsLoading(true);
    setImageUrl("");
    try {
      if (!prompt || !prompt.trim()) {
        setError("Please write a short prompt.");
        setIsLoading(false);
        return;
      }
      saveRecent(prompt);

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, mode, size, n: variations }),
      });

      if (!res.ok) {
        // try to read JSON error
        let body;
        try {
          body = await res.json();
        } catch (e) {
          const txt = await res.text().catch(() => "");
          setError(`Generation failed: ${res.status} ${txt.slice(0,200)}`);
          setIsLoading(false);
          return;
        }
        // show the most helpful message possible
        setError(body?.openai_body?.error?.message || body?.error?.message || JSON.stringify(body).slice(0,300));
        setIsLoading(false);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
      setTimeout(() => {
        if (imgRef.current) imgRef.current.classList.add("reveal");
      }, 80);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setIsLoading(false);
    }
  }

  function downloadImage() {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `milan-${mode}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function clearPrompt() {
    setPrompt("");
  }

  const styles = {
    accent1: "#ff7ab6",
    accent2: "#8b5cf6",
    cyber1: "#00f0ff",
    cyber2: "#8b5cf6",
  };

  return (
    <div className="milan-root">
      <header className="milan-header">
        <div className="brand">
          <div className="logo">💘</div>
          <div>
            <div className="title">Milan AI Studio</div>
            <div className="subtitle">Turn romantic ideas into visuals — dreamy, premium, instant.</div>
          </div>
        </div>
        <div className="top-actions">
          <button className="ghost">Dark</button>
          <a className="cta" href="/dashboard">Back to Dashboard</a>
        </div>
      </header>

      <main className="milan-main">
        <aside className="controls">
          <div className="card style-card">
            <div className="card-title">Style</div>
            <div className="card-sub">Choose a base style to guide the image</div>
            <div className="pills">
              {[
                { id: "romantic", t: "Romantic", e: "🌹" },
                { id: "realistic", t: "Realistic", e: "📷" },
                { id: "anime", t: "Anime", e: "🎎" },
                { id: "product", t: "Product", e: "🛍️" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setMode(p.id)}
                  className={`pill ${mode === p.id ? "active" : ""}`}
                >
                  <span className="emoji">{p.e}</span>
                  <span className="txt">{p.t}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="card prompt-card">
            <div className="card-title">Describe the scene</div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. couple under a blooming tree, golden hour, warm cinematic lighting..."
            />
            <div className="prompt-actions">
              <button onClick={boostPrompt} className="ghost">Boost Prompt</button>
              <button onClick={clearPrompt} className="ghost">Clear</button>
              <div className="charcount">{prompt.length} chars</div>
            </div>
          </div>

          <div className="card advanced">
            <div className="card-title">Advanced</div>
            <div className="row">
              <label>Size</label>
              <select value={size} onChange={(e) => setSize(e.target.value)}>
                <option>512x512</option>
                <option>768x768</option>
                <option>1024x1024</option>
                <option>1536x1536</option>
              </select>
            </div>

            <div className="row">
              <label>Variations</label>
              <input type="number" min="1" max="4" value={variations} onChange={(e) => setVariations(Math.max(1, Math.min(4, Number(e.target.value))))} />
            </div>

            <div className="row actions">
              <button onClick={generateImage} className="primary" disabled={isLoading}>
                {isLoading ? <HeartPulse /> : "Create with Milan"}
              </button>
              <button onClick={downloadImage} className="ghost" disabled={!imageUrl}>Download</button>
            </div>

            <div className="hint">Tip: Use Boost to make a short prompt cinematic. Free users get 1 free image / day.</div>
          </div>

          <div className="card recent">
            <div className="card-title">Recent Prompts</div>
            <div className="recent-list">
              {recent.length ? recent.map((r, i) => (
                <button key={i} onClick={() => setPrompt(r)} className="recent-item">{r.length > 36 ? r.slice(0,36)+"…" : r}</button>
              )) : <div className="muted">You don't have recent prompts yet.</div>}
            </div>
          </div>
        </aside>

        <section className="preview">
          <div className="preview-header">
            <div>
              <div className="preview-title">Preview</div>
              <div className="preview-sub">Download, use as profile picture, or share</div>
            </div>

            <div className="preview-actions">
              <button className="ghost" onClick={() => setPrompt("couple under the tree, warm golden hour, cinematic")}>Quick sample</button>
              <div className="mode-info">Mode: <strong>{mode}</strong></div>
            </div>
          </div>

          <div className="preview-frame">
            <div className="frame-inner">
              {!imageUrl && !isLoading && (
                <div className="placeholder">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor"><path d="M21,19V5C21,3.9 20.1,3 19,3H5C3.9,3 3,3.9 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19M8.5,13.5C9.3,13.5 10,12.8 10,12C10,11.2 9.3,10.5 8.5,10.5C7.7,10.5 7,11.2 7,12C7,12.8 7.7,13.5 8.5,13.5M21,19L17,14L13,18L10,14L3,21"/></svg>
                  <div className="ph-text">Your image will appear here — add a prompt & tap Create</div>
                </div>
              )}

              {isLoading && (
                <div className="loading">
                  <HeartPulse big />
                  <div className="loading-text">Creating dreamy image…</div>
                </div>
              )}

              {imageUrl && (
                <img ref={imgRef} src={imageUrl} alt="Generated" className="generated" />
              )}
            </div>
          </div>

          <div className="right-controls">
            <div className="mini-card">
              <div className="mini-title">Actions</div>
              <button onClick={downloadImage} className="mini-btn" disabled={!imageUrl}>Download</button>
              <button onClick={() => alert("Set as profile pic (demo).")} className="mini-btn" disabled={!imageUrl}>Use as Profile Pic</button>
              <button onClick={() => { navigator.clipboard?.writeText(prompt); alert("Prompt copied"); }} className="mini-btn">Copy Prompt</button>
            </div>

            <div className="mini-card status">
              <div className="mini-title">Status</div>
              <div className="status-val">{error ? <span className="err">{error}</span> : <span className="ok">Ready</span>}</div>
              <div className="credits">Credits: <strong>free 1/day</strong></div>
            </div>

            <div className="mini-card tips">
              <div className="mini-title">Tips</div>
              <ul>
                <li>Short nouns + 1-2 style tags work best.</li>
                <li>Use Boost for cinematic feel.</li>
                <li>Try different sizes for composition.</li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="milan-footer">© Milan — built with ❤️ for creative romantics</footer>

      <style jsx>{`
        :root {
          --bg:#071018;
          --panel: rgba(255,255,255,0.03);
          --border: rgba(255,255,255,0.04);
          --muted: rgba(255,255,255,0.45);
          --accent1: ${styles.accent1};
          --accent2: ${styles.accent2};
          --cyber1: ${styles.cyber1};
        }
        *{box-sizing:border-box}
        .milan-root {
          min-height:100vh;
          background: radial-gradient(1200px 600px at 10% 10%, rgba(139,92,246,0.06), transparent),
                      linear-gradient(180deg, #071018 0%, #05060a 100%);
          color:#e8eef7;
          padding:24px;
          font-family:Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
        }

        .milan-header{
          max-width:1200px;
          margin:0 auto 22px;
          display:flex;
          align-items:center;
          justify-content:space-between;
        }
        .brand{display:flex;gap:14px;align-items:center}
        .logo{
          width:56px;height:56px;border-radius:12px;
          background: linear-gradient(135deg,var(--accent1),var(--accent2));
          display:flex;align-items:center;justify-content:center;
          box-shadow: 0 6px 30px rgba(139,92,246,0.16), inset 0 -6px 20px rgba(255,255,255,0.03);
          font-size:22px;
        }
        .title{font-weight:700;font-size:20px}
        .subtitle{font-size:12px;color:var(--muted);margin-top:2px}

        .top-actions{display:flex;gap:10px;align-items:center}
        .ghost{background:transparent;border:1px solid rgba(255,255,255,0.04);padding:8px 12px;border-radius:10px;color:var(--muted);cursor:pointer}
        .ghost:disabled{opacity:0.5;cursor:not-allowed}
        .cta{background:linear-gradient(90deg,var(--accent1),var(--accent2));padding:9px 14px;border-radius:10px;color:white;text-decoration:none;font-weight:600;box-shadow:0 10px 30px rgba(139,92,246,0.12)}

        .milan-main{max-width:1200px;margin:0 auto;display:grid;grid-template-columns: 380px 1fr;gap:18px}
        @media(max-width:900px){
          .milan-main{grid-template-columns:1fr; padding-bottom:40px}
        }

        .controls{display:flex;flex-direction:column;gap:14px}
        .card{background:var(--panel);border:1px solid var(--border);padding:14px;border-radius:14px;box-shadow: 0 6px 30px rgba(2,6,23,0.6);backdrop-filter: blur(6px)}
        .card-title{font-weight:700;margin-bottom:6px}
        .card-sub{font-size:12px;color:var(--muted);margin-bottom:10px}

        .pills{display:flex;flex-wrap:wrap;gap:8px}
        .pill{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;background:transparent;border:1px solid rgba(255,255,255,0.03);cursor:pointer;color:var(--muted)}
        .pill.active{background:linear-gradient(90deg,var(--accent1),var(--accent2));color:white;box-shadow:0 8px 30px rgba(139,92,246,0.14)}
        .pill .emoji{font-size:16px}

        textarea{width:100%;min-height:100px;background:transparent;border:1px solid rgba(255,255,255,0.03);padding:10px;border-radius:10px;color:inherit;outline:none}
        .prompt-actions{display:flex;align-items:center;gap:8px;margin-top:8px}
        .charcount{margin-left:auto;color:var(--muted);font-size:12px}

        .advanced .row{display:flex;align-items:center;gap:10px;margin-bottom:10px}
        .advanced select,.advanced input{flex:1;padding:8px;border-radius:8px;background:transparent;border:1px solid rgba(255,255,255,0.03);color:inherit}

        .actions{display:flex;gap:8px;align-items:center}
        .primary{flex:1;padding:12px;border-radius:999px;background:linear-gradient(90deg,var(--accent1),var(--accent2));border:none;color:white;font-weight:700;cursor:pointer;box-shadow:0 12px 40px rgba(139,92,246,0.16)}
        .primary:disabled{opacity:0.6;cursor:not-allowed}
        .hint{font-size:12px;color:var(--muted);margin-top:8px}

        .recent-list{display:flex;flex-wrap:wrap;gap:8px}
        .recent-item{padding:6px 8px;border-radius:8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.03);font-size:12px;cursor:pointer}

        .preview{padding-left:10px}
        @media(max-width:900px){.preview{padding-left:0;margin-top:6px}}

        .preview-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
        .preview-title{font-weight:700;font-size:18px}
        .preview-sub{font-size:12px;color:var(--muted)}

        .preview-frame{background: linear-gradient(180deg, rgba(255,255,255,0.01), rgba(0,0,0,0.02));padding:18px;border-radius:16px;border:1px solid rgba(255,255,255,0.03);box-shadow: 0 20px 60px rgba(2,6,23,0.7)}
        .frame-inner{height:520px;border-radius:12px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;background:linear-gradient(180deg, rgba(8,12,18,0.6), rgba(4,6,10,0.4));border:1px solid rgba(255,255,255,0.02)}
        .placeholder{display:flex;flex-direction:column;align-items:center;color:var(--muted)}
        .ph-text{margin-top:12px;font-size:13px;color:var(--muted)}

        .loading{display:flex;flex-direction:column;align-items:center;gap:10px}
        .loading-text{color:var(--muted)}

        .generated{max-height:100%;max-width:100%;border-radius:10px;transform:scale(0.99);opacity:0;transition: all 420ms cubic-bezier(.2,.9,.3,1); box-shadow: 0 26px 60px rgba(8,12,30,0.6);border:1px solid rgba(255,255,255,0.02)}
        .generated.reveal{opacity:1;transform:scale(1)}

        .right-controls{display:flex;flex-direction:column;gap:12px;margin-top:12px}
        .mini-card{background:linear-gradient(90deg, rgba(255,255,255,0.01), rgba(255,255,255,0.006));padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.03)}
        .mini-title{font-size:13px;font-weight:700;margin-bottom:8px}
        .mini-btn{display:block;width:100%;padding:8px;border-radius:8px;margin-bottom:8px;background:transparent;border:1px solid rgba(255,255,255,0.03);color:var(--muted);cursor:pointer}
        .mini-btn:disabled{opacity:0.5;cursor:not-allowed}
        .status .ok{color:#7ef3c5}
        .status .err{color:#ff8aa2}
        .credits{font-size:12px;color:var(--muted);margin-top:8px}

        .milan-footer{text-align:center;margin-top:22px;color:rgba(255,255,255,0.35);font-size:12px}

        /* subtle neon glow for active pill */
        .pill.active{box-shadow:0 8px 30px rgba(255,122,182,0.12), 0 0 26px rgba(139,92,246,0.06)}
        /* heart pulse */
        @keyframes pulse {
          0%{transform:scale(1);opacity:1}
          50%{transform:scale(1.08);opacity:0.9}
          100%{transform:scale(1);opacity:1}
        }
      `}</style>

      {/* inline small components */}
      <style jsx>{`
        .reveal { opacity: 1; transform: scale(1) }
      `}</style>
    </div>
  );
}

/* HeartPulse component */
function HeartPulse({ big = false }) {
  const size = big ? 72 : 18;
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
      <svg style={{animation:'pulse 1s ease-in-out infinite'}} width={size} height={size} viewBox="0 0 24 24">
        <defs>
          <linearGradient id="gA" x1="0" x2="1">
            <stop offset="0%" stopColor="#ff7ab6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <path fill="url(#gA)" d="M12 21s-7-4.35-9-7.35C0.5 10.5 3 6 7 6c2 0 3 1.2 5 3.2C13 7.2 14 6 16 6c4 0 6.5 4.5 4 7.65C19 16.65 12 21 12 21z" />
      </svg>
      {big ? <div style={{color:'rgba(255,255,255,0.7)'}}>Creating...</div> : null}
    </div>
  );
}
