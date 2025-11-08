// pages/chat.js
// ✅ COMPLETE FILE - Token parsing + Friend Request System + AI Partner Support

import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import io from "socket.io-client";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "https://milan-j9u9.onrender.com";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const TARGET_IMAGE_SIZE = 800;
const IMAGE_QUALITY = 0.7;

const getAvatarForGender = (g) => {
  const key = String(g || "").toLowerCase();
  if (key === "male") return "/partner-avatar-male.png";
  if (key === "female") return "/partner-avatar-female.png";
  if (key === "ai") return "/partner-avatar.png"; // AI avatar
  return "/partner-avatar.png";
};

const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > TARGET_IMAGE_SIZE || height > TARGET_IMAGE_SIZE) {
          if (width > height) {
            height = (height / width) * TARGET_IMAGE_SIZE;
            width = TARGET_IMAGE_SIZE;
          } else {
            width = (width / height) * TARGET_IMAGE_SIZE;
            height = TARGET_IMAGE_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const reader2 = new FileReader();
              reader2.onload = () => resolve(reader2.result);
              reader2.onerror = reject;
              reader2.readAsDataURL(blob);
            } else {
              reject(new Error("Compression failed"));
            }
          },
          "image/jpeg",
          IMAGE_QUALITY
        );
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function ChatPage() {
  const [partnerName, setPartnerName] = useState("Partner");
  const [partnerAvatarSrc, setPartnerAvatarSrc] = useState("/partner-avatar.png");
  const [typing, setTyping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [msgs, setMsgs] = useState([]);
  const [roomCode, setRoomCode] = useState(null);
  const [partnerId, setPartnerId] = useState(null);
  const [partnerUserId, setPartnerUserId] = useState(null);
  const [isAiPartner, setIsAiPartner] = useState(false);

  const [emojiOpen, setEmojiOpen] = useState(false);
  const EMOJIS = ["😊", "❤️", "😂", "👍", "🔥", "😍", "🤗", "😘", "😎", "🥰"];

  const [showDisconnectAlert, setShowDisconnectAlert] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Friend Request States
  const [showFriendRequestPopup, setShowFriendRequestPopup] = useState(false);
  const [friendRequestData, setFriendRequestData] = useState(null);
  const [showResponsePopup, setShowResponsePopup] = useState(false);
  const [responseType, setResponseType] = useState('');
  const [celebrationActive, setCelebrationActive] = useState(false);
  const [floatingHearts, setFloatingHearts] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUsername, setCurrentUsername] = useState("");
  const [requestSending, setRequestSending] = useState(false);

  const socketRef = useRef(null);
  const msgRef = useRef(null);
  const fileRef = useRef(null);
  const listRef = useRef(null);
  const messageRefs = useRef({});
  const processedMsgIds = useRef(new Set());
  const partnerFoundRef = useRef(false);
  const isCleaningUp = useRef(false);

  const timeNow = () => {
    const d = new Date();
    const h = d.getHours() % 12 || 12;
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${h}:${m} ${d.getHours() >= 12 ? "PM" : "AM"}`;
  };
  const genId = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const escapeHtml = (s = "") =>
    s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const linkify = (text = "") =>
    text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  const scrollToBottom = () =>
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });

  const createFloatingHearts = (count) => {
    const hearts = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      size: 20 + Math.random() * 20
    }));
    setFloatingHearts(hearts);
    setTimeout(() => setFloatingHearts([]), 3000);
  };

  useEffect(() => {
    let localName = "";
    let localUserId = "";
    
    try {
      localName = localStorage.getItem("milan_name") || "";
      const token = localStorage.getItem("token");
      
      console.log("🔑 Token check:", token ? "Found" : "Not found");
      
      if (token) {
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            console.log("📦 Token payload:", payload);
            
            localUserId = payload.id || payload.userId || payload._id || payload.sub || "";
            
            if (localUserId) {
              setCurrentUserId(localUserId);
              console.log("✅ Successfully extracted userId:", localUserId);
            } else {
              console.error("❌ No ID field found in token payload:", Object.keys(payload));
            }
          } else {
            console.error("❌ Invalid token format - expected 3 parts, got:", parts.length);
          }
        } catch (e) {
          console.error("❌ Token parse error:", e);
        }
      } else {
        console.warn("⚠️ No token in localStorage");
      }
      
      setCurrentUsername(localName || "You");
      console.log("📋 Final user info:", { userId: localUserId, name: localName });
    } catch (err) {
      console.error("❌ Setup error:", err);
    }

    setPartnerAvatarSrc(getAvatarForGender("unknown"));

    const socket = io(BACKEND_URL, { 
      transports: ["websocket", "polling"], 
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("🔌 Socket connected:", socket.id);
      setIsConnected(true);
      
      const userInfo = {
        userId: localUserId,
        name: localName || "You",
        avatar: null,
        gender: "unknown",
      };
      
      console.log("📤 Sending userInfo:", userInfo);
      socket.emit("userInfo", userInfo);
      socket.emit("lookingForPartner", { type: "text" });
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Socket connect error:", err?.message || err);
    });

    socket.on("disconnect", (reason) => {
      console.log("🔌 Socket disconnected:", reason);
      setIsConnected(false);
    });

    socket.on("partnerFound", ({ roomCode: rc, partner }) => {
      console.log("👥 Partner found - RAW EVENT DATA:", { roomCode: rc, partner });
      
      if (!rc) {
        console.error("❌ No roomCode received! Event data:", { roomCode: rc, partner });
        // For AI partner, create a temporary roomCode if not provided
        if (partner?.isAI || partner?.type === "ai" || partner?.name === "Milan AI") {
          rc = `ai-room-${Date.now()}`;
          console.log("🤖 Creating temporary AI roomCode:", rc);
        } else {
          return;
        }
      }
      
      console.log("👥 Partner found - FULL DATA:", partner);
      partnerFoundRef.current = true;
      
      setRoomCode(rc);
      setPartnerId(partner?.id || null);
      
      // Check if this is an AI partner
      const isAI = partner?.isAI === true || partner?.type === "ai" || partner?.name === "Milan AI";
      setIsAiPartner(isAI);
      
      const pUserId = partner?.userId || null;
      const pName = partner?.name || (isAI ? "Milan AI" : "Romantic Stranger");
      const pAvatar = partner?.avatar || getAvatarForGender(isAI ? "ai" : partner?.gender);

      setPartnerUserId(pUserId);
      setPartnerName(pName);
      setPartnerAvatarSrc(pAvatar);

      console.log("✅ Partner Info SET:", { 
        name: pName, 
        userId: pUserId,
        socketId: partner?.id,
        isAI: isAI,
        roomCode: rc
      });

      try {
        socket.emit("joinRoom", { roomCode: rc });
        console.log("📤 Emitted joinRoom with roomCode:", rc);
      } catch (e) {
        console.error("❌ Failed to emit joinRoom:", e);
      }

      const sysId = `sys-found-${Date.now()}`;
      if (!processedMsgIds.current.has(sysId)) {
        processedMsgIds.current.add(sysId);
        setMsgs((p) => [
          ...p,
          { 
            id: sysId, 
            self: false, 
            kind: "system", 
            html: isAI 
              ? `You are connected with ${escapeHtml(pName)}. Say hi! 👋` 
              : `You are connected with ${escapeHtml(pName)}.`, 
            time: timeNow() 
          },
        ]);
      }
      scrollToBottom();
    });

    socket.on("message", (msg) => {
      if (!msg || !msg.id) return;
      
      if (processedMsgIds.current.has(msg.id)) return;
      processedMsgIds.current.add(msg.id);

      setMsgs((prev) => {
        if (prev.some((x) => x.id === msg.id)) return prev;
        
        const isSelf = socket.id === msg.senderId;
        return [
          ...prev,
          {
            id: msg.id,
            self: isSelf,
            kind: "text",
            html: `${linkify(escapeHtml(msg.text || ""))}`,
            time: timeNow(),
          },
        ];
      });
      scrollToBottom();
    });

    socket.on("fileMessage", (msg) => {
      if (!msg || !msg.id) return;
      
      if (processedMsgIds.current.has(msg.id)) return;
      processedMsgIds.current.add(msg.id);

      setMsgs((prev) => {
        if (prev.some((x) => x.id === msg.id)) return prev;
        
        const isSelf = socket.id === msg.senderId;
        const t = (msg.fileType || "").toLowerCase();
        let inner = "";
        
        if (t.startsWith("image/")) {
          inner = `<a href="${msg.fileData}" target="_blank" rel="noopener"><img src="${msg.fileData}" alt="image" /></a>`;
        } else if (t.startsWith("video/")) {
          inner = `<video controls><source src="${msg.fileData}" type="${msg.fileType}"></video>`;
        } else {
          inner = `<a class="file-link" download="${escapeHtml(msg.fileName || "file")}" href="${msg.fileData}">${escapeHtml(msg.fileName || "file")}</a>`;
        }
        
        return [
          ...prev,
          { id: msg.id, self: isSelf, kind: "file", html: inner, time: timeNow() },
        ];
      });
      scrollToBottom();
    });

    socket.on("partnerTyping", () => {
      setTyping(true);
      clearTimeout(socketRef.current?._typingTimer);
      socketRef.current._typingTimer = setTimeout(() => setTyping(false), 1500);
    });

    socket.on("partnerDisconnected", () => {
      console.log("Partner disconnected event received");
      
      if (partnerFoundRef.current && !isCleaningUp.current) {
        setShowDisconnectAlert(true);
      }
    });

    socket.on("friend-request-received", (data) => {
      console.log("✅ Friend request received:", data);
      setFriendRequestData(data);
      setShowFriendRequestPopup(true);
    });

    socket.on("friend-request-accepted", (data) => {
      console.log("✅ Friend request accepted:", data);
      setCelebrationActive(true);
      createFloatingHearts(20);
      
      setTimeout(() => {
        setResponseType('accepted');
        setShowResponsePopup(true);
        setCelebrationActive(false);
      }, 2000);
    });

    socket.on("friend-request-rejected", (data) => {
      console.log("❌ Friend request rejected:", data);
      
      setTimeout(() => {
        setResponseType('rejected');
        setShowResponsePopup(true);
      }, 500);
    });

    return () => {
      isCleaningUp.current = true;
      try {
        socket.off("connect_error");
        socket.off("disconnect");
        socket.off("partnerFound");
        socket.off("message");
        socket.off("fileMessage");
        socket.off("partnerTyping");
        socket.off("partnerDisconnected");
        socket.off("friend-request-received");
        socket.off("friend-request-accepted");
        socket.off("friend-request-rejected");
        socket.disconnect();
      } catch {}
    };
  }, []);

  const sendText = () => {
    const val = (msgRef.current?.value || "").trim();
    if (!val || !socketRef.current || !roomCode) return;
    const id = genId();

    processedMsgIds.current.add(id);

    setMsgs((p) => [
      ...p,
      { id, self: true, kind: "text", html: linkify(escapeHtml(val)), time: timeNow(), status: "sent" },
    ]);
    scrollToBottom();

    try {
      socketRef.current.emit("message", {
        id,
        text: val,
        roomCode,
        senderId: socketRef.current.id,
      });
    } catch (e) {
      setMsgs((prev) => prev.map((m) => (m.id === id ? { ...m, status: "failed" } : m)));
      console.error("emit message failed", e);
    }

    msgRef.current.value = "";
    setTyping(false);
  };

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f || !socketRef.current || !roomCode || isUploading) {
      e.target.value = "";
      return;
    }

    // Don't allow file sending to AI partner
    if (isAiPartner) {
      alert("⚠️ File sharing is not available with AI partner. Try sending a text message instead!");
      e.target.value = "";
      return;
    }

    if (f.size > MAX_FILE_BYTES) {
      alert("⚠️ File too big – max 15 MB allowed.");
      e.target.value = "";
      return;
    }

    setIsUploading(true);
    const id = genId();
    processedMsgIds.current.add(id);

    try {
      let dataUrl;
      
      if (f.type.startsWith("image/")) {
        console.log(`Original image size: ${(f.size / 1024 / 1024).toFixed(2)} MB`);
        dataUrl = await compressImage(f);
        console.log(`Compressed image size: ${(dataUrl.length / 1024 / 1024).toFixed(2)} MB`);
      } else {
        dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(f);
        });
      }

      const sizeInMB = dataUrl.length / 1024 / 1024;
      if (sizeInMB > 10) {
        alert("⚠️ Image is still too large after compression. Try a smaller image.");
        setIsUploading(false);
        e.target.value = "";
        return;
      }

      let inner = "";
      if (f.type.startsWith("image/")) {
        inner = `<a href="${dataUrl}" target="_blank" rel="noopener"><img src="${dataUrl}" alt="image" /></a>`;
      } else if (f.type.startsWith("video/")) {
        inner = `<video controls><source src="${dataUrl}" type="${f.type}"></video>`;
      } else {
        inner = `<a class="file-link" download="${escapeHtml(f.name)}" href="${dataUrl}">${escapeHtml(f.name)}</a>`;
      }

      setMsgs((p) => [
        ...p,
        { id, self: true, kind: "file", html: inner, time: timeNow(), status: "sent" },
      ]);
      scrollToBottom();

      socketRef.current.emit("fileMessage", {
        id,
        fileName: f.name,
        fileType: f.type,
        fileData: dataUrl,
        roomCode,
        senderId: socketRef.current.id,
      });

      console.log("File sent successfully");
    } catch (err) {
      console.error("File processing failed:", err);
      setMsgs((prev) => prev.map((m) => (m.id === id ? { ...m, status: "failed" } : m)));
      alert("⚠️ Failed to send file. Please try again.");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const onType = () => {
    if (!socketRef.current || !roomCode || isAiPartner) return;
    try {
      socketRef.current.emit("typing", { roomCode });
    } catch {}
  };

  const handleDisconnectOk = () => {
    setShowDisconnectAlert(false);
    isCleaningUp.current = true;
    try {
      socketRef.current?.emit("disconnectByUser");
      socketRef.current?.disconnect();
    } catch {}
    window.location.href = "https://milanlove.in/connect";
  };

  const handleAddToFavourites = () => {
    // Don't allow friend request for AI partner
    if (isAiPartner) {
      alert("⚠️ You cannot send friend requests to AI partners!");
      return;
    }

    console.log("🔍 Add Friend clicked - Current state:", {
      socketConnected: socketRef.current?.connected,
      currentUserId,
      partnerUserId,
      roomCode,
      requestSending
    });

    if (!socketRef.current || !currentUserId || !partnerUserId || !roomCode) {
      console.warn("❌ Missing data for friend request:", {
        socket: !!socketRef.current,
        currentUserId,
        partnerUserId,
        roomCode
      });
      alert("Unable to send friend request. Please make sure you're connected.");
      return;
    }

    if (requestSending) {
      console.log("⏳ Request already in progress");
      return;
    }

    console.log("📤 Sending friend request to:", partnerUserId);
    setRequestSending(true);
    setMenuOpen(false);
    
    try {
      socketRef.current.emit("send-friend-request", {
        targetUserId: partnerUserId,
        myUserId: currentUserId,
        myUsername: currentUsername,
        roomCode: roomCode
      });
      
      const sysId = `sys-req-${Date.now()}`;
      setMsgs((p) => [
        ...p,
        { id: sysId, self: false, kind: "system", html: "💌 Friend request sent!", time: timeNow() },
      ]);
      scrollToBottom();
      
      setTimeout(() => setRequestSending(false), 2000);
    } catch (error) {
      console.error("❌ Failed to send friend request:", error);
      alert("Failed to send friend request. Please try again.");
      setRequestSending(false);
    }
  };

  const handleAcceptRequest = () => {
    if (!socketRef.current || !friendRequestData || !currentUserId) {
      console.warn("❌ Missing data for accepting request");
      return;
    }

    setShowFriendRequestPopup(false);
    setCelebrationActive(true);
    createFloatingHearts(20);

    try {
      socketRef.current.emit("friend-request-response", {
        accepted: true,
        requesterId: friendRequestData.fromUserId,
        responderId: currentUserId,
        responderUsername: currentUsername
      });

      console.log("✅ Accepted request from:", friendRequestData.fromUsername);

      setTimeout(() => {
        setResponseType('accepted');
        setShowResponsePopup(true);
        setCelebrationActive(false);
      }, 2000);
    } catch (error) {
      console.error("❌ Failed to accept request:", error);
      setCelebrationActive(false);
    }
  };

  const handleRejectRequest = () => {
    if (!socketRef.current || !friendRequestData || !currentUserId) {
      console.warn("❌ Missing data for rejecting request");
      return;
    }

    setShowFriendRequestPopup(false);

    try {
      socketRef.current.emit("friend-request-response", {
        accepted: false,
        requesterId: friendRequestData.fromUserId,
        responderId: currentUserId
      });

      console.log("❌ Rejected request from:", friendRequestData.fromUsername);

      setTimeout(() => {
        setResponseType('rejected');
        setShowResponsePopup(true);
      }, 500);
    } catch (error) {
      console.error("❌ Failed to reject request:", error);
    }
  };

  const closeResponsePopup = () => {
    setShowResponsePopup(false);
  };

  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest(".header-right")) setMenuOpen(false);
      if (!e.target.closest(".emoji-wrap")) setEmojiOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return (
    <>
      <Head>
        <title>Milan – Romantic Chat</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>

      <div className="app">
        {showFriendRequestPopup && friendRequestData && (
          <div className="modal-overlay">
            <div className="friend-request-modal">
              <div className="sparkles-container">
                {[...Array(8)].map((_, i) => (
                  <span key={i} className="sparkle" style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 2}s`
                  }}>✨</span>
                ))}
              </div>

              <div className="modal-content">
                <div className="heart-icon-wrapper">
                  <div className="heart-icon">
                    <span className="heart-symbol">💖</span>
                  </div>
                  <div className="heart-pulse"></div>
                </div>

                <h3 className="modal-title">
                  <span>💞</span>
                  <span>Someone felt a spark!</span>
                  <span>💫</span>
                </h3>
                
                <p className="modal-subtitle">
                  <span className="username">{friendRequestData.fromUsername}</span> wants to be your friend on Milan
                </p>
                
                <p className="modal-description">
                  They loved chatting with you and want to stay connected 💖
                </p>

                <div className="modal-buttons">
                  <button onClick={handleRejectRequest} className="btn-reject">
                    <span>💔</span>
                    <span>Maybe Later</span>
                  </button>
                  
                  <button onClick={handleAcceptRequest} className="btn-accept">
                    <span>🌸</span>
                    <span>Accept</span>
                    <span className="heart-beat">❤️</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {celebrationActive && (
          <div className="celebration-overlay">
            <div className="celebration-content">
              <div className="celebration-heart">💕</div>
              <h2 className="celebration-text">Connection Made! ✨</h2>
            </div>
          </div>
        )}

        {floatingHearts.map((heart) => (
          <div
            key={heart.id}
            className="floating-heart"
            style={{
              left: `${heart.left}%`,
              fontSize: `${heart.size}px`,
              animationDelay: `${heart.delay}s`
            }}
          >
            ♥
          </div>
        ))}

        {showResponsePopup && (
          <div className="modal-overlay">
            <div className={`response-modal ${responseType}`}>
              <button onClick={closeResponsePopup} className="close-btn">✕</button>

              <div className="modal-content">
                {responseType === 'accepted' ? (
                  <>
                    <div className="response-icon accepted-icon">
                      <span>💖</span>
                    </div>
                    <h3 className="response-title">🎉 Yay!</h3>
                    <p className="response-message">You've got a new Milan friend! 💕</p>
                    <p className="response-sub">
                      You can now find them in your favourites list and chat anytime! ✨
                    </p>
                  </>
                ) : (
                  <>
                    <div className="response-icon rejected-icon">
                      <span>💔</span>
                    </div>
                    <h3 className="response-title">Oh no...</h3>
                    <p className="response-message">Looks like cupid missed this time 😅</p>
                    <p className="response-sub">
                      No worries! Keep meeting new people on Milan 💫
                    </p>
                  </>
                )}
                
                <button onClick={closeResponsePopup} className={`response-btn ${responseType}`}>
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {showDisconnectAlert && (
          <div className="alert-overlay">
            <div className="alert-box">
              <div className="alert-icon">💔</div>
              <h2 className="alert-title">Partner Disconnected</h2>
              <p className="alert-message">
                Your partner has left the chat. Don't worry, there are many hearts waiting to connect with you! 💕
              </p>
              <button className="alert-btn" onClick={handleDisconnectOk}>OK</button>
            </div>
          </div>
        )}

        {isUploading && (
          <div className="upload-overlay">
            <div className="upload-spinner"></div>
            <p className="upload-text">Sending image...</p>
          </div>
        )}

        <header className="header">
          <div className="header-left">
            <img className="avatar" src={partnerAvatarSrc} alt="DP" />
            <div className="partner">
              <div className="name">
                {partnerName}
                {isAiPartner && <span style={{marginLeft: '6px', fontSize: '0.75rem', opacity: 0.8}}>🤖</span>}
              </div>
              <div className="status">
                <span className={`dot ${isConnected && roomCode ? 'online' : ''}`} /> 
                {typing ? "typing…" : roomCode ? "online" : "searching…"}
              </div>
            </div>
          </div>

          <div className="header-right">
            {roomCode && partnerUserId && currentUserId && !isAiPartner && (
              <button
                className="friend-request-btn"
                onClick={handleAddToFavourites}
                title="Send Friend Request"
                disabled={requestSending}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <line x1="19" y1="8" x2="19" y2="14"></line>
                  <line x1="22" y1="11" x2="16" y2="11"></line>
                </svg>
              </button>
            )}

            <button className="icon-btn" title="Menu" onClick={() => setMenuOpen((s) => !s)}>⋮</button>
            
            <div className={`menu ${menuOpen ? "open" : ""}`}>
              {roomCode && partnerUserId && currentUserId && !isAiPartner && (
                <>
                  <button className="menu-item" onClick={handleAddToFavourites} disabled={requestSending}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <line x1="19" y1="8" x2="19" y2="14"></line>
                      <line x1="22" y1="11" x2="16" y2="11"></line>
                    </svg>
                    Send Friend Request
                  </button>
                  <div className="sep" />
                </>
              )}
              <button className="menu-item" onClick={() => {
                setMenuOpen(false);
                isCleaningUp.current = true;
                try {
                  socketRef.current.emit("disconnectByUser");
                  socketRef.current.disconnect();
                } catch {}
                window.location.href = "https://milanlove.in/connect";
              }}>
                🔌 Disconnect
              </button>
              {!isAiPartner && (
                <>
                  <div className="sep" />
                  <button className="menu-item" onClick={() => {
                    setMenuOpen(false);
                    alert("🚩 Report submitted. Thank you!");
                  }}>
                    🚩 Report
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="chat" ref={listRef}>
          <div className="day-sep">
            <span>Today</span>
          </div>
          {msgs.map((m) => (
            <div
              key={m.id}
              className={`row ${m.self ? "me" : m.kind === "system" ? "system-row" : "you"}`}
              ref={(el) => (messageRefs.current[m.id] = el)}
            >
              <div className="msg-wrap">
                <div className={`bubble ${m.kind === "system" ? "system-bubble" : ""}`} dangerouslySetInnerHTML={{ __html: m.html }} />
                <div className="meta">
                  <span className="time">{m.time}</span>
                  {m.self && m.kind !== "system" && (
                    <span className={`ticks ${m.status === "seen" ? "seen" : ""}`}>
                      {m.status === "sent" ? "✓" : m.status === "seen" ? "✓✓" : "✓✓"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </main>

        <footer className="inputbar">
          <input ref={fileRef} type="file" hidden onChange={handleFile} accept="image/*,video/*,.pdf,.doc,.docx" />
          <button className="tool" title="Attach" onClick={() => fileRef.current?.click()} disabled={isUploading || isAiPartner}>
            📎
          </button>

          <div className="emoji-wrap">
            <button className="tool" title="Emoji" onClick={() => setEmojiOpen((s) => !s)}>
              😊
            </button>
            {emojiOpen && (
              <div className="emoji-pop">
                {EMOJIS.map((e) => (
                  <button key={e} className="emoji-item" onClick={() => {
                    if (!msgRef.current) return;
                    const el = msgRef.current;
                    const start = el.selectionStart ?? el.value.length;
                    const end = el.selectionEnd ?? el.value.length;
                    const before = el.value.slice(0, start);
                    const after = el.value.slice(end);
                    el.value = before + e + after;
                    const caret = start + e.length;
                    requestAnimationFrame(() => {
                      el.focus();
                      el.setSelectionRange(caret, caret);
                    });
                    setEmojiOpen(false);
                  }}>
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>

          <input
            ref={msgRef}
            className="msg-field"
            type="text"
            placeholder={roomCode ? "Type a message…" : "Finding a partner…"}
            disabled={!roomCode || isUploading}
            onChange={onType}
            onKeyDown={(e) => e.key === "Enter" && sendText()}
          />
          <button className="send" title="Send" onClick={sendText} disabled={!roomCode || isUploading}>
            ➤
          </button>
        </footer>
      </div>

      <style jsx>{`
        :root {
          --bg-pink-1: #2b0b1e;
          --bg-pink-2: #120317;
          --accent: #ff4fa0;
          --text: #f7f8fb;
          --muted: #d6cbe0;
          --bubble-me-start: #ff6b9d;
          --bubble-me-end: #ff1493;
          --bubble-you-start: #1f2a3a;
          --bubble-you-end: #0f1724;
        }

        * {
          -webkit-tap-highlight-color: transparent;
        }

        html, body {
          height: 100%;
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial;
          background: radial-gradient(1200px 600px at 10% 10%, rgba(255,79,160,0.06), transparent 6%),
                      radial-gradient(900px 400px at 90% 90%, rgba(139,92,246,0.03), transparent 8%),
                      linear-gradient(180deg, var(--bg-pink-1), var(--bg-pink-2));
          -webkit-font-smoothing: antialiased;
          overscroll-behavior: none;
        }

        .app {
          position: relative;
          display: flex;
          flex-direction: column;
          height: 100vh;
          height: 100dvh;
          max-width: 980px;
          margin: 0 auto;
          background: linear-gradient(180deg, rgba(3,2,6,0.6), rgba(5,3,8,0.95));
          color: var(--text);
          box-shadow: 0 18px 60px rgba(11,6,18,0.7);
          overflow: hidden;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100000;
          animation: fadeIn 0.3s ease;
          padding: 20px;
        }

        .friend-request-modal {
          background: linear-gradient(145deg, rgba(255,79,160,0.25), rgba(139,92,246,0.2));
          border: 2px solid rgba(255,79,160,0.5);
          border-radius: 28px;
          padding: 2.5rem 2rem;
          max-width: 460px;
          width: 100%;
          text-align: center;
          box-shadow: 0 25px 70px rgba(255,79,160,0.4), 0 0 120px rgba(255,20,147,0.25);
          animation: slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative;
          overflow: hidden;
        }

        .sparkles-container {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }

        .sparkle {
          position: absolute;
          font-size: 18px;
          animation: sparkleFloat 3s ease-in-out infinite;
          opacity: 0.7;
        }

        @keyframes sparkleFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.5; }
          50% { transform: translateY(-20px) rotate(180deg); opacity: 1; }
        }

        .modal-content {
          position: relative;
          z-index: 10;
        }

        .heart-icon-wrapper {
          position: relative;
          margin-bottom: 1.5rem;
          display: inline-block;
        }

        .heart-icon {
          width: 100px;
          height: 100px;
          background: linear-gradient(135deg, #ff4fa0, #ff1493);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: heartBounce 1.2s ease-in-out infinite;
          box-shadow: 0 15px 40px rgba(255,79,160,0.4);
        }

        .heart-symbol {
          font-size: 3.5rem;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
        }

        .heart-pulse {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 3px solid rgba(255,79,160,0.6);
          animation: pulsate 1.5s ease-out infinite;
        }

        @keyframes heartBounce {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(0.9); }
          50% { transform: scale(1.15); }
        }

        @keyframes pulsate {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.8); opacity: 0; }
        }

        .modal-title {
          color: #ffffff;
          font-size: 1.9rem;
          font-weight: 900;
          margin: 0 0 1rem;
          text-shadow: 0 3px 20px rgba(255,107,157,0.5);
          line-height: 1.3;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .modal-subtitle {
          color: #ffeef8;
          font-size: 1.15rem;
          margin: 0 0 0.8rem;
          font-weight: 600;
        }

        .username {
          color: #ff6b9d;
          font-weight: 800;
          text-shadow: 0 0 15px rgba(255,107,157,0.4);
        }

        .modal-description {
          color: #ffd7e0;
          font-size: 0.95rem;
          margin: 0 0 2rem;
          opacity: 0.9;
        }

        .modal-buttons {
          display: flex;
          gap: 1rem;
        }

        .btn-reject {
          flex: 1;
          background: linear-gradient(135deg, rgba(100,100,120,0.4), rgba(80,80,100,0.5));
          border: 2px solid rgba(150,150,170,0.3);
          color: #ffffff;
          padding: 1rem 1.5rem;
          border-radius: 50px;
          font-size: 1.05rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .btn-reject:hover {
          background: linear-gradient(135deg, rgba(120,120,140,0.5), rgba(100,100,120,0.6));
          transform: translateY(-2px);
        }

        .btn-reject:active {
          transform: translateY(0) scale(0.98);
        }

        .btn-accept {
          flex: 1;
          background: linear-gradient(135deg, #ff4fa0, #ff1493);
          border: 2px solid rgba(255,255,255,0.3);
          color: #ffffff;
          padding: 1rem 1.5rem;
          border-radius: 50px;
          font-size: 1.05rem;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 12px 35px rgba(255,79,160,0.5), 0 0 60px rgba(255,20,147,0.3);
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          position: relative;
          overflow: hidden;
        }

        .btn-accept:hover {
          background: linear-gradient(135deg, #ff1493, #ff4fa0);
          transform: translateY(-3px);
          box-shadow: 0 15px 45px rgba(255,79,160,0.6);
        }

        .btn-accept:active {
          transform: translateY(-1px) scale(0.98);
        }

        .heart-beat {
          animation: heartPulse 1s ease-in-out infinite;
        }

        @keyframes heartPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.3); }
        }

        .celebration-overlay {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .celebration-content {
          text-align: center;
          animation: celebrationBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .celebration-heart {
          font-size: 8rem;
          margin-bottom: 1rem;
          animation: celebrationSpin 1.5s ease-in-out infinite;
          filter: drop-shadow(0 0 30px rgba(255,79,160,0.8));
        }

        @keyframes celebrationSpin {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(0.9) rotate(-10deg); }
          50% { transform: scale(1.2) rotate(10deg); }
          75% { transform: scale(0.95) rotate(-5deg); }
        }

        .celebration-text {
          color: #ffffff;
          font-size: 3rem;
          font-weight: 900;
          text-shadow: 0 5px 25px rgba(255,79,160,0.6), 0 0 50px rgba(255,20,147,0.4);
          animation: textPulse 1.5s ease infinite;
        }

        @keyframes celebrationBounce {
          0% { transform: scale(0.3); opacity: 0; }
          60% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); }
        }

        @keyframes textPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }

        .floating-heart {
          position: fixed;
          bottom: -50px;
          color: #ff4fa0;
          pointer-events: none;
          z-index: 99998;
          animation: floatUp 3s ease-out forwards;
          text-shadow: 0 0 15px rgba(255,79,160,0.8);
        }

        @keyframes floatUp {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(-100vh) rotate(360deg);
            opacity: 0;
          }
        }

        .response-modal {
          background: linear-gradient(145deg, rgba(255,79,160,0.2), rgba(139,92,246,0.15));
          border: 2px solid rgba(255,79,160,0.4);
          border-radius: 28px;
          padding: 2.5rem 2rem;
          max-width: 440px;
          width: 100%;
          text-align: center;
          box-shadow: 0 25px 70px rgba(255,79,160,0.4);
          animation: slideUp 0.4s ease;
          position: relative;
        }

        .response-modal.accepted {
          border-color: rgba(76, 217, 100, 0.6);
          background: linear-gradient(145deg, rgba(76,217,100,0.2), rgba(52,199,89,0.15));
        }

        .close-btn {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: rgba(255,255,255,0.1);
          border: none;
          color: #ffffff;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 1.2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .close-btn:hover {
          background: rgba(255,255,255,0.2);
          transform: rotate(90deg);
        }

        .response-icon {
          width: 90px;
          height: 90px;
          margin: 0 auto 1.5rem;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 3rem;
          animation: iconBounce 0.6s ease;
        }

        .accepted-icon {
          background: linear-gradient(135deg, #4cd964, #34c759);
          box-shadow: 0 15px 40px rgba(76,217,100,0.4);
        }

        .rejected-icon {
          background: linear-gradient(135deg, #888, #666);
          box-shadow: 0 15px 40px rgba(100,100,100,0.3);
        }

        @keyframes iconBounce {
          0% { transform: scale(0); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }

        .response-title {
          color: #ffffff;
          font-size: 2rem;
          font-weight: 800;
          margin: 0 0 1rem;
        }

        .response-message {
          color: #ffeef8;
          font-size: 1.2rem;
          margin: 0 0 0.8rem;
          font-weight: 600;
        }

        .response-sub {
          color: #ffd7e0;
          font-size: 0.95rem;
          margin: 0 0 2rem;
          opacity: 0.9;
        }

        .response-btn {
          padding: 1rem 3rem;
          border-radius: 50px;
          border: none;
          font-size: 1.1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .response-btn.accepted {
          background: linear-gradient(135deg, #4cd964, #34c759);
          color: #ffffff;
          box-shadow: 0 12px 35px rgba(76,217,100,0.5);
        }

        .response-btn.accepted:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 45px rgba(76,217,100,0.6);
        }

        .response-btn.rejected {
          background: linear-gradient(135deg, #888, #666);
          color: #ffffff;
          box-shadow: 0 12px 35px rgba(100,100,100,0.3);
        }

        .response-btn.rejected:hover {
          transform: translateY(-2px);
        }

        .friend-request-btn {
          background: linear-gradient(135deg, rgba(76,217,100,0.25), rgba(52,199,89,0.2));
          border: 2px solid rgba(76,217,100,0.5);
          border-radius: 12px;
          padding: 10px 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #4cd964;
          flex-shrink: 0;
        }

        .friend-request-btn:hover {
          background: linear-gradient(135deg, rgba(76,217,100,0.35), rgba(52,199,89,0.3));
          border-color: rgba(76,217,100,0.7);
          transform: scale(1.08);
          box-shadow: 0 8px 24px rgba(76,217,100,0.4);
        }

        .friend-request-btn:active {
          transform: scale(0.95);
        }

        .friend-request-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: scale(1);
        }

        .friend-request-btn svg {
          filter: drop-shadow(0 2px 4px rgba(76,217,100,0.3));
        }

        .alert-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.92);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 99999;
          animation: fadeIn 0.3s ease;
          padding: 20px;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from {
            transform: translateY(50px) scale(0.95);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }

        .alert-box {
          background: linear-gradient(145deg, rgba(255,79,160,0.2), rgba(139,92,246,0.15));
          border: 2px solid rgba(255,79,160,0.4);
          border-radius: 24px;
          padding: 2.5rem 2rem;
          max-width: 420px;
          width: 100%;
          text-align: center;
          box-shadow: 0 20px 60px rgba(255,79,160,0.3), 0 0 100px rgba(255,20,147,0.2);
          animation: slideUp 0.4s ease;
          position: relative;
          overflow: hidden;
        }

        .alert-icon {
          font-size: 4.5rem;
          margin-bottom: 1rem;
          animation: heartBeat 1.5s ease infinite;
          filter: drop-shadow(0 0 20px rgba(255,79,160,0.5));
        }

        @keyframes heartBeat {
          0%, 100% { transform: scale(1); }
          10%, 30% { transform: scale(0.9); }
          20%, 40% { transform: scale(1.15); }
        }

        .alert-title {
          color: #ff6b9d;
          font-size: 1.8rem;
          font-weight: 800;
          margin: 0 0 1rem;
          text-shadow: 0 2px 15px rgba(255,107,157,0.4);
          line-height: 1.3;
        }

        .alert-message {
          color: #f7f8fb;
          font-size: 1.05rem;
          line-height: 1.6;
          margin: 0 0 2rem;
          opacity: 0.95;
        }

        .alert-btn {
          background: linear-gradient(135deg, #ff4fa0, #ff1493);
          color: #ffffff;
          border: none;
          border-radius: 50px;
          padding: 16px 60px;
          font-size: 1.15rem;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 10px 30px rgba(255,79,160,0.5), 0 0 50px rgba(255,20,147,0.3);
          transition: all 0.3s ease;
          letter-spacing: 0.5px;
          min-width: 140px;
        }

        .alert-btn:active {
          transform: scale(0.97);
          box-shadow: 0 5px 20px rgba(255,79,160,0.4);
        }

        .upload-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 9998;
        }

        .upload-spinner {
          width: 50px;
          height: 50px;
          border: 4px solid rgba(255,79,160,0.2);
          border-top: 4px solid #ff4fa0;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .upload-text {
          color: #fff;
          margin-top: 1rem;
          font-size: 1rem;
        }

        .header {
          position: sticky;
          top: 0;
          z-index: 30;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          gap: 0.6rem;
          background: linear-gradient(180deg, rgba(255,79,160,0.12), rgba(139,92,246,0.08));
          color: var(--text);
          border-bottom: 1px solid rgba(255,255,255,0.03);
          backdrop-filter: blur(6px);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          flex: 1;
          min-width: 0;
        }
        
        .avatar {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid rgba(255,255,255,0.06);
          background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
          flex-shrink: 0;
        }
        
        .partner {
          flex: 1;
          min-width: 0;
        }

        .partner .name {
          font-weight: 800;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: #ffffff;
          font-size: 1rem;
          display: flex;
          align-items: center;
        }
        
        .status {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.86rem;
          opacity: 0.95;
          color: var(--muted);
        }
        
        .dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #666;
          box-shadow: 0 0 10px rgba(102,102,102,0.14);
          transition: background 0.3s ease, box-shadow 0.3s ease;
        }

        .dot.online {
          background: #a7ffb2;
          box-shadow: 0 0 10px rgba(167,255,178,0.14);
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          position: relative;
        }
        
        .icon-btn {
          border: none;
          background: rgba(255,255,255,0.03);
          border-radius: 10px;
          padding: 8px;
          cursor: pointer;
          color: var(--text);
          font-size: 1.05rem;
          flex-shrink: 0;
        }

        .menu {
          position: absolute;
          right: 0;
          top: 48px;
          background: rgba(0,0,0,0.45);
          border-radius: 10px;
          padding: 6px;
          min-width: 220px;
          display: none;
          box-shadow: 0 8px 26px rgba(2,6,23,0.6);
          border: 1px solid rgba(255,255,255,0.04);
          backdrop-filter: blur(6px);
        }
        .menu.open { display: block; }
        .menu-item {
          width: 100%;
          text-align: left;
          background: linear-gradient(90deg, rgba(255,79,160,0.06), rgba(139,92,246,0.04));
          border: none;
          color: #fff;
          padding: 12px 14px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.95rem;
          margin: 4px 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .menu-item:hover {
          background: linear-gradient(90deg, rgba(255,79,160,0.12), rgba(139,92,246,0.08));
        }
        .menu-item:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .menu-item svg {
          flex-shrink: 0;
        }
        .sep { height: 1px; background: rgba(255,255,255,0.03); margin: 6px 0; }

        .chat {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 24px 16px;
          background-image:
            radial-gradient(600px 300px at 10% 10%, rgba(255,79,160,0.03), transparent 6%),
            radial-gradient(500px 250px at 90% 90%, rgba(139,92,246,0.02), transparent 8%);
          -webkit-overflow-scrolling: touch;
        }

        .day-sep { 
          text-align: center; 
          color: var(--muted); 
          font-size: 0.86rem; 
          margin: 8px 0 16px; 
        }
        .day-sep span { 
          background: rgba(255,255,255,0.03); 
          padding: 4px 10px; 
          border-radius: 12px; 
        }

        .row { display: flex; margin: 10px 0; }
        .row.me { justify-content: flex-end; }
        .row.system-row { justify-content: center; }

        .msg-wrap { max-width: 85%; position: relative; }

        .bubble {
          display: inline-block;
          max-width: 100%;
          border-radius: 14px;
          padding: 0.8rem 0.95rem;
          line-height: 1.35;
          word-wrap: break-word;
          box-shadow: 0 10px 40px rgba(2,6,23,0.6);
          border: 1px solid rgba(255,255,255,0.02);
        }

        .you .bubble {
          background: linear-gradient(135deg, var(--bubble-you-start), var(--bubble-you-end));
          color: #ffffff !important;
          border: 1px solid rgba(255,255,255,0.03);
          box-shadow: 0 8px 28px rgba(20,40,80,0.12);
          border-top-left-radius: 6px;
        }

        .me .bubble {
          background: linear-gradient(135deg, var(--bubble-me-start), var(--bubble-me-end));
          color: #ffffff !important;
          border: 1px solid rgba(255,255,255,0.15);
          box-shadow: 0 12px 40px rgba(255,20,147,0.25), 0 0 20px rgba(255,105,180,0.15);
          border-top-right-radius: 6px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.15);
        }

        .bubble a {
          color: inherit;
          text-decoration: underline;
          font-weight: 600;
        }

        .bubble img, .bubble video {
          max-width: 100%;
          width: auto;
          max-height: 400px;
          border-radius: 12px;
          display: block;
          margin: 4px 0;
        }

        .system-bubble {
          background: linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
          color: #ffeef8 !important;
          padding: 0.45rem 0.6rem;
          border-radius: 12px;
          font-weight: 600;
          box-shadow: 0 6px 18px rgba(255,255,255,0.02) inset;
          font-size: 0.9rem;
        }

        .meta {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          margin-top: 0.28rem;
          font-size: 0.78rem;
          color: var(--muted);
        }
        .time { font-size: 0.78rem; color: var(--muted); }
        .ticks { font-size: 0.95rem; line-height: 1; }
        .ticks.seen { color: var(--accent); text-shadow: 0 0 6px rgba(255,79,160,0.16); }

        .inputbar {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 12px 14px;
          background: rgba(255,255,255,0.01);
          border-top: 1px solid rgba(255,255,255,0.02);
          backdrop-filter: blur(6px);
        }
        .tool {
          border: none;
          background: rgba(255,255,255,0.02);
          cursor: pointer;
          display: grid;
          place-items: center;
          border-radius: 10px;
          width: 48px;
          height: 48px;
          color: var(--text);
          font-size: 1.18rem;
          flex-shrink: 0;
        }
        .tool:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .emoji-wrap {
          position: relative;
        }

        .msg-field {
          flex: 1;
          background: rgba(255,255,255,0.08);
          color: #ffffff !important;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 28px;
          padding: 12px 16px;
          outline: none;
          font-size: 1rem;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
        }
        .msg-field::placeholder { color: #d4b8d4; opacity: 0.8; }
        .msg-field:disabled {
          opacity: 0.6;
        }

        .send {
          background: linear-gradient(135deg, rgba(255,79,160,1), rgba(139,92,246,0.95));
          color: #ffffff;
          border: none;
          border-radius: 50%;
          width: 52px;
          height: 52px;
          display: grid;
          place-items: center;
          cursor: pointer;
          box-shadow: 0 16px 36px rgba(255,79,160,0.18);
          font-size: 1.12rem;
          transition: transform 120ms ease, box-shadow 120ms ease;
          font-weight: bold;
          flex-shrink: 0;
        }
        .send:active { 
          transform: translateY(1px) scale(0.98); 
          box-shadow: 0 8px 18px rgba(255,79,160,0.16); 
        }
        .send:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .emoji-pop {
          position: absolute;
          bottom: 66px;
          left: 0;
          background: rgba(30,20,40,0.95);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 0.5rem;
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 0.35rem;
          box-shadow: 0 10px 30px rgba(2,6,23,0.6);
          backdrop-filter: blur(10px);
        }
        .emoji-item {
          border: none;
          background: transparent;
          font-size: 1.4rem;
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 8px;
          transition: all 150ms ease;
        }
        .emoji-item:active { 
          background: rgba(255,79,160,0.2); 
          transform: scale(1.1); 
        }

        @media (max-width: 640px) {
          .app {
            margin: 0;
            border-radius: 0;
            max-width: 100%;
          }
          
          .bubble { 
            max-width: 90%; 
            padding: 0.7rem 0.85rem; 
            font-size: 0.95rem;
          }
          
          .bubble img, .bubble video { 
            max-width: 100%;
            max-height: 300px;
          }
          
          .msg-wrap {
            max-width: 85%;
          }
          
          .avatar { width: 40px; height: 40px; }
          .tool { width: 44px; height: 44px; font-size: 1.1rem; }
          .send { width: 48px; height: 48px; }
          .msg-field { font-size: 16px; padding: 11px 14px; }
          
          .alert-box { 
            padding: 2rem 1.5rem;
            max-width: 340px;
          }
          .alert-title { font-size: 1.5rem; }
          .alert-message { font-size: 0.95rem; }
          .alert-icon { font-size: 3.5rem; }
          .alert-btn {
            padding: 14px 50px;
            font-size: 1.05rem;
          }
          
          .friend-request-modal {
            padding: 2rem 1.5rem;
            max-width: 360px;
          }

          .modal-title {
            font-size: 1.5rem;
          }

          .heart-icon {
            width: 80px;
            height: 80px;
          }

          .heart-symbol {
            font-size: 2.8rem;
          }

          .modal-buttons {
            flex-direction: column;
          }

          .btn-reject, .btn-accept {
            width: 100%;
          }

          .response-modal {
            padding: 2rem 1.5rem;
            max-width: 340px;
          }

          .response-icon {
            width: 70px;
            height: 70px;
            font-size: 2.5rem;
          }

          .response-title {
            font-size: 1.6rem;
          }

          .celebration-heart {
            font-size: 5rem;
          }

          .celebration-text {
            font-size: 2rem;
          }
          
          .header {
            padding: 10px 12px;
          }
          
          .chat {
            padding: 16px 12px;
          }
          
          .partner .name {
            font-size: 0.95rem;
          }
          
          .status {
            font-size: 0.8rem;
          }

          .friend-request-btn {
            padding: 8px 10px;
          }

          .friend-request-btn svg {
            width: 18px;
            height: 18px;
          }

          .menu {
            min-width: 200px;
          }
        }
      `}</style>
    </>
  );
}
