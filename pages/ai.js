import { useEffect, useState } from "react";

/** Milan AI Studio — Mobile-first Responsive (no Tailwind) */

const MODES = [
  { key: "romantic", label: "Romantic", desc: "Warm tones, depth, soft bokeh.", icon: "💖",
    preset: "romantic cinematic portrait, warm tones, soft bokeh, masterpiece, ultra detail, volumetric light" },
  { key: "realistic", label: "Realistic", desc: "Photographic, true-to-life.", icon: "📸",
    preset: "highly detailed, photorealistic, 35mm, natural lighting, film grain, masterpiece" },
  { key: "anime", label: "Anime", desc: "Ghibli / anime vibe.", icon: "🌸",
    preset: "ghibli style, vibrant colors, crisp line art, anime style, dynamic composition, cinematic" },
  { key: "product", label: "Product", desc: "Studio, e-commerce.", icon: "🛍️",
    preset: "studio product photo, soft light, seamless background, crisp shadows, highly detailed" },
];

const TEMPLATES = {
  romantic: [
    "Golden hour couple portrait, soft backlight, pastel grading, dreamy",
    "Rainy street umbrella moment, reflections, bokeh lights, cinematic",
    "Candle-lit indoor close-up, luminous skin, shallow DOF, warm tones",
    "Beach sunset silhouette, lens flare, gentle wind, emotional",
  ],
  realistic: [
    "Natural light portrait, 85mm lens, subtle film grain, skin texture",
    "Street candid, Kodak Porta look, high dynamic range, tack sharp",
    "Editorial studio portrait, Rembrandt lighting, seamless background",
    "Landscape at blue hour, long exposure, crisp details",
  ],
  anime: [
    "Anime couple in blooming garden, floating petals, dynamic composition, vibrant palette",
    "Ghibli-style temple under cherry blossoms, soft diffuse light",
    "City rooftop at dusk, neon signs, energetic pose, manga lines",
    "Forest spirits glowing, whimsical, painterly brushwork",
  ],
  product: [
    "Minimal product lay flat, soft shadow, seamless cyc wall, glossy reflections, editorial style",
    "Cosmetics bottle on wet marble, water droplets, studio rim light",
    "Sneaker levitating with motion blur, gradient backdrop, hero shot",
    "Watch macro on brushed steel, specular highlights, premium",
  ],
};

const SIZES = ["768x768", "1024x1024", "1024x1536", "1536x1024"];
const defaultNegative = "text, watermark, blurry, low quality, jpeg artifacts, extra fingers, missing limbs";

