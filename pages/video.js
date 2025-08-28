"use client";
import { useEffect } from "react";
import io from "socket.io-client";

export default function VideoPage() {
  useEffect(() => {
    const BACKEND_URL = "https://milan-j9u9.onrender.com";
    const ICE_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

    let socket = null;
    let pc = null;
    let localStream = null;
    let hasOffered = false;

    const get = (id) => document.getElementById(id);
    const showToast = (msg, ms = 2000) => {
      const t = get("toast");
      if (!t) return;
      t.textContent = msg;
      t.style.display = "block";
      setTimeout(() => (t.style.display = "none"), ms);
    };

    const showRating = () => {
      const r = get("ratingOverlay");
      if (r) r.style.display = "flex";
    };

    // ⭐ Emoji Animation Function
    const triggerRatingAnimation = (rating) => {
      const overlay = get("ratingOverlay");
      if (!overlay) return;

      const emojiMap = {
        1: ["😐"],
        2: ["🙂"],
        3: ["😊"],
        4: ["😍"],
        5: ["😍", "🥰", "❤️"],
      };

      const emojis = emojiMap[rating] || ["❤️"];
      const count = rating === 5 ? 25 : 15; // more emojis for 5 star

      for (let i = 0; i < count; i++) {
        const e = document.createElement("div");
        e.className = "floating-emoji";
        e.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        e.style.left = Math.random() * 100 + "vw";
        e.style.fontSize = 24 + Math.random() * 24 + "px";
        overlay.appendChild(e);

        // Different animation styles
        if (rating === 1 || rating === 2) {
          e.style.animation = `fall ${2 + Math.random() * 2}s linear`;
        } else if (rating === 3) {
          e.style.animation = `orbit ${3 + Math.random() * 2}s linear`;
        } else if (rating === 4) {
          e.style.animation = `flyUp ${3 + Math.random() * 2}s ease-out`;
        } else if (rating === 5) {
          e.style.animation = `burst ${3 + Math.random() * 2}s ease-in-out`;
        }

        // Remove after animation
        setTimeout(() => e.remove(), 4000);
      }
    };

    // Cleanup
    const cleanup = () => {
      console.log("🧹 Cleanup called");
      try {
        socket?.disconnect();
      } catch {}
      try {
        pc?.getSenders()?.forEach((s) => s.track && s.track.stop());
        pc?.close();
      } catch {}
      pc = null;
      localStream = null;
      hasOffered = false;
    };

    // Start
    (async function start() {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const lv = get("localVideo");
        if (lv) {
          lv.srcObject = localStream;
          lv.muted = true;
          lv.play().catch((e) => console.warn("Local video play error:", e));
        }
      } catch (err) {
        console.error("❌ Camera/Mic error:", err);
        showToast("Camera/Mic access needed");
        return;
      }

      socket = io(BACKEND_URL, { transports: ["websocket"] });

      socket.on("connect", () => {
        const token = localStorage.getItem("token");
        const roomCode = sessionStorage.getItem("roomCode");
        socket.emit("joinVideo", { token, roomCode });
      });

      const createPC = () => {
        if (pc) return;
        pc = new RTCPeerConnection(ICE_CONFIG);

        localStream?.getTracks().forEach((t) => pc.addTrack(t, localStream));

        pc.ontrack = (e) => {
          const rv = get("remoteVideo");
          if (rv && e.streams && e.streams[0]) {
            rv.srcObject = e.streams[0];
          }
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) socket.emit("candidate", e.candidate);
        };
      };

      socket.on("ready", async () => {
        createPC();
        if (!hasOffered && pc.signalingState === "stable") {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("offer", offer);
          hasOffered = true;
        }
      });

      socket.on("offer", async (offer) => {
        createPC();
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", answer);
      });

      socket.on("answer", async (answer) => {
        if (!pc) createPC();
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      });

      socket.on("candidate", async (candidate) => {
        if (!pc) createPC();
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      });

      socket.on("partnerDisconnected", () => {
        showToast("Partner disconnected");
        showRating();
      });

      socket.on("partnerLeft", () => {
        showToast("Partner left");
        showRating();
      });
    })();

    // Buttons
    const micBtn = get("micBtn");
    micBtn.onclick = () => {
      const t = localStream?.getAudioTracks()[0];
      if (!t) return;
      t.enabled = !t.enabled;
      micBtn.classList.toggle("inactive", !t.enabled);
      showToast(t.enabled ? "Mic On" : "Mic Off");
    };

    const camBtn = get("camBtn");
    camBtn.onclick = () => {
      const t = localStream?.getVideoTracks()[0];
      if (!t) return;
      t.enabled = !t.enabled;
      camBtn.classList.toggle("inactive", !t.enabled);
      showToast(t.enabled ? "Camera On" : "Camera Off");
    };

    const screenBtn = get("screenShareBtn");
    screenBtn.onclick = async () => {
      if (!pc) return showToast("No connection");
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const track = screen.getVideoTracks()[0];
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
        if (sender) {
          sender.replaceTrack(track);
          track.onended = () => {
            const cam = localStream?.getVideoTracks()?.[0];
            if (cam) sender.replaceTrack(cam);
          };
        }
      } catch (e) {
        showToast("Screen share cancelled");
      }
    };

    const disconnectBtn = get("disconnectBtn");
    disconnectBtn.onclick = () => {
      try {
        socket?.emit("partnerLeft");
      } catch {}
      cleanup();
      showRating();
    };

    get("quitBtn").onclick = () => {
      cleanup();
      window.location.href = "/";
    };

    get("newPartnerBtn").onclick = () => {
      cleanup();
      window.location.href = "/connect";
    };

    // ⭐ Rating hearts click bind
    const hearts = document.querySelectorAll("#ratingOverlay .hearts i");
    hearts.forEach((h) => {
      h.addEventListener("click", () => {
        const val = parseInt(h.getAttribute("data-value"));
        hearts.forEach((el) => el.classList.remove("selected"));
        for (let i = 0; i < val; i++) hearts[i].classList.add("selected");
        triggerRatingAnimation(val);
      });
    });

    // Draggable local video
    const lb = get("localBox");
    let dragging = false,
      dx = 0,
      dy = 0;
    const startDrag = (x, y) => {
      const rect = lb.getBoundingClientRect();
      dx = x - rect.left;
      dy = y - rect.top;
      dragging = true;
      lb.style.cursor = "grabbing";
    };
    const moveDrag = (x, y) => {
      if (!dragging) return;
      lb.style.left = `${x - dx}px`;
      lb.style.top = `${y - dy}px`;
    };
    const stopDrag = () => {
      dragging = false;
      lb.style.cursor = "grab";
    };

    lb.addEventListener("mousedown", (e) => startDrag(e.clientX, e.clientY));
    document.addEventListener("mousemove", (e) => moveDrag(e.clientX, e.clientY));
    document.addEventListener("mouseup", stopDrag);

    lb.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      startDrag(t.clientX, t.clientY);
    });
    document.addEventListener("touchmove", (e) => {
      const t = e.touches[0];
      moveDrag(t.clientX, t.clientY);
    });
    document.addEventListener("touchend", stopDrag);

    return () => cleanup();
  }, []);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
      />

      <div className="video-container">
        <video id="remoteVideo" autoPlay playsInline></video>
        <div id="localBox">
          <video id="localVideo" autoPlay playsInline muted></video>
        </div>
      </div>

      <div className="control-bar">
        <button id="micBtn" className="control-btn">
          <i className="fas fa-microphone"></i>
          <span>Mic</span>
        </button>
        <button id="camBtn" className="control-btn">
          <i className="fas fa-video"></i>
          <span>Camera</span>
        </button>
        <button id="screenShareBtn" className="control-btn">
          <i className="fas fa-desktop"></i>
          <span>Share</span>
        </button>
        <button id="disconnectBtn" className="control-btn danger">
          <i className="fas fa-phone-slash"></i>
          <span>End</span>
        </button>
      </div>

      <div id="ratingOverlay">
        <h2>Rate your partner ❤️</h2>
        <div className="hearts">
          <i className="far fa-heart" data-value="1"></i>
          <i className="far fa-heart" data-value="2"></i>
          <i className="far fa-heart" data-value="3"></i>
          <i className="far fa-heart" data-value="4"></i>
          <i className="far fa-heart" data-value="5"></i>
        </div>
        <div className="rating-buttons">
          <button id="quitBtn">Quit</button>
          <button id="newPartnerBtn">Search New Partner</button>
        </div>
      </div>

      <div id="toast"></div>

      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        html,
        body {
          height: 100%;
          background: #000;
          font-family: "Segoe UI", sans-serif;
          overflow: hidden;
        }

        .video-container {
          position: relative;
          width: 100%;
          height: 100%;
        }
        #remoteVideo {
          width: 100%;
          height: 100%;
          object-fit: cover;
          background: #000;
        }
        #localBox {
          position: absolute;
          bottom: 20px;
          right: 20px;
          width: 220px;
          height: 150px;
          border: 2px solid #ff4d8d;
          border-radius: 14px;
          overflow: hidden;
          cursor: grab;
          z-index: 2000;
          background: #111;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5);
        }
        #localBox video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scaleX(-1);
        }

        .control-bar {
          position: fixed;
          bottom: 18px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 18px;
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.6);
          border-radius: 16px;
          z-index: 3000;
          backdrop-filter: blur(8px);
        }
        .control-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #18181b;
          color: #fff;
          border-radius: 14px;
          width: 68px;
          height: 68px;
          cursor: pointer;
        }
        .control-btn.danger {
          background: #9b1c2a;
        }

        #ratingOverlay {
          position: fixed;
          inset: 0;
          display: none;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.9);
          color: #fff;
          z-index: 4000;
        }
        .hearts {
          display: flex;
          gap: 12px;
          font-size: 44px;
        }
        .hearts i {
          color: #666;
          cursor: pointer;
        }
        .hearts i:hover {
          color: #ff4d8d;
        }
        .hearts i.selected {
          color: #ff1744;
        }
        .floating-emoji {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
          z-index: 5000;
        }

        @keyframes fall {
          0% {
            transform: translateY(-100vh);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh);
            opacity: 0;
          }
        }
        @keyframes orbit {
          0% {
            transform: rotate(0deg) translateX(0) translateY(0);
            opacity: 1;
          }
          100% {
            transform: rotate(360deg) translateX(150px) translateY(150px);
            opacity: 0;
          }
        }
        @keyframes flyUp {
          0% {
            transform: translateY(0);
            opacity: 1;
          }
          100% {
            transform: translateY(-100vh) rotate(720deg);
            opacity: 0;
          }
        }
        @keyframes burst {
          0% {
            transform: scale(0.5) translateY(0);
            opacity: 1;
          }
          50% {
            transform: scale(1.5) translateY(-50px);
          }
          100% {
            transform: scale(0.8) translateY(-100vh);
            opacity: 0;
          }
        }

        #toast {
          position: fixed;
          left: 50%;
          bottom: 110px;
          transform: translateX(-50%);
          background: #111;
          color: #fff;
          padding: 10px 14px;
          border-radius: 8px;
          display: none;
          z-index: 5000;
        }
      `}</style>
    </>
  );
}
