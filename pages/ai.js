// pages/ai.js
import React, { useEffect, useRef, useState } from "react";

/**
 * Milan AI Studio – Professional Modern UI
 * Fully responsive, glassmorphism design, no blank spaces
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("generate");
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
        let body;
        try {
          body = await res.json();
        } catch (e) {
          const txt = await res.text().catch(() => "");
          setError(`Generation failed: ${res.status} ${txt.slice(0,200)}`);
          setIsLoading(false);
          return;
        }
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

  const styles = [
    { id: "romantic", name: "Romantic", icon: "💕", gradient: "linear-gradient(135deg, #ff7ab6, #ff5694)" },
    { id: "realistic", name: "Realistic", icon: "📷", gradient: "linear-gradient(135deg, #3b82f6, #06b6d4)" },
    { id: "anime", name: "Anime", icon: "🎨", gradient: "linear-gradient(135deg, #a855f7, #ec4899)" },
    { id: "product", name: "Product", icon: "📦", gradient: "linear-gradient(135deg, #f97316, #facc15)" },
    { id: "artistic", name: "Artistic", icon: "🎭", gradient: "linear-gradient(135deg, #6366f1, #a855f7)" },
    { id: "fantasy", name: "Fantasy", icon: "✨", gradient: "linear-gradient(135deg, #8b5cf6, #d946ef)" }
  ];

  const sizes = ["512x512", "768x768", "1024x1024", "1536x1536"];

  return (
    <div className="milan-root">
      {/* Header */}
      <header className="milan-header">
        <div className="header-content">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="menu-toggle"
          >
            {sidebarOpen ? "✕" : "☰"}
          </button>
          <div className="brand">
            <div className="logo">💘</div>
            <div className="brand-text">
              <div className="title">Milan AI Studio</div>
              <div className="subtitle">Professional Image Generation</div>
            </div>
          </div>
          
          <div className="header-actions">
            <button className="header-btn">History</button>
            <a className="dashboard-btn" href="/dashboard">Dashboard</a>
          </div>
        </div>
      </header>

      <div className="main-container">
        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-content">
            {/* Tabs */}
            <div className="tabs">
              <button
                onClick={() => setActiveTab('generate')}
                className={`tab ${activeTab === 'generate' ? 'active' : ''}`}
              >
                ✨ Generate
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
              >
                ⚙️ Settings
              </button>
            </div>

            {activeTab === 'generate' ? (
              <>
                {/* Prompt Section */}
                <div className="card">
                  <div className="card-header">
                    <span className="card-icon">💭</span>
                    <span className="card-title">Describe Your Vision</span>
                  </div>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="A cute couple at candlelit dinner, cinematic lighting, anime-detailed, romantic glow..."
                    className="prompt-textarea"
                  />
                  <div className="prompt-footer">
                    <button onClick={boostPrompt} className="small-btn">✨ Boost</button>
                    <button onClick={clearPrompt} className="small-btn">🗑️ Clear</button>
                    <span className="char-count">{prompt.length} chars</span>
                  </div>
                </div>

                {/* Style Selection */}
                <div className="card">
                  <div className="card-header">
                    <span className="card-icon">🎨</span>
                    <span className="card-title">Style</span>
                  </div>
                  <div className="style-grid">
                    {styles.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setMode(style.id)}
                        className={`style-card ${mode === style.id ? 'active' : ''}`}
                        style={{ background: mode === style.id ? style.gradient : '' }}
                      >
                        <div className="style-icon">{style.icon}</div>
                        <div className="style-name">{style.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Settings */}
                <div className="card">
                  <div className="card-header">
                    <span className="card-icon">⚡</span>
                    <span className="card-title">Quick Settings</span>
                  </div>
                  <div className="settings-row">
                    <div className="setting-item">
                      <label>Size</label>
                      <select value={size} onChange={(e) => setSize(e.target.value)} className="select-input">
                        {sizes.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div className="setting-item">
                      <label>Variations</label>
                      <input
                        type="number"
                        min="1"
                        max="4"
                        value={variations}
                        onChange={(e) => setVariations(Math.max(1, Math.min(4, Number(e.target.value))))}
                        className="number-input"
                      />
                    </div>
                  </div>
                </div>

                {/* Advanced Toggle */}
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="advanced-toggle"
                >
                  <span>⚙️ Advanced Options</span>
                  <span className={`arrow ${showAdvanced ? 'up' : ''}`}>▼</span>
                </button>

                {showAdvanced && (
                  <div className="card">
                    <div className="slider-group">
                      <label>Quality</label>
                      <input type="range" min="1" max="100" defaultValue="80" className="slider" />
                    </div>
                    <div className="slider-group">
                      <label>Creative Freedom</label>
                      <input type="range" min="0" max="100" defaultValue="50" className="slider" />
                    </div>
                  </div>
                )}

                {/* Generate Button */}
                <button onClick={generateImage} className="generate-btn" disabled={isLoading}>
                  {isLoading ? <HeartPulse /> : "✨ Generate Image"}
                </button>

                {/* Tips */}
                <div className="tips-card">
                  <div className="tips-header">💡 Pro Tips</div>
                  <ul className="tips-list">
                    <li>Use 3-12 style tags for best results</li>
                    <li>Try Boost for cinematic feel</li>
                    <li>Different sizes = different compositions</li>
                  </ul>
                </div>
              </>
            ) : (
              <div className="settings-content">
                <div className="card">
                  <div className="card-title">Actions</div>
                  <button onClick={downloadImage} className="action-btn" disabled={!imageUrl}>
                    💾 Download Image
                  </button>
                  <button 
                    onClick={() => { navigator.clipboard?.writeText(prompt); alert("Prompt copied"); }} 
                    className="action-btn"
                  >
                    📋 Copy Prompt
                  </button>
                  <button 
                    onClick={() => alert("Set as profile pic (demo).")} 
                    className="action-btn" 
                    disabled={!imageUrl}
                  >
                    👤 Use as Profile Pic
                  </button>
                </div>

                <div className="card">
                  <div className="card-title">Recent Prompts</div>
                  <div className="recent-list">
                    {recent.length ? recent.map((r, i) => (
                      <button key={i} onClick={() => setPrompt(r)} className="recent-item">
                        {r.length > 50 ? r.slice(0,50)+"..." : r}
                      </button>
                    )) : <div className="empty-state">No recent prompts yet</div>}
                  </div>
                </div>

                <div className="card">
                  <div className="card-title">Status</div>
                  <div className="status-info">
                    {error ? (
                      <div className="status-error">{error}</div>
                    ) : (
                      <div className="status-ready">✓ Ready to generate</div>
                    )}
                    <div className="credits-info">Credits: <strong>1 free/day</strong></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          <div className="preview-section">
            {/* Preview Card */}
            <div className="preview-card">
              <div className="preview-header">
                <div>
                  <div className="preview-title">Preview</div>
                  <div className="preview-subtitle">Download or share your creation</div>
                </div>
                <div className="mode-badge">Mode: {mode}</div>
              </div>

              <div className="preview-frame">
                {!imageUrl && !isLoading && (
                  <div className="placeholder">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21,19V5C21,3.9 20.1,3 19,3H5C3.9,3 3,3.9 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19M8.5,13.5C9.3,13.5 10,12.8 10,12C10,11.2 9.3,10.5 8.5,10.5C7.7,10.5 7,11.2 7,12C7,12.8 7.7,13.5 8.5,13.5M21,19L17,14L13,18L10,14L3,21"/>
                    </svg>
                    <div className="placeholder-text">Your masterpiece will appear here</div>
                    <div className="placeholder-hint">Add a prompt and tap Generate</div>
                  </div>
                )}

                {isLoading && (
                  <div className="loading-state">
                    <HeartPulse big />
                    <div className="loading-text">Creating your image...</div>
                  </div>
                )}

                {imageUrl && (
                  <img ref={imgRef} src={imageUrl} alt="Generated" className="generated-image" />
                )}

                {imageUrl && (
                  <div className="image-actions">
                    <button onClick={downloadImage} className="action-icon-btn" title="Download">
                      💾
                    </button>
                    <button onClick={() => { navigator.clipboard?.writeText(prompt); alert("Prompt copied"); }} className="action-icon-btn" title="Copy">
                      📋
                    </button>
                  </div>
                )}
              </div>

              {/* Image Info */}
              {imageUrl && (
                <div className="info-grid">
                  <div className="info-item">
                    <div className="info-label">Style</div>
                    <div className="info-value">{mode}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Size</div>
                    <div className="info-value">{size}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Variations</div>
                    <div className="info-value">{variations}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Status</div>
                    <div className="info-value status-success">✓ Complete</div>
                  </div>
                </div>
              )}
            </div>

            {/* Gallery */}
            <div className="gallery-card">
              <div className="gallery-header">
                <span>📸 Recent Generations</span>
              </div>
              <div className="gallery-grid">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="gallery-item">
                    <div className="gallery-placeholder">
                      📷
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(false)}></div>}

      <style jsx>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        .milan-root {
          min-height: 100vh;
          background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
          color: #e2e8f0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }

        /* Header */
        .milan-header {
          background: rgba(15, 23, 42, 0.8);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .header-content {
          max-width: 1600px;
          margin: 0 auto;
          padding: 1rem 1.5rem;
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .menu-toggle {
          display: none;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          font-size: 1.25rem;
          cursor: pointer;
        }

        @media (max-width: 1024px) {
          .menu-toggle { display: block; }
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .logo {
          width: 3rem;
          height: 3rem;
          background: linear-gradient(135deg, #ff7ab6, #8b5cf6);
          border-radius: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          box-shadow: 0 4px 20px rgba(255, 122, 182, 0.3);
        }

        .brand-text .title {
          font-size: 1.25rem;
          font-weight: 700;
          background: linear-gradient(90deg, #ff7ab6, #8b5cf6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .brand-text .subtitle {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.6);
        }

        .header-actions {
          margin-left: auto;
          display: flex;
          gap: 0.75rem;
        }

        .header-btn {
          padding: 0.5rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          color: white;
          cursor: pointer;
          transition: all 0.2s;
        }

        .header-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .dashboard-btn {
          padding: 0.5rem 1.25rem;
          background: linear-gradient(90deg, #ff7ab6, #8b5cf6);
          border: none;
          border-radius: 0.5rem;
          color: white;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s;
        }

        .dashboard-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(255, 122, 182, 0.4);
        }

        @media (max-width: 768px) {
          .header-actions { display: none; }
        }

        /* Main Container */
        .main-container {
          display: flex;
          height: calc(100vh - 73px);
          max-width: 1600px;
          margin: 0 auto;
        }

        /* Sidebar */
        .sidebar {
          width: 380px;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(20px);
          border-right: 1px solid rgba(255, 255, 255, 0.1);
          overflow-y: auto;
          transition: transform 0.3s;
        }

        @media (max-width: 1024px) {
          .sidebar {
            position: fixed;
            left: 0;
            top: 73px;
            height: calc(100vh - 73px);
            z-index: 50;
            transform: translateX(-100%);
          }
          .sidebar.open {
            transform: translateX(0);
          }
        }

        .sidebar-content {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        /* Tabs */
        .tabs {
          display: flex;
          gap: 0.5rem;
          background: rgba(255, 255, 255, 0.03);
          padding: 0.25rem;
          border-radius: 0.75rem;
        }

        .tab {
          flex: 1;
          padding: 0.75rem;
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
        }

        .tab.active {
          background: linear-gradient(90deg, #ff7ab6, #8b5cf6);
          color: white;
        }

        /* Card */
        .card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 1rem;
          padding: 1rem;
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        .card-icon {
          font-size: 1.25rem;
        }

        .card-title {
          font-weight: 600;
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.9);
        }

        /* Prompt */
        .prompt-textarea {
          width: 100%;
          min-height: 120px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.75rem;
          padding: 0.75rem;
          color: white;
          font-size: 0.875rem;
          resize: vertical;
        }

        .prompt-textarea:focus {
          outline: none;
          border-color: #ff7ab6;
        }

        .prompt-textarea::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }

        .prompt-footer {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.75rem;
          align-items: center;
        }

        .small-btn {
          padding: 0.5rem 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          color: white;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .small-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .char-count {
          margin-left: auto;
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.5);
        }

        /* Style Grid */
        .style-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
        }

        .style-card {
          padding: 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }

        .style-card:hover {
          transform: translateY(-2px);
        }

        .style-card.active {
          border-color: transparent;
          box-shadow: 0 8px 25px rgba(255, 122, 182, 0.3);
        }

        .style-icon {
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
        }

        .style-name {
          font-size: 0.75rem;
          font-weight: 500;
        }

        /* Settings */
        .settings-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .setting-item label {
          display: block;
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 0.5rem;
        }

        .select-input, .number-input {
          width: 100%;
          padding: 0.5rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          color: white;
        }

        .select-input:focus, .number-input:focus {
          outline: none;
          border-color: #ff7ab6;
        }

        /* Advanced Toggle */
        .advanced-toggle {
          width: 100%;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 0.75rem;
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .advanced-toggle:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .arrow {
          transition: transform 0.3s;
        }

        .arrow.up {
          transform: rotate(180deg);
        }

        /* Sliders */
        .slider-group {
          margin-bottom: 1rem;
        }

        .slider-group label {
          display: block;
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 0.5rem;
        }

        .slider {
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.1);
          outline: none;
          -webkit-appearance: none;
        }

        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: linear-gradient(90deg, #ff7ab6, #8b5cf6);
          cursor: pointer;
        }

        /* Generate Button */
        .generate-btn {
          width: 100%;
          padding: 1rem;
          background: linear-gradient(90deg, #ff7ab6, #8b5cf6);
          border: none;
          border-radius: 0.75rem;
          color: white;
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.3s;
        }

        .generate-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 30px rgba(255, 122, 182, 0.4);
        }

        .generate-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Tips */
        .tips-card {
          background: rgba(255, 122, 182, 0.1);
          border: 1px solid rgba(255, 122, 182, 0.2);
          border-radius: 1rem;
          padding: 1rem;
        }

        .tips-header {
          font-size: 0.875rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .tips-list {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.8);
          padding-left: 1.25rem;
        }

        .tips-list li {
          margin-bottom: 0.25rem;
        }

        /* Settings Content */
        .settings-content {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .action-btn {
          width: 100%;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          color: white;
          font-size: 0.875rem;
          cursor: pointer;
          margin-bottom: 0.5rem;
          transition: all 0.2s;
        }

        .action-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
        }

        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .recent-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .recent-item {
          padding: 0.5rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 0.5rem;
          color: rgba(255, 255, 255, 0.8);
          font-size: 0.75rem;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s;
        }

        .recent-item:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .empty-state {
          padding: 1rem;
          text-align: center;
          color: rgba(255, 255, 255, 0.5);
          font-size: 0.875rem;
        }

        .status-info {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .status-ready {
          color: #7ef3c5;
          font-weight: 500;
        }

        .status-error {
          color: #ff8aa2;
          font-size: 0.875rem;
        }

        .credits-info {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.6);
        }

        /* Main Content */
        .main-content {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
        }

        @media (max-width: 1024px) {
          .main-content {
            padding: 1rem;
          }
        }

        .preview-section {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        /* Preview Card */
        .preview-card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 1.5rem;
          padding: 1.5rem;
        }

        .preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .preview-title {
          font-size: 1.25rem;
          font-weight: 700;
        }

        .preview-subtitle {
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.6);
        }

        .mode-badge {
          padding: 0.5rem 1rem;
          background: rgba(255, 122, 182, 0.1);
          border: 1px solid rgba(255, 122, 182, 0.2);
          border-radius: 0.5rem;
          font-size: 0.875rem;
          color: #ff7ab6;
          font-weight: 600;
        }

        @media (max-width: 768px) {
          .preview-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.75rem;
          }
        }

        /* Preview Frame */
        .preview-frame {
          position: relative;
          min-height: 500px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          color: rgba(255, 255, 255, 0.4);
        }

        .placeholder-text {
          font-size: 1rem;
          font-weight: 500;
        }

        .placeholder-hint {
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.3);
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .loading-text {
          color: rgba(255, 255, 255, 0.7);
        }

        .generated-image {
          max-width: 100%;
          max-height: 100%;
          border-radius: 0.75rem;
          opacity: 0;
          transform: scale(0.95);
          transition: all 0.5s cubic-bezier(0.2, 0.9, 0.3, 1);
        }

        .generated-image.reveal {
          opacity: 1;
          transform: scale(1);
        }

        .image-actions {
          position: absolute;
          top: 1rem;
          right: 1rem;
          display: flex;
          gap: 0.5rem;
        }

        .action-icon-btn {
          width: 2.5rem;
          height: 2.5rem;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          color: white;
          font-size: 1.125rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-icon-btn:hover {
          background: rgba(0, 0, 0, 0.9);
          transform: translateY(-2px);
        }

        /* Info Grid */
        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
          margin-top: 1.5rem;
        }

        .info-item {
          background: rgba(255, 255, 255, 0.03);
          padding: 1rem;
          border-radius: 0.75rem;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .info-label {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 0.25rem;
        }

        .info-value {
          font-weight: 600;
          text-transform: capitalize;
        }

        .status-success {
          color: #7ef3c5;
        }

        /* Gallery */
        .gallery-card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 1.5rem;
          padding: 1.5rem;
        }

        .gallery-header {
          font-size: 1.125rem;
          font-weight: 700;
          margin-bottom: 1rem;
        }

        .gallery-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 1rem;
        }

        @media (max-width: 768px) {
          .gallery-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 480px) {
          .gallery-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        .gallery-item {
          aspect-ratio: 1;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 0.75rem;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.2s;
        }

        .gallery-item:hover {
          transform: translateY(-4px);
          border-color: rgba(255, 122, 182, 0.3);
        }

        .gallery-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          background: linear-gradient(135deg, rgba(255, 122, 182, 0.1), rgba(139, 92, 246, 0.1));
          color: rgba(255, 255, 255, 0.3);
        }

        /* Overlay */
        .overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          z-index: 40;
        }

        @media (max-width: 1024px) {
          .overlay {
            display: block;
          }
        }

        /* Animations */
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.08);
            opacity: 0.9;
          }
        }

        /* Scrollbar */
        .sidebar::-webkit-scrollbar,
        .main-content::-webkit-scrollbar {
          width: 8px;
        }

        .sidebar::-webkit-scrollbar-track,
        .main-content::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.03);
        }

        .sidebar::-webkit-scrollbar-thumb,
        .main-content::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }

        .sidebar::-webkit-scrollbar-thumb:hover,
        .main-content::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}

/* HeartPulse component */
function HeartPulse({ big = false }) {
  const size = big ? 72 : 20;
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
      <svg 
        style={{animation:'pulse 1s ease-in-out infinite'}} 
        width={size} 
        height={size} 
        viewBox="0 0 24 24"
      >
        <defs>
          <linearGradient id="gA" x1="0" x2="1">
            <stop offset="0%" stopColor="#ff7ab6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <path 
          fill="url(#gA)" 
          d="M12 21s-7-4.35-9-7.35C0.5 10.5 3 6 7 6c2 0 3 1.2 5 3.2C13 7.2 14 6 16 6c4 0 6.5 4.5 4 7.65C19 16.65 12 21 12 21z" 
        />
      </svg>
      {big && <div style={{color:'rgba(255,255,255,0.7)'}}>Creating...</div>}
    </div>
  );
}
