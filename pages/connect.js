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
    photoDataUrls: [], // up to 3
    interests: [], // array of strings
    age: "",
    city: "",
    language: "",
    bio: "",
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

  // Rotating quotes (every 5s)
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

  // Sockets
  const socketRef = useRef(null);
  const partnerRef = useRef(null);
  const connectingRef = useRef(false);

  // Resolve backend URL once (safe SSR-friendly)
  const backendUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_BACKEND_URL || "https://milan-j9u9.onrender.com";
  }, []);

  // Load profile from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("milan_profile");
      if (saved) {
        const parsed = JSON.parse(saved);
        // ensure arrays exist
        parsed.photoDataUrls = Array.isArray(parsed.photoDataUrls) ? parsed.photoDataUrls : [];
        parsed.interests = Array.isArray(parsed.interests) ? parsed.interests : [];
        setProfile((p) => ({ ...p, ...parsed }));
      } else {
        // fallback to registration values if present
        const registeredName = localStorage.getItem("registered_name") || "";
        const registeredContact = localStorage.getItem("registered_contact") || "";
        setProfile((p) => ({ ...p, name: registeredName, contact: registeredContact }));
      }
    } catch (e) {
      console.warn("Error reading profile from localStorage", e);
    }
  }, []);

  // ---------------------------
  // Hearts background (canvas)
  // ---------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = document.getElementById("heartCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let hearts = [];
    let rafId = null;
    let cssW = window.innerWidth;
    let cssH = window.innerHeight;
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    function resizeCanvas() {
      cssW = window.innerWidth;
      cssH = window.innerHeight;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function createHeart() {
      const smallMode = cssW < 760;
      const size = smallMode ? Math.random() * 14 + 6 : Math.random() * 18 + 8;
      return {
        x: Math.random() * cssW,
        y: cssH + (smallMode ? 30 : 50),
        size,
        speed: smallMode ? Math.random() * 0.9 + 0.3 : Math.random() * 1.4 + 0.4,
        color: smallMode
          ? ["#ff7a9a", "#ff6b81", "#ff9fb0"][Math.floor(Math.random() * 3)]
          : ["#ff4d6d", "#ff1c68", "#ff6b81", "#e6005c"][Math.floor(Math.random() * 4)],
        rot: Math.random() * Math.PI * 2,
      };
    }

    function drawHearts() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      hearts.forEach((h) => {
        ctx.save();
        ctx.translate(h.x, h.y);
        ctx.rotate(Math.sin(h.y / 50) * 0.03);
        ctx.fillStyle = h.color;
        ctx.beginPath();
        const s = h.size;
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(s / 2, -s, s * 1.5, s / 3, 0, s);
        ctx.bezierCurveTo(-s * 1.5, s / 3, -s / 2, -s, 0, 0);
        ctx.fill();
        ctx.restore();

        h.x += Math.sin(h.y / 40) * 0.5;
        h.y -= h.speed;
      });

      hearts = hearts.filter((h) => h.y + h.size > -20);

      const smallMode = cssW < 760;
      const spawnProb = smallMode ? 0.045 : 0.09;
      if (Math.random() < spawnProb) hearts.push(createHeart());

      if (smallMode && hearts.length > 70) hearts = hearts.slice(-70);
      if (!smallMode && hearts.length > 220) hearts = hearts.slice(-220);

      rafId = requestAnimationFrame(drawHearts);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    drawHearts();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resizeCanvas);
      try {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } catch (e) {}
    };
  }, []);

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        try {
          socketRef.current.removeAllListeners && socketRef.current.removeAllListeners();
          socketRef.current.disconnect && socketRef.current.disconnect();
        } catch (e) {}
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
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [isSearching]);

  // UI Actions
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

  // Save profile to localStorage (centralized)
  function saveProfile(updated) {
    const newProfile = { ...profile, ...updated };
    setProfile(newProfile);
    if (typeof window !== "undefined") {
      localStorage.setItem("milan_profile", JSON.stringify(newProfile));
    }
    setShowProfile(false);
  }

  // Photo upload -> data URL (allow up to 3)
  async function handleAddPhoto(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = function (ev) {
      const dataUrl = ev.target.result;
      const next = [...(profile.photoDataUrls || [])];
      if (next.length >= 3) {
        alert("Maximum 3 photos allowed. Remove one to add a new.");
        return;
      }
      next.push(dataUrl);
      saveProfile({ photoDataUrls: next });
    };
    reader.readAsDataURL(file);
    // reset input
    e.target.value = "";
  }

  function removePhoto(index) {
    const next = [...(profile.photoDataUrls || [])];
    next.splice(index, 1);
    saveProfile({ photoDataUrls: next });
  }

  // Security (frontend-only)
  function saveNewPassword(e) {
    e && e.preventDefault && e.preventDefault();
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

  // Start / Stop Search
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
          reconnectionAttempts: 10,
          reconnectionDelay: 800,
        });
      }

      const token =
        (typeof window !== "undefined" &&
          localStorage.getItem("token")) ||
        "";

      socketRef.current.off && socketRef.current.off("partnerFound");
      socketRef.current.off && socketRef.current.off("partnerDisconnected");
      socketRef.current.off && socketRef.current.off("connect_error");

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
        socketRef.current.emit && socketRef.current.emit("disconnectByUser");
        socketRef.current.disconnect && socketRef.current.disconnect();
      } catch {}
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

  // Avatar helper (keeps same)
  function Avatar() {
    if (profile.photoDataUrls && profile.photoDataUrls.length) {
      return (
        <img
          src={profile.photoDataUrls[0]}
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

  // Save personal info from overlay form
  function handleSaveProfileForm(e) {
    e.preventDefault();
    const f = e.currentTarget;
    const name = f.fullname.value.trim();
    const contact = f.contact.value.trim();
    const age = f.age.value.trim();
    const city = f.city.value.trim();
    const language = f.language.value;
    const bio = f.bio.value.trim();
    // interests are managed via state, so we take from profile.interests
    if (!name) {
      alert("Please enter name.");
      return;
    }
    saveProfile({ name, contact, age, city, language, bio });
    alert("Profile saved.");
  }

  // Interests: add via input (Enter or comma) and show chips
  const [interestInput, setInterestInput] = useState("");
  function handleAddInterestFromInput(e) {
    const raw = interestInput.trim();
    if (!raw) return setInterestInput("");
    const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
    if (!parts.length) return setInterestInput("");
    const next = Array.from(new Set([...(profile.interests || []), ...parts])).slice(0, 12);
    saveProfile({ interests: next });
    setInterestInput("");
  }
  function removeInterest(idx) {
    const next = [...(profile.interests || [])];
    next.splice(idx, 1);
    saveProfile({ interests: next });
  }

  // Profile completeness calculation (weights)
  function calcCompleteness(p = profile) {
    let score = 0;
    // weights (sum to 100)
    // name: 18, contact: 12, age: 10, city: 10, language: 10, bio: 15, interests: 15, photos: 10
    if (p.name && p.name.trim()) score += 18;
    if (p.contact && p.contact.trim()) score += 12;
    if (p.age && String(p.age).trim()) score += 10;
    if (p.city && p.city.trim()) score += 10;
    if (p.language && p.language.trim()) score += 10;
    if (p.bio && p.bio.trim()) score += 15;
    if (Array.isArray(p.interests) && p.interests.length) score += 15;
    if (Array.isArray(p.photoDataUrls) && p.photoDataUrls.length) {
      score += Math.min(10, p.photoDataUrls.length * Math.ceil(10 / 3)); // up to 10
    }
    return Math.min(100, Math.round(score));
  }

  const completeness = calcCompleteness();

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

          {/* profile completeness mini */}
          <div className="completeness-mini" title={`${completeness}% complete`} style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.95)", fontWeight: 700 }}>
              Profile: {completeness}%
            </div>
            <div className="mini-progress" aria-hidden>
              <div className="mini-progress-bar" style={{ width: `${completeness}%` }} />
            </div>
          </div>

          {/* small preview of interests */}
          {profile.interests && profile.interests.length ? (
            <div className="interests-preview" title={profile.interests.join(", ")} style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.9)", textAlign: "center", maxWidth: 200 }}>
              {profile.interests.slice(0, 4).join(", ")}{profile.interests.length > 4 ? "…" : ""}
            </div>
          ) : null}

          <div style={{ marginTop: 8 }}>
            <label htmlFor="photoInput" className="photo-label" style={{ cursor: "pointer" }}>
              Change / Add Photo
            </label>
            <input
              id="photoInput"
              type="file"
              accept="image/*"
              onChange={handleAddPhoto}
              style={{ display: "none" }}
            />
          </div>
        </div>

        <ul className="sidebar-list">
          <li role="button" onClick={openProfilePanel} className="sidebar-item">
            <span className="sidebar-ic">👤</span>
            <span className="sidebar-txt">Profile Info</span>
          </li>
          <li role="button" onClick={openSecurityPanel} className="sidebar-item">
            <span className="sidebar-ic">🔒</span>
            <span className="sidebar-txt">Security</span>
          </li>
          <li role="button" onClick={openLogoutConfirm} className="sidebar-item">
            <span className="sidebar-ic">🚪</span>
            <span className="sidebar-txt">Logout</span>
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

            {/* Quotes just below buttons */}
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

      {/* PROFILE OVERLAY (transparent glass page) */}
      {showProfile && (
        <div
          className="profile-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            // close when clicking the overlay background
            if (e.target && e.target.classList && e.target.classList.contains("profile-overlay")) {
              setShowProfile(false);
            }
          }}
        >
          <div className="profile-card" role="region" aria-label="Edit Profile">
            <header className="profile-head">
              <h3>Edit Your Profile</h3>
              <button className="close" onClick={() => setShowProfile(false)} aria-label="Close">✕</button>
            </header>

            <form className="profile-body" onSubmit={handleSaveProfileForm}>
              <div className="row">
                <label>Full Name</label>
                <input name="fullname" placeholder="Full Name" defaultValue={profile.name} />
              </div>

              <div className="row two-col">
                <label>Contact (Email or Mobile)</label>
                <input name="contact" placeholder="Email or Mobile" defaultValue={profile.contact} />
              </div>

              <div className="row three-col">
                <div>
                  <label>Age</label>
                  <input name="age" type="number" min="13" placeholder="Age" defaultValue={profile.age} />
                </div>
                <div>
                  <label>City</label>
                  <input name="city" placeholder="City" defaultValue={profile.city} />
                </div>
                <div>
                  <label>Language</label>
                  <select name="language" defaultValue={profile.language || ""}>
                    <option value="">Select</option>
                    <option value="English">English</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Hinglish">Hinglish</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="row">
                <label>Short Bio (max 150 chars)</label>
                <textarea name="bio" maxLength={150} placeholder="A short intro about you..." defaultValue={profile.bio} />
                <div className="char-note">{(profile.bio || "").length}/150</div>
              </div>

              <div className="row">
                <label>Interests / Hobbies</label>
                <div className="interests-input">
                  <input
                    value={interestInput}
                    onChange={(e) => setInterestInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddInterestFromInput();
                      } else if (e.key === ",") {
                        e.preventDefault();
                        handleAddInterestFromInput();
                      }
                    }}
                    placeholder="Type and press Enter or comma (e.g. Music, Movies)"
                  />
                  <button type="button" className="btn-small" onClick={handleAddInterestFromInput}>Add</button>
                </div>
                <div className="chips">
                  {(profile.interests || []).map((it, idx) => (
                    <div className="chip" key={idx}>
                      {it}
                      <button type="button" aria-label={`Remove ${it}`} onClick={() => removeInterest(idx)}>✕</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="row">
                <label>Photos (1–3)</label>
                <div className="photo-row">
                  {(profile.photoDataUrls || []).map((p, i) => (
                    <div className="photo-thumb" key={i}>
                      <img src={p} alt={`photo-${i}`} />
                      <button type="button" className="remove-photo" onClick={() => removePhoto(i)}>Remove</button>
                    </div>
                  ))}

                  {(profile.photoDataUrls || []).length < 3 && (
                    <div className="photo-add">
                      <label className="photo-add-label">
                        + Add Photo
                        <input type="file" accept="image/*" onChange={handleAddPhoto} style={{ display: "none" }} />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="row">
                <label>Profile Completeness</label>
                <div className="progress-wrap" aria-hidden>
                  <div className="progress-bar" style={{ width: `${completeness}%` }} />
                </div>
                <div style={{ marginTop: 6, fontSize: 13, color: "#333" }}>{completeness}% complete</div>
              </div>

              <div className="row actions">
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" className="btn-primary">Save Profile</button>
                  <button type="button" className="btn-ghost" onClick={() => setShowProfile(false)}>Cancel</button>
                </div>
                <div>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      // quick export
                      try {
                        const data = JSON.stringify(profile, null, 2);
                        const blob = new Blob([data], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "milan_profile.json";
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch (e) {
                        alert("Export failed");
                      }
                    }}
                  >
                    Export
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Security Modal */}
      {showSecurity && (
        <div className="modal-back" role="dialog" aria-modal="true" onClick={(e)=>{ if(e.target.classList.contains('modal-back')) setShowSecurity(false); }}>
          <div className="modal-card">
            <header className="modal-head">
              <h3>Security</h3>
              <button className="close" onClick={() => setShowSecurity(false)} aria-label="Close">✕</button>
            </header>
            <div className="modal-body">
              <label>Current Password</label>
              <input type="password" value={currentPasswordInput} onChange={(e)=>setCurrentPasswordInput(e.target.value)} />
              <label>New Password</label>
              <input type="password" value={newPasswordInput} onChange={(e)=>setNewPasswordInput(e.target.value)} />
              <div className="modal-actions">
                <button className="btn-primary" onClick={saveNewPassword}>Save</button>
                <button className="btn-ghost" onClick={() => setShowSecurity(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirm Modal */}
      {showLogoutConfirm && (
        <div className="modal-back" role="dialog" aria-modal="true" onClick={(e)=>{ if(e.target.classList.contains('modal-back')) setShowLogoutConfirm(false); }}>
          <div className="modal-card small">
            <header className="modal-head">
              <h3>Confirm Logout</h3>
              <button className="close" onClick={() => setShowLogoutConfirm(false)} aria-label="Close">✕</button>
            </header>
            <div className="modal-body">
              <p style={{margin:0, color:'#333'}}>Are you sure you want to logout?</p>
              <div className="modal-actions" style={{marginTop:12}}>
                <button className="btn-primary" onClick={handleLogoutConfirmYes}>Yes</button>
                <button className="btn-ghost" onClick={() => setShowLogoutConfirm(false)}>No</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        /* Basic page setup */
        html, body {
          margin: 0;
          padding: 0;
          height: 100%;
          font-family: "Poppins", sans-serif;
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          overflow: auto; /* allow background show & natural scrolling */
        }
        canvas {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 0;
          image-rendering: -webkit-optimize-contrast;
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
          width: 240px;
          height: 100%;
          background: rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(10px);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 38px;
          z-index: 40;
          color: white;
          transition: transform 0.28s ease;
        }
        .sidebar.open { transform: translateX(0); }
        .profile-pic-wrapper { width: 78px; height: 78px; border-radius: 50%; overflow: hidden; box-shadow: 0 6px 18px rgba(0,0,0,0.25); }
        .username {
          margin-top: 8px;
          font-size: 18px; /* bigger & attractive */
          font-weight: 800;
          color: #fff;
          text-align: center;
          padding: 6px 12px;
          letter-spacing: 0.2px;
        }
        .photo-label {
          font-size: 13px;
          color: #fff;
          background: linear-gradient(90deg, rgba(255,107,129,0.12), rgba(255,159,176,0.08));
          padding: 6px 12px;
          border-radius: 10px;
          cursor: pointer;
          display: inline-block;
          margin-top: 8px;
        }

        .interests-preview { opacity: 0.95; }

        .sidebar-list { list-style: none; padding: 0; margin-top: 26px; width: 100%; }
        .sidebar-list li {
          display: flex;
          align-items: center;
          gap: 12px;
          justify-content: flex-start;
          padding: 12px 16px;
          margin: 8px 12px;
          background: linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
          border-radius: 12px;
          cursor: pointer;
          transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
        }
        .sidebar-item:hover {
          transform: translateX(6px);
          box-shadow: 0 10px 28px rgba(0,0,0,0.22);
          background: linear-gradient(90deg, rgba(255,107,129,0.04), rgba(255,159,176,0.02));
        }
        .sidebar-ic { font-size: 18px; display:inline-block; width:22px; text-align:center; }
        .sidebar-txt { font-size: 17px; font-weight:800; color:#fff; }

        .btn-cancel-deact { background: transparent; border: 1px solid rgba(255,255,255,0.12); color: #fff; border-radius: 8px; padding: 6px 8px; cursor: pointer; font-weight:700; font-size:12px; }

        /* Content area - FIXED: center correctly on desktop */
        .content-wrap {
          margin-left: 240px; /* leave space for sidebar */
          min-height: 100vh;  /* ensure full viewport height */
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          z-index: 10;
          position: relative;
        }

        /* Glass card (NOW auto-height & compact width) */
        .glass-card {
          width: min(100%, 820px);
          background: rgba(255, 255, 255, 0.06); /* more transparent to reveal hearts */
          border-radius: 18px;
          backdrop-filter: blur(10px);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.20);
          display: block;
          padding: 12px;
        }

        /* center-box layout compact */
        .center-box {
          width: 100%;
          color: #fff;
          text-align: center;
          z-index: 12;
          display: flex;
          flex-direction: column;
          gap: 8px;
          box-sizing: border-box;
          padding: 6px 6px;
        }

        .center-top { margin-bottom: 2px; }
        .center-box h2 {
          font-size: 34px;
          margin: 6px 0 4px 0;
          font-weight: 800;
          text-shadow: 0 0 12px rgba(236,72,153,0.16);
        }

        .mode-text {
          color: #ffe4f1;
          font-weight: 700;
          margin-bottom: 6px;
          min-height: 20px;
        }

        .mode-options {
          display: flex;
          justify-content: center;
          gap: 10px;
          align-items: stretch;
          flex-wrap: nowrap;
          margin-top: 6px;
        }

        .mode-card,
        .disabled-card {
          flex: 1 1 260px;
          max-width: 420px;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 12px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
          transition: transform 0.18s ease, box-shadow 0.18s ease;
          outline: none;
          box-sizing: border-box;
          min-height: 120px; /* smaller min-height so card doesn't appear too tall */
        }
        .mode-card:active { transform: translateY(1px); }
        .mode-card:hover { transform: translateY(-3px); box-shadow: 0 14px 36px rgba(0,0,0,0.18); }

        .mode-btn {
          width: 92%;
          padding: 10px 12px;
          border-radius: 10px;
          border: none;
          background: #fff;
          color: #ec4899;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(236,72,153,0.06);
        }

        .mode-btn.disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .mode-desc {
          color: rgba(255, 255, 255, 0.92);
          font-size: 13px;
          margin-top: 4px;
          margin-bottom: 4px; /* reduce bottom gap */
        }

        .disabled-note {
          margin-top: 4px;
          font-size: 13px;
          color: #ffe4f1;
          font-style: italic;
        }

        .loader { margin: 6px auto; }
        .heart-loader {
          font-size: 26px;
          color: #fff;
          animation: blink 1s infinite;
        }
        @keyframes blink {
          0% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
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
          margin-top: 6px;
          font-weight: 700;
          color: #ffeff7;
          text-shadow: 0 0 6px rgba(255,136,170,0.12);
          padding: 8px 10px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          animation: quoteFade 0.35s ease;
        }
        @keyframes quoteFade {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* PROFILE OVERLAY (glass) */
        .profile-overlay {
          position: fixed;
          inset: 0;
          background: rgba(2,6,23,0.45);
          z-index: 120;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
        }
        .profile-card {
          width: min(920px, 96%);
          max-width: 920px;
          background: linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.92));
          border-radius: 12px;
          box-shadow: 0 18px 60px rgba(0,0,0,0.35);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .profile-head {
          display:flex;
          align-items:center;
          justify-content:space-between;
          padding: 14px 18px;
          background: linear-gradient(90deg, rgba(255,236,245,0.95), rgba(255,255,255,0.95));
          border-bottom: 1px solid rgba(0,0,0,0.04);
        }
        .profile-head h3 { margin:0; font-size:20px; color:#0b1220; font-weight:900; }
        .profile-head .close { background:transparent;border:0;font-size:18px;cursor:pointer;color:#666; }

        .profile-body { padding: 14px 18px 20px 18px; display:flex; flex-direction:column; gap:12px; color:#222; }
        .profile-body label { display:block; font-weight:700; color:#334; margin-bottom:6px; }
        .profile-body input, .profile-body select, .profile-body textarea { width:100%; padding:10px 12px; border-radius:8px; border:1px solid #e6e6e9; box-sizing:border-box; font-size:14px; }
        .profile-body textarea { min-height:80px; resize:vertical; }

        .row { width:100%; }
        .two-col { display:flex; gap:10px; }
        .three-col { display:flex; gap:10px; }
        .three-col > div { flex:1; }

        .interests-input { display:flex; gap:8px; align-items:center; }
        .interests-input input { flex:1; }
        .btn-small { background: linear-gradient(90deg,#ff6b81,#ff9fb0); color:#08121a; padding:8px 10px; border-radius:8px; border:none; font-weight:700; cursor:pointer; }

        .chips { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
        .chip { background:#fff; padding:6px 10px; border-radius:20px; display:flex; gap:8px; align-items:center; font-weight:700; box-shadow: 0 6px 18px rgba(0,0,0,0.06); }
        .chip button { background:transparent; border:0; cursor:pointer; color:#c33; font-weight:800; }

        .photo-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
        .photo-thumb { position:relative; width:84px; height:84px; border-radius:8px; overflow:hidden; background:#f3f3f3; display:flex; align-items:center; justify-content:center; box-shadow: 0 6px 18px rgba(0,0,0,0.06); }
        .photo-thumb img { width:100%; height:100%; object-fit:cover; }
        .photo-thumb .remove-photo { position:absolute; top:6px; right:6px; background: rgba(0,0,0,0.36); color:#fff; border:0; padding:6px 8px; border-radius:6px; cursor:pointer; }

        .photo-add { width:84px; height:84px; border-radius:8px; background:linear-gradient(90deg,#fff,#fff); display:flex; align-items:center; justify-content:center; box-shadow: 0 6px 18px rgba(0,0,0,0.04); }
        .photo-add-label { display:block; cursor:pointer; color:#ec4899; font-weight:800; }

        .progress-wrap { width:100%; height:12px; background: #f1f1f1; border-radius:8px; overflow:hidden; margin-top:6px; }
        .progress-bar { height:100%; background: linear-gradient(90deg,#ff6b81,#ff9fb0); width:0%; transition: width 260ms ease; }

        .actions { display:flex; align-items:center; justify-content:space-between; gap:12px; }

        /* Buttons used in overlays/modals */
        .btn-primary { background: linear-gradient(90deg,#ff6b81,#ff9fb0); color:#08121a; padding:10px 14px; border-radius:8px; border:none; font-weight:800; cursor:pointer; }
        .btn-ghost { background:#f3f4f6; color:#333; padding:10px 12px; border-radius:8px; border:none; cursor:pointer; }

        .modal-back {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(2,6,23,0.45);
          z-index: 80;
          padding: 12px;
        }
        .modal-card {
          width: 96%;
          max-width: 520px;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 18px 60px rgba(0,0,0,0.35);
          overflow: hidden;
        }
        .modal-card.small { max-width: 420px; }
        .modal-head { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; background: linear-gradient(90deg,#ffeef5,#fff); }
        .modal-head h3 { margin:0; font-size:18px; color:#08121a; font-weight:800; }
        .modal-head .close { background:transparent;border:0;font-size:18px;cursor:pointer;color:#666; }

        .modal-body { padding:14px 16px 18px 16px; color:#08121a; }
        .modal-body label { display:block; font-weight:700; color:#334; margin-top:8px; }
        .modal-body input { width:100%; padding:10px 12px; margin-top:8px; border-radius:8px; border:1px solid #e6e6e9; box-sizing:border-box; }

        .modal-actions { display:flex; gap:10px; justify-content:flex-end; margin-top:12px; }

        .mini-progress { width:140px; height:8px; background: rgba(255,255,255,0.08); border-radius:8px; margin-top:6px; overflow:hidden; }
        .mini-progress-bar { height:100%; background: linear-gradient(90deg,#ff6b81,#ff9fb0); width:0%; transition: width 280ms ease; }

        /* Responsive adjustments */
        @media (max-width: 1024px) {
          .glass-card { width: min(100%, 760px); }
        }

        @media (max-width: 768px) {
          /* show hamburger */
          .hamburger { display: block; }

          /* collapse sidebar */
          .sidebar { transform: translateX(-100%); width: 200px; }
          .sidebar.open { transform: translateX(0); }

          .content-wrap { left: 0; padding: 10px; margin-left: 0; }

          .glass-card { width: 98%; padding: 10px; border-radius: 14px; }

          .center-box h2 { font-size: 22px; margin: 4px 0 6px 0; }

          .mode-options {
            flex-direction: column;
            gap: 8px; /* reduced gap to tighten vertical spacing for mobile */
            margin-top: 6px;
            align-items: center;
          }
          .mode-card, .disabled-card {
            width: 96%;
            max-width: 96%;
            padding: 10px; /* compact padding for mobile */
            border-radius: 12px;
            min-height: 100px; /* even smaller mobile min-height */
          }

          .mode-btn { font-size: 15px; padding: 10px; }
          .mode-desc { font-size: 13px; margin-bottom: 6px; } /* ensure less extra space */
          .quote-box { font-size: 13px; padding: 8px; margin-bottom: 4px; }

          /* overlay card should be smaller on mobile */
          .profile-card { width: 96%; max-width: 680px; padding: 8px; }
          .three-col { flex-direction: column; }
          .two-col { flex-direction: column; }
        }
      `}</style>
    </>
  );
}
