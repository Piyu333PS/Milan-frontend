"use client";
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

export default function ConnectPage() {
  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile toggle
  const [showProfile, setShowProfile] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Profile state (stored in localStorage)
  const [profile, setProfile] = useState({
    name: "",
    contact: "",
    photoDataUrl: "" // base64 or data URL
  });

  // Security (very simple frontend-only handling)
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");

  // Status / searching
  const [statusMessage, setStatusMessage] = useState(
    "❤️ जहाँ दिल मिले, वहीं होती है शुरुआत Milan की…"
  );
  const [modeText, setModeText] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // socket ref
  const socketRef = useRef(null);
  // store room/partner if needed
  const partnerRef = useRef(null);

  // Helpers: load/save profile to localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("milan_profile");
      if (saved) {
        setProfile(JSON.parse(saved));
      } else {
        // if registration created name earlier, try token payload or other storage key
        const registeredName = localStorage.getItem("registered_name") || "";
        const registeredContact = localStorage.getItem("registered_contact") || "";
        setProfile((p) => ({
          ...p,
          name: registeredName,
          contact: registeredContact
        }));
      }
    } catch (e) {
      console.warn("Error reading profile from localStorage", e);
    }
  }, []);

  // HEARTS CANVAS + socket setup removed from render loop
  useEffect(() => {
    // Hearts background (same logic as you provided)
    const canvas = document.getElementById("heartCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let hearts = [];
    let rafId = null;

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    function createHeart() {
      return {
        x: Math.random() * canvas.width,
        y: canvas.height + 50,
        size: Math.random() * 20 + 10,
        speed: Math.random() * 1.5 + 0.5,
        color: ["#ff4d6d", "#ff1c68", "#ff6b81", "#e6005c"][
          Math.floor(Math.random() * 4)
        ]
      };
    }

    function drawHearts() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hearts.forEach((h) => {
        ctx.fillStyle = h.color;
        ctx.beginPath();
        ctx.moveTo(h.x, h.y);
        ctx.bezierCurveTo(
          h.x + h.size / 2,
          h.y - h.size,
          h.x + h.size * 1.5,
          h.y + h.size / 3,
          h.x,
          h.y + h.size
        );
        ctx.bezierCurveTo(
          h.x - h.size * 1.5,
          h.y + h.size / 3,
          h.x - h.size / 2,
          h.y - h.size,
          h.x,
          h.y
        );
        ctx.fill();
        h.y -= h.speed;
      });
      hearts = hearts.filter((h) => h.y + h.size > 0);
      if (Math.random() < 0.1) hearts.push(createHeart());
      rafId = requestAnimationFrame(drawHearts);
    }
    drawHearts();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  // Socket management (we will connect when user starts search)
  // Keep socket disconnect on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        try {
          socketRef.current.disconnect();
        } catch (e) { /* ignore */ }
        socketRef.current = null;
      }
    };
  }, []);

  // UI actions
  function openProfilePanel() {
    setShowProfile(true);
    setShowSecurity(false);
    setShowLogoutConfirm(false);
  }
  function openSecurityPanel() {
    setShowSecurity(true);
    setShowProfile(false);
    setShowLogoutConfirm(false);
  }
  function openLogoutConfirm() {
    setShowLogoutConfirm(true);
    setShowProfile(false);
    setShowSecurity(false);
  }

  // Save profile to localStorage
  function saveProfile(updated) {
    const newProfile = { ...profile, ...updated };
    setProfile(newProfile);
    localStorage.setItem("milan_profile", JSON.stringify(newProfile));
    setShowProfile(false);
  }

  // Handle photo input change (file to data URL)
  function handlePhotoChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      const dataUrl = ev.target.result;
      saveProfile({ photoDataUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  }

  // Simple security handling: store password in localStorage (frontend only)
  function saveNewPassword() {
    const savedPwd = localStorage.getItem("milan_password") || "";
    if (savedPwd && savedPwd !== currentPasswordInput) {
      alert("Current password is incorrect.");
      return;
    }
    if (!newPasswordInput || newPasswordInput.length < 4) {
      alert("New password should be at least 4 characters.");
      return;
    }
    localStorage.setItem("milan_password", newPasswordInput);
    setCurrentPasswordInput("");
    setNewPasswordInput("");
    setShowSecurity(false);
    alert("Password updated (frontend only).");
  }

  // Logout handler
  function handleLogoutConfirmYes() {
    localStorage.clear();
    sessionStorage.clear();
    // redirect to home
    window.location.href = "/";
  }

  // Start searching for partner (connect socket if not already)
  function startSearch(type) {
    if (isSearching) return;
    setIsSearching(true);
    setModeText(type === "video" ? "Video Chat" : "Text Chat");
    setStatusMessage(type === "video" ? "🎥 Searching for a Video Chat partner..." : "💬 Searching for a Text Chat partner...");
    // ensure socket connection
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "https://milan-j9u9.onrender.com";
    if (!socketRef.current || !socketRef.current.connected) {
      socketRef.current = io(backend, { transports: ["websocket", "polling"] });
    }
    const token = localStorage.getItem("token") || "";
    socketRef.current.emit("lookingForPartner", { type, token });

    // handle incoming events
    socketRef.current.off("partnerFound");
    socketRef.current.on("partnerFound", (data) => {
      partnerRef.current = data.partner || {};
      sessionStorage.setItem("partnerData", JSON.stringify(partnerRef.current));
      sessionStorage.setItem("roomCode", data.roomCode || "");
      setStatusMessage("💖 Milan Successful!");
      setTimeout(() => {
        if (type === "video") {
          window.location.href = "/video";
        } else {
          // older code used chat.html; in Next.js use route /chat
          window.location.href = "/chat";
        }
      }, 900);
    });

    socketRef.current.off("partnerDisconnected");
    socketRef.current.on("partnerDisconnected", () => {
      alert("Partner disconnected.");
      stopSearch();
    });

    // Show loader
    const loaderEl = document.getElementById("loader");
    if (loaderEl) loaderEl.style.display = "block";
    const stopBtn = document.getElementById("stopBtn");
    if (stopBtn) stopBtn.style.display = "inline-block";
    // hide main buttons so user can't click again
    const vbtn = document.getElementById("videoBtn");
    const tbtn = document.getElementById("textBtn");
    if (vbtn) vbtn.style.display = "none";
    if (tbtn) tbtn.style.display = "none";
  }

  function stopSearch() {
    if (socketRef.current) {
      try {
        socketRef.current.emit("disconnectByUser");
        socketRef.current.disconnect();
      } catch (e) { /* ignore */ }
      socketRef.current = null;
    }
    setIsSearching(false);
    setModeText("");
    setStatusMessage("❤️ जहाँ दिल मिले, वहीं होती है शुरुआत Milan की…");
    const loaderEl = document.getElementById("loader");
    if (loaderEl) loaderEl.style.display = "none";
    const stopBtn = document.getElementById("stopBtn");
    if (stopBtn) stopBtn.style.display = "none";
    const vbtn = document.getElementById("videoBtn");
    const tbtn = document.getElementById("textBtn");
    if (vbtn) vbtn.style.display = "inline-block";
    if (tbtn) tbtn.style.display = "inline-block";
  }

  // small helper to render avatar: if photo exist show it, else first letter
  function Avatar() {
    if (profile.photoDataUrl) {
      return <img src={profile.photoDataUrl} alt="avatar" style={{ width: 70, height: 70, borderRadius: "50%", objectFit: "cover" }} />;
    }
    const first = (profile.name && profile.name.trim().charAt(0).toUpperCase()) || "M";
    return <div style={{ width: 70, height: 70, borderRadius: "50%", background: "#ec4899", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, color: "#fff" }}>{first}</div>;
  }

  // Save personal info from profile panel
  function handleSavePersonal(e) {
    e.preventDefault();
    const f = e.target;
    const name = f.fullname.value.trim();
    const contact = f.contact.value.trim();
    if (!name) {
      alert("Please enter name.");
      return;
    }
    saveProfile({ name, contact });
  }

  return (
    <>
      {/* canvas hearts */}
      <canvas id="heartCanvas"></canvas>

      {/* hamburger for mobile */}
      <div className="hamburger" onClick={() => setSidebarOpen((s) => !s)} aria-hidden>
        ☰
      </div>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`} aria-hidden={false}>
        <div className="sidebar-top">
          <div className="profile-pic-wrapper">
            <Avatar />
          </div>
          <div className="username">{profile.name || "My Name"}</div>

          <div style={{ marginTop: 8 }}>
            <label htmlFor="photoInput" className="photo-label">Change / Add Photo</label>
            <input id="photoInput" type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
          </div>
        </div>

        <ul className="sidebar-list">
          <li onClick={openProfilePanel}><span>👤</span><span>Profile Info</span></li>
          <li onClick={openSecurityPanel}><span>🔒</span><span>Security</span></li>
          <li onClick={openLogoutConfirm}><span>🚪</span><span>Logout</span></li>
        </ul>
      </aside>

      {/* Main content area */}
      <main className="content-wrap" role="main">
        <div className="glass-card">
          <div className="center-box">
            <h2>Select Milan Mode</h2>
            <div className="mode-text" id="modeText">{modeText}</div>

            {/* Mode options */}
            <div className="mode-options">
              {/* Video card */}
              <div className="mode-card" role="button" tabIndex={0} onClick={() => startSearch("video")} id="videoBtn">
                {/* simple camera SVG with pulse */}
                <div className="mode-animation video-animation" aria-hidden>
                  <svg viewBox="0 0 64 48" width="120" height="80" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="8" width="40" height="32" rx="6" fill="#fff" opacity="0.06"/>
                    <rect x="6" y="12" width="32" height="24" rx="5" fill="#fff" />
                    <path d="M46 14 L62 6 L62 42 L46 34 Z" fill="#ffd2e0" opacity="0.9" />
                    <circle cx="22" cy="24" r="6" fill="#ec4899" />
                  </svg>
                </div>
                <button className="mode-btn">Start Video Chat</button>
                <p className="mode-desc">Meet face-to-face instantly in Milan’s romantic video room.</p>
              </div>

              {/* Text card */}
              <div className="mode-card disabled-card" role="button" tabIndex={0} onClick={() => startSearch("text")} id="textBtn">
                <div className="mode-animation text-animation" aria-hidden>
                  {/* typing phone mockup */}
                  <div className="phone-mock">
                    <div className="phone-screen">
                      <div className="typing-dots">
                        <span className="dot dot1" />
                        <span className="dot dot2" />
                        <span className="dot dot3" />
                      </div>
                    </div>
                  </div>
                </div>
                <button className="mode-btn" disabled={false}>Start Text Chat</button>
                <p className="mode-desc">Express your feelings through sweet and romantic messages.</p>
                <div className="disabled-note">💌 Text Chat on the way…</div>
              </div>
            </div>

            <div id="loader" className="loader" style={{ display: "none" }}>
              <div id="statusMessage" className="heart-loader"></div>
            </div>

            <button id="stopBtn" className="stop-btn" style={{ display: "none" }} onClick={stopSearch}>Stop Searching</button>

            <div className="quote-box" id="quoteBox">
              {statusMessage}
              <span style={{ display: "block", fontSize: 14, marginTop: 6, opacity: 0.95 }}>
                (Where hearts meet, that’s where Milan begins…)
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Panels: Personal Info, Security, Logout confirm */}
      {showProfile && (
        <div className="panel">
          <h3>Personal Info</h3>
          <form onSubmit={handleSavePersonal}>
            <input name="fullname" placeholder="Full Name" defaultValue={profile.name} />
            <input name="contact" placeholder="Email or Mobile" defaultValue={profile.contact} />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="save-btn">Save</button>
              <button type="button" className="cancel-btn" onClick={() => setShowProfile(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {showSecurity && (
        <div className="panel">
          <h3>Security</h3>
          <input type="password" placeholder="Current Password" value={currentPasswordInput} onChange={(e) => setCurrentPasswordInput(e.target.value)} />
          <input type="password" placeholder="New Password" value={newPasswordInput} onChange={(e) => setNewPasswordInput(e.target.value)} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="save-btn" onClick={() => saveNewPassword()}>Save</button>
            <button className="cancel-btn" onClick={() => setShowSecurity(false)}>Cancel</button>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="panel">
          <p style={{ marginBottom: 12 }}>Do you want to Logout?</p>
          <div style={{ display: "flex", gap: 12 }}>
            <label className="radio-label"><input type="radio" name="logout" onClick={handleLogoutConfirmYes}/> Yes</label>
            <label className="radio-label"><input type="radio" name="logout" onClick={() => setShowLogoutConfirm(false)}/> No</label>
          </div>
        </div>
      )}

      <style jsx global>{`
        /* Basic page setup */
        body, html {
          margin: 0;
          padding: 0;
          height: 100%;
          font-family: 'Poppins', sans-serif;
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          overflow: hidden;
        }
        canvas {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 0;
        }

        /* Hamburger for mobile */
        .hamburger {
          display: none;
          position: fixed;
          top: 16px;
          left: 16px;
          font-size: 24px;
          color: white;
          z-index: 50;
          background: rgba(0,0,0,0.25);
          padding: 8px 10px;
          border-radius: 6px;
          cursor: pointer;
          user-select: none;
        }

        /* Sidebar */
        .sidebar {
          position: fixed;
          top: 0;
          left: 0;
          width: 220px;
          height: 100%;
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(12px);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 36px;
          z-index: 40;
          color: white;
          transition: transform 0.28s ease;
        }
        .sidebar.open { transform: translateX(0); }
        .sidebar .sidebar-top { display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .profile-pic-wrapper { width: 70px; height: 70px; border-radius: 50%; overflow: hidden; }
        .username { margin-top: 6px; font-size: 16px; font-weight: 600; color: #fff; text-align: center; padding: 6px 10px; }
        .photo-label { font-size: 13px; color: #fff; background: rgba(0,0,0,0.18); padding: 6px 10px; border-radius: 8px; cursor: pointer; display: inline-block; margin-top: 6px; }

        .sidebar-list { list-style: none; padding: 0; margin-top: 26px; width: 100%; }
        .sidebar-list li {
          display:flex; align-items:center; gap:12px; justify-content:flex-start;
          padding:12px 18px; margin:8px 12px; background: rgba(255,255,255,0.06); border-radius: 10px; cursor: pointer;
        }
        .sidebar-list li:hover { background: rgba(255,255,255,0.12); transform: translateX(6px); transition: all 0.18s; }

        /* Content area */
        .content-wrap {
          position: fixed;
          top: 0;
          left: 220px;
          right: 0;
          bottom: 0;
          display: grid;
          place-items: center;
          padding: 24px;
          z-index: 10;
        }

        /* Glass card */
        .glass-card {
          width: min(100%, 1100px);
          height: min(88vh, 820px);
          background: rgba(255,255,255,0.14);
          border: 2px solid rgba(255,255,255,0.28);
          border-radius: 24px;
          backdrop-filter: blur(18px);
          box-shadow: 0 10px 40px rgba(0,0,0,0.25), inset 0 0 60px rgba(255,255,255,0.06);
          display: grid;
          place-items: center;
          padding: 28px;
        }
        .center-box { width: 100%; max-width: 900px; color: #fff; text-align: center; z-index: 12; }
        .center-box h2 {
          font-size: 40px; margin-bottom: 12px; font-weight: 700;
          text-shadow: 0 0 10px #ec4899;
        }
        .mode-text { color: #ffe4f1; font-weight: 600; margin-bottom: 8px; }

        .mode-options {
          display:flex; justify-content:center; gap:20px; align-items: stretch; flex-wrap: wrap; margin-top: 14px;
        }
        .mode-card, .disabled-card {
          flex: 1 1 300px; max-width: 420px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 18px;
          padding: 18px;
          display:flex; flex-direction: column; align-items: center; gap: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.18);
          transition: transform 0.22s ease, box-shadow 0.22s ease;
        }
        .mode-card:hover { transform: translateY(-8px); box-shadow: 0 14px 30px rgba(0,0,0,0.26); }
        .disabled-card { opacity: 0.95; }

        .mode-animation { width: 100%; display:flex; align-items:center; justify-content:center; margin-bottom: 6px; }
        .mode-btn {
          width: 100%;
          padding: 12px 14px;
          border-radius: 10px;
          border: none;
          background: #fff;
          color: #ec4899;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
        }
        .mode-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .mode-desc { color: rgba(255,255,255,0.9); font-size: 14px; margin-top: 6px; }

        .disabled-note { margin-top: 6px; font-size: 13px; color: #ffe4f1; font-style: italic; }

        /* Video camera animation (simple pulse) */
        .video-animation svg { width: 120px; height: 80px; }
        .video-animation svg rect, .video-animation svg circle, .video-animation svg path { transition: transform 0.4s ease; }
        .mode-card:hover .video-animation svg rect, .mode-card:hover .video-animation svg circle { transform: scale(1.03); }

        /* Phone mockup + typing dots */
        .phone-mock { width: 84px; height: 140px; border-radius: 14px; background: linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0.8)); box-shadow: inset 0 1px 0 rgba(255,255,255,0.6); display:flex; align-items:center; justify-content:center; }
        .phone-screen { width: 72px; height: 120px; background: linear-gradient(180deg, rgba(236,72,153,0.12), rgba(139,92,246,0.06)); border-radius: 10px; display:flex; align-items:center; justify-content:center; }
        .typing-dots { display:flex; gap:8px; align-items:center; justify-content:center; }
        .typing-dots .dot { width:8px; height:8px; background:#fff; border-radius:50%; opacity:0.25; transform: scale(0.8); animation: typing-bounce 1.2s infinite ease-in-out; }
        .typing-dots .dot1 { animation-delay: 0s; }
        .typing-dots .dot2 { animation-delay: 0.18s; }
        .typing-dots .dot3 { animation-delay: 0.36s; }
        @keyframes typing-bounce {
          0% { opacity: 0.25; transform: translateY(0) scale(0.8); }
          40% { opacity: 1; transform: translateY(-6px) scale(1.0); }
          80% { opacity: 0.4; transform: translateY(0) scale(0.9); }
          100% { opacity: 0.25; transform: translateY(0) scale(0.8); }
        }

        /* Loader & status */
        .loader { display:none; margin: 10px auto; }
        .heart-loader { font-size: 30px; color: #fff; animation: blink 1s infinite; }
        @keyframes blink {
          0% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.12); }
          100% { opacity: 0.2; transform: scale(1); }
        }
        .stop-btn {
          margin-top: 12px; padding: 10px 18px; background:#ff4d4f; color:#fff; border:none; border-radius:10px; cursor:pointer;
        }

        .quote-box {
          margin-top: 20px;
          font-weight: 600;
          color: #ffeff7;
          text-shadow: 0 0 5px #ff88aa;
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
        }

        /* Panels */
        .panel {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(255,255,255,0.98);
          padding: 22px;
          border-radius: 12px;
          z-index: 60;
          box-shadow: 0 12px 40px rgba(0,0,0,0.25);
          width: 320px;
          display:flex;
          flex-direction:column;
          gap: 10px;
        }
        .panel input { padding: 10px; border: 1px solid #ddd; border-radius: 8px; width: 100%; }
        .save-btn { padding: 10px 12px; background: #ec4899; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
        .cancel-btn { padding: 10px 12px; background: #f1f1f1; border: none; border-radius: 8px; cursor: pointer; }

        .radio-label input { margin-right: 8px; }

        /* Responsive adjustments */
        @media (max-width: 1024px) {
          .glass-card { height: min(86vh, 760px); }
        }
        @media (max-width: 768px) {
          .hamburger { display: block; }
          .sidebar { transform: translateX(-100%); width: 200px; }
          .sidebar.open { transform: translateX(0); }
          .content-wrap { left: 0; padding: 16px; }
          .glass-card { width: 100%; height: auto; min-height: 72vh; padding: 22px; border-radius: 20px; }
          .center-box h2 { font-size: 28px; }
          .mode-options { gap: 12px; }
          .mode-card, .disabled-card { max-width: 100%; }
        }
      `}</style>
    </>
  );
}
