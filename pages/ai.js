// pages/ai.js — FIXED for mobile tap/overlay + 100vh

import { useEffect, useMemo, useRef, useState } from "react";

/* ---------- LocalStorage helpers ---------- */
const LS = {
  HISTORY: "milan_ai_history",
  SAVED: "milan_ai_saved",
  SETTINGS: "milan_ai_settings",
  THEME: "milan_ai_theme",
};
const readLS = (k, v=null)=> (typeof window==="undefined"?v: (()=>{try{return JSON.parse(localStorage.getItem(k))??v;}catch{return v;}})());
const writeLS = (k,v)=>{ if(typeof window==="undefined") return; try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} };

/* ---------- Tiny bits ---------- */
const Chip = ({ active, children, onClick }) => (
  <button className={`chip ${active ? "active" : ""}`} onClick={onClick}>{children}</button>
);

const SectionTitle = ({ children }) => (
  <div className="sect"><h4>{children}</h4></div>
);

const ImageCard = ({ src, onSave, onDownload }) => (
  <figure className="card">
    <img src={src} alt="milan" />
    <div className="actions">
      <button onClick={onSave}>❤ Save</button>
      <button onClick={onDownload}>⬇ Download</button>
    </div>
    <style jsx>{`
      .card { position:relative; border:1px solid var(--border); border-radius:14px; overflow:hidden; background:var(--panel); }
      img { width:100%; display:block; }
      .actions { position:absolute; right:8px; bottom:8px; display:flex; gap:8px; }
      .actions button { background:#ffffffdd; color:#0b0f1a; font-weight:800; border:0; border-radius:10px; padding:6px 10px; cursor:pointer; }
    `}</style>
  </figure>
);

