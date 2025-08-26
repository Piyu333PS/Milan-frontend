"use client";
import { useEffect } from "react";
import io from "socket.io-client";

export default function VideoPage() {
  useEffect(() => {
    // ====== CONFIG ======
    const BACKEND_URL = "https://milan-j9u9.onrender.com";
    const ICE_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

    // ====== STATE ======
    let socket = null;
    let pc = null;                 // RTCPeerConnection (single instance)
    let localStream = null;
    let hasMadeOffer = false;      // to avoid offer glare
    let inRoom = false;

    // ====== UI HOOKS ======
    const remoteVideo = document.getElementById("remoteVideo");
    const localVideo  = document.getElementById("localVideo");
    const localBox    = document.getElementById("localBox");
    const toast       = document.getElementById("toast");
    const ratingOverlay = document.getElementById("ratingOverlay");

    // --------- helpers ----------
    const showToast = (msg, ms = 2200) => {
      if (!toast) return;
      toast.textContent = msg;
      toast.style.display = "block";
      setTimeout(() => (toast.style.display = "none"), ms);
    };

    const showRating = () => {
      if (ratingOverlay) ratingOverlay.style.display = "flex";
    };

    const hideRating = () => {
      if (ratingOverlay) ratingOverlay.style.display = "none";
    };

    // Create PC only once
    const createPeerConnection = () => {
      if (pc) return pc;
      pc = new RTCPeerConnection(ICE_CONFIG);

      // Local tracks
      if (localStream) {
        localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
      }

      // Remote track(s)
      pc.ontrack = (evt) => {
        if (evt.streams && evt.streams[0]) {
          remoteVideo.srcObject = evt.streams[0];
          remoteVideo.style.display = "block";
        }
      };

      // ICE candidates
      pc.onicecandidate = (evt) => {
        if (evt.candidate) {
          socket?.emit("candidate", evt.candidate);
        }
      };

      // On connection state change
      pc.onconnectionstatechange = () => {
        // console.log("PC state:", pc.connectionState);
        if (["failed", "disconnected"].includes(pc.connectionState)) {
          showToast("Connection lost");
        }
      };

      return pc;
    };

    // Make an offer safely (no glare)
    const makeOffer = async () => {
      if (!pc || hasMadeOffer) return;
      hasMadeOffer = true;
      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);
        socket?.emit("offer", offer);
      } catch (e) {
        console.error("makeOffer error:", e);
        hasMadeOffer = false;
      }
    };

    // Graceful cleanup
    const cleanup = () => {
      try {
        if (socket && inRoom) socket.emit("leaveVideo");
      } catch {}
      try {
        socket?.disconnect();
      } catch {}
      try {
        pc?.getSenders()?.forEach(s => s.track && s.track.stop());
        pc?.close();
      } catch {}
      pc = null;
      localStream = null;
      hasMadeOffer = false;
      inRoom = false;
    };

    // ====== INIT ======
    (async function init() {
      // 1) Get media
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        localVideo.style.display = "block";
      } catch (err) {
        console.error("Media error:", err);
        showToast("Camera/Mic permission required");
        return;
      }

      // 2) Connect socket
      socket = io(BACKEND_URL, { transports: ["websocket"] });

      const token = localStorage.getItem("token");
      const roomCode = sessionStorage.getItem("roomCode");
      socket.emit("joinVideo", { token, roomCode });

      // Server should emit 'ready' when two users are in same room
      socket.on("ready", async () => {
        // Create PC and only the first ready peer will offer (race-safe via hasMadeOffer guard)
        createPeerConnection();
        await makeOffer();
        inRoom = true;
        showToast("Connected. Say hi! 👋");
      });

      // If your backend emits 'joined' first time, still create PC early
      socket.on("joined", () => {
        createPeerConnection();
        inRoom = true;
        showToast("Waiting for partner…");
      });

      // Incoming offer
      socket.on("offer", async (offer) => {
        // If we already made an offer, ignore to prevent glare
        if (hasMadeOffer) return;
        createPeerConnection();
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("answer", answer);
        } catch (e) {
          console.error("on offer error:", e);
        }
      });

      // Incoming answer
      socket.on("answer", async (answer) => {
        try {
          if (!pc?.currentRemoteDescription) {
            await pc?.setRemoteDescription(new RTCSessionDescription(answer));
          }
        } catch (e) {
          console.error("on answer error:", e);
        }
      });

      // Incoming ICE
      socket.on("candidate", async (candidate) => {
        try {
          await pc?.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("on candidate error:", e);
        }
      });

      // Partner left (server should broadcast this when other peer leaves)
      socket.on("partnerDisconnected", () => {
        showToast("Partner disconnected");
        showRating();
      });

      // If server supports explicit notice
      socket.on("partnerLeft", () => {
        showToast("Partner ended the chat");
        showRating();
      });

      // Safety: auto-create the PC if not already when any signaling arrives
      ["offer", "answer", "candidate"].forEach(ev =>
        socket.on(ev, () => { if (!pc) createPeerConnection(); })
      );

      // 3) Add local tracks (if PC was created before stream)
      createPeerConnection();
    })();

    // ====== CONTROLS ======
    // Mic
    document.getElementById("micBtn").onclick = () => {
      if (!localStream) return;
      const track = localStream.getAudioTracks()[0];
      if (!track) return;
      track.enabled = !track.enabled;
      document.getElementById("micBtn").classList.toggle("inactive", !track.enabled);
      showToast(track.enabled ? "Mic On" : "Mic Off");
    };

    // Camera
    document.getElementById("camBtn").onclick = () => {
      if (!localStream) return;
      const track = localStream.getVideoTracks()[0];
      if (!track) return;
      track.enabled = !track.enabled;
      document.getElementById("camBtn").classList.toggle("inactive", !track.enabled);
      showToast(track.enabled ? "Camera On" : "Camera Off");
    };

    // Screen Share
    document.getElementById("screenShareBtn").onclick = async () => {
      if (!pc) return;
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screen.getVideoTracks()[0];
        const sender = pc.getSenders().find(s => s.track && s.track.kind === "video");
        if (sender) sender.replaceTrack(screenTrack);
        showToast("Sharing screen");

        // When user stops sharing, revert to camera
        screenTrack.onended = () => {
          const camTrack = localStream?.getVideoTracks()[0];
          if (camTrack && sender) sender.replaceTrack(camTrack);
          document.getElementById("screenShareBtn").classList.remove("active");
          showToast("Screen share ended");
        };
        document.getElementById("screenShareBtn").classList.add("active");
      } catch {
        showToast("Screen share cancelled");
      }
    };

    // End / Disconnect (notify partner + show rating)
    document.getElementById("disconnectBtn").onclick = () => {
      try { socket?.emit("leaveVideo"); socket?.emit("partnerLeft"); } catch {}
      showRating();
      cleanup();
    };

    // Quit button inside rating overlay -> go home
    document.getElementById("quitBtn").onclick = () => {
      window.location.href = "/";
    };

    // New partner button -> connect page
    document.getElementById("newPartnerBtn").onclick = () => {
      try { socket?.emit("leaveVideo"); socket?.emit("partnerLeft"); } catch {}
      window.location.href = "/connect";
    };

    // Hearts rating (UX only; no server save needed)
    const hearts = document.querySelectorAll(".hearts i");
    hearts.forEach(h => {
      h.addEventListener("click", () => {
        hearts.forEach(x => x.classList.remove("selected"));
        h.classList.add("selected");
        showToast(`You rated ${h.dataset.value} ❤️`);
      });
    });

    // ====== DRAG LOCAL PREVIEW ======
    let dragging = false, dx = 0, dy = 0;
    const startDrag = (x, y) => {
      const rect = localBox.getBoundingClientRect();
      dx = x - rect.left;
      dy = y - rect.top;
      dragging = true;
      localBox.style.cursor = "grabbing";
    };
    const doDrag = (x, y) => {
      if (!dragging) return;
      const maxX = window.innerWidth  - localBox.offsetWidth  - 8;
      const maxY = window.innerHeight - localBox.offsetHeight - 8;
      const nx = Math.min(Math.max(8, x - dx), maxX);
      const ny = Math.min(Math.max(8, y - dy), maxY);
      localBox.style.left = `${nx}px`;
      localBox.style.top  = `${ny}px`;
    };
    const stopDrag = () => { dragging = false; localBox.style.cursor = "grab"; };

    // Mouse
    localBox.addEventListener("mousedown", (e) => startDrag(e.clientX, e.clientY));
    document.addEventListener("mousemove", (e) => doDrag(e.clientX, e.clientY));
    document.addEventListener("mouseup", stopDrag);

    // Touch
    localBox.addEventListener("touchstart", (e) => {
      const t = e.touches[0]; startDrag(t.clientX, t.clientY);
    });
    document.addEventListener("touchmove", (e) => {
      const t = e.touches[0]; doDrag(t.clientX, t.clientY);
    }, { passive: true });
    document.addEventListener("touchend", stopDrag);

    // ====== CLEANUP ======
    return () => cleanup();
  }, []);

  return (
    <>
      {/* Remote video fills screen */}
      <div className="video-container">
        <video id="remoteVideo" autoPlay playsInline></video>

        {/* Local movable preview */}
        <div id="localBox" title="Drag to move">
          <video id="localVideo" autoPlay playsInline muted></video>
        </div>
      </div>

      {/* Professional control bar */}
      <div className="control-bar">
        <button id="micBtn" className="control-btn" aria-label="Toggle mic">
          <i className="fas fa-microphone"></i>
          <span>Mic</span>
        </button>
        <button id="camBtn" className="control-btn" aria-label="Toggle camera">
          <i className="fas fa-video"></i>
          <span>Camera</span>
        </button>
        <button id="screenShareBtn" className="control-btn" aria-label="Share screen">
          <i className="fas fa-desktop"></i>
          <span>Share</span>
        </button>
        <button id="disconnectBtn" className="control-btn danger" aria-label="End call">
          <i className="fas fa-phone-slash"></i>
          <span>End</span>
        </button>
      </div>

      {/* Rating Overlay */}
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

      {/* Toast */}
      <div id="toast"></div>

      {/* Styles */}
      <style jsx global>{`
        *{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;background:#000;color:#fff;font-family:'Segoe UI',sans-serif;overflow:hidden}

        .video-container{position:relative;width:100%;height:100%;}
        #remoteVideo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000;}

        /* Bigger WhatsApp-style local preview */
        #localBox{
          position:absolute; bottom:20px; right:20px;
          width:220px; height:160px; border:2px solid #ff4d8d;
          border-radius:12px; overflow:hidden; cursor:grab; z-index:2000;
          box-shadow:0 10px 24px rgba(0,0,0,.55);
          background:#111;
        }
        #localBox video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1);}

        @media(max-width:768px){
          #localBox{ width:160px; height:120px; bottom:16px; right:16px; }
        }

        .control-bar{
          position:fixed; left:0; bottom:0; width:100%;
          display:flex; justify-content:center; gap:14px;
          padding:10px 12px; background:linear-gradient(to top, rgba(0,0,0,.7), rgba(0,0,0,.2));
          z-index:2500; backdrop-filter: blur(6px); border-top:1px solid rgba(255,255,255,.08);
        }
        .control-btn{
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          background:#18181b; color:#fff; border:1px solid rgba(255,255,255,.12);
          border-radius:14px; padding:10px 14px; min-width:78px;
          font-weight:600; gap:6px; transition:.2s; box-shadow:0 6px 16px rgba(0,0,0,.35);
        }
        .control-btn i{font-size:18px}
        .control-btn span{font-size:12px; opacity:.9}
        .control-btn:hover{transform:translateY(-2px); border-color:#ff4d8d; box-shadow:0 8px 20px rgba(255,77,141,.25);}
        .control-btn.inactive{opacity:.6; border-color:#444;}
        .control-btn.danger{background:#9b1c2a; border-color:#ff5a79;}
        .control-btn.danger:hover{background:#c01f35;}

        #ratingOverlay{
          position:fixed; inset:0; display:none; flex-direction:column; align-items:center; justify-content:center;
          background:rgba(0,0,0,.88); z-index:3000; text-align:center; padding:20px;
        }
        #ratingOverlay h2{font-size:28px; margin-bottom:18px;}
        .hearts{display:flex; gap:12px; font-size:48px; cursor:pointer;}
        .hearts i{color:#666; transition:.2s;}
        .hearts i:hover{color:#ff4d8d; transform:scale(1.15);}
        .hearts i.selected{color:#ff1744; transform:scale(1.28); text-shadow:0 0 10px rgba(255,23,68,.6);}
        .rating-buttons{display:flex; gap:16px; margin-top:22px;}
        .rating-buttons button{
          background:#ff4d8d; border:none; color:#fff; border-radius:10px; padding:10px 18px; font-size:16px;
          cursor:pointer; transition:.2s; box-shadow:0 6px 18px rgba(255,77,141,.25);
        }
        .rating-buttons button:hover{transform:translateY(-1px);}

        #toast{
          position:fixed; left:50%; bottom:90px; transform:translateX(-50%);
          background:#0b0b0c; border:1px solid #333; color:#fff;
          padding:10px 14px; border-radius:10px; display:none; z-index:3200;
          box-shadow:0 8px 18px rgba(0,0,0,.4);
        }
      `}</style>
    </>
  );
}
