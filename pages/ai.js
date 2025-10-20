import { useEffect, useState } from "react";

/** Milan AI Studio — Robust Frontend (no Tailwind)
 * - Create CTA under Prompt
 * - Clear selected mode
 * - Full-page scroll (CSS side)
 * - Handles API JSON ({ok,imageUrl}) + raw image bytes
 * - Proper error surfacing (status + details)
 * - Safe blob download
 */

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

  // Helper: turn a Response with image body into an object URL
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

      // ❌ Server returned an error → read the body once and surface it
      if (!res.ok) {
        let bodyText = "";
        try { bodyText = ctype.includes("application/json") ? JSON.stringify(await res.json()) : await res.text(); }
        catch { bodyText = "Unknown server error"; }
        setImageUrl(null);
        setError(`Generation failed (${res.status}). ${truncate(String(bodyText), 300)}`);
        return;
      }

      // ✅ Our API returns JSON: { ok, imageUrl, error? }
      if (ctype.includes("application/json")) {
        const data = await res.json();
        if (data?.ok && data?.imageUrl) {
          setImageUrl(data.imageUrl);
          setCompareUrls((prev) => [data.imageUrl, ...prev].slice(0, 6));
          return;
        }
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

      // ✅ If (rarely) server streams raw image bytes
      if (ctype.startsWith("image/")) {
        const url = await imageUrlFromImageResponse(res);
        setImageUrl(url);
        setCompareUrls((prev) => [url, ...prev].slice(0, 6));
        return;
      }

      // ❓ Unexpected content type
      const txt = await res.text();
      const trimmed = txt.trim();
      if (trimmed.startsWith("data:image")) {
        setImageUrl(trimmed);
        setCompareUrls((prev) => [trimmed, ...prev].slice(0, 6));
        return;
      }
      if (/^https?:\/\//i.test(trimmed)) {
        setImageUrl(trimmed);
        setCompareUrls((prev) => [trimmed, ...prev].slice(0, 6));
        return;
      }
      setImageUrl(null);
      setError("Unrecognized response from server.");

    } catch (e) {
      // Pure network failure → no fake demo unless you want it
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

  // Safe blob download
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
      {/* Header */}
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

      {/* Hero */}
      <section className="milan-hero">
        <div className="milan-hero__text">
          <h2>Turn your imagination into reality ✨</h2>
          <p>Generate romantic, anime, realistic or product-grade images with one prompt. Clean UI, pro controls, mobile-friendly.</p>

          <div className="milan-modes" role="tablist" aria-label="Generation modes">
            {MODES.map((m) => (
              <button
                key={m.key}
                className={`milan-mode ${mode === m.key ? "is-active" : ""}`}
                aria-pressed={mode === m.key}
                aria-selected={mode === m.key}
                onClick={() => setMode(m.key)}
              >
                <div className="milan-mode__title">
                  {m.icon} {m.label} {mode === m.key ? "✓" : ""}
                </div>
                <div className="milan-mode__desc">{m.desc}</div>
              </button>
            ))}
          </div>

          <div className="milan-helpers">
            <button onClick={() => setTemplatesOpen(true)} className="milan-btn milan-btn--ghost">🧰 Use Template</button>
            <button onClick={onInspire} className="milan-btn milan-btn--ghost">💡 Inspire Me</button>
          </div>
        </div>

        {/* Recent Prompt */}
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

      {/* Main */}
      <main className="milan-main">
        <div className="milan-grid">
          {/* Left: Controls */}
          <div className="milan-col">
            <div className="milan-card">
              <label className="milan-label">Your Prompt</label>
              <div className="milan-textarea-wrap">
                <textarea
                  className="milan-textarea"
                  placeholder="Describe your dream image…"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
                <div className="milan-counter">{prompt.length} chars</div>
              </div>
              <div style={{ marginTop: 10 }}>
                <button onClick={onGenerate} disabled={loading || !prompt.trim()} className="milan-btn milan-btn--primary" style={{ width: "100%" }}>
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

          {/* Right: Preview */}
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

      {/* Template Picker */}
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
// keep regex literal as `\/`
function stripPrefix(b64){ return (b64 || "").replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ""); }
function demoFallbackUrl() {
  const seeds = ["milan1","milan2","milan3","milan4","milan5"];
  const seed = seeds[Math.floor(Math.random()*seeds.length)];
  return `https://picsum.photos/seed/${seed}/1200/800`;
}
