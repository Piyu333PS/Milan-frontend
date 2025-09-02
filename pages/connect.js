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
  // Sockets
  // -----------------------------
  const socketRef = useRef(null);
  const partnerRef = useRef(null);
  const connectingRef = useRef(false);

  // Resolve backend URL once
  const backendUrl = useMemo(
    () =>
      (typeof window !== "undefined" &&
        process.env.NEXT_PUBLIC_BACKEND_URL) ||
      "https://milan-j9u9.onrender.com",
    []
  );

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
        const registeredName =
          localStorage.getItem("registered_name") || "";
        const registeredContact =
          localStorage.getItem("registered_contact") || "";
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
        socketRef.current = io(backendUrl, {
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 800,
        });
      }

      const token =
        (typeof window !== "undefined" &&
          localStorage.getItem("token")) ||
        "";

      // Remove previous listeners to avoid duplicates
      socketRef.current.off("partnerFound");
      socketRef.current.off("partnerDisconnected");
      socketRef.current.off("connect_error");

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
        setTimeout(() => {
          if (typeof window !== "undefined") {
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
                  <div className="mode-animation video-animation" aria-hidden>
                    <svg
                      viewBox="0 0 64 48"
                      className="video-svg"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <rect
                        x="2"
                        y="8"
                        width="40"
                        height="32"
                        rx="6"
                        fill="#fff"
                        opacity="0.06"
                      />
                      <rect x="6" y="12" width="32" height="24" rx="5" fill="#fff" />
                      <path
                        d="M46 14 L62 6 L62 42 L46 34 Z"
                        fill="#ffd2e0"
                        opacity="0.9"
                      />
                      <circle cx="22" cy="24" r="6" fill="#ec4899" />
                    </svg>
                  </div>
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
                  className="mode-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => startSearch("text")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") startSearch("text");
                  }}
                  id="textBtn"
                  aria-label="Start Text Chat"
                >
                  <div className="mode-animation text-animation" aria-hidden>
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
                  <button className="mode-btn" type="button">
                    Start Text Chat
                  </button>
                  <p className="mode-desc">
                    Express your feelings through sweet and romantic messages.
                  </p>
                  <div className="disabled-note">💌 Text Chat on the way…</div>
                </div>
              )}
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
        /* Your full CSS here (same as original) */
      `}</style>
    </>
  );
}
