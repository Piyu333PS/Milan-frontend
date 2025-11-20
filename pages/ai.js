// pages/ai.js
import React, { useEffect, useRef, useState } from "react";

export default function AIPage() {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState("romantic");
  const [size, setSize] = useState("1024x1024");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState([]);
  const [variations, setVariations] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem("milan_recent") || "[]");
      setRecent(r || []);
    } catch (e) {}
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [prompt]);

  function saveRecent(p) {
    try {
      const arr = [p, ...(JSON.parse(localStorage.getItem("milan_recent") || "[]") || [])].filter(
        (v, i, a) => a.indexOf(v) === i
      );
      localStorage.setItem("milan_recent", JSON.stringify(arr.slice(0, 30)));
      setRecent(arr.slice(0, 10));
    } catch (e) {}
  }

  async function generateImage() {
    if (!prompt.trim()) return;
    
    const userMessage = {
      type: 'user',
      text: prompt,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setError("");
    setIsLoading(true);
    const currentPrompt = prompt;
    setPrompt("");
    
    try {
      saveRecent(currentPrompt);

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: currentPrompt, mode, size, n: variations }),
      });

      if (!res.ok) {
        let body;
        try {
          body = await res.json();
        } catch (e) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Generation failed: ${res.status} ${txt.slice(0,200)}`);
        }
        throw new Error(body?.openai_body?.error?.message || body?.error?.message || JSON.stringify(body).slice(0,300));
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      
      const aiMessage = {
        type: 'ai',
        imageUrl: url,
        prompt: currentPrompt,
        mode,
        size,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      setError(String(err?.message || err));
      const errorMessage = {
        type: 'error',
        text: String(err?.message || err),
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }

  function downloadImage(url, prompt) {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `milan-${mode}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      generateImage();
    }
  };

  const styles = [
    { id: "romantic", name: "Romantic", icon: "💕", color: "#ff7ab6" },
    { id: "realistic", name: "Realistic", icon: "📷", color: "#3b82f6" },
    { id: "anime", name: "Anime", icon: "🎨", color: "#a855f7" },
    { id: "product", name: "Product", icon: "📦", color: "#f97316" },
    { id: "artistic", name: "Artistic", icon: "🎭", color: "#6366f1" },
    { id: "fantasy", name: "Fantasy", icon: "✨", color: "#8b5cf6" }
  ];

  const sizes = ["512x512", "768x768", "1024x1024", "1536x1536"];

  const examplePrompts = [
    "A romantic couple at sunset beach, cinematic lighting",
    "Anime-style portrait with dreamy colors, soft focus",
    "Modern minimalist product photography, studio lighting",
    "Fantasy landscape with magical atmosphere, HD quality"
  ];

  return (
    <div className="milan-root">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-section">
            <div className="logo">💘</div>
            <div>
              <div className="logo-text">Milan AI</div>
              <div className="logo-subtitle">Image Studio</div>
            </div>
          </div>
          <button className="close-sidebar" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>

        <div className="sidebar-content">
          <button className="new-chat-btn" onClick={() => setMessages([])}>
            <span className="icon">+</span>
            <span>New Generation</span>
          </button>

          <div className="history-section">
            <div className="history-title">Recent</div>
            {messages.filter(m => m.type === 'ai').slice(-5).reverse().map((msg, i) => (
              <div key={i} className="history-item">
                <div className="history-icon">🖼️</div>
                <div className="history-text">{msg.prompt?.slice(0, 40)}...</div>
              </div>
            ))}
            {messages.filter(m => m.type === 'ai').length === 0 && (
              <div className="empty-history">No generations yet</div>
            )}
          </div>

          <div className="settings-section">
            <button className="settings-item" onClick={() => setShowSettings(!showSettings)}>
              <span>⚙️</span>
              <span>Settings</span>
            </button>
            <a href="/dashboard" className="settings-item">
              <span>🏠</span>
              <span>Dashboard</span>
            </a>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="main-area">
        <header className="top-header">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="header-title">
            <span className="model-name">Milan AI Studio</span>
            <span className="model-badge">{mode}</span>
          </div>
          <button className="settings-toggle" onClick={() => setShowSettings(!showSettings)}>⚙️</button>
        </header>

        <div className="chat-container">
          {messages.length === 0 ? (
            <div className="welcome-screen">
              <div className="welcome-logo">💘</div>
              <h1 className="welcome-title">Milan AI Studio</h1>
              <p className="welcome-subtitle">Create stunning AI-generated images with simple prompts</p>
              
              <div className="example-prompts">
                {examplePrompts.map((example, i) => (
                  <button key={i} className="example-card" onClick={() => setPrompt(example)}>
                    <span className="example-icon">💡</span>
                    <span className="example-text">{example}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages-area">
              {messages.map((msg, i) => (
                <div key={i} className={`message ${msg.type}`}>
                  {msg.type === 'user' && (
                    <div className="user-message">
                      <div className="message-avatar user-avatar">👤</div>
                      <div className="message-content">
                        <div className="message-text">{msg.text}</div>
                      </div>
                    </div>
                  )}
                  
                  {msg.type === 'ai' && (
                    <div className="ai-message">
                      <div className="message-avatar ai-avatar">💘</div>
                      <div className="message-content">
                        <div className="image-wrapper">
                          <img src={msg.imageUrl} alt="Generated" className="generated-image" />
                          <div className="image-overlay">
                            <button className="overlay-btn" onClick={() => downloadImage(msg.imageUrl, msg.prompt)}>
                              💾 Download
                            </button>
                            <button className="overlay-btn" onClick={() => setPrompt(msg.prompt)}>
                              🔄 Regenerate
                            </button>
                          </div>
                        </div>
                        <div className="image-info">
                          <span className="info-badge">{msg.mode}</span>
                          <span className="info-badge">{msg.size}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {msg.type === 'error' && (
                    <div className="error-message">
                      <div className="message-avatar error-avatar">⚠️</div>
                      <div className="message-content">
                        <div className="error-text">{msg.text}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="message ai">
                  <div className="ai-message">
                    <div className="message-avatar ai-avatar">💘</div>
                    <div className="message-content">
                      <div className="loading-indicator">
                        <HeartPulse />
                        <span className="loading-text">Creating your image...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="input-area">
          <div className="input-container">
            <div className="style-pills">
              {styles.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setMode(style.id)}
                  className={`style-pill ${mode === style.id ? 'active' : ''}`}
                  style={mode === style.id ? { 
                    background: `linear-gradient(135deg, ${style.color}, ${style.color}dd)`,
                    borderColor: style.color 
                  } : {}}
                >
                  <span className="pill-icon">{style.icon}</span>
                  <span className="pill-text">{style.name}</span>
                </button>
              ))}
            </div>

            <div className="input-box">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Describe your image... (Press Enter to generate, Shift+Enter for new line)"
                className="prompt-input"
                rows="1"
              />
              <button onClick={generateImage} disabled={isLoading || !prompt.trim()} className="send-btn">
                {isLoading ? "⏳" : "🚀"}
              </button>
            </div>

            <div className="quick-settings">
              <select value={size} onChange={(e) => setSize(e.target.value)} className="quick-select">
                {sizes.map((s) => (
                  <option key={s} value={s}>📐 {s}</option>
                ))}
              </select>
              <select value={variations} onChange={(e) => setVariations(Number(e.target.value))} className="quick-select">
                <option value="1">1x variation</option>
                <option value="2">2x variations</option>
                <option value="3">3x variations</option>
                <option value="4">4x variations</option>
              </select>
            </div>
          </div>
        </div>
      </main>

      {showSettings && (
        <div className="settings-panel">
          <div className="panel-header">
            <h3>Settings</h3>
            <button onClick={() => setShowSettings(false)} className="close-panel">✕</button>
          </div>
          <div className="panel-content">
            <div className="setting-group">
              <label>Image Size</label>
              <select value={size} onChange={(e) => setSize(e.target.value)} className="setting-input">
                {sizes.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="setting-group">
              <label>Variations</label>
              <input
                type="number"
                min="1"
                max="4"
                value={variations}
                onChange={(e) => setVariations(Math.max(1, Math.min(4, Number(e.target.value))))}
                className="setting-input"
              />
            </div>
            <div className="setting-group">
              <label>Style Mode</label>
              <div className="style-grid">
                {styles.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setMode(style.id)}
                    className={`style-option ${mode === style.id ? 'active' : ''}`}
                  >
                    <span>{style.icon}</span>
                    <span>{style.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {(sidebarOpen || showSettings) && (
        <div className="overlay" onClick={() => { setSidebarOpen(false); setShowSettings(false); }}></div>
      )}

      <style jsx>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        .milan-root {
          display: flex;
          height: 100vh;
          background: #0f172a;
          color: #e2e8f0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          overflow: hidden;
        }

        .sidebar {
          width: 260px;
          background: #1e293b;
          border-right: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          flex-direction: column;
          transition: transform 0.3s;
        }

        @media (max-width: 768px) {
          .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            height: 100vh;
            z-index: 100;
            transform: translateX(-100%);
          }
          .sidebar.open {
            transform: translateX(0);
          }
        }

        .sidebar-header {
          padding: 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .logo-section {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .logo {
          width: 2.5rem;
          height: 2.5rem;
          background: linear-gradient(135deg, #ff7ab6, #8b5cf6);
          border-radius: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
        }

        .logo-text {
          font-weight: 700;
          font-size: 1rem;
        }

        .logo-subtitle {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.6);
        }

        .close-sidebar {
          display: none;
          background: none;
          border: none;
          color: white;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0.25rem;
        }

        @media (max-width: 768px) {
          .close-sidebar { display: block; }
        }

        .sidebar-content {
          flex: 1;
          padding: 1rem;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .new-chat-btn {
          width: 100%;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          color: white;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.875rem;
        }

        .new-chat-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .new-chat-btn .icon {
          font-size: 1.25rem;
        }

        .history-section {
          flex: 1;
        }

        .history-title {
          font-size: 0.75rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 0.5rem;
          text-transform: uppercase;
        }

        .history-item {
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 0.5rem;
          margin-bottom: 0.5rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .history-item:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .history-icon {
          font-size: 1rem;
        }

        .history-text {
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.8);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .empty-history {
          padding: 1rem;
          text-align: center;
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.4);
        }

        .settings-section {
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding-top: 1rem;
        }

        .settings-item {
          width: 100%;
          padding: 0.75rem;
          background: transparent;
          border: none;
          color: white;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
          border-radius: 0.5rem;
          transition: all 0.2s;
          font-size: 0.875rem;
          text-decoration: none;
        }

        .settings-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .main-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .top-header {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #1e293b;
        }

        .menu-btn {
          display: none;
          background: none;
          border: none;
          color: white;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0.25rem;
        }

        @media (max-width: 768px) {
          .menu-btn { display: block; }
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .model-name {
          font-weight: 600;
        }

        .model-badge {
          padding: 0.25rem 0.75rem;
          background: rgba(255, 122, 182, 0.2);
          border-radius: 1rem;
          font-size: 0.75rem;
          color: #ff7ab6;
          text-transform: capitalize;
        }

        .settings-toggle {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          cursor: pointer;
          font-size: 1rem;
        }

        .chat-container {
          flex: 1;
          overflow-y: auto;
          padding: 2rem 1rem;
        }

        .welcome-screen {
          max-width: 800px;
          margin: 0 auto;
          text-align: center;
          padding: 2rem;
        }

        .welcome-logo {
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        .welcome-title {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          background: linear-gradient(90deg, #ff7ab6, #8b5cf6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .welcome-subtitle {
          font-size: 1.125rem;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 2rem;
        }

        .example-prompts {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1rem;
        }

        .example-card {
          padding: 1.5rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1rem;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }

        .example-card:hover {
          background: rgba(255, 255, 255, 0.08);
          transform: translateY(-2px);
          border-color: rgba(255, 122, 182, 0.3);
        }

        .example-icon {
          font-size: 1.5rem;
        }

        .example-text {
          color: rgba(255, 255, 255, 0.9);
          font-size: 0.875rem;
          line-height: 1.5;
        }

        .messages-area {
          max-width: 900px;
          margin: 0 auto;
          padding: 0 1rem;
        }

        .message {
          margin-bottom: 2rem;
        }

        .user-message, .ai-message, .error-message {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }

        .message-avatar {
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          flex-shrink: 0;
        }

        .user-avatar {
          background: rgba(59, 130, 246, 0.2);
        }

        .ai-avatar {
          background: linear-gradient(135deg, #ff7ab6, #8b5cf6);
        }

        .error-avatar {
          background: rgba(239, 68, 68, 0.2);
        }

        .message-content {
          flex: 1;
          max-width: 100%;
        }

        .message-text {
          padding: 1rem;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          line-height: 1.6;
        }

        .error-text {
          padding: 1rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 1rem;
          color: #fca5a5;
          font-size: 0.875rem;
        }

        .image-wrapper {
          position: relative;
          border-radius: 1rem;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
          max-width: 100%;
        }

        .generated-image {
          width: 100%;
          height: auto;
          display: block;
        }

        .image-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
          padding: 1rem;
          display: flex;
          gap: 0.5rem;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .image-wrapper:hover .image-overlay {
          opacity: 1;
        }

        .overlay-btn {
          padding: 0.5rem 1rem;
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 0.5rem;
          color: white;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .overlay-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .image-info {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }

        .info-badge {
          padding: 0.25rem 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.7);
          text-transform: capitalize;
        }

        .loading-indicator {
          padding: 2rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .loading-text {
          color: rgba(255, 255, 255, 0.7);
        }

        .input-area {
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          background: #1e293b;
          padding: 1rem;
        }

        .input-container {
          max-width: 900px;
          margin: 0 auto;
        }

        .style-pills {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          overflow-x: auto;
          padding-bottom: 0.5rem;
        }

        .style-pills::-webkit-scrollbar {
          height: 4px;
        }

        .style-pills::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
        }

        .style-pill {
          padding: 0.5rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 2rem;
          color: white;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
          font-size: 0.875rem;
        }

        .style-pill:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .style-pill.active {
          color: white;
          box-shadow: 0 4px 20px rgba(255, 122, 182, 0.3);
        }

        .pill-icon {
          font-size: 1rem;
        }

        .pill-text {
          font-weight: 500;
        }

        .input-box {
          display: flex;
          gap: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1.5rem;
          padding: 0.75rem 1rem;
          align-items: flex-end;
        }

        .prompt-input {
          flex: 1;
          background: transparent;
          border: none;
          color: white;
          font-size: 1rem;
          resize: none;
          outline: none;
          max-height: 200px;
          overflow-y: auto;
          line-height: 1.5;
        }

        .prompt-input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }

        .send-btn {
          width: 2.5rem;
          height: 2.5rem;
          background: linear-gradient(135deg, #ff7ab6, #8b5cf6);
          border: none;
          border-radius: 50%;
          color: white;
          font-size: 1.25rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .send-btn:hover:not(:disabled) {
          transform: scale(1.1);
          box-shadow: 0 4px 20px rgba(255, 122, 182, 0.4);
        }

        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .quick-settings {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }

        .quick-select {
          padding: 0.5rem 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          color: white;
          font-size: 0.875rem;
          cursor: pointer;
          outline: none;
        }

        .quick-select:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .settings-panel {
          position: fixed;
          right: 0;
          top: 0;
          width: 320px;
          height: 100vh;
          background: #1e293b;
          border-left: 1px solid rgba(255, 255, 255, 0.1);
          z-index: 90;
          display: flex;
          flex-direction: column;
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        @media (max-width: 768px) {
          .settings-panel {
            width: 100%;
            max-width: 320px;
          }
        }

        .panel-header {
          padding: 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .panel-header h3 {
          font-size: 1.25rem;
          font-weight: 600;
        }

        .close-panel {
          background: none;
          border: none;
          color: white;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0.25rem;
        }

        .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
        }

        .setting-group {
          margin-bottom: 1.5rem;
        }

        .setting-group label {
          display: block;
          font-size: 0.875rem;
          font-weight: 600;
          margin-bottom: 0.75rem;
          color: rgba(255, 255, 255, 0.9);
        }

        .setting-input {
          width: 100%;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          color: white;
          font-size: 0.875rem;
          outline: none;
        }

        .setting-input:focus {
          border-color: #ff7ab6;
        }

        .style-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.5rem;
        }

        .style-option {
          padding: 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.75rem;
          color: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.875rem;
        }

        .style-option:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .style-option.active {
          background: linear-gradient(135deg, #ff7ab6, #8b5cf6);
          border-color: transparent;
        }

        .style-option span:first-child {
          font-size: 1.5rem;
        }

        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          z-index: 80;
          animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

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

        .chat-container::-webkit-scrollbar,
        .sidebar-content::-webkit-scrollbar,
        .panel-content::-webkit-scrollbar,
        .prompt-input::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        .chat-container::-webkit-scrollbar-track,
        .sidebar-content::-webkit-scrollbar-track,
        .panel-content::-webkit-scrollbar-track,
        .prompt-input::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.03);
        }

        .chat-container::-webkit-scrollbar-thumb,
        .sidebar-content::-webkit-scrollbar-thumb,
        .panel-content::-webkit-scrollbar-thumb,
        .prompt-input::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }

        .chat-container::-webkit-scrollbar-thumb:hover,
        .sidebar-content::-webkit-scrollbar-thumb:hover,
        .panel-content::-webkit-scrollbar-thumb:hover,
        .prompt-input::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        @media (max-width: 768px) {
          .welcome-title {
            font-size: 1.5rem;
          }

          .welcome-subtitle {
            font-size: 1rem;
          }

          .example-prompts {
            grid-template-columns: 1fr;
          }

          .chat-container {
            padding: 1rem 0.5rem;
          }

          .messages-area {
            padding: 0 0.5rem;
          }

          .input-area {
            padding: 0.75rem;
          }

          .style-pills {
            margin-bottom: 0.5rem;
          }

          .quick-settings {
            flex-direction: column;
          }

          .quick-select {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

function HeartPulse({ big = false }) {
  const size = big ? 48 : 20;
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
