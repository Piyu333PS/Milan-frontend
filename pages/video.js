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

    // keep a saved camera track so we can restore after screen-share ends reliably
    let cameraTrackSaved = null;

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

    // ⭐ Emoji Animation Function (targets .emoji-container behind content)
    const triggerRatingAnimation = (rating) => {
      const container = document.querySelector("#ratingOverlay .emoji-container");
      if (!container) return;

      const emojiMap = {
        1: ["😐"],
        2: ["🙂"],
        3: ["😊"],
        4: ["😍"],
        5: ["😍", "🥰", "❤️"],
      };

      const emojis = emojiMap[rating] || ["❤️"];
      const count = rating === 5 ? 28 : 18;

      const containerRect = container.getBoundingClientRect();
      for (let i = 0; i < count; i++) {
        const e = document.createElement("div");
        e.className = "floating-emoji";
        e.textContent = emojis[Math.floor(Math.random() * emojis.length)];

        const x = Math.random() * containerRect.width;
        const y = Math.random() * containerRect.height;

        e.style.left = `${x}px`;
        e.style.top = `${y}px`;
        e.style.fontSize = 24 + Math.random() * 26 + "px";
        container.appendChild(e);

        if (rating === 1 || rating === 2) {
          e.style.animation = `fallLocal ${2 + Math.random() * 1.8}s linear`;
        } else if (rating === 3) {
          const r = 80 + Math.random() * 120;
          const dir = Math.random() > 0.5 ? "orbitCW" : "orbitCCW";
          e.style.setProperty("--r", `${r}px`);
          e.style.animation = `${dir} ${3 + Math.random() * 2}s linear`;
        } else if (rating === 4) {
          e.style.animation = `flyUpLocal ${3 + Math.random() * 2}s ease-out`;
        } else if (rating === 5) {
          e.style.animation = `burstLocal ${3 + Math.random() * 2}s ease-in-out`;
        }

        setTimeout(() => e.remove(), 4200);
      }
    };

    // Cleanup
    const cleanup = () => {
      try { socket?.disconnect(); } catch {}
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
        cameraTrackSaved = localStream?.getVideoTracks()?.[0] || null;

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

        // Add local tracks
        localStream?.getTracks().forEach((t) => pc.addTrack(t, localStream));

        // When remote track arrives
        pc.ontrack = (e) => {
          const rv = get("remoteVideo");
          if (rv && e.streams && e.streams[0]) {
            rv.srcObject = e.streams[0];

            try {
              const remoteStream = e.streams[0];
              const videoTracks = remoteStream.getVideoTracks();
              if (videoTracks && videoTracks.length) {
                videoTracks.forEach((vt) => {
                  vt.onended = () => {
                    showToast("Partner stopped video");
                  };
                });
              }
              remoteStream.addEventListener &&
                remoteStream.addEventListener("addtrack", () => {
                  if (rv && remoteStream) rv.srcObject = remoteStream;
                });
            } catch (err) {
              console.warn("Error attaching remote track handlers", err);
            }
          }
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) socket.emit("candidate", e.candidate);
        };
      };

      socket.on("ready", async () => {
        createPC();
        if (!hasOffered && pc.signalingState === "stable") {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("offer", offer);
            hasOffered = true;
          } catch (err) {
            console.error("Offer error:", err);
          }
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
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Error adding candidate:", err);
        }
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

    // Controls
    const micBtn = get("micBtn");
    micBtn.onclick = () => {
      const t = localStream?.getAudioTracks()[0];
      if (!t) return;
      t.enabled = !t.enabled;
      micBtn.classList.toggle("inactive", !t.enabled);
      const i = micBtn.querySelector("i");
      if (i) i.className = t.enabled ? "fas fa-microphone" : "fas fa-microphone-slash";
      showToast(t.enabled ? "Mic On" : "Mic Off");
    };

    const camBtn = get("camBtn");
    camBtn.onclick = () => {
      const t = localStream?.getVideoTracks()[0];
      if (!t) return;
      t.enabled = !t.enabled;
      camBtn.classList.toggle("inactive", !t.enabled);
      const i = camBtn.querySelector("i");
      if (i) i.className = t.enabled ? "fas fa-video" : "fas fa-video-slash";
      showToast(t.enabled ? "Camera On" : "Camera Off");
    };

    const screenBtn = get("screenShareBtn");
    screenBtn.onclick = async () => {
      if (!pc) return showToast("No connection");
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screen.getVideoTracks()[0];
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
        if (!sender) {
          showToast("No video sender found");
          screenTrack.stop();
          return;
        }

        // Save current camera track (in case it changed)
        cameraTrackSaved = localStream?.getVideoTracks()?.[0] || cameraTrackSaved;

        // replace with screen
        await sender.replaceTrack(screenTrack);
        screenBtn.classList.add("active");
        showToast("Screen sharing");

        // When screen sharing stops, restore camera
        screenTrack.onended = async () => {
          try {
            let cam = cameraTrackSaved;
            if (!cam || cam.readyState === "ended") {
              try {
                const fresh = await navigator.mediaDevices.getUserMedia({ video: true });
                cam = fresh.getVideoTracks()[0];
                if (localStream) {
                  const prev = localStream.getVideoTracks()[0];
                  try { prev && prev.stop(); } catch {}
                  if (prev) localStream.removeTrack(prev);
                  localStream.addTrack(cam);
                  const lv = get("localVideo");
                  if (lv) lv.srcObject = localStream;
                }
                cameraTrackSaved = cam;
              } catch (err) {
                console.warn("Couldn't reacquire camera after screen share ended", err);
              }
            }
            if (sender && cam) {
              await sender.replaceTrack(cam);
              showToast("Screen sharing stopped — camera restored");
            } else {
              showToast("Screen sharing stopped");
            }
          } catch (err) {
            console.error("Error restoring camera after screen end", err);
            showToast("Stopped screen sharing");
          } finally {
            screenBtn.classList.remove("active");
          }
        };
      } catch (e) {
        console.warn("❌ Screen share cancelled / error", e);
        showToast("Screen share cancelled");
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

    return () => cleanup();
  }, []);

  return (
    <>
      {/* Font Awesome */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
        referrerPolicy="no-referrer"
      />

      {/* ======= Omegle-style Layout ======= */}
      <div className="video-stage">
        <div className="video-panes">
          <div className="video-box">
            <video id="remoteVideo" autoPlay playsInline></video>
            <div className="label">Partner</div>
          </div>
          <div className="video-box">
            <video id="localVideo" autoPlay playsInline muted></video>
            <div className="label">You</div>
          </div>
        </div>
      </div>

      <div className="control-bar">
        <button id="micBtn" className="control-btn" aria-label="Toggle Mic">
          <i className="fas fa-microphone"></i>
          <span>Mic</span>
        </button>
        <button id="camBtn" className="control-btn" aria-label="Toggle Camera">
          <i className="fas fa-video"></i>
          <span>Camera</span>
        </button>
        <button id="screenShareBtn" className="control-btn" aria-label="Share Screen">
          <i className="fas fa-desktop"></i>
          <span>Share</span>
        </button>
        <button id="disconnectBtn" className="control-btn danger" aria-label="End Call">
          <i className="fas fa-phone-slash"></i>
          <span>End</span>
        </button>
      </div>

      {/* ✅ Rating overlay */}
      <div id="ratingOverlay">
        <div className="rating-content">
          <h2>Rate your partner ❤️</h2>

          <div className="hearts">
            <i className="far fa-heart" data-value="1" aria-label="1 star"></i>
            <i className="far fa-heart" data-value="2" aria-label="2 stars"></i>
            <i className="far fa-heart" data-value="3" aria-label="3 stars"></i>
            <i className="far fa-heart" data-value="4" aria-label="4 stars"></i>
            <i className="far fa-heart" data-value="5" aria-label="5 stars"></i>
          </div>

          <div className="rating-buttons">
            <button id="quitBtn">Quit</button>
            <button id="newPartnerBtn">Search New Partner</button>
          </div>

          <div className="emoji-container" aria-hidden="true"></div>
        </div>
      </div>

      <div id="toast"></div>

      <style jsx global>{`
        *{margin:0;padding:0;box-sizing:border-box}
        html,body{height:100%;background:#000;font-family:'Segoe UI',sans-serif;overflow:hidden}

        /* ======= Stage (reserves space for controls) ======= */
        .video-stage{
          position:relative;
          width:100%;
          height:100vh;
          padding-bottom:110px; /* space for bottom control bar */
          background:#000;
        }

        /* ======= Two-panes layout (Omegle style) ======= */
        .video-panes{
          position:absolute;
          left:0; right:0; top:0; bottom:110px; /* keep clear for controls */
          display:flex;
          gap:12px;
          padding:12px;
        }
        .video-box{
          position:relative;
          flex:1 1 50%;
          border-radius:14px;
          overflow:hidden;
          background:#111;
          border:1px solid rgba(255,255,255,.08);
        }
        .video-box video{
          width:100%;
          height:100%;
          object-fit:cover;
          background:#000;
        }

        /* Mirror local like most apps (feels natural) */
        #localVideo{ transform: scaleX(-1); }

        .label{
          position:absolute;
          left:10px; bottom:10px;
          padding:6px 10px;
          font-size:12px;
          color:#fff;
          background:rgba(0,0,0,.5);
          border:1px solid rgba(255,255,255,.15);
          border-radius:10px;
          pointer-events:none;
        }

        /* ======= Controls ======= */
        .control-bar{
          position:fixed;bottom:18px;left:50%;transform:translateX(-50%);
          display:flex;gap:18px;padding:12px 16px;background:rgba(0,0,0,.6);
          border-radius:16px;z-index:3000;backdrop-filter: blur(8px);
        }
        .control-btn{
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          background:#18181b;color:#fff;border-radius:14px;width:68px;height:68px;cursor:pointer;
        }
        .control-btn.inactive{opacity:0.5}
        .control-btn.active{box-shadow:0 6px 18px rgba(255,77,141,0.18);transform:translateY(-2px)}
        .control-btn.danger{background:#9b1c2a}

        /* ======= Rating Overlay ======= */
        #ratingOverlay{
          position:fixed;inset:0;display:none;align-items:center;justify-content:center;
          background:rgba(0,0,0,.9);color:#fff;z-index:4000;padding:40px
        }
        .rating-content{
          position:relative;min-width: min(720px, 92vw);
          padding:48px 56px;border-radius:24px;text-align:center;
          background:rgba(255,255,255,.10);
          border:1px solid rgba(255,255,255,.18);
          box-shadow:0 20px 60px rgba(0,0,0,.55);
          z-index:1
        }
        .rating-content h2{
          font-size:32px;margin-bottom:18px;letter-spacing:.3px
        }
        .hearts{
          display:flex;gap:30px;font-size:70px;margin:26px 0 8px 0;justify-content:center;z-index:2;position:relative
        }
        .hearts i{color:#777;cursor:pointer;transition:transform .18s,color .18s}
        .hearts i:hover{transform:scale(1.2);color:#ff6fa3}
        .hearts i.selected{color:#ff1744}

        .rating-buttons{
          display:flex;gap:26px;margin-top:32px;justify-content:center;position:relative;z-index:2
        }
        .rating-buttons button{
          padding:18px 32px;font-size:20px;border-radius:16px;border:none;color:#fff;cursor:pointer;
          background:linear-gradient(135deg,#ff4d8d,#6a5acd);
          box-shadow:0 10px 28px rgba(0,0,0,.45);
          backdrop-filter: blur(14px);
          transition:transform .2s ease,opacity .2s ease
        }
        .rating-buttons button:hover{transform:scale(1.06);opacity:.92}

        .emoji-container{
          position:absolute;inset:-16px;
          pointer-events:none;z-index:0;overflow:visible
        }
        .floating-emoji{position:absolute;user-select:none}

        @keyframes fallLocal{
          from{transform:translateY(-40px);opacity:1}
          to{transform:translateY(360px);opacity:0}
        }
        @keyframes flyUpLocal{
          from{transform:translateY(0);opacity:1}
          to{transform:translateY(-360px);opacity:0}
        }
        @keyframes orbitCW{
          from{transform:rotate(0deg) translateX(var(--r)) rotate(0deg)}
          to{transform:rotate(360deg) translateX(var(--r)) rotate(-360deg)}
        }
        @keyframes orbitCCW{
          from{transform:rotate(360deg) translateX(var(--r)) rotate(-360deg)}
          to{transform:rotate(0deg) translateX(var(--r)) rotate(360deg)}
        }
        @keyframes burstLocal{
          0%{transform:scale(.6) translateY(0);opacity:1}
          60%{transform:scale(1.4) translateY(-80px)}
          100%{transform:scale(1) translateY(-320px);opacity:0}
        }

        #toast{
          position:fixed;left:50%;bottom:110px;transform:translateX(-50%);
          background:#111;color:#fff;padding:10px 14px;border-radius:8px;display:none;z-index:5000;
          border:1px solid rgba(255,255,255,.12)
        }

        /* ======= Mobile: stack top/bottom ======= */
        @media(max-width: 900px){
          .video-panes{
            flex-direction:column;
          }
          .video-box{
            flex:1 1 50%;
            min-height: 0; /* allow flexible shrink */
          }
        }

        /* Small phones: tighter gaps/padding */
        @media(max-width:480px){
          .video-panes{ gap:8px; padding:8px; bottom:108px; }
          .label{ font-size:11px; padding:5px 8px; }
          .control-btn{ width:62px; height:62px; }
          .rating-content{min-width:92vw;padding:30px 20px}
          .hearts{font-size:46px;gap:18px}
          .rating-buttons{gap:16px}
          .rating-buttons button{padding:14px 18px;font-size:16px;border-radius:14px}
        }
      `}</style>
    </>
  );
}
