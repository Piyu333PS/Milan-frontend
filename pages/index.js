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

    const cleanup = () => {
      try { socket?.disconnect(); } catch {}
      try {
        pc?.getSenders()?.forEach((s) => s.track && s.track.stop());
        pc?.close();
      } catch {}
      pc = null;
      localStream = null;
    };

    (async function start() {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const lv = get("localVideo");
        if (lv) lv.srcObject = localStream;
      } catch (err) {
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
          if (rv && e.streams[0]) {
            rv.srcObject = e.streams[0];
          }
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) socket.emit("candidate", e.candidate);
        };
      };

      socket.on("ready", () => createPC());

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
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {}
      });

      socket.on("partnerDisconnected", () => {
        showToast("Partner disconnected");
        showRating();
      });

      socket.on("partnerLeft", () => {
        showToast("Partner left");
        showRating();
      });

      // ensure only one offer at a time
      setTimeout(async () => {
        if (!pc) createPC();
        if (pc.signalingState === "stable") {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("offer", offer);
        }
      }, 1000);
    })();

    // === Buttons ===
    const micBtn = get("micBtn");
    micBtn.onclick = () => {
      const t = localStream?.getAudioTracks()[0];
      if (!t) return;
      t.enabled = !t.enabled;
      micBtn.classList.toggle("inactive", !t.enabled);
      showToast(t.enabled ? "🎤 Mic On" : "🔇 Mic Off");
    };

    const camBtn = get("camBtn");
    camBtn.onclick = () => {
      const t = localStream?.getVideoTracks()[0];
      if (!t) return;
      t.enabled = !t.enabled;
      camBtn.classList.toggle("inactive", !t.enabled);
      showToast(t.enabled ? "📸 Camera On" : "📷 Camera Off");
    };

    const screenBtn = get("screenShareBtn");
    screenBtn.onclick = async () => {
      if (!pc) return showToast("No connection");
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const track = screen.getVideoTracks()[0];
        const sender = pc.getSenders().find((s) => s.track.kind === "video");
        sender.replaceTrack(track);
        track.onended = () => sender.replaceTrack(localStream.getVideoTracks()[0]);
        showToast("🖥️ Screen sharing");
      } catch {
        showToast("❌ Screen share cancelled");
      }
    };

    const disconnectBtn = get("disconnectBtn");
    disconnectBtn.onclick = () => {
      try { socket?.emit("partnerLeft"); } catch {}
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

    // draggable local video
    const lb = get("localBox");
    let dragging = false, dx = 0, dy = 0;
    const startDrag = (x, y) => {
      const rect = lb.getBoundingClientRect();
      dx = x - rect.left; dy = y - rect.top; dragging = true;
    };
    const moveDrag = (x, y) => {
      if (!dragging) return;
      lb.style.left = `${x - dx}px`;
      lb.style.top = `${y - dy}px`;
    };
    const stopDrag = () => (dragging = false);

    lb.addEventListener("mousedown", (e) => startDrag(e.clientX, e.clientY));
    document.addEventListener("mousemove", (e) => moveDrag(e.clientX, e.clientY));
    document.addEventListener("mouseup", stopDrag);
    lb.addEventListener("touchstart", (e) => {
      const t = e.touches[0]; startDrag(t.clientX, t.clientY);
    });
    document.addEventListener("touchmove", (e) => {
      const t = e.touches[0]; moveDrag(t.clientX, t.clientY);
    });
    document.addEventListener("touchend", stopDrag);

    return () => cleanup();
  }, []);

  return (
    <>
      <div className="video-container">
        <video id="remoteVideo" autoPlay playsInline></video>
        <div id="localBox"><video id="localVideo" autoPlay playsInline muted></video></div>
      </div>

      {/* === Icon Only Control Bar === */}
      <div className="control-bar">
        <button id="micBtn" className="control-btn" title="Mic"><i className="fas fa-microphone"></i></button>
        <button id="camBtn" className="control-btn" title="Camera"><i className="fas fa-video"></i></button>
        <button id="screenShareBtn" className="control-btn" title="Share Screen"><i className="fas fa-desktop"></i></button>
        <button id="disconnectBtn" className="control-btn danger" title="End Call"><i className="fas fa-phone-slash"></i></button>
      </div>

      <div id="ratingOverlay">
        <h2>💖 Rate your partner 💖</h2>
        <div className="hearts">
          <i className="far fa-heart" data-value="1"></i>
          <i className="far fa-heart" data-value="2"></i>
          <i className="far fa-heart" data-value="3"></i>
          <i className="far fa-heart" data-value="4"></i>
          <i className="far fa-heart" data-value="5"></i>
        </div>
        <div className="rating-buttons">
          <button id="quitBtn">💔 Quit</button>
          <button id="newPartnerBtn">💞 New Partner</button>
        </div>
      </div>

      <div id="toast"></div>

      <style jsx global>{`
        *{margin:0;padding:0;box-sizing:border-box}
        html,body{height:100%;background:#1b0034;font-family:'Segoe UI',sans-serif;overflow:hidden}
        .video-container{position:relative;width:100%;height:100%}
        #remoteVideo{width:100%;height:100%;object-fit:cover;background:#000}
        #localBox{position:absolute;bottom:20px;right:20px;width:200px;height:140px;border:2px solid #ff4d8d;border-radius:12px;overflow:hidden;cursor:grab;z-index:2000;background:rgba(255,255,255,0.05);backdrop-filter:blur(10px);box-shadow:0 8px 30px rgba(255,77,141,.5)}
        #localBox video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}
        @media(max-width:768px){#localBox{width:140px;height:100px}}

        /* === Icon Control Bar === */
        .control-bar {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 22px;
          padding: 14px 20px;
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(12px);
          border-radius: 24px;
          border: 1px solid rgba(255,77,141,0.3);
          z-index: 3000;
        }

        .control-btn {
          width: 65px;
          height: 65px;
          border-radius: 50%;
          border: none;
          background: linear-gradient(145deg, rgba(255,182,193,0.6), rgba(255,105,180,0.6));
          color: #fff;
          font-size: 26px;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(255,105,180,0.4);
          transition: all 0.3s ease;
        }

        .control-btn:hover {
          background: linear-gradient(145deg, rgba(255,182,193,0.9), rgba(255,105,180,0.9));
          transform: scale(1.2);
          box-shadow: 0 6px 20px rgba(255,105,180,0.6);
        }

        .control-btn.inactive { opacity: 0.6; filter: grayscale(30%); }
        .control-btn.danger {
          background: linear-gradient(145deg, rgba(255,69,102,0.8), rgba(255,20,60,0.8));
        }
        .control-btn.danger:hover {
          background: linear-gradient(145deg, rgba(255,69,102,1), rgba(255,20,60,1));
        }

        /* Toast & Overlay remain same */
        #toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:rgba(17,17,17,0.85);color:#fff;padding:12px 18px;border-radius:10px;display:none;z-index:5000;font-size:14px}
      `}</style>
    </>
  );
}
