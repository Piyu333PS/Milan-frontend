import { useEffect, useState } from "react";

/** Milan AI Studio — Vanilla CSS (no Tailwind)
 * Fixes:
 * - Single CTA (mobile vs desktop)
 * - Clear selected mode (badge + left bar)
 * - Full-page scroll (no 50% clipping)
 * - Reliable demo image (no 404)
 * - Safe download (blob) to avoid cross-site 404
 * - “Back” goes to home (no missing /dashboard route)
 * - Template picker panel with multiple options per mode
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
const defaultNegative =
  "text, watermark, blurry, low quality, jpeg artifacts, extra fingers, missing limbs";

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

  // Prefill prompt when mode changes (only if empty)
  useEffect(() => {
    if (!prompt?.trim()) {
      const m = MODES.find((m) => m.key === mode);
      if (m) setPrompt(m.preset);
    }
  }, [mode]);

  const onInspire = () => {
    // Random ideas, independent of mode
    const bank = [
      "Moonlit riverside, soft fog, glowing lanterns, reflective water, cinematic",
      "Old library with golden sunbeams, dust motes, warm wood, cozy vibe",
      "Neon alley, rain-slick streets, reflections, cyberpunk framing",
      "Art deco hotel lobby, marble floor reflections, wide angle, dramatic",
    ];
    setPrompt(bank[Math.floor(Math.random() * bank.length)]);
  };

  const onGenerate = async () => {
    const finalPrompt = prompt?.trim();
    if (!finalPrompt) return;
    setLoading(true);
    setError("");

    // Save search in history
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
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();
      const url = data?.imageUrl || demoFallbackUrl();
      setImageUrl(url);
      setCompareUrls((prev) => [url, ...prev].slice(0, 4));
    } catch {
      const url = demoFallbackUrl(); // reliable placeholder
      setImageUrl(url);
      setError("Generation service unreachable. Showing a demo image. Configure /api/generate to go live.");
    } finally {
      setLoading(false);
    }
  };

  const onSave = () => {
    if (!imageUrl) return;
    setSaved((prev) => [{ url: imageUrl, prompt, mode, ts: Date.now() }, ...prev]);
  };

  // Safer download that fetches as blob (avoids 404 on some hosts)
  const onDownload = async () => {
    if (!imageUrl) return;
    try {
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
      // fallback to direct link if blob fails
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
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="milan-btn milan-btn--ghost"
          >
            {theme === "dark" ? "🌙 Dark" : "🌞 Light"}
          </button>
          {/* Avoid 404: send to homepage unless you actually have /dashboard */}
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
            <button onClick={() => setTemplatesOpen(true)} className="milan-btn milan-btn--ghost">
              🧰 Use Template
            </button>
            <button
              onClick={onInspire}
              className="milan-btn milan-btn--ghost"
              title="Gives a random creative idea irrespective of mode"
            >
              💡 Inspire Me
            </button>
          </div>
        </div>

        {/* Recent Prompt */}
        <div className="milan-hero__aside">
          <div className="milan-card">
            <div className="milan-card__title">Recent Prompt</div>
            {history?.length ? (
              <button
                className="milan-link"
                onClick={() => {
                  const h = history[0];
                  setPrompt(h.prompt);
                  setNegative(h.negative || defaultNegative);
                  setMode(h.mode || "romantic");
                  setSize(h.size || "1024x1024");
                  setSteps(h.steps || 25);
                  setGuidance(h.guidance || 7);
                }}
              >
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
                      <select
                        className="milan-input"
                        value={size}
                        onChange={(e) => setSize(e.target.value)}
                      >
                        {SIZES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="milan-field">
                      <label className="milan-label">
                        Steps <span className="milan-note">{steps}</span>
                      </label>
                      <input
                        type="range"
                        min={10}
                        max={50}
                        value={steps}
                        onChange={(e) => setSteps(parseInt(e.target.value, 10))}
                        className="milan-range"
                      />
                    </div>
                  </div>
                  <div className="milan-field">
                    <label className="milan-label">
                      Guidance <span className="milan-note">{guidance}</span>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      value={guidance}
                      onChange={(e) => setGuidance(parseInt(e.target.value, 10))}
                      className="milan-range"
                    />
                  </div>
                  <div className="milan-field">
                    <label className="milan-label">Negative Prompt</label>
                    <input
                      className="milan-input"
                      value={negative}
                      onChange={(e) => setNegative(e.target.value)}
                      placeholder="Unwanted elements (e.g., text, watermark)"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="milan-card">
              <div className="milan-card__title">
                📁 Saved{" "}
                {saved?.length ? (
                  <button className="milan-link milan-right" onClick={() => setSaved([])}>
                    Clear
                  </button>
                ) : null}
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
                  <button className="milan-btn milan-btn--ghost" onClick={onSave} disabled={!imageUrl}>
                    Save
                  </button>
                  <button className="milan-btn milan-btn--ghost" onClick={onDownload} disabled={!imageUrl}>
                    Download
                  </button>
                  <button className="milan-btn milan-btn--ghost" onClick={onShare} disabled={!imageUrl}>
                    Share
                  </button>
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

      {/* CTA — show ONE button: mobile-only OR desktop-only */}
      <div className="milan-sticky sm-only">
        <button onClick={onGenerate} disabled={loading || !prompt.trim()} className="milan-btn milan-btn--primary">
          {loading ? "Creating…" : "Create with Milan"}
        </button>
      </div>

      <div className="milan-desktop-cta lg-only">
        <button onClick={onGenerate} disabled={loading || !prompt.trim()} className="milan-btn milan-btn--primary">
          {loading ? "Creating…" : "Create with Milan"}
        </button>
      </div>

      {/* Template Picker */}
      {templatesOpen && (
        <div className="milan-sheet" role="dialog" aria-modal="true">
          <div className="milan-sheet__panel">
            <div className="milan-sheet__head">
              <div className="milan-sheet__title">Choose a template — {mode}</div>
              <button className="milan-btn milan-btn--ghost" onClick={() => setTemplatesOpen(false)}>
                Close
              </button>
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

// Hooks & utils
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
// Use a reliable placeholder service to avoid 404s
function demoFallbackUrl() {
  const seeds = ["milan1","milan2","milan3","milan4"];
  const seed = seeds[Math.floor(Math.random()*seeds.length)];
  // picsum is very reliable for demo images
  return `https://picsum.photos/seed/${seed}/1200/800`;
}
