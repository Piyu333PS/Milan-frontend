import { useEffect, useMemo, useRef, useState } from "react";

/** ---------- Utilities (localStorage helpers) ---------- */
const LS_KEYS = {
  HISTORY: "milan_ai_history",
  SAVED: "milan_ai_saved",
  SETTINGS: "milan_ai_settings",
};
const readLS = (k, v = null) => {
  if (typeof window === "undefined") return v;
  try { return JSON.parse(localStorage.getItem(k)) ?? v; } catch { return v; }
};
const writeLS = (k, v) => {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
};

/** ---------- Tiny Components ---------- */
const Chip = ({ active, children, onClick }) => (
  <button className={`chip ${active ? "active" : ""}`} onClick={onClick}>{children}</button>
);

const ImageCard = ({ src, onSave, onDownload }) => (
  <figure className="card">
    <img src={src} alt="milan" />
    <div className="actions">
      <button onClick={onSave}>❤ Save</button>
      <button onClick={onDownload}>⬇ Download</button>
    </div>
    <style jsx>{`
      .card { position:relative; border:1px solid #2b3450; border-radius:14px; overflow:hidden; background:#0d1221; }
      img { width:100%; display:block; }
      .actions { position:absolute; right:8px; bottom:8px; display:flex; gap:8px; }
      .actions button { background:#ffffffdd; color:#0b0f1a; font-weight:800; border:0; border-radius:10px; padding:6px 10px; cursor:pointer; }
    `}</style>
  </figure>
);

const SectionTitle = ({ children }) => (
  <div className="sect">
    <h4>{children}</h4>
    <style jsx>{`
      .sect { margin:14px 0 10px; }
      h4 { margin:0; font-size:12px; letter-spacing:.08em; opacity:.9; text-transform:uppercase; }
    `}</style>
  </div>
);