export default function AIStudioPage() {
  const [theme, setTheme] = useDarkTheme();
  const [mode, setMode] = useState("romantic");
  const [prompt, setPrompt] = useState("");
  const [negative, setNegative] = useState(defaultNegative);
  const [size, setSize] = useState("1024x1024");
  const [steps, setSteps] = useState(25);
  const [guidance, setGuidance] = useState(7);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [history, setHistory] = useLocalStorageArray("milan:ai:history", []);
  const [saved, setSaved] = useLocalStorageArray("milan:ai:saved", []);

  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [error, setError] = useState("");
  const [compareUrls, setCompareUrls] = useState([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // --- mobile 100vh fix (and notch safe areas) ---
  useEffect(() => {
    const setVh = () => {
      document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
    };
    setVh();
    window.addEventListener("resize", setVh);
    return () => window.removeEventListener("resize", setVh);
  }, []);

  useEffect(() => {
    if (!prompt?.trim()) {
      const m = MODES.find((m) => m.key === mode);
      if (m) setPrompt(m.preset);
    }
  }, [mode]);

  const onInspire = () => {
    const bank = [
      "Moonlit riverside, soft fog, glowing lanterns, reflective water, cinematic",
      "Old library with golden sunbeams, dust motes, warm wood, cozy vibe",
      "Neon alley, rain-slick streets, reflections, cyberpunk framing",
      "Art deco hotel lobby, marble floor reflections, wide angle, dramatic",
    ];
    setPrompt(bank[Math.floor(Math.random() * bank.length)]);
  };

  async function imageUrlFromImageResponse(res) {
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  const onGenerate = async () => {
    const finalPrompt = prompt?.trim();
    if (!finalPrompt) return;
    setLoading(true);
    setError("");

    setHistory((prev) => [
      { ts: Date.now(), prompt: finalPrompt, negative, mode, size, steps, guidance },
      ...prev.filter((h) => h.prompt !== finalPrompt).slice(0, 49),
    ]);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: finalPrompt, negative, mode, size, steps, guidance }),
      });

      const ctype = res.headers.get("content-type") || "";

      if (!res.ok) {
        let bodyText = "";
        try { bodyText = ctype.includes("application/json") ? JSON.stringify(await res.json()) : await res.text(); }
        catch { bodyText = "Unknown server error"; }
        setImageUrl(null);
        setError(`Generation failed (${res.status}). ${truncate(String(bodyText), 300)}`);
        return;
      }

      if (ctype.includes("application/json")) {
        const data = await res.json();
        if (data?.imageUrl) {
          setImageUrl(data.imageUrl);
          setCompareUrls((prev) => [data.imageUrl, ...prev].slice(0, 6));
          if (data?.error) setError(truncate(String(data.error), 240));
          return;
        }
        setImageUrl(null);
        setError(truncate(String(data?.error || "No image returned by API."), 240));
        return;
      }

      if (ctype.startsWith("image/")) {
        const url = await imageUrlFromImageResponse(res);
        setImageUrl(url);
        setCompareUrls((prev) => [url, ...prev].slice(0, 6));
        return;
      }

      const txt = await res.text();
      const trimmed = txt.trim();
      if (trimmed.startsWith("data:image") || /^https?:\/\//i.test(trimmed)) {
        setImageUrl(trimmed);
        setCompareUrls((prev) => [trimmed, ...prev].slice(0, 6));
        return;
      }
      setImageUrl(null);
      setError("Unrecognized response from server.");
    } catch (e) {
      setImageUrl(null);
      setError(`Network error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const onSave = () => {
    if (!imageUrl) return;
    setSaved((prev) => [{ url: imageUrl, prompt, mode, ts: Date.now() }, ...prev]);
  };

  const onDownload = async () => {
    if (!imageUrl) return;
    try {
      if (imageUrl.startsWith("data:image")) {
        const a = document.createElement("a");
        a.href = imageUrl;
        a.download = `milan-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
      const resp = await fetch(imageUrl, { mode: "cors" });
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `milan-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      const a = document.createElement("a");
      a.href = imageUrl;
      a.download = `milan-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  const onShare = async () => {
    if (!imageUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Milan AI Studio", text: prompt, url: imageUrl });
      } else {
        await navigator.clipboard.writeText(imageUrl);
        alert("Link copied! Paste anywhere to share.");
      }
    } catch {}
  };

  return (
    <div className={`milan-root ${theme === "dark" ? "milan-dark" : "milan-light"}`}>
      <header className="milan-header">
        <div className="milan-header__left">
          <span className="milan-logo">💘</span>
          <h1>Milan AI Studio</h1>
        </div>
        <div className="milan-header__right">
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="milan-btn milan-btn--ghost">
            {theme === "dark" ? "🌙 Dark" : "🌞 Light"}
          </button>
          <a href="/" className="milan-btn milan-btn--ghost milan-hide-sm">← Back to Home</a>
        </div>
      </header>

      <section className="milan-hero">
        <div className="milan-hero__text">
          <h2>Turn your imagination into reality ✨</h2>
          <p>Generate romantic, anime, realistic or product-grade images with one prompt. Clean UI, pro controls, mobile-friendly.</p>

          {/* Modes: chips on mobile, stacked on desktop */}
          <div className="milan-modes" role="tablist" aria-label="Generation modes">
            {MODES.map((m) => (
              <button
                key={m.key}
                className={`milan-mode ${mode === m.key ? "is-active" : ""}`}
                aria-pressed={mode === m.key}
                aria-selected={mode === m.key}
                onClick={() => setMode(m.key)}
                title={m.desc}
              >
                <span className="milan-mode__title">{m.icon} {m.label}</span>
              </button>
            ))}
          </div>

          <div className="milan-helpers">
            <button onClick={() => setTemplatesOpen(true)} className="milan-btn milan-btn--ghost">🧰 Use Template</button>
            <button onClick={onInspire} className="milan-btn milan-btn--ghost">💡 Inspire Me</button>
          </div>
        </div>

        <div className="milan-hero__aside">
          <div className="milan-card">
            <div className="milan-card__title">Recent Prompt</div>
            {history?.length ? (
              <button className="milan-link" onClick={() => {
                const h = history[0];
                setPrompt(h.prompt);
                setNegative(h.negative || defaultNegative);
                setMode(h.mode || "romantic");
                setSize(h.size || "1024x1024");
                setSteps(h.steps || 25);
                setGuidance(h.guidance || 7);
              }}>
                {truncate(history[0].prompt, 140)}
              </button>
            ) : (
              <div className="milan-muted">Your latest prompt will appear here.</div>
            )}
          </div>
        </div>
      </section>

      <main className="milan-main">
        <div className="milan-grid">
          {/* LEFT: prompt & controls */}
          <div className="milan-col">
            <div className="milan-card">
              <label className="milan-label">Your Prompt</label>
              <div className="milan-textarea-wrap">
                <textarea
                  className="milan-textarea"
                  placeholder="Describe your dream image…"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={6}
                />
                <div className="milan-counter">{prompt.length} chars</div>
              </div>

              <div className="milan-create-row">
                <button
                  onClick={onGenerate}
                  disabled={loading || !prompt.trim()}
                  className="milan-btn milan-btn--primary milan-btn--full"
                >
                  {loading ? "Creating…" : "Create with Milan"}
                </button>
              </div>
            </div>

            <div className="milan-card">
              <button className="milan-accordion" onClick={() => setAdvancedOpen((v) => !v)}>
                <span>⚙️ Advanced Settings</span>
                <span className="milan-muted">{advancedOpen ? "Hide" : "Show"}</span>
              </button>

              {advancedOpen && (
                <div className="milan-adv">
                  <div className="milan-row">
                    <div className="milan-field">
                      <label className="milan-label">Size</label>
                      <select className="milan-input" value={size} onChange={(e) => setSize(e.target.value)}>
                        {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="milan-field">
                      <label className="milan-label">Steps <span className="milan-note">{steps}</span></label>
                      <input type="range" min={10} max={50} value={steps} onChange={(e) => setSteps(parseInt(e.target.value, 10))} className="milan-range" />
                    </div>
                  </div>

                  <div className="milan-field">
                    <label className="milan-label">Guidance <span className="milan-note">{guidance}</span></label>
                    <input type="range" min={1} max={20} value={guidance} onChange={(e) => setGuidance(parseInt(e.target.value, 10))} className="milan-range" />
                  </div>

                  <div className="milan-field">
                    <label className="milan-label">Negative Prompt</label>
                    <input className="milan-input" value={negative} onChange={(e) => setNegative(e.target.value)} placeholder="Unwanted elements (e.g., text, watermark)" />
                  </div>
                </div>
              )}
            </div>

            <div className="milan-card">
              <div className="milan-card__title">
                📁 Saved {saved?.length ? <button className="milan-link milan-right" onClick={() => setSaved([])}>Clear</button> : null}
              </div>
              {saved?.length === 0 ? (
                <div className="milan-muted">Nothing saved yet. Generate and hit “Save”.</div>
              ) : (
                <div className="milan-gallery">
                  {saved.map((s, i) => (
                    <button key={s.ts + "-" + i} onClick={() => setImageUrl(s.url)} className="milan-thumb">
                      <img src={s.url} alt="saved" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: preview & recent */}
          <div className="milan-col milan-col--wide">
            <div className="milan-card milan-card--noPad">
              <div className="milan-toolbar">
                <div className="milan-muted">{imageUrl ? `${size} — ${mode}` : "Preview"}</div>
                <div className="milan-toolbar__btns">
                  <button className="milan-btn milan-btn--ghost" onClick={onSave} disabled={!imageUrl}>Save</button>
                  <button className="milan-btn milan-btn--ghost" onClick={onDownload} disabled={!imageUrl}>Download</button>
                  <button className="milan-btn milan-btn--ghost" onClick={onShare} disabled={!imageUrl}>Share</button>
                </div>
              </div>

              <div className="milan-canvas">
                {loading ? (
                  <div className="milan-loader">
                    <div className="milan-spinner" />
                    <div className="milan-muted">✨ Creating magic…</div>
                  </div>
                ) : imageUrl ? (
                  <img src={imageUrl} alt="result" className="milan-result" />
                ) : (
                  <div className="milan-empty">Your image will appear here. Add a prompt and hit Create.</div>
                )}
              </div>

              {error && <div className="milan-alert">{error}</div>}
            </div>

            {compareUrls?.length > 0 && (
              <div className="milan-card">
                <div className="milan-card__title">Recent Results</div>
                <div className="milan-compare">
                  {compareUrls.map((u, i) => (
                    <button key={u + "-" + i} onClick={() => setImageUrl(u)} className="milan-thumb">
                      <img src={u} alt="recent" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Templates Bottom Sheet */}
      {templatesOpen && (
        <div className="milan-sheet" role="dialog" aria-modal="true">
          <div className="milan-sheet__panel">
            <div className="milan-sheet__head">
              <div className="milan-sheet__title">Choose a template — {mode}</div>
              <button className="milan-btn milan-btn--ghost" onClick={() => setTemplatesOpen(false)}>Close</button>
            </div>
            <div className="milan-templates">
              {(TEMPLATES[mode] || []).map((t, i) => (
                <button key={i} className="milan-template" onClick={() => { setPrompt(t); setTemplatesOpen(false); }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="milan-sheet__backdrop" onClick={() => setTemplatesOpen(false)} />
        </div>
      )}

      {/* Component-scoped responsive styles */}
      <style jsx>{`
        :root { --radius: 14px; --gap: 16px; }
        .milan-root {
          min-height: calc(var(--vh, 1vh) * 100);
          padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
          background: radial-gradient(1200px 800px at 20% -10%, rgba(255,105,180,0.06), transparent 60%),
                      radial-gradient(1200px 800px at 120% 0%, rgba(135,206,250,0.05), transparent 60%);
          color: #e8e8ec;
        }
        .milan-dark { background-color: #0e1217; }
        .milan-light { background-color: #f6f7fb; color: #121316; }

        .milan-header {
          position: sticky; top: 0; z-index: 40;
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; backdrop-filter: blur(8px);
          background: rgba(12,14,18,0.6);
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .milan-light .milan-header { background: rgba(255,255,255,0.7); border-color: rgba(0,0,0,0.06); }
        .milan-logo { font-size: 20px; margin-right: 8px; }
        .milan-header__left { display:flex; align-items:center; gap:8px; }
        .milan-header__right { display:flex; gap:8px; align-items:center; }
        .milan-hide-sm { display:none; }
        @media (min-width: 768px){ .milan-hide-sm { display:inline-flex; } }

        .milan-hero {
          display:grid; gap: var(--gap);
          grid-template-columns: 1fr;
          padding: 12px 16px 4px;
        }
        @media (min-width: 1024px){
          .milan-hero { grid-template-columns: 2fr 1fr; align-items:start; }
        }
        .milan-hero__text h2 { margin: 4px 0 6px; font-size: 22px; }
        @media (min-width:768px){ .milan-hero__text h2 { font-size: 26px; } }
        .milan-hero__text p { margin: 0 0 10px; opacity: 0.85; }

        /* Modes: chips on mobile, stack on desktop */
        .milan-modes { display:flex; gap:8px; overflow-x:auto; padding: 6px 0; scrollbar-width: none; }
        .milan-modes::-webkit-scrollbar{ display:none; }
        .milan-mode {
          flex: 0 0 auto; padding: 10px 12px; border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.03);
          font-size: 14px; line-height: 1; white-space: nowrap;
        }
        .milan-mode.is-active { border-color: #ff6ea6; box-shadow: 0 0 0 2px rgba(255,110,166,0.2) inset; }
        @media (min-width: 1024px){
          .milan-modes { flex-direction: column; overflow: visible; }
          .milan-mode { border-radius: var(--radius); padding: 12px 14px; white-space: normal; }
        }

        .milan-helpers { display:flex; gap:8px; flex-wrap:wrap; margin-top: 8px; }

        .milan-main { padding: 8px 16px 24px; }
        .milan-grid {
          display:grid; gap: var(--gap);
          grid-template-columns: 1fr;
        }
        @media (min-width: 1024px){
          .milan-grid { grid-template-columns: 2fr 3fr; }
        }
        .milan-col { display: grid; gap: var(--gap); align-content: start; }
        .milan-col--wide { min-width: 0; }

        .milan-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: var(--radius);
          padding: 12px;
        }
        .milan-light .milan-card { background: rgba(0,0,0,0.02); border-color: rgba(0,0,0,0.08); }
        .milan-card--noPad { padding: 0; overflow: hidden; }

        .milan-card__title { font-weight: 600; margin-bottom: 8px; }
        .milan-label { font-size: 13px; opacity: 0.9; display:block; margin-bottom: 6px; }
        .milan-input, .milan-textarea, select {
          width: 100%; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.02); color: inherit; padding: 10px 12px;
        }
        .milan-light .milan-input, .milan-light .milan-textarea, .milan-light select {
          background: #fff; border-color: rgba(0,0,0,0.12); color: #111;
        }
        .milan-textarea { min-height: 120px; resize: vertical; }
        .milan-textarea-wrap { position: relative; }
        .milan-counter {
          position: absolute; right: 8px; bottom: 8px; font-size: 12px; opacity: 0.7;
          background: rgba(0,0,0,0.35); padding: 2px 6px; border-radius: 999px;
        }
        .milan-light .milan-counter { background: rgba(0,0,0,0.08); }

        .milan-btn {
          display:inline-flex; align-items:center; justify-content:center; gap:8px;
          height: 40px; padding: 0 14px; border-radius: 12px; cursor: pointer;
          border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.06); color: inherit;
        }
        .milan-btn[disabled] { opacity: 0.5; cursor: not-allowed; }
        .milan-btn--primary { border-color: #ff6ea6; background: linear-gradient(180deg,#ff6ea6,#ff3e7f); color: #fff; }
        .milan-btn--ghost { background: transparent; }
        .milan-btn--full { width: 100%; }

        /* Sticky create button on mobile */
        .milan-create-row { margin-top: 10px; }
        @media (max-width: 767px){
          .milan-create-row { position: sticky; bottom: 8px; z-index: 20; }
          .milan-create-row .milan-btn--primary { box-shadow: 0 8px 24px rgba(255,62,127,0.35); }
        }

        .milan-accordion {
          width: 100%; display:flex; justify-content: space-between; align-items:center;
          background: transparent; border: none; color: inherit; padding: 4px 2px; cursor: pointer;
        }
        .milan-adv { display:grid; gap: 10px; padding-top: 8px; }
        .milan-row { display:grid; gap: 10px; grid-template-columns: 1fr; }
        @media (min-width: 640px){ .milan-row { grid-template-columns: 1fr 1fr; } }
        .milan-field { display:grid; gap: 6px; }
        .milan-range { width: 100%; }
        .milan-note { opacity: 0.7; font-weight: 500; margin-left: 6px; }

        .milan-toolbar {
          display:flex; align-items:center; justify-content:space-between; gap: 8px;
          padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.02);
          flex-wrap: wrap;
        }
        .milan-toolbar__btns { display:flex; gap: 6px; flex-wrap: wrap; }

        .milan-canvas {
          position: relative; display:flex; align-items:center; justify-content:center;
          padding: 10px; min-height: 260px; aspect-ratio: 4/3; /* responsive preview box */
          background: rgba(0,0,0,0.25);
        }
        .milan-result { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 10px; }
        .milan-empty { opacity: 0.7; text-align: center; padding: 24px; }

        .milan-loader { display:flex; flex-direction:column; align-items:center; gap: 10px; }
        .milan-spinner { width: 24px; height: 24px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.25); border-top-color: #ff6ea6; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .milan-alert {
          margin: 10px; border-radius: 10px; padding: 10px 12px;
          background: rgba(255,80,80,0.1); border: 1px solid rgba(255,80,80,0.3);
        }

        .milan-gallery, .milan-compare {
          display:flex; flex-wrap: wrap; gap: 8px;
        }
        .milan-thumb {
          width: 88px; height: 88px; border-radius: 10px; overflow:hidden;
          border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03);
        }
        .milan-thumb img { width: 100%; height: 100%; object-fit: cover; display:block; }

        .milan-link { color: #80bfff; text-decoration: underline; background: none; border: 0; cursor: pointer; }
        .milan-muted { opacity: 0.75; }
        .milan-right { float: right; }

        /* Bottom sheet */
        .milan-sheet { position: fixed; inset: 0; z-index: 70; }
        .milan-sheet__backdrop { position:absolute; inset:0; background: rgba(0,0,0,0.5); }
        .milan-sheet__panel {
          position: absolute; left: 0; right: 0; bottom: 0; max-height: 80vh; overflow: auto;
          background: rgba(30,32,39,1); border-top-left-radius: 18px; border-top-right-radius: 18px;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .milan-light .milan-sheet__panel { background: #fff; }
        .milan-sheet__head { display:flex; align-items:center; justify-content:space-between; padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .milan-sheet__title { font-weight: 600; }
        .milan-templates { display:grid; gap: 8px; padding: 12px; }
        .milan-template { text-align: left; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); color: inherit; }

        /* Light mode tweaks */
        .milan-light .milan-mode { border-color: rgba(0,0,0,0.12); background: rgba(0,0,0,0.03); }
        .milan-light .milan-mode.is-active { box-shadow: 0 0 0 2px rgba(255,110,166,0.25) inset; }
      `}</style>
    </div>
  );
}

/* Hooks & utils */
function useLocalStorageArray(key, initial) {
  const [state, setState] = useState(initial);
  useEffect(() => { try { const raw = localStorage.getItem(key); if (raw) setState(JSON.parse(raw)); } catch {} }, [key]);
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(state)); } catch {} }, [key, state]);
  return [state, setState];
}
function useDarkTheme() {
  const [theme, setTheme] = useState("dark");
  useEffect(() => { const saved = localStorage.getItem("milan:theme"); if (saved === "dark" || saved === "light") setTheme(saved); }, []);
  useEffect(() => { try { localStorage.setItem("milan:theme", theme); } catch {} }, [theme]);
  return [theme, setTheme];
}
function truncate(str, n) { if (!str) return ""; return str.length > n ? str.slice(0, n - 1) + "…" : str; }
