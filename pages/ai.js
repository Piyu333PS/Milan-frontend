// pages/ai.js
import React, { useEffect, useRef, useState } from "react";

export default function AIPage() {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState("romantic");
  const [size, setSize] = useState("1024x1024");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [variations, setVariations] = useState(1);
  const [showMenu, setShowMenu] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [prompt]);

  async function generateImage() {
    if (!prompt.trim()) return;
    
    const userMsg = { type: 'user', text: prompt, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    
    const currentPrompt = prompt;
    setPrompt("");
    setIsLoading(true);
    
    try {
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
      
      const aiMsg = {
        type: 'ai',
        imageUrl: url,
        prompt: currentPrompt,
        mode,
        size,
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      const errorMsg = {
        type: 'error',
        text: String(err?.message || err),
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }

  function downloadImage(url) {
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
    { id: "romantic", name: "Romantic", icon: "💕" },
    { id: "realistic", name: "Realistic", icon: "📷" },
    { id: "anime", name: "Anime", icon: "🎨" },
    { id: "product", name: "Product", icon: "📦" },
    { id: "artistic", name: "Artistic", icon: "🎭" },
    { id: "fantasy", name: "Fantasy", icon: "✨" }
  ];

  const examples = [
    "A romantic couple at sunset beach, cinematic lighting",
    "Anime-style portrait with dreamy colors",
    "Modern minimalist product photography",
    "Fantasy landscape with magical atmosphere"
  ];

  return (
    <div className="root">
      {/* Top Bar */}
      <header className="header">
        <div className="header-left">
          <button className="menu-btn" onClick={() => setShowMenu(!showMenu)}>☰</button>
          <div className="brand">
            <span className="brand-icon">💘</span>
            <span className="brand-text">Milan AI Studio</span>
          </div>
        </div>
        <div className="header-right">
          <span className="badge">{mode}</span>
          <a href="/connect" className="dash-link">Back to Dashboard</a>
        </div>
      </header>

      {/* Main Content */}
      <main className="main">
        <div className="container">
          {/* Welcome or Messages */}
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-icon">💘</div>
              <h1 className="welcome-title">Milan AI Studio</h1>
              <p className="welcome-subtitle">Create beautiful AI images with simple prompts</p>
              
              <div className="examples">
                {examples.map((ex, i) => (
                  <button key={i} className="example" onClick={() => setPrompt(ex)}>
                    <span className="ex-icon">💡</span>
                    <span className="ex-text">{ex}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((msg, i) => (
                <div key={i} className={`msg msg-${msg.type}`}>
                  {msg.type === 'user' && (
                    <div className="user-msg">
                      <div className="avatar user-av">👤</div>
                      <div className="msg-bubble">{msg.text}</div>
                    </div>
                  )}
                  
                  {msg.type === 'ai' && (
                    <div className="ai-msg">
                      <div className="avatar ai-av">💘</div>
                      <div className="img-container">
                        <img src={msg.imageUrl} alt="Generated" className="gen-img" />
                        <div className="img-actions">
                          <button onClick={() => downloadImage(msg.imageUrl)} className="action-btn">
                            💾 Download
                          </button>
                          <button onClick={() => setPrompt(msg.prompt)} className="action-btn">
                            🔄 Remake
                          </button>
                        </div>
                        <div className="img-info">
                          <span className="info-tag">{msg.mode}</span>
                          <span className="info-tag">{msg.size}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {msg.type === 'error' && (
                    <div className="error-msg">
                      <div className="avatar err-av">⚠️</div>
                      <div className="err-bubble">{msg.text}</div>
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="msg msg-ai">
                  <div className="ai-msg">
                    <div className="avatar ai-av">💘</div>
                    <div className="loading">
                      <div className="spinner"></div>
                      <span>Creating your image...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* Input Area */}
      <footer className="footer">
        <div className="input-wrapper">
          {/* Style Selector */}
          <div className="style-bar">
            {styles.map((s) => (
              <button
                key={s.id}
                onClick={() => setMode(s.id)}
                className={`style-btn ${mode === s.id ? 'active' : ''}`}
              >
                <span>{s.icon}</span>
                <span>{s.name}</span>
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="input-box">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Describe your image... (Enter to send)"
              className="input"
              rows="1"
            />
            <button 
              onClick={generateImage} 
              disabled={isLoading || !prompt.trim()} 
              className="send-btn"
            >
              {isLoading ? "⏳" : "🚀"}
            </button>
          </div>

          {/* Quick Options */}
          <div className="options">
            <select value={size} onChange={(e) => setSize(e.target.value)} className="opt-select">
              <option value="512x512">512×512</option>
              <option value="768x768">768×768</option>
              <option value="1024x1024">1024×1024</option>
              <option value="1536x1536">1536×1536</option>
            </select>
            <select value={variations} onChange={(e) => setVariations(Number(e.target.value))} className="opt-select">
              <option value="1">1 image</option>
              <option value="2">2 images</option>
              <option value="3">3 images</option>
              <option value="4">4 images</option>
            </select>
          </div>
        </div>
      </footer>

      {/* Side Menu */}
      {showMenu && (
        <>
          <div className="overlay" onClick={() => setShowMenu(false)}></div>
          <div className="menu">
            <div className="menu-header">
              <h3>Menu</h3>
              <button onClick={() => setShowMenu(false)} className="close-btn">✕</button>
            </div>
            <button className="menu-item" onClick={() => setMessages([])}>
              <span>+</span> New Generation
            </button>
            <div className="menu-section">
              <div className="menu-title">Recent</div>
              {messages.filter(m => m.type === 'ai').slice(-5).reverse().map((m, i) => (
                <div key={i} className="history-item">
                  🖼️ {m.prompt?.slice(0, 30)}...
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        .root {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: linear-gradient(to bottom, #0a0e1a, #1a1f35);
          color: #e5e7eb;
          font-family: -apple-system, system-ui, sans-serif;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          background: rgba(15, 23, 42, 0.8);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .menu-btn {
          background: none;
          border: none;
          color: white;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0.25rem;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 700;
          font-size: 1.125rem;
        }

        .brand-icon {
          font-size: 1.5rem;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .badge {
          padding: 0.25rem 0.75rem;
          background: rgba(255, 105, 180, 0.2);
          border-radius: 1rem;
          font-size: 0.875rem;
          color: #ff69b4;
          text-transform: capitalize;
        }

        .dash-link {
          padding: 0.5rem 1rem;
          background: linear-gradient(135deg, #ff69b4, #8b5cf6);
          border-radius: 0.5rem;
          color: white;
          text-decoration: none;
          font-weight: 600;
          font-size: 0.875rem;
        }

        @media (max-width: 640px) {
          .brand-text { display: none; }
        }

        .main {
          flex: 1;
          overflow-y: auto;
          padding: 2rem 1rem;
        }

        .container {
          max-width: 900px;
          margin: 0 auto;
        }

        .welcome {
          text-align: center;
          padding: 3rem 1rem;
        }

        .welcome-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        .welcome-title {
          font-size: 2.5rem;
          font-weight: 700;
          background: linear-gradient(90deg, #ff69b4, #8b5cf6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 0.5rem;
        }

        .welcome-subtitle {
          font-size: 1.125rem;
          color: #9ca3af;
          margin-bottom: 3rem;
        }

        .examples {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1rem;
          max-width: 800px;
          margin: 0 auto;
        }

        .example {
          padding: 1.5rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1rem;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
          display: flex;
          gap: 1rem;
        }

        .example:hover {
          background: rgba(255, 255, 255, 0.06);
          transform: translateY(-2px);
          border-color: rgba(255, 105, 180, 0.3);
        }

        .ex-icon {
          font-size: 1.5rem;
        }

        .ex-text {
          color: #e5e7eb;
          line-height: 1.5;
        }

        .messages {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .msg {
          animation: fadeIn 0.3s;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .user-msg, .ai-msg, .error-msg {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }

        .avatar {
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          flex-shrink: 0;
        }

        .user-av {
          background: rgba(59, 130, 246, 0.2);
        }

        .ai-av {
          background: linear-gradient(135deg, #ff69b4, #8b5cf6);
        }

        .err-av {
          background: rgba(239, 68, 68, 0.2);
        }

        .msg-bubble {
          flex: 1;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1rem;
          line-height: 1.6;
        }

        .err-bubble {
          flex: 1;
          padding: 1rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 1rem;
          color: #fca5a5;
        }

        .img-container {
          flex: 1;
          position: relative;
        }

        .gen-img {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: block;
        }

        .img-actions {
          position: absolute;
          bottom: 1rem;
          left: 1rem;
          right: 1rem;
          display: flex;
          gap: 0.5rem;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .img-container:hover .img-actions {
          opacity: 1;
        }

        .action-btn {
          padding: 0.5rem 1rem;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 0.5rem;
          color: white;
          cursor: pointer;
          font-size: 0.875rem;
        }

        .action-btn:hover {
          background: rgba(0, 0, 0, 0.9);
        }

        .img-info {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }

        .info-tag {
          padding: 0.25rem 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          font-size: 0.75rem;
          text-transform: capitalize;
        }

        .loading {
          padding: 2rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .spinner {
          width: 2rem;
          height: 2rem;
          border: 3px solid rgba(255, 255, 255, 0.1);
          border-top-color: #ff69b4;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .footer {
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(10px);
          padding: 1rem;
        }

        .input-wrapper {
          max-width: 900px;
          margin: 0 auto;
        }

        .style-bar {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          overflow-x: auto;
          padding-bottom: 0.5rem;
        }

        .style-bar::-webkit-scrollbar {
          height: 4px;
        }

        .style-bar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
        }

        .style-btn {
          padding: 0.5rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 2rem;
          color: white;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          white-space: nowrap;
          font-size: 0.875rem;
          transition: all 0.2s;
        }

        .style-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .style-btn.active {
          background: linear-gradient(135deg, #ff69b4, #8b5cf6);
          border-color: transparent;
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

        .input {
          flex: 1;
          background: transparent;
          border: none;
          color: white;
          font-size: 1rem;
          resize: none;
          outline: none;
          max-height: 200px;
          line-height: 1.5;
        }

        .input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }

        .send-btn {
          width: 2.5rem;
          height: 2.5rem;
          background: linear-gradient(135deg, #ff69b4, #8b5cf6);
          border: none;
          border-radius: 50%;
          color: white;
          font-size: 1.25rem;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.2s;
        }

        .send-btn:hover:not(:disabled) {
          transform: scale(1.1);
        }

        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .options {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }

        .opt-select {
          padding: 0.5rem 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          color: white;
          font-size: 0.875rem;
          cursor: pointer;
          outline: none;
        }

        .menu {
          position: fixed;
          left: 0;
          top: 0;
          width: 280px;
          height: 100vh;
          background: #1e293b;
          z-index: 100;
          animation: slideIn 0.3s;
          display: flex;
          flex-direction: column;
        }

        @keyframes slideIn {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }

        .menu-header {
          padding: 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .close-btn {
          background: none;
          border: none;
          color: white;
          font-size: 1.5rem;
          cursor: pointer;
        }

        .menu-item {
          width: 100%;
          padding: 1rem 1.5rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          color: white;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          margin: 1rem 1rem 0 1rem;
        }

        .menu-section {
          flex: 1;
          padding: 1rem 1.5rem;
          overflow-y: auto;
        }

        .menu-title {
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
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.8);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          z-index: 90;
          animation: fadeIn 0.3s;
        }

        @media (max-width: 640px) {
          .welcome-title { font-size: 1.75rem; }
          .examples { grid-template-columns: 1fr; }
          .options { flex-direction: column; }
          .opt-select { width: 100%; }
        }
      `}</style>
    </div>
  );
}
