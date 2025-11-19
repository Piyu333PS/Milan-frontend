import { useEffect, useState } from "react";

/** Milan AI Studio – Modern, Attractive & Stylish UI */

const MODES = [
  { key: "romantic", label: "Romantic", desc: "Warm tones, depth, soft bokeh.", icon: "💖",
    preset: "romantic cinematic portrait, warm tones, soft bokeh, masterpiece, ultra detail, volumetric light",
    gradient: "from-pink-500 to-rose-500" },
  { key: "realistic", label: "Realistic", desc: "Photographic, true-to-life.", icon: "📸",
    preset: "highly detailed, photorealistic, 35mm, natural lighting, film grain, masterpiece",
    gradient: "from-blue-500 to-cyan-500" },
  { key: "anime", label: "Anime", desc: "Ghibli / anime vibe.", icon: "🌸",
    preset: "ghibli style, vibrant colors, crisp line art, anime style, dynamic composition, cinematic",
    gradient: "from-purple-500 to-pink-500" },
  { key: "product", label: "Product", desc: "Studio, e-commerce.", icon: "🛍️",
    preset: "studio product photo, soft light, seamless background, crisp shadows, highly detailed",
    gradient: "from-amber-500 to-orange-500" },
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

  const [history, setHistory] = useState([]);
  const [saved, setSaved] = useState([]);

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

  const currentMode = MODES.find(m => m.key === mode);

  return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" : "bg-gradient-to-br from-slate-50 via-white to-slate-50"} transition-colors duration-300`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 backdrop-blur-xl ${theme === "dark" ? "bg-slate-950/80 border-slate-800" : "bg-white/80 border-slate-200"} border-b transition-colors`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">💘</div>
              <h1 className={`text-xl sm:text-2xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent`}>
                Milan AI Studio
              </h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button 
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")} 
                className={`px-3 sm:px-4 py-2 rounded-xl ${theme === "dark" ? "bg-slate-800 hover:bg-slate-700" : "bg-slate-100 hover:bg-slate-200"} transition-all duration-200 text-sm font-medium`}
              >
                {theme === "dark" ? "🌙" : "☀️"}
              </button>
              <a 
                href="/connect" 
                className={`hidden sm:flex px-4 py-2 rounded-xl ${theme === "dark" ? "bg-slate-800 hover:bg-slate-700" : "bg-slate-100 hover:bg-slate-200"} transition-all duration-200 text-sm font-medium`}
              >
                ← Dashboard
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className={`text-3xl sm:text-5xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
            Turn imagination into <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent">reality</span> ✨
          </h2>
          <p className={`text-base sm:text-lg ${theme === "dark" ? "text-slate-400" : "text-slate-600"} max-w-2xl mx-auto`}>
            Generate stunning images with AI. Choose your style, describe your vision, and watch magic happen.
          </p>
        </div>

        {/* Mode Selection - Modern Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`group relative p-4 sm:p-6 rounded-2xl transition-all duration-300 transform hover:scale-105 ${
                mode === m.key
                  ? `bg-gradient-to-br ${m.gradient} shadow-2xl`
                  : theme === "dark" 
                    ? "bg-slate-800/50 hover:bg-slate-800 border border-slate-700" 
                    : "bg-white hover:bg-slate-50 border border-slate-200 shadow-sm"
              }`}
            >
              <div className={`text-3xl sm:text-4xl mb-2 sm:mb-3 ${mode === m.key ? "animate-bounce" : ""}`}>{m.icon}</div>
              <h3 className={`font-bold text-sm sm:text-base mb-1 ${mode === m.key ? "text-white" : theme === "dark" ? "text-white" : "text-slate-900"}`}>
                {m.label}
              </h3>
              <p className={`text-xs ${mode === m.key ? "text-white/90" : theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                {m.desc}
              </p>
              {mode === m.key && (
                <div className="absolute inset-0 rounded-2xl bg-white/20 animate-pulse" />
              )}
            </button>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3 justify-center mb-8">
          <button 
            onClick={() => setTemplatesOpen(true)}
            className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium transition-all duration-200 ${
              theme === "dark" 
                ? "bg-slate-800 hover:bg-slate-700 text-white" 
                : "bg-white hover:bg-slate-50 text-slate-900 shadow-sm border border-slate-200"
            }`}
          >
            🧰 Templates
          </button>
          <button 
            onClick={onInspire}
            className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium transition-all duration-200 ${
              theme === "dark" 
                ? "bg-slate-800 hover:bg-slate-700 text-white" 
                : "bg-white hover:bg-slate-50 text-slate-900 shadow-sm border border-slate-200"
            }`}
          >
            💡 Inspire Me
          </button>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Left Column - Controls */}
          <div className="lg:col-span-1 space-y-6">
            {/* Prompt Card */}
            <div className={`rounded-2xl p-6 ${theme === "dark" ? "bg-slate-800/50 border border-slate-700" : "bg-white border border-slate-200 shadow-lg"}`}>
              <label className={`block text-sm font-semibold mb-3 ${theme === "dark" ? "text-slate-200" : "text-slate-900"}`}>
                Your Prompt
              </label>
              <div className="relative">
                <textarea
                  className={`w-full rounded-xl p-4 min-h-[160px] resize-none ${
                    theme === "dark" 
                      ? "bg-slate-900 border-slate-600 text-white placeholder-slate-500" 
                      : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400"
                  } border-2 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none transition-all`}
                  placeholder="Describe your dream image..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
                <div className={`absolute bottom-3 right-3 text-xs px-2 py-1 rounded-lg ${
                  theme === "dark" ? "bg-slate-800 text-slate-400" : "bg-white text-slate-500"
                }`}>
                  {prompt.length} chars
                </div>
              </div>

              <button
                onClick={onGenerate}
                disabled={loading || !prompt.trim()}
                className={`w-full mt-4 py-4 rounded-xl font-bold text-white transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                  loading 
                    ? "bg-gradient-to-r from-pink-400 to-rose-400" 
                    : "bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-lg shadow-pink-500/30"
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating Magic...
                  </span>
                ) : (
                  "✨ Create with Milan"
                )}
              </button>
            </div>

            {/* Advanced Settings */}
            <div className={`rounded-2xl overflow-hidden ${theme === "dark" ? "bg-slate-800/50 border border-slate-700" : "bg-white border border-slate-200 shadow-lg"}`}>
              <button 
                onClick={() => setAdvancedOpen(!advancedOpen)}
                className={`w-full p-4 flex items-center justify-between ${theme === "dark" ? "hover:bg-slate-700/50" : "hover:bg-slate-50"} transition-colors`}
              >
                <span className={`font-semibold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>⚙️ Advanced Settings</span>
                <span className={`text-sm ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                  {advancedOpen ? "Hide" : "Show"}
                </span>
              </button>

              {advancedOpen && (
                <div className="p-6 space-y-6 border-t border-slate-700">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>Size</label>
                      <select 
                        value={size} 
                        onChange={(e) => setSize(e.target.value)}
                        className={`w-full rounded-lg p-2.5 ${
                          theme === "dark" 
                            ? "bg-slate-900 border-slate-600 text-white" 
                            : "bg-slate-50 border-slate-300 text-slate-900"
                        } border-2 focus:border-pink-500 outline-none`}
                      >
                        {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                        Steps <span className="text-pink-500">{steps}</span>
                      </label>
                      <input 
                        type="range" 
                        min={10} 
                        max={50} 
                        value={steps} 
                        onChange={(e) => setSteps(parseInt(e.target.value, 10))}
                        className="w-full accent-pink-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                      Guidance <span className="text-pink-500">{guidance}</span>
                    </label>
                    <input 
                      type="range" 
                      min={1} 
                      max={20} 
                      value={guidance} 
                      onChange={(e) => setGuidance(parseInt(e.target.value, 10))}
                      className="w-full accent-pink-500"
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>Negative Prompt</label>
                    <input 
                      type="text"
                      value={negative} 
                      onChange={(e) => setNegative(e.target.value)}
                      placeholder="Unwanted elements..."
                      className={`w-full rounded-lg p-2.5 ${
                        theme === "dark" 
                          ? "bg-slate-900 border-slate-600 text-white placeholder-slate-500" 
                          : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400"
                      } border-2 focus:border-pink-500 outline-none`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Saved Images */}
            <div className={`rounded-2xl p-6 ${theme === "dark" ? "bg-slate-800/50 border border-slate-700" : "bg-white border border-slate-200 shadow-lg"}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-semibold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>📁 Saved</h3>
                {saved.length > 0 && (
                  <button 
                    onClick={() => setSaved([])}
                    className="text-xs text-pink-500 hover:text-pink-600"
                  >
                    Clear
                  </button>
                )}
              </div>
              {saved.length === 0 ? (
                <p className={`text-sm ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                  Nothing saved yet. Generate and hit "Save".
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {saved.map((s, i) => (
                    <button 
                      key={s.ts + "-" + i} 
                      onClick={() => setImageUrl(s.url)}
                      className="aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-pink-500 transition-all"
                    >
                      <img src={s.url} alt="saved" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Preview */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Preview */}
            <div className={`rounded-2xl overflow-hidden ${theme === "dark" ? "bg-slate-800/50 border border-slate-700" : "bg-white border border-slate-200 shadow-lg"}`}>
              <div className={`p-4 flex items-center justify-between border-b ${theme === "dark" ? "border-slate-700" : "border-slate-200"}`}>
                <div className={`text-sm ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                  {imageUrl ? `${size} • ${mode}` : "Preview"}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={onSave} 
                    disabled={!imageUrl}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      imageUrl 
                        ? theme === "dark" 
                          ? "bg-slate-700 hover:bg-slate-600 text-white" 
                          : "bg-slate-100 hover:bg-slate-200 text-slate-900"
                        : "opacity-50 cursor-not-allowed"
                    }`}
                  >
                    💾 Save
                  </button>
                  <button 
                    onClick={onDownload} 
                    disabled={!imageUrl}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      imageUrl 
                        ? theme === "dark" 
                          ? "bg-slate-700 hover:bg-slate-600 text-white" 
                          : "bg-slate-100 hover:bg-slate-200 text-slate-900"
                        : "opacity-50 cursor-not-allowed"
                    }`}
                  >
                    ⬇️ Download
                  </button>
                  <button 
                    onClick={onShare} 
                    disabled={!imageUrl}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      imageUrl 
                        ? theme === "dark" 
                          ? "bg-slate-700 hover:bg-slate-600 text-white" 
                          : "bg-slate-100 hover:bg-slate-200 text-slate-900"
                        : "opacity-50 cursor-not-allowed"
                    }`}
                  >
                    📤 Share
                  </button>
                </div>
              </div>

              <div className={`relative aspect-[4/3] flex items-center justify-center ${theme === "dark" ? "bg-slate-900" : "bg-slate-100"}`}>
                {loading ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-slate-700 rounded-full" />
                      <div className="absolute inset-0 w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <p className={`text-sm ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                      ✨ Creating magic...
                    </p>
                  </div>
                ) : imageUrl ? (
                  <img 
                    src={imageUrl} 
                    alt="Generated" 
                    className="max-w-full max-h-full object-contain rounded-lg animate-fadeIn"
                  />
                ) : (
                  <div className="text-center p-8">
                    <div className="text-6xl mb-4">🎨</div>
                    <p className={`${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                      Your masterpiece will appear here
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <div className="m-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>

            {/* Recent Results */}
            {compareUrls.length > 0 && (
              <div className={`rounded-2xl p-6 ${theme === "dark" ? "bg-slate-800/50 border border-slate-700" : "bg-white border border-slate-200 shadow-lg"}`}>
                <h3 className={`font-semibold mb-4 ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                  🎭 Recent Results
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {compareUrls.map((u, i) => (
                    <button 
                      key={u + "-" + i} 
                      onClick={() => setImageUrl(u)}
                      className="aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-pink-500 transition-all transform hover:scale-105"
                    >
                      <img src={u} alt="recent" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Templates Modal */}
      {templatesOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setTemplatesOpen(false)}
          />
          <div className={`relative w-full sm:max-w-2xl sm:rounded-2xl overflow-hidden ${
            theme === "dark" ? "bg-slate-900" : "bg-white"
          } animate-slideUp sm:animate-fadeIn max-h-[80vh] sm:max-h-[90vh] flex flex-col`}>
            <div className={`p-6 border-b ${theme === "dark" ? "border-slate-700" : "border-slate-200"} flex items-center justify-between`}>
              <h3 className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                Templates • {currentMode?.label}
              </h3>
              <button 
                onClick={() => setTemplatesOpen(false)}
                className={`px-4 py-2 rounded-lg ${theme === "dark" ? "bg-slate-800 hover:bg-slate-700" : "bg-slate-100 hover:bg-slate-200"} transition-colors`}
              >
                Close
              </button>
            </div>
            <div className="p-6 space-y-3 overflow-y-auto">
              {(TEMPLATES[mode] || []).map((t, i) => (
                <button 
                  key={i}
                  onClick={() => { setPrompt(t); setTemplatesOpen(false); }}
                  className={`w-full p-4 rounded-xl text-left transition-all transform hover:scale-[1.02] ${
                    theme === "dark" 
                      ? "bg-slate-800 hover:bg-slate-700 text-white" 
                      : "bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{currentMode?.icon}</span>
                    <span className="flex-1 text-sm leading-relaxed">{t}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

/* Hooks & utils */
function useDarkTheme() {
  const [theme, setTheme] = useState("dark");
  return [theme, setTheme];
}
function truncate(str, n) { 
  if (!str) return ""; 
  return str.length > n ? str.slice(0, n - 1) + "…" : str; 
}
