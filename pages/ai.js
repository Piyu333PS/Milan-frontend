import { useEffect, useMemo, useRef, useState } from "react";

// ————————————————————————————————————————
// Milan AI Studio — Fully reworked UI (mobile-first, glassy romantic theme)
// Drop this file at: /pages/ai.js  (Next.js pages router)
// TailwindCSS required. No external UI deps. Works dark/light. Saved items persisted.
// It calls POST /api/generate — return { imageUrl } from your backend. Fallback demo image if it fails.
// ————————————————————————————————————————

const MODES = [
  {
    key: "romantic",
    label: "Romantic",
    desc: "Warm tones, depth, soft bokeh.",
    badge: "💖",
    preset:
      "romantic cinematic portrait, warm tones, soft bokeh, masterpiece, ultra detail, volumetric light",
  },
  {
    key: "realistic",
    label: "Realistic",
    desc: "Photographic, true-to-life.",
    badge: "📸",
    preset:
      "highly detailed, photorealistic, 35mm, natural lighting, film grain, masterpiece",
  },
  {
    key: "anime",
    label: "Anime",
    desc: "Ghibli / anime vibe.",
    badge: "🌸",
    preset:
      "ghibli style, vibrant colors, crisp line art, anime style, dynamic composition, cinematic",
  },
  {
    key: "product",
    label: "Product",
    desc: "Studio, e‑commerce.",
    badge: "🛍️",
    preset:
      "studio product photo, soft light, seamless background, crisp shadows, highly detailed",
  },
];

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

  // Prefill prompt when mode changes (only if empty)
  useEffect(() => {
    if (!prompt?.trim()) {
      const m = MODES.find((m) => m.key === mode);
      if (m) setPrompt(m.preset);
    }
  }, [mode]);

  const onInspire = () => {
    const bank = [
      "Radha and Krishna under moonlit garden, soft mist, intricate embroidery, cinematic, masterpiece",
      "Royal bridal portrait in warm candle light, shallow depth of field, detailed jewelry, photorealistic",
      "Cozy coffee shop rain window, bokeh lights, reflective table, moody cinematic frame",
      "Premium perfume bottle on marble slab with water droplets, studio lighting, hero shot",
    ];
    setPrompt(bank[Math.floor(Math.random() * bank.length)]);
  };

  const onTemplates = (k) => {
    const t = {
      romantic:
        "Close-up romantic portrait, golden hour, glowing skin, soft lens flare, pastel color grading",
      realistic:
        "Natural light portrait, 85mm lens, true-to-life textures, subtle film grain, balanced exposure",
      anime:
        "Anime couple in blooming garden, floating petals, dynamic composition, vibrant palette",
      product:
        "Minimal product lay flat, soft shadow, seamless cyc wall, glossy reflections, editorial style",
    };
    setPrompt(t[k] || "");
  };

  const onGenerate = async () => {
    const finalPrompt = prompt?.trim();
    if (!finalPrompt) return;
    setLoading(true);
    setError("");

    // Add to history (de-dup, keep latest first)
    setHistory((prev) => {
      const next = [
        {
          ts: Date.now(),
          prompt: finalPrompt,
          negative,
          mode,
          size,
          steps,
          guidance,
        },
        ...prev.filter((h) => h.prompt !== finalPrompt).slice(0, 49),
      ];
      return next;
    });

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalPrompt,
          negative,
          mode,
          size,
          steps,
          guidance,
        }),
      });

      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();
      const url = data?.imageUrl || demoFallbackUrl();
      setImageUrl(url);
      setCompareUrls((prev) => [url, ...prev].slice(0, 4));
    } catch (e) {
      setImageUrl(demoFallbackUrl());
      setError(
        "Generation service unreachable. Showing a demo image so your flow stays smooth. Configure /api/generate to go live."
      );
    } finally {
      setLoading(false);
    }
  };

  const onSave = () => {
    if (!imageUrl) return;
    setSaved((prev) => [
      { url: imageUrl, prompt, mode, ts: Date.now() },
      ...prev,
    ]);
  };

  const onDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `milan-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const onShare = async () => {
    if (!imageUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Milan AI Studio",
          text: prompt,
          url: imageUrl,
        });
      } else {
        await navigator.clipboard.writeText(imageUrl);
        alert("Link copied! Paste anywhere to share.");
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={tw(
      "min-h-screen w-full",
      theme === "dark" ? "bg-[#0b0e13] text-white" : "bg-white text-slate-900"
    )}>
      {/* Top Bar */}
      <header className="sticky top-0 z-30 backdrop-blur bg-black/20 supports-[backdrop-filter]:bg-black/10 border-b border-white/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💘</span>
            <h1 className="font-semibold tracking-tight">Milan AI Studio</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="px-3 py-1.5 text-sm rounded-full border border-white/10 hover:border-white/30 transition"
            >
              {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
            </button>
            <a
              href="/dashboard"
              className="hidden sm:inline-flex px-3 py-1.5 text-sm rounded-full border border-pink-300/30 bg-pink-500/10 hover:bg-pink-500/20 transition"
            >
              ← Back to Dashboard
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-8 pb-4">
        <div className="grid lg:grid-cols-3 gap-6 items-center">
          <div className="lg:col-span-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Turn your imagination into reality ✨
            </h2>
            <p className="mt-2 text-sm opacity-80">
              Generate romantic, anime, realistic or product‑grade images with one prompt. Clean UI, pro controls, mobile‑friendly.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {MODES.map((m) => (
                <ModePill
                  key={m.key}
                  active={mode === m.key}
                  onClick={() => setMode(m.key)}
                  badge={m.badge}
                  label={m.label}
                  desc={m.desc}
                />)
              )}
              <button
                onClick={() => onTemplates(mode)}
                className="px-3 py-1.5 rounded-full border border-white/10 hover:border-white/30 text-xs"
                title="Fill a starter prompt for the selected mode"
              >
                🪄 Use Template
              </button>
              <button
                onClick={onInspire}
                className="px-3 py-1.5 rounded-full border border-white/10 hover:border-white/30 text-xs"
              >
                💡 Inspire Me
              </button>
            </div>
          </div>

          {/* Quick History (last search) */}
          <div className="lg:justify-self-end w-full">
            <HistoryCompact history={history} onPick={(h)=>{
              setPrompt(h.prompt);
              setNegative(h.negative||defaultNegative);
              setMode(h.mode||"romantic");
              setSize(h.size||"1024x1024");
              setSteps(h.steps||25);
              setGuidance(h.guidance||7);
            }} />
          </div>
        </div>
      </section>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 pb-24">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Controls */}
          <div className="lg:col-span-1 space-y-4">
            {/* Prompt */}
            <div className={card()}>
              <label className="text-sm opacity-80">Your Prompt</label>
              <div className="mt-2 relative">
                <textarea
                  className="w-full rounded-xl bg-white/5 border border-white/10 focus:border-pink-400/50 outline-none p-3 min-h-[120px]"
                  placeholder="Describe your dream image…"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
                <div className="absolute right-2 bottom-2 text-xs opacity-60">
                  {prompt.length} chars
                </div>
              </div>
            </div>

            {/* Advanced */}
            <div className={card()}>
              <button
                onClick={() => setAdvancedOpen((v) => !v)}
                className="w-full flex items-center justify-between"
              >
                <span className="text-sm">⚙️ Advanced Settings</span>
                <span className="text-xs opacity-70">{advancedOpen ? "Hide" : "Show"}</span>
              </button>

              {advancedOpen && (
                <div className="mt-3 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Select label="Size" value={size} setValue={setSize} options={SIZES} />
                    <NumberRange label="Steps" value={steps} setValue={setSteps} min={10} max={50} />
                  </div>
                  <NumberRange label="Guidance" value={guidance} setValue={setGuidance} min={1} max={20} />

                  <div>
                    <label className="text-xs opacity-80">Negative Prompt</label>
                    <input
                      className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 focus:border-pink-400/50 outline-none p-2"
                      value={negative}
                      onChange={(e) => setNegative(e.target.value)}
                      placeholder="Unwanted elements (e.g., text, watermark)"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Saved Gallery */}
            <div className={card()}>
              <div className="flex items-center justify-between">
                <span className="text-sm">📁 Saved</span>
                {saved?.length > 0 && (
                  <button
                    className="text-xs opacity-70 hover:opacity-100"
                    onClick={() => setSaved([])}
                  >
                    Clear
                  </button>
                )}
              </div>
              {saved?.length === 0 ? (
                <p className="mt-2 text-xs opacity-60">Nothing saved yet. Generate and hit “Save”.</p>
              ) : (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {saved.map((s, i) => (
                    <button key={s.ts+"-"+i} onClick={()=>setImageUrl(s.url)} className="group relative rounded-lg overflow-hidden">
                      <img src={s.url} alt="saved" className="w-full h-24 object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Preview */}
          <div className="lg:col-span-2 space-y-4">
            <div className={card("p-0 overflow-hidden")}> 
              {/* Toolbar */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                <div className="text-sm opacity-80 flex items-center gap-2">
                  <span className="hidden sm:inline">Preview</span>
                  {imageUrl && <span className="text-xs opacity-60">{size} — {mode}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={onSave} disabled={!imageUrl} className={btn("ghost")}>Save</button>
                  <button onClick={onDownload} disabled={!imageUrl} className={btn("ghost")}>Download</button>
                  <button onClick={onShare} disabled={!imageUrl} className={btn("ghost")}>Share</button>
                </div>
              </div>

              {/* Canvas */}
              <div className="aspect-square sm:aspect-[16/10] w-full relative bg-white/5">
                {loading ? (
                  <LoaderOverlay />
                ) : imageUrl ? (
                  // Image
                  <img
                    src={imageUrl}
                    alt="result"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-sm opacity-60 text-center p-6">
                    Your image will appear here. Add a prompt and hit Create.
                  </div>
                )}
              </div>

              {error && (
                <div className="px-3 py-2 text-xs text-yellow-300/90 bg-yellow-500/10 border-t border-yellow-500/20">
                  {error}
                </div>
              )}
            </div>

            {/* Compare strip */}
            {compareUrls?.length > 0 && (
              <div className={card()}>
                <div className="text-sm opacity-80">Recent Results</div>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {compareUrls.map((u, i) => (
                    <button key={u+"-"+i} onClick={()=>setImageUrl(u)} className="rounded-lg overflow-hidden border border-white/10">
                      <img src={u} alt="recent" className="w-full h-28 object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Sticky mobile Create */}
      <div className="fixed bottom-0 inset-x-0 z-40 sm:hidden">
        <div className="mx-3 mb-3 rounded-2xl shadow-lg overflow-hidden">
          <button
            onClick={onGenerate}
            disabled={loading || !prompt.trim()}
            className={tw(
              "w-full py-4 text-base font-semibold",
              "bg-gradient-to-r from-pink-500 to-rose-500 text-white",
              "disabled:opacity-60 disabled:cursor-not-allowed"
            )}
          >
            {loading ? "Creating…" : "Create with Milan"}
          </button>
        </div>
      </div>

      {/* Desktop CTA */}
      <div className="hidden sm:block border-t border-white/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 flex justify-end">
          <button
            onClick={onGenerate}
            disabled={loading || !prompt.trim()}
            className={btn("primary")}
          >
            {loading ? "Creating…" : "Create with Milan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ———— UI Bits ————
function LoaderOverlay() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
        <div className="text-sm opacity-80">✨ Creating magic…</div>
      </div>
    </div>
  );
}

function ModePill({ active, onClick, badge, label, desc }) {
  return (
    <button
      onClick={onClick}
      className={tw(
        "px-3 py-2 rounded-2xl border text-left",
        active
          ? "border-pink-400/40 bg-pink-500/10"
          : "border-white/10 hover:border-white/30"
      )}
    >
      <div className="text-sm flex items-center gap-2">
        <span className="text-lg leading-none">{badge}</span>
        <span className="font-medium">{label}</span>
      </div>
      <div className="text-[11px] opacity-60 mt-0.5">{desc}</div>
    </button>
  );
}

function Select({ label, value, setValue, options }) {
  return (
    <div>
      <label className="text-xs opacity-80">{label}</label>
      <select
        className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 focus:border-pink-400/50 outline-none p-2"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function NumberRange({ label, value, setValue, min = 0, max = 100 }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs opacity-80">{label}</label>
        <div className="text-xs opacity-70">{value}</div>
      </div>
      <input
        type="range"
        className="w-full accent-pink-500"
        value={value}
        min={min}
        max={max}
        onChange={(e) => setValue(parseInt(e.target.value, 10))}
      />
    </div>
  );
}

function HistoryCompact({ history, onPick }) {
  if (!history?.length) return (
    <div className={card()}>
      <div className="text-sm opacity-80">Recent Prompt</div>
      <div className="mt-2 text-xs opacity-60">Your latest prompt will appear here.</div>
    </div>
  );

  const h = history[0];
  return (
    <div className={card()}>
      <div className="text-sm opacity-80">Recent Prompt</div>
      <button
        onClick={() => onPick(h)}
        className="mt-2 text-xs opacity-80 hover:opacity-100 text-left"
        title="Click to reuse"
      >
        {truncate(h.prompt, 140)}
      </button>
    </div>
  );
}

// ———— Hooks & Utils ————
function useLocalStorageArray(key, initial) {
  const [state, setState] = useState(initial);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setState(JSON.parse(raw));
    } catch {}
  }, [key]);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);
  return [state, setState];
}

function useDarkTheme() {
  const [theme, setTheme] = useState("dark");
  useEffect(() => {
    const saved = localStorage.getItem("milan:theme");
    if (saved === "dark" || saved === "light") setTheme(saved);
  }, []);
  useEffect(() => {
    try { localStorage.setItem("milan:theme", theme); } catch {}
    if (typeof document !== "undefined") {
      if (theme === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    }
  }, [theme]);
  return [theme, setTheme];
}

function demoFallbackUrl() {
  // Public demo fallback (won't block). Replace with your static asset if you like.
  const demos = [
    "https://images.unsplash.com/photo-1542124521-92172c1f1cdb?q=80&w=1200&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1200&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1518837695005-2083093ee35b?q=80&w=1200&auto=format&fit=crop",
  ];
  return demos[Math.floor(Math.random() * demos.length)];
}

function btn(variant) {
  const base =
    "px-4 py-2 rounded-xl border transition disabled:opacity-60 disabled:cursor-not-allowed";
  if (variant === "primary")
    return (
      base +
      " bg-gradient-to-r from-pink-500 to-rose-500 text-white border-pink-400/40 hover:shadow-lg hover:shadow-rose-500/20"
    );
  if (variant === "ghost")
    return base + " border-white/10 hover:border-white/30";
  return base;
}

function card(extra = "") {
  return (
    "rounded-2xl p-3 sm:p-4 border border-white/10 bg-white/5 " + extra
  );
}

function truncate(str, n) {
  if (!str) return "";
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}

function tw(...cls) {
  return cls.filter(Boolean).join(" ");
}
