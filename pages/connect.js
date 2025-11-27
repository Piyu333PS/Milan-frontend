// pages/connect.js
"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import io from "socket.io-client";

const ENABLE_DIWALI = false;
const HUMAN_SEARCH_TIMEOUT = 12000; // 12 seconds
const VIDEO_EXTENDED_TIMEOUT = 20000; // 20 seconds for the cute message

export default function ConnectPage() {
  const [profile, setProfile] = useState({
    name: "",
    contact: "",
    photoDataUrls: [],
    interests: [],
    age: "",
    city: "",
    language: "",
    outerBio: "",
  });
  const [isSearching, setIsSearching] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "❤️ जहां दिल मिले, वहीं होती है शुरुआत Milan की…"
  );
  const [showWelcome, setShowWelcome] = useState(false);
  const [userName, setUserName] = useState("");
  // LOGOUT MODAL STATE
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  // AUTH STATE
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // AESTHETIC STATE
  const [onlineCount, setOnlineCount] = useState(120); // Static count for display

  const fwRef = useRef({ raf: null, burst: () => {}, cleanup: null });
  const socketRef = useRef(null);
  const partnerRef = useRef(null);
  const connectingRef = useRef(false);
  const searchTimerRef = useRef(null);
  const extendedTimerRef = useRef(null); // Ref for the 20s video message
  const searchTypeRef = useRef(null);

  const backendUrl = useMemo(
    () =>
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      "https://milan-j9u9.onrender.com",
    []
  );

  // 1. AUTHENTICATION GUARD & PROFILE LOAD
  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/";
      return;
    }
    
    setIsAuthenticated(true);

    try {
      const saved = localStorage.getItem("milan_profile");
      if (saved) {
        const p = JSON.parse(saved);
        setProfile((prev) => ({
          ...prev,
          ...p,
          photoDataUrls: Array.isArray(p.photoDataUrls) ? p.photoDataUrls : [],
          interests: Array.isArray(p.interests) ? p.interests : [],
        }));
      } else {
        setProfile((p) => ({
          ...p,
          name: localStorage.getItem("registered_name") || "",
          contact: localStorage.getItem("registered_contact") || "",
        }));
      }
    } catch (e) {
      console.error("Error loading profile:", e);
    }
    
    // Aesthetic: Initialize a dynamic looking count
    const countInterval = setInterval(() => {
        setOnlineCount(prev => {
            const change = Math.floor(Math.random() * 5) - 2; // change between -2 and +2
            const newCount = Math.min(Math.max(100, prev + change), 150);
            return newCount;
        });
    }, 5000); // Update count every 5 seconds
    
    return () => clearInterval(countInterval);
  }, []);

  // 2. WELCOME POPUP
  useEffect(() => {
    if (typeof window === "undefined" || !isAuthenticated) return;
    
    const isNewUser = sessionStorage.getItem("newUser");
    if (isNewUser === "true") {
      const name = sessionStorage.getItem("userName") || 
                   localStorage.getItem("registered_name") || 
                   "Friend";
      setUserName(name);
      setShowWelcome(true);
      sessionStorage.removeItem("newUser");
    }
  }, [isAuthenticated]);

  const handleStartJourney = () => {
    setShowWelcome(false);
  };

  // 3. HEARTS CANVAS ANIMATION
  useEffect(() => {
    if (showWelcome || !isAuthenticated) return;
    
    const cvs = document.getElementById("heartsCanvas");
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;

    let W, H, rafId;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    let items = [];

    function resize() {
      W = Math.round(window.innerWidth * dpr);
      H = Math.round(window.innerHeight * dpr);
      cvs.width = W;
      cvs.height = H;
      cvs.style.width = window.innerWidth + "px";
      cvs.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function spawn() {
      const small = window.innerWidth < 760;
      // Increased heart size and number slightly for aesthetic
      const size = (small ? 8 : 12) + Math.random() * (small ? 18 : 24);
      items.push({
        x: Math.random() * window.innerWidth,
        y: window.innerHeight + size,
        s: size,
        v: (small ? 0.6 : 1.0) + Math.random() * (small ? 0.8 : 1.0), // Slightly faster
        c: ["#ff6ea7", "#ff8fb7", "#ff4d6d", "#e6007a", "#ffc0cb"][
          Math.floor(Math.random() * 5)
        ],
        wobble: Math.random() * Math.PI * 2,
        alpha: 1,
      });
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < items.length; i++) {
        const h = items[i];
        ctx.save();
        ctx.globalAlpha = h.alpha * 0.95;
        ctx.translate(h.x, h.y);
        h.wobble += 0.025; // Slightly faster wobble
        ctx.rotate(Math.sin(h.wobble) * 0.08); // Slightly stronger rotation
        const s = h.s;
        ctx.fillStyle = h.c;
        ctx.beginPath();
        // Heart shape drawing
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(s / 2, -s, s * 1.5, s / 3, 0, s);
        ctx.bezierCurveTo(-s * 1.5, s / 3, -s / 2, -s, 0, 0);
        ctx.fill();
        ctx.restore();
        h.y -= h.v;
        h.alpha *= 0.996; // Slower fade
      }
      items = items.filter((h) => h.y + h.s > -40 && h.alpha > 0.06);
      if (Math.random() < (window.innerWidth < 760 ? 0.08 : 0.15)) spawn(); // Increased spawn rate
      rafId = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, [showWelcome, isAuthenticated]);

  // 4. FIREWORKS (Conditional)
  useEffect(() => {
    if (ENABLE_DIWALI && !showWelcome && isAuthenticated) {
      startFireworks();
      return stopFireworks;
    }
    return () => {};
  }, [showWelcome, isAuthenticated]);

  function startFireworks() {
    const cvs = document.getElementById("fxCanvas");
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    let W, H;
    let ents = [];

    function resize() {
      W = cvs.width = window.innerWidth;
      H = cvs.height = window.innerHeight;
    }
    window.addEventListener("resize", resize);
    resize();

    function rand(a, b) {
      return a + Math.random() * (b - a);
    }
    function hsv(h, s, v) {
      const f = (n, k = (n + h / 60) % 6) =>
        v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
      return `rgb(${(f(5) * 255) | 0},${(f(3) * 255) | 0},${(f(1) * 255) | 0})`;
    }
    function burst(x, y) {
      const n = 60 + ((Math.random() * 40) | 0);
      const hue = Math.random() * 360;
      for (let i = 0; i < n; i++) {
        const speed = rand(1.2, 3.2);
        const ang = ((Math.PI * 2) * i) / n + rand(-0.03, 0.03);
        ents.push({
          x,
          y,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed - rand(0.2, 0.6),
          life: rand(0.9, 1.4),
          age: 0,
          color: hsv(hue + rand(-20, 20), 0.9, 1),
          r: rand(1, 2.2),
        });
      }
    }

    function tick() {
      ctx.fillStyle = "rgba(10,7,16,.22)";
      ctx.fillRect(0, 0, W, H);

      if (Math.random() < 0.02) {
        burst(rand(W * 0.05, W * 0.95), rand(H * 0.12, H * 0.9));
      }

      const next = [];
      for (let i = 0; i < ents.length; i++) {
        const p = ents[i];
        p.age += 0.016;
        if (p.age < p.life) next.push(p);
      }
      ents = next;

      for (let i = 0; i < ents.length; i++) {
        const p = ents[i];
        p.vy += 0.5 * 0.016;
        p.x += p.vx;
        p.y += p.vy;
        const a = 1 - p.age / p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color
          .replace("rgb", "rgba")
          .replace(")", `,${a.toFixed(2)})`);
        ctx.fill();
      }
      fwRef.current.raf = requestAnimationFrame(tick);
    }
    tick();

    fwRef.current.cleanup = () => {
        if (fwRef.current.raf) {
            cancelAnimationFrame(fwRef.current.raf);
        }
        window.removeEventListener("resize", resize);
    };
  }
  function stopFireworks() {
    if (fwRef.current.cleanup) fwRef.current.cleanup();
  }

  // 5. AI CONNECTION FUNCTION
  function connectToAI(type) {
    sessionStorage.setItem("connectingToAI", "true");
    sessionStorage.setItem("aiChatType", type);
    
    const userGender = localStorage.getItem("gender") || "male";
    const userName = profile.name || localStorage.getItem("registered_name") || "Friend";
    
    // Aesthetic AI name logic
    const aiPartner = {
      isAI: true,
      name: userGender === "male" ? "Priya (AI Muse)" : "Rahul (AI Charm)",
      gender: userGender === "male" ? "female" : "male",
      age: "25",
      city: "Virtual Dreamscape",
      bio: "Hey! I'm your AI companion, crafted for perfect connection. Let's chat! 😊"
    };
    
    sessionStorage.setItem("partnerData", JSON.stringify(aiPartner));
    sessionStorage.setItem("roomCode", "AI_" + Date.now());
    
    setStatusMessage("💖 AI Partner Connected!");
    
    setTimeout(() => {
      window.location.href = type === "video" ? "/video" : "/chat";
    }, 500);
  }

  // 6. START SEARCH FUNCTION (Core Logic)
  function startSearch(type) {
    if (isSearching || connectingRef.current) return;
    connectingRef.current = true;
    searchTypeRef.current = type;
    setIsSearching(true);
    setShowLoader(true);
    setStatusMessage(
      type === "video"
        ? "🎥 Finding your video chat soulmate..."
        : "💬 Searching for a human partner..."
    );

    // Clear any existing timers
    if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
    }
    if (extendedTimerRef.current) {
        clearTimeout(extendedTimerRef.current);
        extendedTimerRef.current = null;
    }

    if (type === "video") {
        // Video Chat: Set a timeout to update the message after 20s (Extended Message)
        extendedTimerRef.current = setTimeout(() => {
            console.log("20 seconds elapsed - showing extended video message");
            setStatusMessage("Sit tight! Cupid is checking every corner of Milan for your perfect match! 🏹💖");
        }, VIDEO_EXTENDED_TIMEOUT);

        // Set a timer for the initial video chat message update (12s)
        searchTimerRef.current = setTimeout(() => {
            console.log(`${HUMAN_SEARCH_TIMEOUT / 1000} seconds elapsed - initial video check`);
            // VIDEO CHAT: Update status message after initial 12 seconds but keep searching.
            setStatusMessage("Hold on, real partners are taking a moment to connect. Searching continues... ⏳");
        }, HUMAN_SEARCH_TIMEOUT);

    } else {
        // TEXT CHAT: Set a single timer for AI fallback (12s)
        searchTimerRef.current = setTimeout(() => {
            console.log("12 seconds elapsed - text chat AI fallback");
            // TEXT CHAT: Fallback to AI
            setStatusMessage("💔 No human partner found. Connecting you with AI...");
            
            if (socketRef.current && socketRef.current.connected) {
                try {
                    // Explicitly disconnect search socket before connecting to AI
                    socketRef.current.emit("stopLookingForPartner");
                    socketRef.current.disconnect();
                } catch {}
            }
            
            setTimeout(() => {
                connectToAI(type);
            }, 1000);
        }, HUMAN_SEARCH_TIMEOUT);
    }

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
        (typeof window !== "undefined" && localStorage.getItem("token")) || "";

      if (socketRef.current && socketRef.current.off) {
        socketRef.current.off("partnerFound");
        socketRef.current.off("partnerDisconnected");
        socketRef.current.off("connect_error");
      }

      socketRef.current.emit("lookingForPartner", { type, token });

      socketRef.current.on("partnerFound", (data) => {
        try {
          if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current);
            searchTimerRef.current = null;
          }
          if (extendedTimerRef.current) {
            clearTimeout(extendedTimerRef.current);
            extendedTimerRef.current = null;
          }

          const roomCode = data && data.roomCode ? data.roomCode : "";
          partnerRef.current = data && data.partner ? data.partner : {};
          if (!roomCode) {
            setTimeout(() => stopSearch(), 800);
            return;
          }
          
          partnerRef.current.isAI = false;
          
          sessionStorage.setItem(
            "partnerData",
            JSON.stringify(partnerRef.current)
          );
          sessionStorage.setItem("roomCode", roomCode);
          localStorage.setItem("lastRoomCode", roomCode);
          setStatusMessage("💖 Human Partner Found!");
          setTimeout(() => {
            window.location.href = type === "video" ? "/video" : "/chat";
          }, 120);
        } catch {
          setTimeout(() => stopSearch(), 500);
        }
      });

      socketRef.current.on("partnerDisconnected", () => {
        if (searchTimerRef.current) {
          clearTimeout(searchTimerRef.current);
          searchTimerRef.current = null;
        }
        if (extendedTimerRef.current) {
            clearTimeout(extendedTimerRef.current);
            extendedTimerRef.current = null;
        }
        alert("Partner disconnected.");
        stopSearch();
      });

      socketRef.current.on("connect_error", () => {
        if (searchTimerRef.current) {
          clearTimeout(searchTimerRef.current);
          searchTimerRef.current = null;
        }
        if (extendedTimerRef.current) {
            clearTimeout(extendedTimerRef.current);
            extendedTimerRef.current = null;
        }
        alert("Connection error. Please try again.");
        stopSearch();
      });
    } catch {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
      if (extendedTimerRef.current) {
        clearTimeout(extendedTimerRef.current);
        extendedTimerRef.current = null;
      }
      alert("Something went wrong starting the search.");
      stopSearch();
    } finally {
      setTimeout(() => {
        connectingRef.current = false;
      }, 300);
    }
  }

  // 7. STOP SEARCH FUNCTION
  function stopSearch(shouldDisconnect = true) {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    if (extendedTimerRef.current) {
      clearTimeout(extendedTimerRef.current);
      extendedTimerRef.current = null;
    }

    if (shouldDisconnect && socketRef.current) {
      try {
        socketRef.current.emit("disconnectByUser");
        socketRef.current.disconnect();
      } catch {}
      try {
        if (socketRef.current.removeAllListeners) {
          socketRef.current.removeAllListeners();
        }
      } catch {}
      socketRef.current = null;
    }
    setIsSearching(false);
    setShowLoader(false);
    setStatusMessage("❤️ जहां दिल मिले, वहीं होती है शुरुआत Milan की…");
  }

  // 8. LOGOUT FUNCTIONS
  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    setShowLogoutModal(false);
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}

    window.location.href = "/";
  };

  const handleStayLoggedIn = () => {
    setShowLogoutModal(false);
  };


  const handleProfileClick = () => {
    window.location.href = "/profile";
  };

  // If user is not authenticated yet, return null or a simple loader to prevent UI flicker
  if (!isAuthenticated) {
    return (
        <div style={{ 
            background: '#08060c', 
            minHeight: '100vh', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#fff',
            fontSize: '24px'
        }}>
            Loading Milan... ❤️
        </div>
    );
  }

  return (
    <>
      <Head>
        <title>Milan – Connect</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Poppins:wght@300;400;600;700;900&display=swap"
          rel="stylesheet"
        />
      </Head>

      {/* Full Screen Welcome Popup */}
      {showWelcome && (
        <div className="welcome-fullscreen">
          <div className="welcome-content-wrapper">
            {/* Aesthetic Floating Hearts */}
            <div className="floating-hearts">
              <div className="float-heart heart-1">💕</div>
              <div className="float-heart heart-2">💖</div>
              <div className="float-heart heart-3">💗</div>
              <div className="float-heart heart-4">💓</div>
              <div className="float-heart heart-5">💘</div>
              <div className="float-heart heart-6">💞</div>
            </div>

            <div className="welcome-box">
              <div className="sparkles-top">
                <span className="sparkle">✨</span>
                <span className="sparkle big">💕</span>
                <span className="sparkle">✨</span>
              </div>
              
              <h1 className="welcome-heading">
                Welcome to Milan, <span className="user-name">{userName}</span>! 💕
              </h1>
              
              <p className="welcome-text">
                Tumhari love story yahan se shuru hoti hai. Ready? ✨
              </p>

              <div className="sparkles-bottom">
                <span className="sparkle-line">━━━━━</span>
                <span className="sparkle-heart">❤️</span>
                <span className="sparkle-line">━━━━━</span>
              </div>

              {/* Enhanced Start Journey Button */}
              <button className="start-journey-btn" onClick={handleStartJourney}>
                <span className="btn-sparkle">✨</span>
                <span className="btn-text">Start Milan Journey</span>
                <span className="btn-sparkle">✨</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="logout-modal-overlay" role="dialog" aria-modal="true">
          <div className="logout-modal">
            <div className="modal-content">
              <div className="heart-icon-large">💔</div>
              <h2 className="modal-heading-logout">
                Going so soon?
              </h2>
              
              <p className="modal-description-logout">
                Are you sure you want to logout?
                <br />
                We’ll miss your presence here on Milan ❤️
              </p>

              <div className="modal-actions">
                <button 
                  className="btn-stay-logged-in" 
                  onClick={handleStayLoggedIn}
                >
                  Stay Logged In
                </button>
                <button 
                  className="btn-logout-confirm" 
                  onClick={confirmLogout}
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Connect Page */}
      {!showWelcome && (
        <>
          {/* Logout Button */}
          <button 
            className="logout-btn"
            onClick={handleLogout} // Calls the function to show modal
            aria-label="Logout"
            title="Logout"
          >
            <svg viewBox="0 0 24 24" className="logout-icon" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
          </button>

          <div className="frame" aria-hidden />

          <canvas id="heartsCanvas" style={{position: 'fixed', inset: 0, zIndex: 1}} />
          <canvas
            id="fxCanvas"
            style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
          />

          <div className="brandBlock">
            {/* New Live Counter Strip */}
            <div className="live-counter-strip">
                <div className="dot"></div> {onlineCount}+ Hearts Online
            </div>

            <div className="heroBrand">Milan</div>
            <div className="brandTagline">
              Where hearts connect <span aria-hidden>❤️</span>
            </div>
          </div>

          <main className="heroWrap">
            
            <section
              className="featuresGrid"
              role="navigation"
              aria-label="Choose a mode"
            >
              {/* ROW 1 */}
              {/* PROFILE CARD - ENHANCED */}
              <article className="featureCard profile-card">
                <div className="profile-icon-wrapper">
                  <div className="profile-avatar">
                    {profile.name ? (
                      <span className="profile-initial">{profile.name.charAt(0).toUpperCase()}</span>
                    ) : (
                      <svg viewBox="0 0 24 24" className="profile-icon" fill="currentColor">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>
                    )}
                  </div>
                  <div className="profile-pulse-ring"></div>
                </div>
                
                <header>
                  <h3>Meri Kahaani</h3>
                  <p>Apni pehchaan banao. Dikhao tum kaun ho. ✨</p>
                </header>
                
                <button className="cta profile-cta" onClick={handleProfileClick}>
                  ✍️ Apna Profile Banao
                </button>
                
                {profile.name && (
                  <div className="profile-completion-hint">
                    <span className="hint-icon">👋</span>
                    <span className="hint-text">Namaste {profile.name}!</span>
                  </div>
                )}
              </article>

              {/* TEXT CHAT CARD - ENHANCED */}
              <article className="featureCard text">
                <header>
                  <h3>Text Chat</h3>
                  <p>Say hello. Trade vibes. Let the story find you.</p>
                </header>
                <button className="cta" onClick={() => startSearch("text")}>
                  💬 Start Text Chat
                </button>
              </article>

              {/* VIDEO CHAT CARD - ENHANCED */}
              <article className="featureCard video">
                <header>
                  <h3>Video Chat</h3>
                  <p>Face-to-face chemistry. Zero setup, all spark.</p>
                </header>
                <button className="cta" onClick={() => startSearch("video")}>
                  🎥 Start Video Chat
                </button>
              </article>
              
              {/* ROW 2 */}
              {/* AI STUDIO CARD - ENHANCED */}
              <article className="featureCard studio">
                <header>
                  <h3>Milan AI Studio</h3>
                  <p>Create dreamy prompts & reels—love, but make it aesthetic.</p>
                </header>
                <a href="/ai" className="cta">
                  🎨 Open AI Studio
                </a>
              </article>

              {/* INVITE LINK CARD - AESTHETICALLY DEGRADED (Coming Soon) */}
              <article className="featureCard invite coming-soon" style={{ gridColumn: 'span 2' }}>
                <div className="coming-soon-badge">
                  <span className="badge-sparkle">✨</span>
                  <span className="badge-text">Coming Soon</span>
                  <span className="badge-sparkle">✨</span>
                </div>
                <header>
                  <h3>Invite Link (Zero-DB)</h3>
                  <p>Share a link. Partner clicks. You're connected.</p>
                </header>
                <button className="cta disabled">
                  🔗 Create Invite Link
                </button>
                <div className="hover-message">
                  💕 Patience, love! This magical feature is almost ready to bring hearts together... 💕
                </div>
              </article>
            </section>

            {/* Search Loader Modal - ENHANCED */}
            {showLoader && isSearching && (
              <div className="search-modal-overlay" role="dialog" aria-modal="true">
                <div className="search-modal">
                  <div className="modal-content">
                    <h2 className="modal-heading">
                      💖 Your Milan story is about to begin…
                    </h2>
                    
                    <div className="heart-loader-container">
                      <div className="orbiting-hearts">
                        <div className="orbit-heart heart-1">💗</div>
                        <div className="orbit-heart heart-2">💕</div>
                        <div className="orbit-heart heart-3">💖</div>
                        <div className="orbit-heart heart-4">💓</div>
                        <div className="orbit-heart heart-5">💙</div>
                        <div className="orbit-heart heart-6">💞</div>
                      </div>
                      
                      <svg className="center-heart" viewBox="0 0 24 24" aria-hidden>
                        <defs>
                          <linearGradient id="heartGrad" x1="0" x2="1" y1="0" y2="1">
                            <stop offset="0%" stopColor="#ff6ea7" />
                            <stop offset="50%" stopColor="#ff9fb0" />
                            <stop offset="100%" stopColor="#ff6ea7" />
                          </linearGradient>
                        </defs>
                        <path 
                          fill="url(#heartGrad)" 
                          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.19C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                          className="heart-pulse"
                        />
                      </svg>
                    </div>

                    <p className="modal-description">
                      We're gently nudging hearts together – finding someone who vibes with your rhythm. Hold on, cupid is working his magic! 💘
                    </p>

                    <div className="status-text">{statusMessage}</div>

                    <button className="stop-search-btn" onClick={() => stopSearch(true)}>
                      <span className="btn-icon">✕</span>
                      <span className="btn-text">Stop Searching</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </>
      )}

      {/* COMPLETE CSS BLOCK (Enhanced Aesthetics) */}
      <style jsx>{`
        :root { --brandH: 140px; --bottomH: 60px; }
        *, *::before, *::after { box-sizing: border-box; min-width: 0; }
        
        /* THEME CHANGE: Deep Rose/Purple Background */
        html, body { 
            margin: 0; 
            padding: 0; 
            min-height: 100vh; 
            background: #1e082b; /* Deep Purple Base */
            color: #f7f7fb; 
            font-family: Poppins, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; 
        }
        body { 
            overflow-x: hidden; 
            overflow-y: auto; 
            background: linear-gradient(135deg, #120317 0%, #251030 100%); /* Gradient Added for depth */
        }
        
        /* Canvas for Floating Hearts */
        #heartsCanvas { 
            position: fixed; 
            inset: 0; 
            z-index: 1; 
            pointer-events: none; 
        }

        /* Frame (Border) - Made Glassy & Glowing */
        .frame {
          position: fixed;
          top: 10px;
          bottom: 10px;
          right: 10px;
          left: 10px;
          z-index: 2;
          pointer-events: none;
        }
        
        .frame::before {
          content: '';
          position: absolute;
          inset: 0;
          padding: 2px;
          /* Pink/Purple Gradient Border */
          background: linear-gradient(135deg, rgba(255,110,167,0.4), rgba(255,110,167,0.1) 40%, rgba(139,92,246,0.1));
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          border-radius: 18px;
          box-shadow: 0 0 40px rgba(255,110,167,0.3), 0 0 80px rgba(139,92,246,0.15); /* Stronger glow */
        }
        
        .frame::after {
          content: '';
          position: absolute;
          inset: 8px;
          border: 1px solid rgba(255,110,167,0.15); /* Slight pinkish border */
          border-radius: 14px;
          box-shadow: 0 0 20px rgba(255,110,167,0.1) inset;
        }
        
        /* Brand Styling */
        .brandBlock {
          position: relative; 
          /* FIXED: Ensure Milan is not cut off */
          padding-top: 45px; 
          margin: 0px auto 10px auto; 
          text-align: center;
          z-index: 3;
          pointer-events: none;
          width: 100%;
          padding-left: 20px;
          padding-right: 20px;
        }

        .heroBrand {
          font-family: 'Great Vibes', cursive;
          font-size: clamp(60px, 12vw, 116px);
          line-height: 1.02;
          /* Stronger Pink/Gold Gradient */
          background: linear-gradient(180deg, #ffd6ea 0%, #ff9fb0 48%, #ff6ea7);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow: 0 0 35px rgba(255, 110, 167, 0.4), 0 0 50px rgba(255, 110, 167, 0.2);
          white-space: nowrap;
        }

        /* NEW LIVE COUNTER STRIP */
        .live-counter-strip {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 5px 12px;
            margin-bottom: 5px;
            border-radius: 15px;
            background: rgba(255, 110, 167, 0.1);
            border: 1px solid rgba(255, 110, 167, 0.3);
            font-size: 14px;
            font-weight: 600;
            color: #a7ffb2;
            box-shadow: 0 0 10px rgba(167, 255, 178, 0.3);
            animation: gentlePulseGreen 2s infinite alternate;
        }

        @keyframes gentlePulseGreen {
            from { box-shadow: 0 0 10px rgba(167, 255, 178, 0.3); }
            to { box-shadow: 0 0 15px rgba(167, 255, 178, 0.5); }
        }

        .live-counter-strip .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #00ff80;
            box-shadow: 0 0 8px #00ff80;
            animation: liveBlink 1.5s infinite alternate;
        }
        /* END NEW LIVE COUNTER STRIP */
        
        .brandTagline {
            color: #d1d5db;
            font-weight: 300;
            font-size: clamp(14px, 4vw, 20px);
            margin-top: 2px;
        }
        
        .heroWrap {
            position: relative;
            z-index: 3;
            max-width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            padding: 10px 40px var(--bottomH);
        }
        
        /* Logout Button (Kept same) */
        .logout-btn {
          position: fixed;
          top: 25px;
          right: 25px;
          z-index: 1000;
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          /* Glassy Pink/Purple Background */
          background: linear-gradient(135deg, rgba(255, 110, 167, 0.25), rgba(139, 92, 246, 0.25));
          border: 2px solid rgba(255, 110, 167, 0.4);
          border-radius: 50%;
          cursor: pointer;
          backdrop-filter: blur(12px);
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 
            0 4px 20px rgba(255, 110, 167, 0.3),
            0 0 30px rgba(255, 110, 167, 0.15),
            inset 0 1px 1px rgba(255, 255, 255, 0.2);
          animation: gentlePulse 3s ease-in-out infinite;
        }

        .logout-btn:hover {
          transform: scale(1.1) rotate(-5deg);
        }

        .logout-icon {
          width: 24px;
          height: 24px;
          color: #ff6ea7;
        }

        @keyframes gentlePulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(255, 110, 167, 0.3), 0 0 30px rgba(255, 110, 167, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.2); }
          50% { box-shadow: 0 6px 25px rgba(255, 110, 167, 0.5), 0 0 40px rgba(255, 110, 167, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.3); }
        }

        /* --- FEATURE CARDS (Glassy Style) --- */
        .featuresGrid {
          width: min(920px, calc(100vw - 60px));
          grid-template-columns: repeat(3, minmax(200px, 1fr)); /* 3 columns for better layout */
          display: grid;
          gap: 20px; /* Increased gap */
          padding: 0 10px;
        }
        
        .featureCard {
          background: rgba(40, 15, 55, 0.5); /* Darker, more purple background */
          border: 1px solid rgba(255, 255, 255, 0.15); /* More visible border */
          border-radius: 20px; /* More rounded */
          padding: 22px; /* Increased padding */
          backdrop-filter: blur(14px); /* Stronger blur for glassy effect */
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
          position: relative;
          min-height: 220px; /* Increased min height */
          text-align: center;
          overflow: hidden; /* For inner animations */
        }
        
        .featureCard:hover {
          transform: translateY(-6px); 
          box-shadow: 0 24px 60px rgba(255, 110, 167, 0.3), 0 0 50px rgba(139,92,246,0.2); /* Pink/Purple Glow */
          border-color: rgba(255, 110, 167, 0.4);
        }

        .featureCard header h3 {
          font-family: 'Poppins', sans-serif;
          font-size: 20px;
          font-weight: 900;
          color: #fff;
        }

        .featureCard header p {
          font-size: 13px;
          color: #e5e7eb;
          opacity: 0.9;
        }
        
        /* Profile Card Specific Styles - Stronger Highlight */
        .featureCard.profile-card {
          grid-column: span 1; 
          border-color: #ffd700; /* Gold */
          background: linear-gradient(145deg, 
            rgba(255, 215, 0, 0.15) 0%, 
            rgba(255, 110, 167, 0.15) 100%);
        }
        
        .featureCard.profile-card:hover {
          box-shadow: 
            0 18px 56px rgba(255, 215, 0, 0.5),
            0 0 50px rgba(255, 110, 167, 0.4);
          border-color: #ffed4e;
        }
        
        .profile-icon-wrapper {
          position: relative;
          width: 60px;
          height: 60px;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .profile-avatar {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: #ffc0cb;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 700;
          color: #880e4f;
          border: 3px solid #ffd700; /* Gold border */
          z-index: 10;
        }
        
        .profile-icon {
          width: 24px;
          height: 24px;
          color: #880e4f;
        }
        
        .profile-pulse-ring {
            position: absolute;
            inset: -5px;
            border: 3px solid;
            border-radius: 50%;
            border-color: #ffd700 transparent #ffd700 transparent;
            animation: ringPulse 2.5s linear infinite;
        }
        
        @keyframes ringPulse {
            0% { transform: rotate(0deg) scale(0.9); opacity: 0.6; }
            50% { transform: rotate(180deg) scale(1.1); opacity: 1; }
            100% { transform: rotate(360deg) scale(0.9); opacity: 0.6; }
        }
        
        .profile-completion-hint {
            position: absolute;
            top: -10px;
            right: -10px;
            background: #ff6ea7;
            color: white;
            padding: 5px 10px;
            border-radius: 10px;
            font-size: 10px;
            font-weight: 700;
            white-space: nowrap;
            box-shadow: 0 4px 10px rgba(255, 110, 167, 0.5);
            animation: hintPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        
        @keyframes hintPop {
            0% { transform: scale(0.5) rotate(10deg); opacity: 0; }
            100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }

        /* Card Icons/Animations */
        
        /* Text Chat Animation: Subtle Pulsing Glow */
        .featureCard.text::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: inherit;
            background: radial-gradient(circle at 10% 10%, rgba(255, 110, 167, 0.2), transparent 70%);
            animation: textPulseGlow 3s infinite alternate;
            pointer-events: none;
            z-index: -1;
        }
        @keyframes textPulseGlow {
            from { opacity: 0.5; transform: scale(1); }
            to { opacity: 0.8; transform: scale(1.02); }
        }
        
        /* Video Chat Animation: Video Stream Flicker/Glow */
        .featureCard.video::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: inherit;
            background: radial-gradient(circle at 90% 90%, rgba(79, 255, 142, 0.1), transparent 70%);
            animation: videoGlow 2s infinite alternate;
            pointer-events: none;
            z-index: -1;
        }
        @keyframes videoGlow {
            0% { opacity: 0.3; }
            100% { opacity: 0.6; }
        }
        
        /* AI Studio Animation: Slow Rotating Shimmer */
        .featureCard.studio::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: inherit;
            background: conic-gradient(from 0deg, rgba(139, 92, 246, 0.05) 0deg, rgba(139, 92, 246, 0.2) 90deg, transparent 180deg);
            animation: studioShimmer 8s linear infinite;
            pointer-events: none;
            z-index: -1;
        }
        @keyframes studioShimmer {
            to { transform: rotate(360deg); }
        }


        /* Call To Action (CTA) Buttons - Added Subtle Glow */
        .cta {
          width: 100%;
          padding: 12px 18px;
          border-radius: 14px;
          font-weight: 900;
          font-size: 14px;
          text-transform: uppercase;
          background: linear-gradient(135deg, #ff6ea7 0%, #ff4d8d 100%);
          color: #fff;
          border: none;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(255, 79, 160, 0.4);
          position: relative;
          overflow: hidden;
          z-index: 1;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          text-decoration: none;
          display: block;
        }
        
        .cta:hover {
          transform: translateY(-3px);
          box-shadow: 0 14px 40px rgba(255, 79, 160, 0.6);
        }

        .cta:active {
            transform: translateY(-1px);
        }

        .cta.disabled {
            background: #4b4b4b;
            box-shadow: none;
            cursor: not-allowed;
            opacity: 0.7;
        }
        
        /* Coming Soon Card Aesthetic */
        .featureCard.coming-soon {
          background: rgba(100, 100, 100, 0.2);
          border-color: rgba(255, 255, 255, 0.08);
          filter: grayscale(80%) blur(1px); /* Slightly faded and blurred */
          pointer-events: all; /* Keep pointer events to show hover message */
        }
        
        .featureCard.coming-soon:hover {
            transform: none;
            box-shadow: 0 14px 44px rgba(0, 0, 0, 0.35); /* No glow effect on hover */
        }

        .coming-soon-badge {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 20;
            padding: 8px 15px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 900;
            color: white;
            /* Changed to purple badge for better aesthetics */
            background: linear-gradient(135deg, #8b5cf6, #c084fc); 
            box-shadow: 0 4px 16px rgba(139, 92, 246, 0.5);
            white-space: nowrap;
        }

        .hover-message {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(2px);
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 20px;
            border-radius: 20px;
            font-style: italic;
            font-size: 14px;
            opacity: 0;
            transition: opacity 0.3s;
            pointer-events: none;
        }

        .featureCard.coming-soon:hover .hover-message {
            opacity: 1;
        }

        /* --- SEARCH MODAL STYLES (Fixed Stop Button) --- */
        .search-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: grid;
          place-items: center;
          background: rgba(8, 6, 12, 0.95);
          backdrop-filter: blur(16px);
          animation: fadeIn 0.3s ease;
        }

        .search-modal {
          width: min(520px, calc(100% - 32px));
          /* Stronger Pink Glow */
          background: linear-gradient(145deg, 
            rgba(255, 110, 167, 0.18) 0%, 
            rgba(255, 159, 176, 0.12) 50%,
            rgba(255, 110, 167, 0.18) 100%); 
          border: 2px solid rgba(255, 110, 167, 0.4);
          border-radius: 30px;
          padding: 40px 32px;
          text-align: center;
          backdrop-filter: blur(12px);
          box-shadow: 
            0 35px 90px rgba(255, 79, 160, 0.5), /* Stronger shadow */
            inset 0 1px 1px rgba(255, 255, 255, 0.2);
          position: relative;
          overflow: hidden;
          animation: modalSlideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes modalSlideUp {
            0% { transform: translateY(50px) scale(0.9); opacity: 0; }
            100% { transform: translateY(0) scale(1); opacity: 1; }
        }

        .modal-heading {
          font-family: 'Poppins', sans-serif;
          font-size: 24px;
          font-weight: 700;
          color: #ffc0cb;
          margin-bottom: 20px;
        }
        
        .status-text {
          font-size: 16px;
          font-weight: 600;
          color: #ff6ea7;
          min-height: 20px;
          margin-bottom: 30px;
        }

        .stop-search-btn {
          /* Fixed styling for better visibility and interactive look */
          background: linear-gradient(135deg, #ff4d6d 0%, #ff6ea7 100%);
          border: 2px solid #ff4d6d;
          color: #fff;
          padding: 12px 30px;
          border-radius: 30px;
          font-weight: 800;
          letter-spacing: 0.5px;
          box-shadow: 0 5px 20px rgba(255, 79, 160, 0.7);
          transition: all 0.3s ease;
          width: 80%; /* Increased width for clickability */
          max-width: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stop-search-btn:hover {
          transform: translateY(-2px);
          background: linear-gradient(135deg, #ff6ea7 0%, #ff4d6d 100%);
          box-shadow: 0 10px 30px rgba(255, 79, 160, 0.9);
        }

        .btn-icon {
          font-size: 18px;
          margin-right: 8px;
        }

        /* --- LOGOUT MODAL STYLES --- */
        .logout-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: grid;
          place-items: center;
          background: rgba(8, 6, 12, 0.95);
          backdrop-filter: blur(16px);
          animation: fadeIn 0.3s ease;
        }

        .logout-modal {
          width: min(450px, calc(100% - 32px));
          /* Glassy Pink/Purple */
          background: linear-gradient(145deg, 
            rgba(255, 110, 167, 0.2) 0%, 
            rgba(255, 159, 176, 0.15) 50%,
            rgba(255, 110, 167, 0.2) 100%);
          border: 3px solid rgba(255, 110, 167, 0.4);
          border-radius: 32px;
          padding: 40px 32px;
          text-align: center;
          backdrop-filter: blur(12px);
          box-shadow: 
            0 40px 100px rgba(255, 110, 167, 0.4),
            0 0 80px rgba(255, 110, 167, 0.25),
            inset 0 2px 2px rgba(255, 255, 255, 0.2);
          position: relative;
          overflow: hidden;
          animation: modalSlideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .heart-icon-large {
            font-size: 3rem;
            margin-bottom: 10px;
            animation: pulse 1s infinite alternate;
        }

        .modal-heading-logout {
            font-size: 28px;
            font-weight: 900;
            color: #ffc0cb;
            margin-bottom: 10px;
        }

        .modal-description-logout {
            font-size: 16px;
            color: #bdbdbd;
            margin-bottom: 30px;
        }

        .modal-actions {
            display: flex;
            gap: 15px;
            justify-content: center;
        }

        .btn-stay-logged-in {
            padding: 12px 25px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 16px;
            background: linear-gradient(135deg, #ff6ea7 0%, #ff4d8d 100%);
            color: #fff;
            border: none;
            cursor: pointer;
            box-shadow: 0 8px 20px rgba(255, 79, 160, 0.4);
            transition: all 0.2s ease;
        }
        
        .btn-stay-logged-in:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(255, 79, 160, 0.6);
        }

        .btn-logout-confirm {
            padding: 12px 25px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 16px;
            background: none;
            border: 2px solid #ff6ea7;
            color: #ff6ea7;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .btn-logout-confirm:hover {
            background: #ff6ea7;
            color: #120317;
        }


        /* --- MEDIA QUERIES (Retained original structure for line count and responsiveness) --- */
        @media (max-width: 1024px) {
          .heroBrand {
            font-size: 10vw;
          }
        }
        
        @media (min-width: 761px) and (max-width: 1024px) {
          .welcome-box {
            padding: 55px 35px;
          }

          .heroWrap {
            padding: 20px 24px var(--bottomH);
          }

          .featuresGrid {
            width: calc(100vw - 80px);
            max-width: 880px;
            grid-template-columns: repeat(3, minmax(200px, 1fr));
          }
        }

        @media (max-width: 760px) {
            .featuresGrid {
                grid-template-columns: repeat(2, 1fr); /* Back to 2 columns on mobile */
                width: min(600px, calc(100vw - 40px));
                gap: 15px;
            }
            
            .featureCard {
                min-height: 190px;
                padding: 16px;
                grid-column: span 1;
            }
            
            .featureCard.profile-card {
                 grid-column: span 2; /* Profile spans both columns on small mobile */
            }

            .logout-btn {
                top: 15px;
                right: 15px;
                width: 40px;
                height: 40px;
            }

            .logout-icon {
                width: 20px;
                height: 20px;
            }

            .frame {
                top: 5px;
                bottom: 5px;
                right: 5px;
                left: 5px;
            }
            
            .frame::before {
                border-radius: 12px;
            }
            
            .frame::after {
                inset: 5px;
                border-radius: 9px;
            }

            .brandBlock {
                /* Adjusted for mobile - less top margin */
                margin: 30px auto 10px auto;
                padding-top: 25px; /* Less cutting risk */
            }
            
            .heroWrap {
                padding: 10px 20px var(--bottomH);
            }
            
            .welcome-box {
                padding: 40px 25px;
                border-radius: 20px;
            }
            
            .welcome-heading {
                font-size: 36px;
            }
            
            .start-journey-btn {
                padding: 12px 25px;
                font-size: 16px;
            }

            .modal-actions {
                flex-direction: column;
                gap: 10px;
            }

            .btn-stay-logged-in, .btn-logout-confirm {
                width: 100%;
            }
        }

        @media (max-width: 480px) {
            .featuresGrid {
                gap: 12px;
            }
            
            .featureCard {
                min-height: 170px;
                padding: 14px;
                border-radius: 16px;
            }
            
            .cta {
                padding: 10px 14px;
                font-size: 13px;
            }
            
            .welcome-heading {
                font-size: 30px;
            }
            
            .stop-search-btn {
                width: 90%;
            }
        }
        
        @media (max-width: 360px) {
          .profile-icon-wrapper {
            width: 50px;
            height: 50px;
            margin-bottom: 6px;
          }

          .profile-avatar {
            width: 40px;
            height: 40px;
          }

          .profile-initial {
            font-size: 18px;
          }

          .profile-icon {
            width: 20px;
            height: 20px;
          }

          .profile-pulse-ring {
            inset: -4px;
            border-width: 2px;
          }

          .profile-completion-hint {
            padding: 3px 6px;
            font-size: 8px;
            top: -6px;
            right: -6px;
          }

          .hint-icon {
            font-size: 10px;
          }

          .featureCard {
            min-height: 160px;
            padding: 10px 8px;
          }

          .welcome-box {
            padding: 30px 20px;
          }

          .welcome-heading {
            font-size: 26px;
          }

          .start-journey-btn {
            font-size: 14px;
          }
        }
      `}</style>
    </>
  );
}
