"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import io from "socket.io-client";

export default function ConnectPage() {
  // -----------------------------
  // UI state
  // -----------------------------
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Profile (localStorage)
  const [profile, setProfile] = useState({
    name: "",
    contact: "",
    photoDataUrl: "",
  });

  // Security (frontend-only demo)
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");

  // Search / status
  const [statusMessage, setStatusMessage] = useState(
    "❤️ जहाँ दिल मिले, वहीं होती है शुरुआत Milan की…"
  );
  const [modeText, setModeText] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [showLoader, setShowLoader] = useState(false);

  // Primary CTA visibility
  const [showModeButtons, setShowModeButtons] = useState(true);

  // -----------------------------
  // Sockets
  // -----------------------------
  const socketRef = useRef(null);
  const partnerRef = useRef(null);
  const connectingRef = useRef(false);

  const backendUrl = useMemo(
    () =>
      (typeof window !== "undefined" && process.env.NEXT_PUBLIC_BACKEND_URL) ||
      "https://milan-j9u9.onrender.com",
    []
  );

  // -----------------------------
  // Load profile
  // -----------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("milan_profile");
      if (saved) {
        setProfile(JSON.parse(saved));
      } else {
        const registeredName = localStorage.getItem("registered_name") || "";
        const registeredContact = localStorage.getItem("registered_contact") || "";
        setProfile((p) => ({ ...p, name: registeredName, contact: registeredContact }));
      }
    } catch (e) {
      console.warn("Error reading profile from localStorage", e);
    }
  }, []);

  // -----------------------------
  // Hearts background
  // -----------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
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
        ],
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

  // -----------------------------
  // Cleanup socket on unmount
  // -----------------------------
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        try {
          socketRef.current.disconnect();
        } catch {}
        socketRef.current = null;
      }
    };
  }, []);

  // Disconnect if tab hidden while searching
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && socketRef.current && isSearching) {
        try {
          socketRef.current.emit("disconnectByUser");
          socketRef.current.disconnect();
        } catch {}
        socketRef.current = null;
        setIsSearching(false);
        setShowLoader(false);
        setShowModeButtons(true);
        setModeText("");
        setStatusMessage("❤️ जहाँ दिल मिले, वहीं होती है शुरुआत Milan की…");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [isSearching]);

  // -----------------------------
  // Sidebar actions
  // -----------------------------
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

  // Save profile
  function saveProfile(updated) {
    const newProfile = { ...profile, ...updated };
    setProfile(newProfile);
    if (typeof window !== "undefined") {
      localStorage.setItem("milan_profile", JSON.stringify(newProfile));
    }
    setShowProfile(false);
  }

  // Photo upload
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

  // Security (demo)
  function saveNewPassword() {
    if (typeof window === "undefined") return;
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

  // Logout
  function handleLogoutConfirmYes() {
    if (typeof window === "undefined") return;
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/";
  }

  // -----------------------------
  // Start / Stop Search
  // -----------------------------
  function startSearch(type) {
    if (isSearching || connectingRef.current) return;
    connectingRef.current = true;

    setIsSearching(true);
    setShowLoader(true);
    setShowModeButtons(false);
    setModeText(type === "video" ? "Video Chat" : "Text Chat");
    setStatusMessage(
      type === "video"
        ? "🎥 Searching for a Video Chat partner..."
        : "💬 Searching for a Text Chat partner..."
    );

    try {
      if (!socketRef.current || !socketRef.current.connected) {
        socketRef.current = io(backendUrl, {
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 800,
        });
      }

      const token =
        (typeof window !== "undefined" && localStorage.getItem("token")) || "";

      socketRef.current.off("partnerFound");
      socketRef.current.off("partnerDisconnected");
      socketRef.current.off("connect_error");

      socketRef.current.emit("lookingForPartner", { type, token });

      socketRef.current.on("partnerFound", (data) => {
        partnerRef.current = data?.partner || {};
        if (typeof window !== "undefined") {
          sessionStorage.setItem("partnerData", JSON.stringify(partnerRef.current));
          sessionStorage.setItem("roomCode", data?.roomCode || "");
        }
        setStatusMessage("💖 Milan Successful!");
        setTimeout(() => {
          if (typeof window !== "undefined") {
            window.location.href = type === "video" ? "/video" : "/chat";
          }
        }, 900);
      });

      socketRef.current.on("partnerDisconnected", () => {
        alert("Partner disconnected.");
        stopSearch();
      });

      socketRef.current.on("connect_error", (err) => {
        console.warn("Socket connect_error:", err?.message || err);
        alert("Connection error. Please try again.");
        stopSearch();
      });
    } catch (e) {
      console.error("Socket error:", e);
      alert("Something went wrong starting the search.");
      stopSearch();
    } finally {
      setTimeout(() => {
        connectingRef.current = false;
      }, 300);
    }
  }

  function stopSearch() {
    if (socketRef.current) {
      try {
        socketRef.current.emit("disconnectByUser");
        socketRef.current.disconnect();
      } catch {}
      socketRef.current = null;
    }
    setIsSearching(false);
    setShowLoader(false);
    setShowModeButtons(true);
    setModeText("");
    setStatusMessage("❤️ जहाँ दिल मिले, वहीं होती है शुरुआत Milan की…");
  }

  // -----------------------------
  // Avatar
  // -----------------------------
  function Avatar() {
    if (profile.photoDataUrl) {
      return (
        <img
          src={profile.photoDataUrl}
          alt="avatar"
          style={{
            width: 70,
            height: 70,
            borderRadius: "50%",
            objectFit: "cover",
          }}
        />
      );
    }
    const first =
      (profile.name && profile.name.trim().charAt(0).toUpperCase()) || "M";
    return (
      <div
        aria-label={`avatar ${first}`}
        style={{
          width: 70,
          height: 70,
          borderRadius: "50%",
          background: "#ec4899",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          fontWeight: 700,
          color: "#fff",
        }}
      >
        {first}
      </div>
    );
  }

  // Save personal info
  function handleSavePersonal(e) {
    e.preventDefault();
    const f = e.currentTarget;
    const name = f.fullname.value.trim();
    const contact = f.contact.value.trim();
    if (!name) {
      alert("Please enter name.");
      return;
    }
    saveProfile({ name, contact });
  }

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <>
      {/* canvas hearts */}
      <canvas id="heartCanvas" aria-hidden />

      {/* hamburger for mobile */}
      <button
        type="button"
        className="hamburger"
        aria-label="Toggle menu"
        onClick={() => setSidebarOpen((s) => !s)}
      >
        ☰
      </button>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`} aria-hidden={false}>
        <div className="sidebar-top">
          <div className="profile-pic-wrapper">
            <Avatar />
          </div>
          <div className="username">{profile.name || "My Name"}</div>

          <div style={{ marginTop: 8 }}>
            <label htmlFor="photoInput" className="photo-label">
              Change / Add Photo
            </label>
            <input
              id="photoInput"
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              style={{ display: "none" }}
            />
          </div>
        </div>

        <ul className="sidebar-list">
          <li role="button" onClick={openProfilePanel}>
            <span>👤</span>
            <span>Profile Info</span>
          </li>
          <li role="button" onClick={openSecurityPanel}>
            <span>🔒</span>
            <span>Security</span>
          </li>
          <li role="button" onClick={openLogoutConfirm}>
            <span>🚪</span>
            <span>Logout</span>
          </li>
        </ul>
      </aside>

      {/* Main content */}
      <main className="content-wrap" role="main">
        <div className="glass-card">
          <div className="center-box">
            <div className="center-top">
              <h2>Select Milan Mode</h2>
              <div className="mode-text" id="modeText">
                {modeText}
              </div>
            </div>

            {/* Mode options */}
            <div className="mode-options" aria-live="polite">
              {/* Video card (no images) */}
              {showModeButtons && (
                <div
                  className="mode-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => startSearch("video")}
                  onKeyDown={(e) => e.key === "Enter" && startSearch("video")}
                  id="videoBtn"
                  aria-label="Start Video Chat"
                >
                  <div className="mode-title">🎥 Video Chat</div>
                  <p className="mode-desc">
                    Meet face-to-face instantly in Milan’s romantic video room.
                  </p>
                  <button className="mode-btn" type="button">
                    Start Video Chat ❤️
                  </button>
                </div>
              )}

              {/* Text card (no images) */}
              {showModeButtons && (
                <div
                  className="mode-card disabled-card"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && null}
                  id="textBtn"
                  aria-label="Start Text Chat"
                >
                  <div className="mode-title">💌 Text Chat</div>
                  <p className="mode-desc">
                    Express your feelings through sweet and romantic messages.
                  </p>
                  <button className="mode-btn disabled" type="button" disabled>
                    Coming Soon
                  </button>
                  <div className="disabled-note">Text Chat on the way…</div>
                </div>
              )}
            </div>

            {/* Loader */}
            {showLoader && (
              <div id="loader" className="loader" aria-live="assertive">
                <div id="statusMessage" className="heart-loader">
                  {statusMessage}
                </div>
              </div>
            )}

            {/* Stop searching */}
            {isSearching && (
              <button id="stopBtn" className="stop-btn" onClick={stopSearch} type="button">
                Stop Searching
              </button>
            )}

            <div className="quote-box" id="quoteBox">
              {statusMessage}
              <span
                style={{
                  display: "block",
                  fontSize: 14,
                  marginTop: 6,
                  opacity: 0.95,
                }}
              >
                (Where hearts meet, that’s where Milan begins…)
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Panels */}
      {showProfile && (
        <div className="panel" role="dialog" aria-modal="true">
          <h3>Personal Info</h3>
          <form onSubmit={handleSavePersonal}>
            <input
              name="fullname"
              placeholder="Full Name"
              defaultValue={profile.name}
              aria-label="Full Name"
            />
            <input
              name="contact"
              placeholder="Email or Mobile"
              defaultValue={profile.contact}
              aria-label="Contact"
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="save-btn">
                Save
              </button>
              <button
                type="button"
                className="cancel-btn"
                onClick={() => setShowProfile(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showSecurity && (
        <div className="panel" role="dialog" aria-modal="true">
          <h3>Security</h3>
          <input
            type="password"
            placeholder="Current Password"
            value={currentPasswordInput}
            onChange={(e) => setCurrentPasswordInput(e.target.value)}
            aria-label="Current Password"
          />
          <input
            type="password"
            placeholder="New Password"
            value={newPasswordInput}
            onChange={(e) => setNewPasswordInput(e.target.value)}
            aria-label="New Password"
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="save-btn" onClick={saveNewPassword} type="button">
              Save
            </button>
            <button
              className="cancel-btn"
              onClick={() => setShowSecurity(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="panel" role="dialog" aria-modal="true">
          <p style={{ marginBottom: 12 }}>Do you want to Logout?</p>
          <div style={{ display: "flex", gap: 12 }}>
            <label className="radio-label">
              <input type="radio" name="logout" onClick={handleLogoutConfirmYes} />{" "}
              Yes
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="logout"
                onClick={() => setShowLogoutConfirm(false)}
              />{" "}
              No
            </label>
          </div>
        </div>
      )}

      <style jsx global>{`
        /* Base */
        html,
        body {
          margin: 0;
          padding: 0;
          height: 100%;
          font-family: "Poppins", sans-serif;
          background: radial-gradient(1200px 800px at 70% 10%, #ff7ab3 0%, transparent 60%),
            linear-gradient(135deg, #8b5cf6, #ec4899);
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

        /* Hamburger (mobile) */
        .hamburger {
          display: none;
          position: fixed;
          top: env(safe-area-inset-top, 12px);
          left: 12px;
          font-size: 24px;
          color: white;
          z-index: 50;
          background: rgba(0, 0, 0, 0.25);
          padding: 8px 10px;
          border-radius: 6px;
          cursor: pointer;
          user-select: none;
          border: 0;
        }

        /* Sidebar */
        .sidebar {
          position: fixed;
          top: 0;
          left: 0;
          width: 220px;
          height: 100%;
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(12px);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 36px;
          z-index: 40;
          color: white;
          transition: transform 0.28s ease;
        }
        .sidebar.open {
          transform: translateX(0);
        }
        .profile-pic-wrapper {
          width: 70px;
          height: 70px;
          border-radius: 50%;
          overflow: hidden;
        }
        .username {
          margin-top: 6px;
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          text-align: center;
          padding: 6px 10px;
        }
        .photo-label {
          font-size: 13px;
          color: #fff;
          background: rgba(0, 0, 0, 0.18);
          padding: 6px 10px;
          border-radius: 8px;
          cursor: pointer;
          display: inline-block;
          margin-top: 6px;
        }

        .sidebar-list {
          list-style: none;
          padding: 0;
          margin-top: 26px;
          width: 100%;
        }
        .sidebar-list li {
          display: flex;
          align-items: center;
          gap: 12px;
          justify-content: flex-start;
          padding: 12px 18px;
          margin: 8px 12px;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          cursor: pointer;
        }

        /* Content area */
        .content-wrap {
          position: fixed;
          top: 0;
          left: 220px;
          right: 0;
          bottom: 0;
          display: grid;
          place-items: center;
          padding: 12px;
          z-index: 10;
        }

        /* Glass card (auto height/width) */
        .glass-card {
          width: min(100%, 980px);
          max-height: calc(100vh - 48px);
          background: rgba(255, 255, 255, 0.14);
          border: 1.5px solid rgba(255, 255, 255, 0.28);
          border-radius: 20px;
          backdrop-filter: blur(18px);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25),
            inset 0 0 60px rgba(255, 255, 255, 0.06);
          padding: 22px;
        }

        .center-box {
          width: 100%;
          color: #fff;
          text-align: center;
          z-index: 12;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 18px;
        }

        .center-box h2 {
          font-size: 34px;
          margin: 0;
          font-weight: 700;
          letter-spacing: 0.3px;
          text-shadow: 0 0 10px #ec4899;
        }
        .mode-text {
          color: #ffe4f1;
          font-weight: 600;
          min-height: 22px;
          margin-top: 6px;
        }

        .mode-options {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: stretch;
          gap: 18px;
          flex-wrap: nowrap;
        }

        .mode-card {
          flex: 1 1 320px;
          max-width: 440px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 16px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
          transition: transform 0.22s ease, box-shadow 0.22s ease, border 0.22s ease;
          outline: none;
          box-sizing: border-box;
        }
        .mode-card:hover {
          transform: translateY(-3px) scale(1.01);
          box-shadow: 0 14px 36px rgba(236, 72, 153, 0.35);
          border-color: rgba(255, 255, 255, 0.28);
        }

        .mode-title {
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 0.2px;
        }

        .mode-desc {
          color: rgba(255, 255, 255, 0.92);
          font-size: 14px;
          margin: 2px 0 6px 0;
        }

        .mode-btn {
          width: 100%;
          padding: 12px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #ffffff, #ffe6f2);
          color: #ec4899;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 6px 18px rgba(236, 72, 153, 0.35);
          transition: transform 0.18s ease, box-shadow 0.18s ease;
          animation: softPulse 2.6s infinite ease-in-out;
        }
        .mode-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 22px rgba(236, 72, 153, 0.45);
        }
        .mode-btn.disabled {
          cursor: not-allowed;
          opacity: 0.7;
          box-shadow: none;
          animation: none;
        }

        @keyframes softPulse {
          0% { box-shadow: 0 6px 18px rgba(236, 72, 153, 0.28); }
          50% { box-shadow: 0 10px 26px rgba(236, 72, 153, 0.48); }
          100% { box-shadow: 0 6px 18px rgba(236, 72, 153, 0.28); }
        }

        .disabled-note {
          margin-top: 4px;
          font-size: 13px;
          color: #ffe4f1;
          font-style: italic;
        }

        .loader { margin: 8px auto; }
        .heart-loader {
          font-size: 28px;
          color: #fff;
          animation: blink 1s infinite;
        }
        @keyframes blink {
          0%   { opacity: 0.25; transform: scale(1); }
          50%  { opacity: 1;    transform: scale(1.1); }
          100% { opacity: 0.25; transform: scale(1); }
        }

        .stop-btn {
          margin-top: 6px;
          padding: 10px 16px;
          background: #ff4d4f;
          color: #fff;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 700;
        }

        .quote-box {
          font-weight: 600;
          color: #ffeff7;
          text-shadow: 0 0 5px #ff88aa;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        /* Panels */
        .panel {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(255, 255, 255, 0.98);
          padding: 18px;
          border-radius: 12px;
          z-index: 60;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
          width: 320px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .save-btn,
        .cancel-btn {
          padding: 10px 12px;
          border-radius: 10px;
          border: 0;
          font-weight: 700;
          cursor: pointer;
        }
        .save-btn { background: #ec4899; color: #fff; }
        .cancel-btn { background: #eee; }

        /* Responsive */
        @media (max-width: 1024px) {
          .glass-card { padding: 18px; }
        }
        @media (max-width: 768px) {
          .hamburger { display: block; }
          .sidebar { transform: translateX(-100%); width: 200px; }
          .sidebar.open { transform: translateX(0); }

          .content-wrap { left: 0; padding: 10px; }
          .glass-card { width: 100%; border-radius: 16px; }

          .center-box { gap: 14px; }
          .center-box h2 { font-size: 24px; }

          .mode-options {
            flex-direction: column;
            gap: 12px;
          }
          .mode-card {
            width: 100%;
            max-width: 100%;
            padding: 14px;
          }
          .mode-btn { font-size: 15px; padding: 11px; }
          .quote-box { font-size: 13px; padding: 9px 10px; }
        }
      `}</style>
    </>
  );
}
