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

    // polite signalling flags (MDN-style)
    let makingOffer = false;
    let polite = false;
    let ignoreOffer = false;

    // UI elements (get later to be safe)
    const get = (id) => document.getElementById(id);
    const toast = () => get("toast");
    const ratingOverlay = () => get("ratingOverlay");
    const remoteVideo = () => get("remoteVideo");
    const localVideo = () => get("localVideo");
    const localBox = () => get("localBox");

    const showToast = (msg, ms = 1800) => {
      const t = toast();
      if (!t) return;
      t.textContent = msg;
      t.style.display = "block";
      setTimeout(() => (t.style.display = "none"), ms);
    };

    const showRating = () => {
      const r = ratingOverlay();
      if (r) r.style.display = "flex";
    };
    const hideRating = () => {
      const r = ratingOverlay();
      if (r) r.style.display = "none";
    };

    // create or reuse RTCPeerConnection
    function createPeerConnection() {
      if (pc) return pc;
      pc = new RTCPeerConnection(ICE_CONFIG);

      // add any existing local tracks
      if (localStream) localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

      // when remote tracks arrive
      pc.ontrack = (e) => {
        if (e.streams && e.streams[0]) {
          const rv = remoteVideo();
          rv.srcObject = e.streams[0];
          rv.style.display = "block";
        }
      };

      // ICE candidate => send to server
      pc.onicecandidate = (e) => {
        if (e.candidate) socket?.emit("candidate", e.candidate);
      };

      // negotiationneeded -> createOffer safely
      pc.onnegotiationneeded = async () => {
        try {
          makingOffer = true;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket?.emit("offer", offer);
        } catch (err) {
          console.error("negotiationneeded error:", err);
        } finally {
          makingOffer = false;
        }
      };

      pc.onconnectionstatechange = () => {
        // can show connection state if needed
        // console.log("pc state", pc.connectionState);
        if (pc.connectionState === "failed") showToast("Connection failed");
      };

      return pc;
    }

    // cleanup routine
    function cleanup() {
      try {
        socket && socket.emit("disconnectByUser");
        socket && socket.emit("leaveVideo");
        socket && socket.emit("partnerLeft");
      } catch {}
      try { socket?.disconnect(); } catch {}
      try {
        pc?.getSenders()?.forEach(s => s.track && s.track.stop());
        pc?.close();
      } catch {}
      pc = null;
      localStream = null;
    }

    // start: getMedia, connect socket and join room
    (async function start() {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const lv = localVideo();
        if (lv) { lv.srcObject = localStream; lv.style.display = "block"; }
      } catch (err) {
        console.error("getUserMedia failed:", err);
        showToast("Camera/Mic access needed");
        return;
      }

      // connect socket
      socket = io(BACKEND_URL, { transports: ["websocket"] });

      // On connect: store own id, ask server to join video room
      socket.on("connect", () => {
        const token = localStorage.getItem("token");
        const roomCode = sessionStorage.getItem("roomCode");
        socket.emit("joinVideo", { token, roomCode });
      });

      // Server may send list of room users -> decide polite
      socket.on("roomUsers", (users) => {
        // users is expected to be array of socket ids (including self)
        try {
          const myId = socket.id || "";
          const other = (users || []).find(id => id !== myId);
          if (other) {
            // deterministic: the peer with lexicographically larger id will be polite
            polite = myId > other;
            // create pc now
            createPeerConnection();
            showToast("Room ready");
          }
        } catch (e) { console.warn(e); }
      });

      // If server tells 'joined' (you joined room)
      socket.on("joined", (data) => {
        // server may send users or partnerId
        if (data?.users) {
          socket.emit("getRoomUsers"); // ask if available
        }
        createPeerConnection();
      });

      // If server signals 'ready' (two peers present), create pc and let negotiationstart via onnegotiationneeded
      socket.on("ready", () => {
        createPeerConnection();
        // negotiation will be triggered by onnegotiationneeded when tracks added
      });

      // Incoming offer: polite algorithm
      socket.on("offer", async (offer, fromId) => {
        try {
          // ensure pc exists
          createPeerConnection();

          const isCollision = makingOffer || pc.signalingState !== "stable";
          if (isCollision) {
            if (!polite) {
              // impolite and collision -> ignore this offer
              console.warn("Glare: impolite - ignoring incoming offer");
              return;
            }
            // polite: we will handle it; set ignoreOffer false
            ignoreOffer = false;
          }

          // set remote and answer
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("answer", answer);
        } catch (e) {
          console.error("handle offer error:", e);
        }
      });

      // Incoming answer
      socket.on("answer", async (answer) => {
        try {
          if (!pc) createPeerConnection();
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (e) {
          console.error("handle answer error:", e);
        }
      });

      // Incoming candidate
      socket.on("candidate", async (candidate) => {
        try {
          if (!pc) createPeerConnection();
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("handle candidate error:", e);
        }
      });

      // Partner disconnected or left
      socket.on("partnerDisconnected", () => {
        showToast("Partner disconnected");
        showRating();
      });
      socket.on("partnerLeft", () => {
        showToast("Partner left");
        showRating();
      });

      // Safety: if server forwards signaling with different signature (offer only single arg)
      socket.on("offer_single", async (offer) => {
        socket.emit("offer", offer); // re-route to standard handler or just process
      });

      // Ask server for users if available
      setTimeout(() => {
        try { socket.emit("getRoomUsers"); } catch {}
      }, 500);
    })();

    // Controls wiring (ensure elements exist)
    const micBtn = get("micBtn");
    const camBtn = get("camBtn");
    const screenBtn = get("screenShareBtn");
    const disconnectBtn = get("disconnectBtn");
    const quitBtn = get("quitBtn");
    const newPartnerBtn = get("newPartnerBtn");

    if (micBtn) {
      micBtn.onclick = () => {
        if (!localStream) return;
        const t = localStream.getAudioTracks()[0];
        if (!t) return;
        t.enabled = !t.enabled;
        micBtn.classList.toggle("inactive", !t.enabled);
        showToast(t.enabled ? "Mic On" : "Mic Off");
      };
    }

    if (camBtn) {
      camBtn.onclick = () => {
        if (!localStream) return;
        const t = localStream.getVideoTracks()[0];
        if (!t) return;
        t.enabled = !t.enabled;
        camBtn.classList.toggle("inactive", !t.enabled);
        showToast(t.enabled ? "Camera On" : "Camera Off");
      };
    }

    if (screenBtn) {
      screenBtn.onclick = async () => {
        if (!pc) return showToast("No connection");
        try {
          const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
          const track = screen.getVideoTracks()[0];
          const sender = pc.getSenders().find(s => s.track && s.track.kind === "video");
          if (sender) sender.replaceTrack(track);
          showToast("Screen sharing");
          track.onended = () => {
            const cam = localStream?.getVideoTracks()[0];
            if (cam && sender) sender.replaceTrack(cam);
            showToast("Stopped sharing");
          };
        } catch {
          showToast("Screen share cancelled");
        }
      };
    }

    if (disconnectBtn) {
      disconnectBtn.onclick = () => {
        try { socket?.emit("disconnectByUser"); socket?.emit("leaveVideo"); socket?.emit("partnerLeft"); } catch {}
        showRating();
        cleanup();
      };
    }

    if (quitBtn) {
      quitBtn.onclick = () => {
        cleanup();
        window.location.href = "/";
      };
    }
    if (newPartnerBtn) {
      newPartnerBtn.onclick = () => {
        try { socket?.emit("disconnectByUser"); socket?.emit("leaveVideo"); socket?.emit("partnerLeft"); } catch {}
        cleanup();
        window.location.href = "/connect";
      };
    }

    // Draggable local preview (mouse + touch)
    const lb = localBox();
    if (lb) {
      let dragging = false, dx = 0, dy = 0;
      lb.style.left = `${window.innerWidth - lb.offsetWidth - 20}px`;
      lb.style.top = `${window.innerHeight - lb.offsetHeight - 140}px`;
      lb.style.position = "absolute";

      const start = (x, y) => {
        const rect = lb.getBoundingClientRect();
        dx = x - rect.left; dy = y - rect.top; dragging = true; lb.style.cursor = "grabbing";
      };
      const move = (x, y) => {
        if (!dragging) return;
        const maxX = window.innerWidth - lb.offsetWidth - 8;
        const maxY = window.innerHeight - lb.offsetHeight - 8;
        const nx = Math.min(Math.max(8, x - dx), maxX);
        const ny = Math.min(Math.max(8, y - dy), maxY);
        lb.style.left = `${nx}px`; lb.style.top = `${ny}px`;
      };
      const end = () => { dragging = false; lb.style.cursor = "grab"; };

      lb.addEventListener("mousedown", (e) => start(e.clientX, e.clientY));
      document.addEventListener("mousemove", (e) => move(e.clientX, e.clientY));
      document.addEventListener("mouseup", end);

      lb.addEventListener("touchstart", (e) => { const t = e.touches[0]; start(t.clientX, t.clientY); });
      document.addEventListener("touchmove", (e) => { const t = e.touches[0]; move(t.clientX, t.clientY); }, { passive: true });
      document.addEventListener("touchend", end);
    }

    // Hearts rating: UI only
    const observeHearts = () => {
      const hearts = document.querySelectorAll(".hearts i");
      hearts.forEach(h => h.addEventListener("click", () => {
        hearts.forEach(x => x.classList.remove("selected"));
        h.classList.add("selected");
        showToast(`You rated ${h.dataset.value} ❤️`);
      }));
    };
    observeHearts();

    // cleanup on unmount
    return () => {
      cleanup();
      // remove listeners? (browser unload will clear)
    };
  }, []);

  return (
    <>
      <div className="video-container">
        <video id="remoteVideo" autoPlay playsInline></video>

        <div id="localBox" title="Drag to move">
          <video id="localVideo" autoPlay playsInline muted></video>
        </div>
      </div>

      <div className="control-bar" role="toolbar" aria-label="Video controls">
        <button id="micBtn" className="control-btn" aria-label="Toggle mic"><i className="fas fa-microphone"></i><span>Mic</span></button>
        <button id="camBtn" className="control-btn" aria-label="Toggle camera"><i className="fas fa-video"></i><span>Camera</span></button>
        <button id="screenShareBtn" className="control-btn" aria-label="Share screen"><i className="fas fa-desktop"></i><span>Share</span></button>
        <button id="disconnectBtn" className="control-btn danger" aria-label="End call"><i className="fas fa-phone-slash"></i><span>End</span></button>
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
        *{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;background:#000;color:#fff;font-family:'Segoe UI',sans-serif;overflow:hidden}
        .video-container{position:relative;width:100%;height:100%;}
        #remoteVideo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000;}
        #localBox{position:absolute;bottom:20px;right:20px;width:220px;height:160px;border:2px solid #ff4d8d;border-radius:12px;overflow:hidden;cursor:grab;z-index:2000;background:#111;box-shadow:0 10px 24px rgba(0,0,0,.55)}
        #localBox video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}
        @media(max-width:768px){#localBox{width:160px;height:120px;bottom:16px;right:16px}}
        .control-bar{position:fixed;left:0;bottom:0;width:100%;display:flex;justify-content:center;gap:14px;padding:10px 12px;background:linear-gradient(to top, rgba(0,0,0,.7), rgba(0,0,0,.2));z-index:2500;backdrop-filter: blur(6px);border-top:1px solid rgba(255,255,255,.08)}
        .control-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;background:#18181b;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:10px 14px;min-width:78px;font-weight:600;gap:6px;transition:.2s;box-shadow:0 6px 16px rgba(0,0,0,.35)}
        .control-btn i{font-size:18px}
        .control-btn span{font-size:12px;opacity:.9}
        .control-btn:hover{transform:translateY(-2px);border-color:#ff4d8d;box-shadow:0 8px 20px rgba(255,77,141,.25)}
        .control-btn.inactive{opacity:.6;border-color:#444}
        .control-btn.danger{background:#9b1c2a;border-color:#ff5a79}
        .control-btn.danger:hover{background:#c01f35}
        #ratingOverlay{position:fixed;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,.88);z-index:3000;text-align:center;padding:20px}
        #ratingOverlay h2{font-size:28px;margin-bottom:18px}
        .hearts{display:flex;gap:12px;font-size:48px;cursor:pointer}
        .hearts i{color:#666;transition:.2s}
        .hearts i:hover{color:#ff4d8d;transform:scale(1.15)}
        .hearts i.selected{color:#ff1744;transform:scale(1.28);text-shadow:0 0 10px rgba(255,23,68,.6)}
        .rating-buttons{display:flex;gap:16px;margin-top:22px}
        .rating-buttons button{background:#ff4d8d;border:none;color:#fff;border-radius:10px;padding:10px 18px;font-size:16px;cursor:pointer;transition:.2s;box-shadow:0 6px 18px rgba(255,77,141,.25)}
        .rating-buttons button:hover{transform:translateY(-1px)}
        #toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#0b0b0c;border:1px solid #333;color:#fff;padding:10px 14px;border-radius:10px;display:none;z-index:3200;box-shadow:0 8px 18px rgba(0,0,0,.4)}
      `}</style>
    </>
  );
}
