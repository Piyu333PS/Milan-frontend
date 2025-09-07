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

  // Control primary CTA visibility with state (no DOM poking)
  const [showModeButtons, setShowModeButtons] = useState(true);

  // -----------------------------
  // NEW: Rotating quotes (every 5s)
  // -----------------------------
  const QUOTES = [
    "❤️ जहाँ दिल मिले, वहीं होती है शुरुआत Milan की…",
    "✨ हर chat के पीछे छुपी है एक नई कहानी…",
    "💬 शब्द कम हों या ज़्यादा, connection सच्चा होना चाहिए।",
    "🎥 नज़रें कह देती हैं जो लफ़्ज़ नहीं कह पाते।",
    "🌸 प्यार मिल जाए, तो सफ़र आसान लगने लगता है।",
  ];
  const [quoteIndex, setQuoteIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setQuoteIndex((i) => (i + 1) % QUOTES.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // -----------------------------
  // Sockets
  // -----------------------------
  const socketRef = useRef(null);
  const partnerRef = useRef(null);
  const connectingRef = useRef(false);

  // Resolve backend URL once (safe SSR-friendly)
  const backendUrl = useMemo(() => {
    // NEXT_PUBLIC_* variables are available on client when defined in env.
    return process.env.NEXT_PUBLIC_BACKEND_URL || "https://milan-j9u9.onrender.com";
  }, []);

  // -----------------------------
  // Load profile from localStorage
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
        setProfile((p) => ({
          ...p,
          name: registeredName,
          contact: registeredContact,
        }));
      }
    } catch (e) {
      console.warn("Error reading profile from localStorage", e);
    }
  }, []);

  // -----------------------------
  // Hearts background (canvas)
  // -----------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = document.getElementById("heartCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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
      if (!ctx) return;
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
      if (rafId) cancelAnimationFrame(drawHearts);
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
          // remove all listeners safely
          socketRef.current.removeAllListeners && socketRef.current.removeAllListeners();
          socketRef.current.disconnect && socketRef.current.disconnect();
        } catch (e) {
          // ignore
        }
        socketRef.current = null;
      }
    };
  }, []);

  // Disconnect socket when user hides tab for long (optional UX)
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => {
      if (
        document.visibilityState === "hidden" &&
        socketRef.current &&
        isSearching
      ) {
        try {
          socketRef.current.emit && socketRef.current.emit("disconnectByUser");
          socketRef.current.disconnect && socketRef.current.disconnect();
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
    return () =>
      document.removeEventListener("visibilitychange", onVisibility);
  }, [isSearching]);

  // -----------------------------
  // UI Actions
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

  // Save profile to localStorage
  function saveProfile(updated) {
    const newProfile = { ...profile, ...updated };
    setProfile(newProfile);
    if (typeof window !== "undefined") {
      localStorage.setItem("milan_profile", JSON.stringify(newProfile));
    }
    setShowProfile(false);
  }

  // Photo upload -> data URL
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

  // Security (frontend-only)
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

    // Ensure socket
    try {
      if (!socketRef.current || !socketRef.current.connected) {
        // Create socket and set options
        socketRef.current = io(backendUrl, {
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 800,
        });
      }

      const token =
        (typeof window !== "undefined" &&
          localStorage.getItem("token")) ||
        "";

      // Remove previous listeners to avoid duplicates
      socketRef.current.off && socketRef.current.off("partnerFound");
      socketRef.current.off && socketRef.current.off("partnerDisconnected");
      socketRef.current.off && socketRef.current.off("connect_error");

      // Emit lookingForPartner
      socketRef.current.emit("lookingForPartner", { type, token });

      // partnerFound
      socketRef.current.on("partnerFound", (data) => {
        partnerRef.current = data?.partner || {};
        if (typeof window !== "undefined") {
          sessionStorage.setItem(
            "partnerData",
            JSON.stringify(partnerRef.current)
          );
          sessionStorage.setItem("roomCode", data?.roomCode || "");
        }
        setStatusMessage("💖 Milan Successful!");
        // small delay for UX, but ensure we still have valid socket/session
        setTimeout(() => {
          if (typeof window !== "undefined") {
            // navigate to respective route (video/chat)
            window.location.href = type === "video" ? "/video" : "/chat";
          }
        }, 900);
      });

      // partnerDisconnected
      socketRef.current.on("partnerDisconnected", () => {
        alert("Partner disconnected.");
        stopSearch();
      });

      // basic connect error handling
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
      // Allow re-click after initial setup
      setTimeout(() => {
        connectingRef.current = false;
      }, 300);
    }
  }

  function stopSearch() {
    if (socketRef.current) {
      try {
        socketRef.current.emit && socketRef.current.emit("disconnectByUser");
        socketRef.current.disconnect && socketRef.current.disconnect();
      } catch {}
      // remove listeners to be safe
      try {
        socketRef.current.removeAllListeners && socketRef.current.removeAllListeners();
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
  // Avatar helper
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
      <aside
        className={`sidebar ${sidebarOpen ? "open" : ""}`}
        aria-hidden={false}
      >
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

      {/* Main content area */}
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
              {/* Video card */}
              {showModeButtons && (
                <div
                  className="mode-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => startSearch("video")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") startSearch("video");
                  }}
                  id="videoBtn"
                  aria-label="Start Video Chat"
                >
                  {/* removed pictures/illustrations intentionally */}
                  <button className="mode-btn" type="button">
                    Start Video Chat
                  </button>
                  <p className="mode-desc">
                    Meet face-to-face instantly in Milan’s romantic video room.
                  </p>
                </div>
              )}

              {/* Text card */}
              {showModeButtons && (
                <div
                  className="mode-card disabled-card"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                  }}
                  id="textBtn"
                  aria-label="Start Text Chat"
                >
                  {/* removed pictures/illustrations intentionally */}
                  <button className="mode-btn disabled" type="button" disabled>
                    Coming Soon
                  </button>
                  <p className="mode-desc">
                    Express your feelings through sweet and romantic messages.
                  </p>
                  <div className="disabled-note">💌 Text Chat on the way…</div>
                </div>
              )}
            </div>

            {/* NEW: Quotes just below buttons */}
            <div className="quote-box" id="quoteBox">
              {QUOTES[quoteIndex]}
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

            {/* Loader (React driven) */}
            {showLoader && (
              <div id="loader" className="loader" aria-live="assertive">
                <div id="statusMessage" className="heart-loader">
                  {statusMessage}
                </div>
              </div>
            )}

            {/* Stop searching */}
            {isSearching && (
              <button
                id="stopBtn"
                className="stop-btn"
                onClick={stopSearch}
                type="button"
              >
                Stop Searching
              </button>
            )}
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
        /* Basic page setup */
        html,
        body {
          margin: 0;
          padding: 0;
          height: 100%;
          font-family: "Poppins", sans-serif;
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          overflow: hidden; /* we intentionally keep it hidden so everything fits on one screen */
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

        /* Glass card (NOW auto-height & compact width) */
        .glass-card {
          width: min(100%, 760px);
          background: rgba(255, 255, 255, 0.14);
          border: 2px solid rgba(255, 255, 255, 0.28);
          border-radius: 20px;
          backdrop-filter: blur(18px);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25),
            inset 0 0 60px rgba(255, 255, 255, 0.06);
          display: block;           /* was flex-center earlier */
          padding: 18px;
        }

        /* center-box layout compact */
        .center-box {
          width: 100%;
          color: #fff;
          text-align: center;
          z-index: 12;
          display: flex;
          flex-direction: column;
          gap: 14px;                /* natural spacing between blocks */
          box-sizing: border-box;
          padding: 6px 8px;
        }

        .center-top {
          margin-bottom: 2px;
        }

        .center-box h2 {
          font-size: 36px;
          margin: 6px 0 4px 0;
          font-weight: 700;
          text-shadow: 0 0 10px #ec4899;
        }

        .mode-text {
          color: #ffe4f1;
          font-weight: 600;
          margin-bottom: 6px;
          min-height: 22px;
        }

        .mode-options {
          display: flex;
          justify-content: center;
          gap: 16px;
          align-items: stretch;
          flex-wrap: nowrap;
          margin-top: 6px;
        }

        .mode-card,
        .disabled-card {
          flex: 1 1 300px;
          max-width: 420px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 14px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
          transition: transform 0.22s ease, box-shadow 0.22s ease;
          outline: none;
          box-sizing: border-box;
        }

        /* Removed .mode-animation blocks (images) */

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

        .mode-btn.disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .mode-desc {
          color: rgba(255, 255, 255, 0.9);
          font-size: 14px;
          margin-top: 4px;
        }

        .disabled-note {
          margin-top: 4px;
          font-size: 13px;
          color: #ffe4f1;
          font-style: italic;
        }

        .loader {
          margin: 6px auto;
        }
        .heart-loader {
          font-size: 30px;
          color: #fff;
          animation: blink 1s infinite;
        }
        @keyframes blink {
          0% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.12); }
          100% { opacity: 0.2; transform: scale(1); }
        }

        .stop-btn {
          margin-top: 6px;
          padding: 10px 16px;
          background: #ff4d4f;
          color: #fff;
          border: none;
          border-radius: 10px;
          cursor: pointer;
        }

        /* Quotes just below buttons */
        .quote-box {
          margin-top: 8px;
          font-weight: 600;
          color: #ffeff7;
          text-shadow: 0 0 5px #ff88aa;
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          animation: quoteFade 0.6s ease;
        }
        @keyframes quoteFade {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
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

        /* Responsive adjustments */
        @media (max-width: 1024px) {
          .glass-card {
            width: min(100%, 780px);
          }
        }

        @media (max-width: 768px) {
          /* show hamburger */
          .hamburger { display: block; }

          /* collapse sidebar */
          .sidebar {
            transform: translateX(-100%);
            width: 200px;
          }
          .sidebar.open { transform: translateX(0); }

          .content-wrap {
            left: 0;
            padding: 10px;
          }

          .glass-card {
            width: 100%;
            padding: 12px;
            border-radius: 16px;
          }

          .center-box h2 {
            font-size: 22px;
            margin: 4px 0 6px 0;
          }

          .mode-options {
            flex-direction: column;
            gap: 10px;
            margin-top: 6px;
            align-items: center;
          }
          .mode-card,
          .disabled-card {
            width: 94%;
            max-width: 94%;
            padding: 12px;
            border-radius: 12px;
            min-height: auto; /* compact cards */
          }

          .mode-btn {
            font-size: 15px;
            padding: 10px;
          }

          .mode-desc {
            font-size: 13px;
          }

          .quote-box {
            font-size: 13px;
            padding: 10px;
            margin-bottom: 4px;
          }
        }
      `}</style>
    </>
  );
}