/** ---------- Main Page ---------- */
export default function MilanAIStudio() {
  // prompt + UI state
  const [prompt, setPrompt] = useState("romantic cinematic portrait, warm tones, soft bokeh, masterpiece");
  const [negative, setNegative] = useState("");
  const [size, setSize] = useState("1024");
  const [steps, setSteps] = useState(25);
  const [guidance, setGuidance] = useState(7);
  const [images, setImages] = useState([]);     // current session results (top-first)
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const textareaRef = useRef(null);

  // left rail state
  const [history, setHistory] = useState(() => readLS(LS_KEYS.HISTORY, []));
  const [saved, setSaved] = useState(() => readLS(LS_KEYS.SAVED, []));
  const [mode, setMode] = useState("txt2img"); // future: img2img, prompt-helper

  // presets
  const presets = useMemo(() => ([
    { k: "Romantic", v: "romantic cinematic portrait, golden hour, soft bokeh, masterpiece" },
    { k: "Realistic", v: "ultra realistic photo, 85mm lens, shallow depth of field, detailed skin, natural light" },
    { k: "Anime", v: "anime, ghibli style, soft watercolor shading, dreamy colors, whimsical, highly detailed" },
    { k: "Product", v: "studio shot of a perfume bottle on reflective black surface, editorial lighting, high detail" },
  ]), []);

  useEffect(() => {
    writeLS(LS_KEYS.HISTORY, history.slice(0, 50));
  }, [history]);
  useEffect(() => {
    writeLS(LS_KEYS.SAVED, saved.slice(0, 100));
  }, [saved]);
  useEffect(() => {
    writeLS(LS_KEYS.SETTINGS, { size, steps, guidance });
  }, [size, steps, guidance]);
  useEffect(() => {
    const s = readLS(LS_KEYS.SETTINGS, null);
    if (s) { setSize(String(s.size ?? "1024")); setSteps(s.steps ?? 25); setGuidance(s.guidance ?? 7); }
  }, []);

  async function onGenerate() {
    if (!prompt.trim()) return;
    setLoading(true); setErr(null);
    try {
      const dim = parseInt(size, 10);
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          negativePrompt: negative || undefined,
          width: dim, height: dim,
          steps, guidance
        })
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "failed");
      setImages((prev) => [j.image, ...prev]);
      setHistory((prev) => [{ p: prompt, t: Date.now() }, ...prev.filter(x => x.p !== prompt)].slice(0, 50));
    } catch (e) {
      setErr(String(e.message || e));
    } finally { setLoading(false); }
  }

  function onDownload(src) {
    const a = document.createElement("a");
    a.href = src; a.download = "milan-ai.png"; a.click();
  }
  const onSave = (src) => setSaved((prev) => [src, ...prev.filter(s => s !== src)]);

  function onKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onGenerate();
  }

  return (
    <div className="wrap">
      {/* LEFT RAIL */}
      <aside className="rail">
        <div className="brand">
          <span>💖</span>
          <strong>Milan Studio</strong>
        </div>

        <SectionTitle>Modes</SectionTitle>
        <div className="mode-row">
          <Chip active={mode === "txt2img"} onClick={() => setMode("txt2img")}>✍️ Text → Image</Chip>
          <Chip active={mode === "img2img"} onClick={() => alert("Coming soon!")}>🖼️ Image → Image</Chip>
          <Chip active={mode === "prompter"} onClick={() => alert("Prompt Helper soon!")}>🧠 Prompt Helper</Chip>
        </div>

        <SectionTitle>History</SectionTitle>
        <div className="list">
          {history.length === 0 ? <div className="empty">No prompts yet</div> :
            history.map((h, i) => (
              <button key={i} className="row" onClick={() => setPrompt(h.p)} title={h.p}>
                {h.p}
              </button>
            ))
          }
        </div>

        <SectionTitle>Saved</SectionTitle>
        <div className="saved">
          {saved.length === 0 ? <div className="empty">No saved images</div> :
            saved.map((s, i) => (
              <img key={i} src={s} alt="saved" onClick={() => onDownload(s)} />
            ))
          }
        </div>
      </aside>

      {/* MAIN */}
      <main className="main">
        <header className="top">
          <h1>💖 Milan AI Studio — Text → Image</h1>
          <div className="right-actions">
            <a className="pill" href="/">Home</a>
          </div>
        </header>

        <p className="sub">Describe your image below and hit generate.</p>

        <div className="chips">
          {presets.map((c) => (
            <Chip key={c.k} active={false} onClick={() => setPrompt(c.v)}>{c.k}</Chip>
          ))}
        </div>

        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Describe your image… (Cmd/Ctrl + Enter to generate)"
        />

        {/* ADVANCED */}
        <div className="adv">
          <select value={size} onChange={(e) => setSize(e.target.value)} title="Size">
            <option value="512">512 × 512</option>
            <option value="768">768 × 768</option>
            <option value="1024">1024 × 1024</option>
          </select>

          <label>Steps
            <input type="range" min={4} max={50} value={steps} onChange={(e) => setSteps(+e.target.value)} />
            <span>{steps}</span>
          </label>

          <label>Guidance
            <input type="range" min={1} max={12} step={0.5} value={guidance} onChange={(e) => setGuidance(+e.target.value)} />
            <span>{guidance}</span>
          </label>

          <input
            className="neg"
            value={negative}
            onChange={(e) => setNegative(e.target.value)}
            placeholder="Negative prompt (e.g., text, watermark, blurry, low quality)"
          />
        </div>

        <div className="actions">
          <button className="primary" disabled={loading} onClick={onGenerate}>
            {loading ? "Generating…" : "✨ Create with Milan"}
          </button>
          {images[0] && (
            <button className="ghost" onClick={() => onDownload(images[0])}>⬇ Download</button>
          )}
        </div>

        {err && (
          <div className="error">
            ⚠️ {err.includes("hf_401") ? "Auth error (check HF token)." :
                 err.includes("hf_403") ? "Access denied (try a public model)." :
                 err.includes("hf_404") ? "Model not found (check model id)." :
                 err}
          </div>
        )}

        {/* RESULTS GRID */}
        <div className="grid">
          {images.map((src, idx) => (
            <ImageCard
              key={idx}
              src={src}
              onSave={() => onSave(src)}
              onDownload={() => onDownload(src)}
            />
          ))}
        </div>
      </main>

      {/* --------- Styles --------- */}
      <style jsx>{`
        .wrap { display:grid; grid-template-columns: 280px 1fr; min-height:100vh; background:#0b0f1a; color:#fff; }
        @media (max-width: 980px){ .wrap{ grid-template-columns: 1fr; } .rail{ position:static; height:auto; } }

        .rail { background:#0e1323; border-right:1px solid #1e2741; padding:16px; position:sticky; top:0; height:100vh; overflow:auto; }
        .brand { display:flex; gap:8px; align-items:center; font-weight:900; letter-spacing:.02em; margin-bottom:10px; }
        .mode-row { display:flex; flex-wrap:wrap; gap:8px; }
        .chip { border:1px solid #354266; background:#121a30; color:#dbe7ff; border-radius:999px; padding:6px 10px; font-size:12px; cursor:pointer; }
        .chip.active { background:#26334f; border-color:#44537a; }
        .list { display:flex; flex-direction:column; gap:6px; }
        .row { text-align:left; background:#0f1529; color:#cfe1ff; border:1px solid #273255; padding:8px 10px; border-radius:10px; cursor:pointer; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
        .saved { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
        .saved img { width:100%; border-radius:8px; border:1px solid #273255; cursor:pointer; }

        .main { padding:22px; max-width:1100px; width:100%; }
        .top { display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .top h1 { font-size:22px; margin:0; }
        .right-actions .pill { border:1px solid #394a75; background:#11162a; color:#cfe1ff; text-decoration:none; padding:6px 10px; border-radius:999px; font-size:12px; }
        .sub { opacity:.85; margin:4px 0 12px; }

        textarea { width:100%; background:#0f1320; border:1px solid #3a4157; color:#fff; border-radius:12px; padding:12px; min-height:90px; }
        .adv { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin:10px 0; }
        .adv select { background:#0f1320; border:1px solid #3a4157; color:#fff; border-radius:10px; padding:8px 10px; }
        .adv label { display:flex; align-items:center; gap:8px; background:#0f1320; border:1px solid #3a4157; border-radius:10px; padding:4px 8px; font-size:12px; }
        .adv input[type="range"]{ accent-color:#e91e63; }
        .adv .neg { flex:1; min-width:220px; background:#0f1320; border:1px solid #3a4157; color:#fff; border-radius:10px; padding:8px 10px; }

        .actions { display:flex; gap:10px; margin:10px 0 8px; }
        .primary { padding:10px 14px; border-radius:12px; font-weight:900; border:0; background:linear-gradient(90deg,#ff6ea7,#ff9fb0); color:#0b0a12; box-shadow:0 10px 30px rgba(255,110,167,.2); cursor:pointer; }
        .ghost { padding:10px 14px; border-radius:12px; background:#2f3a55; border:1px solid #3a4157; color:#fff; cursor:pointer; }

        .error { background:#3a2030; border:1px solid #5a2a3a; padding:10px; border-radius:10px; margin:8px 0; }

        .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap:14px; margin-top:12px; }
      `}</style>
    </div>
  );
}
