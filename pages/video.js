"use client";
import { useEffect } from "react";
import io from "socket.io-client";

export default function VideoPage() {
  useEffect(() => {
    const BACKEND_URL = "https://milan-j9u9.onrender.com";

    // ---- ICE servers (STUN + optional TURN from localStorage) ----
    const baseIce = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478?transport=udp" }
    ];
    const turnUrl = localStorage.getItem("turnUrl");
    const turnUser = localStorage.getItem("turnUser");
    const turnPass = localStorage.getItem("turnPass");
    const ICE_CONFIG = {
      iceServers: turnUrl && turnUser && turnPass
        ? [...baseIce, { urls: turnUrl, username: turnUser, credential: turnPass }]
        : baseIce
    };

    // ---- State refs ----
    let socket = null;
    let pc = null;
    let localStream = null;
    let makingOffer = false;
    let ignoreOffer = false;
    let ratedValue = 0;

    // ---- Helpers ----
    const $ = (id) => document.getElementById(id);
    const toast = (msg, ms = 1800) => {
      const t = $("toast");
      if (!t) return;
      t.textContent = msg;
      t.style.display = "block";
      setTimeout(() => (t.style.display = "none"), ms);
    };
    const showOverlay = () => { const r = $("ratingOverlay"); if (r) r.style.display = "flex"; };
    const hideOverlay = () => { const r = $("ratingOverlay"); if (r) r.style.display = "none"; };

    // ---- Cleanup ----
    const cleanup = () => {
      try { socket?.disconnect(); } catch {}
      try {
        pc?.getSenders()?.forEach((s) => s.track && s.track.stop());
        localStream?.getTracks()?.forEach((t) => t.stop());
        pc?.close();
      } catch {}
      pc = null;
      localStream = null;
    };

    // ---- PeerConnection factory ----
    const createPC = () => {
      if (pc) return;

      pc = new RTCPeerConnection(ICE_CONFIG);

      // Local tracks
      localStream?.getTracks().forEach((t) => pc.addTrack(t, localStream));

      // Remote track handler
      pc.ontrack = (e) => {
        const rv = $("remoteVideo");
        if (!rv) return;
        const [stream] = e.streams;
        if (rv.srcObject !== stream) rv.srcObject = stream;
        rv.play?.().catch(() => {});
      };

      // ICE candidates to signaling
      pc.onicecandidate = (e) => {
        if (e.candidate) socket?.emit("candidate", e.candidate);
      };

      // Connection state feedback
      pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState;
        if (s === "connected") toast("Connected");
        if (s === "failed" || s === "disconnected") {
          toast("Reconnecting…");
          pc.restartIce?.();
        }
      };

      pc.onnegotiationneeded = async () => {
        if (!socket) return;
        try {
          makingOffer = true;
          const offer = await pc.createOffer({ iceRestart: false });
          await pc.setLocalDescription(offer);
          socket.emit("offer", pc.localDescription);
        } catch (err) {
          // ignore
        } finally {
          makingOffer = false;
        }
      };
    };

    // ---- Start flow ----
    (async function start() {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const lv = $("localVideo");
        if (lv) {
          lv.srcObject = localStream;
          lv.play?.().catch(() => {});
        }
      } catch {
        toast("Camera/Mic access required");
        return;
      }

      socket = io(BACKEND_URL, { transports: ["websocket"] });

      socket.on("connect", () => {
        const token = localStorage.getItem("token");
        const roomCode = sessionStorage.getItem("roomCode");
        socket.emit("joinVideo", { token, roomCode });
      });

      socket.on("ready", async () => {
        createPC();
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("offer", pc.localDescription);
        } catch {}
      });

      socket.on("offer", async (offer) => {
        createPC();
        const offerDesc = new RTCSessionDescription(offer);
        const polite = true;

        const readyForOffer =
          !makingOffer && (pc.signalingState === "stable" || pc.signalingState === "have-local-offer");
        ignoreOffer = !polite && !readyForOffer;
        if (ignoreOffer) return;

        try {
          await pc.setRemoteDescription(offerDesc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("answer", pc.localDescription);
        } catch {}
      });

      socket.on("answer", async (answer) => {
        if (!pc) createPC();
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch {}
      });

      socket.on("candidate", async (candidate) => {
        if (!pc) createPC();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {}
      });

      socket.on("partnerDisconnected", () => { toast("Partner disconnected"); showOverlay(); });
      socket.on("partnerLeft", () => { toast("Partner left"); showOverlay(); });
    })();

    // ---- UI: Controls ----
    const micBtn = $("micBtn");
    micBtn.onclick = () => {
      const t = localStream?.getAudioTracks?.()[0];
      if (!t) return;
      t.enabled = !t.enabled;
      micBtn.classList.toggle("inactive", !t.enabled);
      toast(t.enabled ? "Mic On" : "Mic Off");
    };

    const camBtn = $("camBtn");
    camBtn.onclick = () => {
      const t = localStream?.getVideoTracks?.()[0];
      if (!t) return;
      t.enabled = !t.enabled;
      camBtn.classList.toggle("inactive", !t.enabled);
      toast(t.enabled ? "Camera On" : "Camera Off");
    };

    const screenBtn = $("screenShareBtn");
    screenBtn.onclick = async () => {
      if (!pc) return toast("Not connected");
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screen.getVideoTracks()[0];
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
        if (sender) sender.replaceTrack(screenTrack);
        toast("Screen sharing started");
        screenTrack.onended = () => {
          const camTrack = localStream?.getVideoTracks?.()[0];
          if (camTrack && sender) sender.replaceTrack(camTrack);
          toast("Screen sharing stopped");
        };
      } catch {
        toast("Screen share cancelled");
      }
    };

    const disconnectBtn = $("disconnectBtn");
    disconnectBtn.onclick = () => {
      try { socket?.emit("partnerLeft"); } catch {}
      cleanup();
      showOverlay();
    };

    // ---- Local video draggable & zoom ----
    const box = $("localBox");
    let dragging = false, dx = 0, dy = 0, large = true;
    const startDrag = (x, y) => {
      const r = box.getBoundingClientRect();
      dx = x - r.left; dy = y - r.top; dragging = true;
      box.style.cursor = "grabbing";
    };
    const moveDrag = (x, y) => {
      if (!dragging) return;
      box.style.left = `${x - dx}px`;
      box.style.top = `${y - dy}px`;
    };
    const stopDrag = () => { dragging = false; box.style.cursor = "grab"; };

    box.addEventListener("mousedown", (e) => startDrag(e.clientX, e.clientY));
    document.addEventListener("mousemove", (e) => moveDrag(e.clientX, e.clientY));
    document.addEventListener("mouseup", stopDrag);

    box.addEventListener("touchstart", (e) => {
      const t = e.touches[0]; startDrag(t.clientX, t.clientY);
    }, { passive: true });
    document.addEventListener("touchmove", (e) => {
      const t = e.touches[0]; moveDrag(t.clientX, t.clientY);
    }, { passive: true });
    document.addEventListener("touchend", stopDrag);

    box.addEventListener("dblclick", () => {
      large = !large;
      box.classList.toggle("mini", !large);
    });

    // ---- Rating hearts ----
    const heartsWrap = $("heartsWrap");
    const heartEls = heartsWrap?.querySelectorAll("i") || [];
    heartEls.forEach((el) => {
      el.addEventListener("mouseenter", () => {
        const v = Number(el.dataset.value);
        heartEls.forEach((h, i) => h.classList.toggle("hovered", i < v));
      });
      el.addEventListener("mouseleave", () => heartEls.forEach((h) => h.classList.remove("hovered")));
      el.addEventListener("click", () => {
        ratedValue = Number(el.dataset.value);
        heartEls.forEach((h, i) => h.classList.toggle("selected", i < ratedValue));
      });
    });

    $("quitBtn").onclick = () => {
      if (ratedValue && socket) socket.emit("ratePartner", { rating: ratedValue });
      cleanup();
      window.location.href = "/";
    };
    $("newPartnerBtn").onclick = () => {
      if (!ratedValue) { toast("Please rate your partner ❤️"); return; }
      if (socket) socket.emit("ratePartner", { rating: ratedValue });
      cleanup();
      window.location.href = "/connect";
    };

    // Unmount
    return () => cleanup();
  }, []);

  return (
    <>
      <div className="video-container">
        <video id="remoteVideo" autoPlay playsInline></video>
        <div id="localBox">
          <video id="localVideo" autoPlay playsInline muted></video>
        </div>
      </div>

      {/* Glassy Control Bar */}
      <div className="control-bar">
        <button id="micBtn" className="control-btn">
          <i className="fas fa-microphone"></i><span>Mic</span>
        </button>
        <button id="camBtn" className="control-btn">
          <i className="fas fa-video"></i><span>Camera</span>
        </button>
        <button id="screenShareBtn" className="control-btn">
          <i className="fas fa-desktop"></i><span>Share</span>
        </button>
        <button id="disconnectBtn" className="control-btn danger">
          <i className="fas fa-phone-slash"></i><span>End</span>
        </button>
      </div>

      {/* Rating Overlay */}
      <div id="ratingOverlay">
        <h2>Rate your partner ❤️</h2>
        <div id="heartsWrap" className="hearts">
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
        *{margin:0;padding:0;box-sizing:border-box}
        html,body{height:100%;background:#000;font-family:'Segoe UI',sans-serif;overflow:hidden}

        .video-container{position:relative;width:100%;height:100%}
        #remoteVideo{width:100%;height:100%;object-fit:cover;background:#000}

        #localBox{
          position:absolute;bottom:20px;right:20px;
          width:320px;height:220px;
          border:2px solid rgba(255,77,141,.9);
          border-radius:14px;overflow:hidden;cursor:grab;z-index:2000;background:#0b0b0b;
          box-shadow:0 18px 40px rgba(0,0,0,.55);
          transition:transform .2s ease, width .2s ease, height .2s ease;
          backdrop-filter: blur(6px);
        }
        #localBox.mini{ width:180px; height:128px; }
        #localBox video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}

        @media(max-width:768px){
          #localBox{ width:200px; height:140px; }
          #localBox.mini{ width:150px; height:110px; }
        }

        .control-bar{
          position:fixed;left:50%;transform:translateX(-50%);
          bottom:22px;display:flex;gap:18px;z-index:3000;
          background:rgba(255,255,255,.08);
          border:1px solid rgba(255,255,255,.18);
          padding:12px 16px;border-radius:20px;
          backdrop-filter: blur(12px);
          box-shadow:0 10px 30px rgba(0,0,0,.35);
        }
        .control-btn{
          display:flex;flex-direction:column;align-items:center;gap:6px;
          min-width:86px;padding:12px 14px;border-radius:16px;
          background:rgba(20,20,22,.6);color:#fff;border:1px solid rgba(255,255,255,.18);
          cursor:pointer;transition:transform .15s ease, background .15s ease, border-color .15s ease;
          user-select:none;
        }
        .control-btn:hover{ transform:translateY(-2px); border-color:#ff4d8d; }
        .control-btn:active{ transform:translateY(0); }
        .control-btn.inactive{ opacity:.55; }
        .control-btn i{ font-size:18px; }
        .control-btn span{ font-size:13px; letter-spacing:.2px; }
        .control-btn.danger{
          background:rgba(210,24,38,.75);
          border-color:rgba(255,90,121,.9);
        }

        #ratingOverlay{
          position:fixed;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;
          background:rgba(0,0,0,.88);color:#fff;z-index:4000;padding:20px;text-align:center;
        }
        #ratingOverlay h2{ margin-bottom:18px; }
        .hearts{display:flex;gap:14px;font-size:50px;margin-bottom:16px}
        .hearts i{color:#555;cursor:pointer;transition:transform .12s ease, color .12s ease}
        .hearts i.hovered{color:#ff6b9e; transform:scale(1.05)}
        .hearts i.selected{color:#ff1744}
        .rating-buttons{display:flex;gap:14px}
        .rating-buttons button{
          background:#ff4d8d;color:#fff;border:none;border-radius:10px;padding:10px 16px;cursor:pointer;
          box-shadow:0 10px 20px rgba(255,77,141,.25);
        }

        #toast{
          position:fixed;left:50%;bottom:100px;transform:translateX(-50%);
          background:rgba(15,15,15,.9);color:#fff;padding:10px 14px;border-radius:10px;display:none;z-index:5000;
          border:1px solid rgba(255,255,255,.15);backdrop-filter: blur(8px);
        }
      `}</style>
    </>
  );
}