/* ---------- Page ---------- */
export default function MilanAIStudio() {
  // theme
  const [theme, setTheme] = useState(()=> readLS(LS.THEME, "dark"));
  useEffect(()=> {
    writeLS(LS.THEME, theme);
    if (typeof document !== "undefined") document.documentElement.dataset.theme = theme;
  }, [theme]);

  // ✅ Mobile 100vh fix
  useEffect(() => {
    const setVh = () => {
      document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
    };
    setVh();
    window.addEventListener("resize", setVh);
    window.addEventListener("orientationchange", setVh);
    return () => {
      window.removeEventListener("resize", setVh);
      window.removeEventListener("orientationchange", setVh);
    };
  }, []);

  // main state
  const [prompt, setPrompt] = useState("romantic cinematic portrait, warm tones, soft bokeh, masterpiece");
  const [negative, setNegative] = useState("");
  const [size, setSize] = useState("1024");
  const [steps, setSteps] = useState(25);
  const [guidance, setGuidance] = useState(7);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const taRef = useRef(null);

  // left rail
  const [history, setHistory] = useState(()=> readLS(LS.HISTORY, []));
  const [saved, setSaved]     = useState(()=> readLS(LS.SAVED, []));
  const [mode, setMode]       = useState("txt2img");

  // mobile drawer
  const [drawer, setDrawer]   = useState(false);

  const presets = useMemo(()=>[
    { k:"Romantic", v:"romantic cinematic portrait, golden hour, soft bokeh, masterpiece" },
    { k:"Realistic", v:"ultra realistic photo, 85mm lens, shallow depth of field, detailed skin, natural light" },
    { k:"Anime",    v:"anime, ghibli style, soft watercolor shading, dreamy colors, whimsical, highly detailed" },
    { k:"Product",  v:"studio shot of a perfume bottle on reflective black surface, editorial lighting, high detail" },
  ],[]);

  useEffect(()=>writeLS(LS.HISTORY, history.slice(0,50)),[history]);
  useEffect(()=>writeLS(LS.SAVED, saved.slice(0,100)),[saved]);
  useEffect(()=>writeLS(LS.SETTINGS,{size,steps,guidance}),[size,steps,guidance]);
  useEffect(()=>{
    const s = readLS(LS.SETTINGS,null);
    if(s){ setSize(String(s.size??"1024")); setSteps(s.steps??25); setGuidance(s.guidance??7); }
    if (typeof document !== "undefined") document.documentElement.dataset.theme = theme;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  async function onGenerate(){
    if(!prompt.trim()) return;
    setLoading(true); setErr(null);
    try{
      const dim = parseInt(size,10);
      const r = await fetch("/api/generate",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ prompt, negativePrompt: negative||undefined, width:dim, height:dim, steps, guidance })
      });
      const j = await r.json();
      if(!j?.ok) throw new Error(j?.error || "failed");
      setImages(prev=>[j.image,...prev]);
      setHistory(prev=>[{p:prompt,t:Date.now()},...prev.filter(x=>x.p!==prompt)].slice(0,50));
      if(drawer) setDrawer(false);
    }catch(e){ setErr(String(e.message||e)); } finally{ setLoading(false); }
  }
  function onDownload(src){ const a=document.createElement("a"); a.href=src; a.download="milan-ai.png"; a.click(); }
  const onSave = (src)=> setSaved(prev=>[src,...prev.filter(s=>s!==src)]);
  function onKeyDown(e){ if((e.metaKey||e.ctrlKey)&&e.key==="Enter") onGenerate(); }

  return (
    <div className="page">
      {/* App bar */}
      <div className="appbar">
<button
  className="icon"
  aria-label="Toggle menu"
  aria-expanded={drawer}
  onClick={()=>setDrawer(d => !d)}
>
  ☰
</button>
        <div className="title">💖 Milan Studio</div>
        <a className="pill" href="/connect">← Back to Dashboard</a>
      </div>

      <div className="layout">
        {/* Sidebar (drawer on mobile) */}
        <aside className={`rail ${drawer ? "open" : ""}`}>
          <div className="rail-inner">
            <div className="rail-head">
              <div className="brand"><span>💖</span><strong>Milan Studio</strong></div>
              <button className="close icon" onClick={()=>setDrawer(false)}>✕</button>
            </div>

            <div className="modes">
              <div className="modes-badge">MODES</div>
              <button className={`mode-btn ${mode==="txt2img"?"active":""}`} onClick={()=>setMode("txt2img")}><span>✍️</span> Text → Image</button>
              <button className={`mode-btn ${mode==="img2img"?"active":""}`} onClick={()=>alert("Image → Image coming soon!")}><span>🖼️</span> Image → Image</button>
              <button className={`mode-btn ${mode==="prompter"?"active":""}`} onClick={()=>alert("Prompt Helper coming soon!")}><span>🧠</span> Prompt Helper</button>
            </div>

            <SectionTitle>Theme</SectionTitle>
            <div className="theme-row">
              <label className={`theme-pill ${theme==="dark"?"active":""}`} onClick={()=>setTheme("dark")}>🌙 Dark</label>
              <label className={`theme-pill ${theme==="light"?"active":""}`} onClick={()=>setTheme("light")}>🌤️ Light</label>
            </div>

            <SectionTitle>History</SectionTitle>
            <div className="list">
              {history.length===0 ? <div className="empty">No prompts yet</div> :
                history.map((h,i)=>(
                  <button key={i} className="row" onClick={()=>{setPrompt(h.p); setDrawer(false);}} title={h.p}>{h.p}</button>
                ))
              }
            </div>

            <SectionTitle>Saved</SectionTitle>
            <div className="saved">
              {saved.length===0 ? <div className="empty">No saved images</div> :
                saved.map((s,i)=>(<img key={i} src={s} alt="saved" onClick={()=>onDownload(s)} />))
              }
            </div>
          </div>
          {/* Overlay (only outside the drawer) */}
          <div className="overlay" onClick={()=>setDrawer(false)} />
        </aside>

        {/* Main Canvas */}
        <main className="main">
          <header className="top">
            <h1>💖 Milan AI Studio — Text → Image</h1>
          </header>
          <p className="sub">Describe your image below and hit generate.</p>

          <div className="chips">
            {presets.map(c=> <Chip key={c.k} onClick={()=>setPrompt(c.v)}>{c.k}</Chip>)}
          </div>

          <textarea
            ref={taRef}
            value={prompt}
            onChange={(e)=>setPrompt(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Describe your image… (Cmd/Ctrl + Enter to generate)"
          />

          <div className="adv">
            <select value={size} onChange={(e)=>setSize(e.target.value)} title="Size">
              <option value="512">512 × 512</option>
              <option value="768">768 × 768</option>
              <option value="1024">1024 × 1024</option>
            </select>

            <label>Steps
              <input type="range" min={4} max={50} value={steps} onChange={(e)=>setSteps(+e.target.value)} />
              <span>{steps}</span>
            </label>

            <label>Guidance
              <input type="range" min={1} max={12} step={0.5} value={guidance} onChange={(e)=>setGuidance(+e.target.value)} />
              <span>{guidance}</span>
            </label>

            <input className="neg" value={negative} onChange={(e)=>setNegative(e.target.value)}
              placeholder="Negative prompt (e.g., text, watermark, blurry, low quality)" />
          </div>

          <div className="actions">
            <button className="primary" disabled={loading} onClick={onGenerate}>
              {loading ? "Generating…" : "✨ Create with Milan"}
            </button>
            {images[0] && <button className="ghost" onClick={()=>onDownload(images[0])}>⬇ Download</button>}
          </div>

          {err && (
            <div className="error">
              ⚠️ {err.includes("hf_401") ? "Auth error (check HF token)." :
                   err.includes("hf_403") ? "Access denied (try a public model)." :
                   err.includes("hf_404") ? "Model not found (check model id)." :
                   err}
            </div>
          )}

          <div className="grid">
            {images.map((src,idx)=>(
              <ImageCard key={idx} src={src} onSave={()=>setSaved([src,...saved])} onDownload={()=>onDownload(src)} />
            ))}
          </div>
        </main>
      </div>

      <style jsx>{`
        :global(html){ box-sizing:border-box; } :global(*, *:before, *:after){ box-sizing:inherit; }
        :global(body){ margin:0; background:var(--bg); color:var(--text); -webkit-tap-highlight-color:transparent; }

        /* THEME TOKENS */
        :global(:root[data-theme="dark"]){
          --bg:#0b0f1a; --panel:#0e1323; --text:#fff; --muted:#cfe1ff;
          --border:#1e2741; --chip:#121a30; --chip-border:#354266; --chip-active:#26334f; --chip-active-border:#44537a;
          --input:#0f1320; --input-border:#3a4157;
        }
        :global(:root[data-theme="light"]){
          --bg:#f6f8ff; --panel:#ffffff; --text:#0b0f1a; --muted:#243050;
          --border:#d6def5; --chip:#f0f3ff; --chip-border:#c9d5ff; --chip-active:#dfe8ff; --chip-active-border:#afc3ff;
          --input:#ffffff; --input-border:#c9d5ff;
        }

        .page{ min-height:calc(var(--vh, 1vh) * 100); }

        /* App bar */
        .appbar{
          position:sticky; top:0; z-index:40;
          display:flex; align-items:center; gap:10px;
          padding:10px 14px; background:var(--panel); border-bottom:1px solid var(--border);
          touch-action: manipulation;
        }
        .icon{ background:var(--chip); color:var(--muted); border:1px solid var(--chip-border); border-radius:10px; padding:8px 10px; cursor:pointer; }
        .title{ font-weight:900; letter-spacing:.02em; flex:1; color:var(--text); }
        .pill{ border:1px solid #394a75; background:#11162a; color:#cfe1ff; text-decoration:none; padding:6px 10px; border-radius:999px; }
        :global(:root[data-theme="light"]) .pill{ background:#eef3ff; color:#10204a; border-color:#c9d5ff; }

        /* Layout grid */
        .layout{ display:grid; grid-template-columns: 300px 1fr; max-width:1400px; margin:0 auto; overflow:hidden; position:relative; z-index:10; }
        @media (max-width: 1024px){ .layout{ grid-template-columns: 1fr; } }

        /* Sidebar / Drawer */
        .rail{ position:relative; }
        .rail .overlay{ display:none; }
        .rail-inner{
          background:var(--panel); border-right:1px solid var(--border); padding:18px;
          position:sticky; top:54px; height:calc((var(--vh, 1vh) * 100) - 54px); overflow:auto;
        }
        .rail-head{ display:flex; align-items:center; justify-content:space-between; }
        .brand{ display:flex; gap:8px; align-items:center; font-weight:900; letter-spacing:.02em; color:var(--text); }
        .close{ display:none; }

        /* True drawer on small screens (fixed) */
        @media (max-width: 1024px){
          /* ❗ Closed state MUST NOT block taps */
          .rail{ position:fixed; inset:0; z-index:60; pointer-events:none; }
          .rail.open{ pointer-events:auto; } /* only clickable when open */

          .rail-inner{
            position:absolute; left:-100vw; top:0; height:calc(var(--vh, 1vh) * 100); width:86vw; max-width:360px;
            border-right:1px solid var(--border); background:var(--panel); padding:16px;
            transition:left .25s ease; z-index:2; /* above overlay */
            pointer-events:auto; /* drawer itself clickable */
          }
          .rail.open .rail-inner{ left:0; }

          /* Overlay only outside drawer so taps on drawer work */
          .rail .overlay{
            position:absolute; top:0; right:0; bottom:0; left:86vw;
            background:rgba(0,0,0,.45); opacity:0; transition:opacity .25s ease;
            pointer-events:none; z-index:1;
          }
          .rail.open .overlay{ opacity:1; pointer-events:auto; }

          .close{ display:inline-block; }
        }

        .modes{ margin-top:12px; }
        .modes-badge{ display:inline-block; font-size:11px; letter-spacing:.14em; padding:6px 10px; border:1px solid var(--chip-active-border); border-radius:999px; background:var(--chip); color:var(--muted); margin-bottom:10px; }
        .mode-btn{
          width:100%; display:flex; align-items:center; gap:10px;
          font-weight:700; font-size:14px; letter-spacing:.01em;
          padding:12px 12px; margin:6px 0; background:var(--chip); color:var(--text);
          border:1px solid var(--chip-border); border-radius:12px; cursor:pointer; transition:transform .06s ease, background .2s ease;
          touch-action: manipulation;
        }
        .mode-btn span{ font-size:18px; }
        .mode-btn:hover{ background:var(--chip-active); transform:translateY(-1px); }
        .mode-btn.active{ background:var(--chip-active); border-color:var(--chip-active-border); }

        .theme-row{ display:flex; gap:10px; }
        .theme-pill{ cursor:pointer; padding:8px 10px; border-radius:999px; border:1px solid var(--chip-border); background:var(--chip); color:var(--text); font-size:13px; }
        .theme-pill.active{ background:var(--chip-active); border-color:var(--chip-active-border); }

        .list{ display:flex; flex-direction:column; gap:6px; }
        .row{ text-align:left; background:var(--chip); color:var(--muted); border:1px solid var(--chip-border); padding:10px 12px; border-radius:10px; cursor:pointer; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-size:13px; }

        .saved{ display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
        .saved img{ width:100%; border-radius:8px; border:1px solid var(--chip-border); cursor:pointer; }

        /* Main */
        .main{ padding:20px 24px 36px; overflow-x:hidden; position:relative; z-index:10; }
        @media (max-width:640px){ .main{ padding:16px; } }
        .top{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:4px; }
        .top h1{ font-size:20px; margin:0; color:var(--text); }
        .sub{ opacity:.85; margin:4px 0 14px; }

        .chips{ display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px; }
        .chip{ border:1px solid var(--chip-border); background:var(--chip); color:var(--muted); border-radius:999px; padding:6px 10px; font-size:12px; cursor:pointer; touch-action: manipulation; }
        .chip.active{ background:var(--chip-active); border-color:var(--chip-active-border); }

        textarea{
          width:100%; background:var(--input); border:1px solid var(--input-border); color:var(--text);
          border-radius:12px; padding:12px; min-height:110px; display:block;
        }

        .adv{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin:12px 0 6px; }
        .adv select{ background:var(--input); border:1px solid var(--input-border); color:var(--text); border-radius:10px; padding:8px 10px; }
        .adv label{ display:flex; align-items:center; gap:8px; background:var(--input); border:1px solid var(--input-border); border-radius:10px; padding:4px 8px; font-size:12px; }
        .adv input[type="range"]{ accent-color:#e91e63; }
        .adv .neg{ flex:1; min-width:220px; background:var(--input); border:1px solid var(--input-border); color:var(--text); border-radius:10px; padding:8px 10px; }
        @media (max-width:640px){ .adv select, .adv .neg{ width:100%; min-width:100%; } }

        .actions{ display:flex; gap:10px; margin:12px 0 8px; flex-wrap:wrap; }
        .primary{ padding:12px 16px; border-radius:12px; font-weight:900; border:0; background:linear-gradient(90deg,#ff6ea7,#ff9fb0); color:#0b0a12; box-shadow:0 10px 30px rgba(255,110,167,.2); cursor:pointer; touch-action: manipulation; }
        .ghost{ padding:12px 16px; border-radius:12px; background:#2f3a55; border:1px solid var(--input-border); color:#fff; cursor:pointer; touch-action: manipulation; }
        :global(:root[data-theme="light"]) .ghost{ background:#e9eeff; color:#0b0f1a; }

        .error{ background:#3a2030; border:1px solid #5a2a3a; padding:10px; border-radius:10px; margin:8px 0; color:#ffd7de; }
        :global(:root[data-theme="light"]) .error{ background:#ffe6ea; border-color:#ffc5cf; color:#4b0c18; }

        .grid{ display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:12px; margin-top:12px; }
      `}</style>
    </div>
  );
}
