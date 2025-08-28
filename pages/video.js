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
    let hasOffered = false; // ✅ ensure we send offer only once after 'ready'

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

    // Cleanup
    const cleanup = () => {
      console.log("🧹 Cleanup called");
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
        console.log("🎥 Requesting camera + mic access...");
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        console.log("✅ Got local stream:", localStream);
        const lv = get("localVideo");
        if (lv) lv.srcObject = localStream;
      } catch (err) {
        console.error("❌ Camera/Mic error:", err);
        showToast("Camera/Mic access needed");
        return;
      }

      console.log("🔌 Connecting to backend:", BACKEND_URL);
      socket = io(BACKEND_URL, { transports: ["websocket"] });

      socket.on("connect", () => {
        console.log("✅ Socket connected:", socket.id);
        const token = localStorage.getItem("token");
        const roomCode = sessionStorage.getItem("roomCode");
        console.log("📨 joinVideo sent →", { token, roomCode });
        socket.emit("joinVideo", { token, roomCode });
      });

      // Create PeerConnection
      const createPC = () => {
        if (pc) return;
        console.log("⚡ Creating RTCPeerConnection...");
        pc = new RTCPeerConnection(ICE_CONFIG);

        localStream?.getTracks().forEach((t) => {
          pc.addTrack(t, localStream);
          console.log("➕ Added local track:", t.kind);
        });

        pc.ontrack = (e) => {
          console.log("📺 Remote track received:", e.streams);
          const rv = get("remoteVideo");
          if (rv && e.streams && e.streams[0]) {
            rv.srcObject = e.streams[0];
          }
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            console.log("📡 Sending ICE candidate:", e.candidate);
            socket.emit("candidate", e.candidate);
          }
        };

        pc.onconnectionstatechange = () => {
          console.log("🔄 PC state changed:", pc.connectionState);
          if (pc.connectionState === "failed") {
            console.warn("⚠️ ICE failed, consider TURN.");
            showToast("Connection issue (ICE failed)");
          }
        };

        pc.onsignalingstatechange = () => {
          console.log("🧭 Signaling state:", pc.signalingState);
        };

        pc.onicegatheringstatechange = () => {
          console.log("🧊 ICE gathering:", pc.iceGatheringState);
        };

        pc.oniceconnectionstatechange = () => {
          console.log("🧊 ICE connection:", pc.iceConnectionState);
        };
      };

      // Partner ready → create PC and send initial offer (only once)
      socket.on("ready", async () => {
        console.log("✅ Partner ready");
        createPC();
        if (!hasOffered && pc.signalingState === "stable") {
          try {
            console.log("📡 Creating offer (after ready)...");
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("offer", offer);
            console.log("📡 Offer sent:", offer);
            hasOffered = true;
          } catch (err) {
            console.error("❌ Error creating/sending offer:", err);
          }
        }
      });

      socket.on("offer", async (offer) => {
        console.log("📡 Offer received:", offer);
        createPC();
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", answer);
        console.log("📡 Answer sent:", answer);
      });

      socket.on("answer", async (answer) => {
        console.log("📡 Answer received:", answer);
        if (!pc) createPC();
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      });

      socket.on("candidate", async (candidate) => {
        console.log("📡 ICE candidate received:", candidate);
        if (!pc) createPC();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
          console.log("✅ ICE candidate added");
        } catch (err) {
          console.error("❌ Error adding ICE candidate:", err);
        }
      });

      socket.on("partnerDisconnected", () => {
        console.warn("⚠️ Partner disconnected");
        showToast("Partner disconnected");
        showRating();
      });

      socket.on("partnerLeft", () => {
        console.warn("⚠️ Partner left");
        showToast("Partner left");
        showRating();
      });

      // ❌ हटाया गया: टाइमर से early offer भेजना
      // अब offer सिर्फ 'ready' पर जाएगा ताकि दोनों peers sync रहें.
    })();

    // Buttons
    const micBtn = get("micBtn");
    micBtn.onclick = () => {
      const t = localStream?.getAudioTracks()[0];
      if (!t) return;
      t.enabled = !t.enabled;
      micBtn.classList.toggle("inactive", !t.enabled);
      console.log("🎙️ Mic toggled:", t.enabled);
      showToast(t.enabled ? "Mic On" : "Mic Off");
    };

    const camBtn = get("camBtn");
    camBtn.onclick = () => {
      const t = localStream?.getVideoTracks()[0];
      if (!t) return;
      t.enabled = !t.enabled;
      camBtn.classList.toggle("inactive", !t.enabled);
      console.log("📷 Camera toggled:", t.enabled);
      showToast(t.enabled ? "Camera On" : "Camera Off");
    };

    const screenBtn = get("screenShareBtn");
    screenBtn.onclick = async () => {
      if (!pc) return showToast("No connection");
      try {
        console.log("🖥️ Starting screen share...");
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const track = screen.getVideoTracks()[0];
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
        if (!sender) {
          console.warn("⚠️ No video sender found to replace");
          return;
        }
        sender.replaceTrack(track);
        track.onended = () => {
          console.log("🖥️ Screen share ended, restoring camera");
          const cam = localStream?.getVideoTracks()?.[0];
          if (cam) sender.replaceTrack(cam);
        };
        showToast("Screen sharing");
      } catch (e) {
        console.warn("❌ Screen share cancelled / error", e);
        showToast("Screen share cancelled");
      }
    };

    const disconnectBtn = get("disconnectBtn");
    disconnectBtn.onclick = () => {
      console.log("📴 Disconnect clicked");
      try { socket?.emit("partnerLeft"); } catch {}
      cleanup();
      showRating();
    };

    get("quitBtn").onclick = () => {
      console.log("🚪 Quit clicked");
      cleanup();
      window.location.href = "/";
    };

    get("newPartnerBtn").onclick = () => {
      console.log("🔄 Search new partner clicked");
      cleanup();
      window.location.href = "/connect";
    };

    // Draggable local video (passive touch listeners to avoid warnings)
    const lb = get("localBox");
    let dragging = false, dx = 0, dy = 0;

    const startDrag = (x, y) => {
      const rect = lb.getBoundingClientRect();
      dx = x - rect.left; dy = y - rect.top; dragging = true;
      lb.style.cursor = "grabbing";
    };
    const moveDrag = (x, y) => {
      if (!dragging) return;
      lb.style.left = `${x - dx}px`;
      lb.style.top = `${y - dy}px`;
    };
    const stopDrag = () => { dragging = false; lb.style.cursor = "grab"; };

    lb.addEventListener("mousedown", (e) => startDrag(e.clientX, e.clientY));
    document.addEventListener("mousemove", (e) => moveDrag(e.clientX, e.clientY));
    document.addEventListener("mouseup", stopDrag);

    lb.addEventListener("touchstart", (e) => {
      const t = e.touches[0]; startDrag(t.clientX, t.clientY);
    }, { passive: true });
    document.addEventListener("touchmove", (e) => {
      const t = e.touches[0]; moveDrag(t.clientX, t.clientY);
    }, { passive: true });
    document.addEventListener("touchend", stopDrag, { passive: true });

    return () => cleanup();
  }, []);

  return (
    <>
      {/* Font Awesome for icons */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
        referrerPolicy="no-referrer"
      />

      <div className="video-container">
        <video id="remoteVideo" autoPlay playsInline></video>
        <div id="localBox"><video id="localVideo" autoPlay playsInline muted></video></div>
      </div>

      <div className="control-bar">
        <button id="micBtn" className="control-btn" aria-label="Toggle Mic">
          <i className="fas fa-microphone"></i><span>Mic</span>
        </button>
        <button id="camBtn" className="control-btn" aria-label="Toggle Camera">
          <i className="fas fa-video"></i><span>Camera</span>
        </button>
        <button id="screenShareBtn" className="control-btn" aria-label="Share Screen">
          <i className="fas fa-desktop"></i><span>Share</span>
        </button>
        <button id="disconnectBtn" className="control-btn danger" aria-label="End Call">
          <i className="fas fa-phone-slash"></i><span>End</span>
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

      {/* === Styles (restored + improved) === */}
      <style jsx global>{`
        *{margin:0;padding:0;box-sizing:border-box}
        html,body{height:100%;background:#000;font-family:'Segoe UI',sans-serif;overflow:hidden}

        .video-container{position:relative;width:100%;height:100%}
        #remoteVideo{width:100%;height:100%;object-fit:cover;background:#000}
        #localBox{
          position:absolute;bottom:20px;right:20px;width:220px;height:150px;
          border:2px solid #ff4d8d;border-radius:14px;overflow:hidden;cursor:grab;
          z-index:2000;background:#111;box-shadow:0 8px 20px rgba(0,0,0,.5)
        }
        #localBox video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}
        @media(max-width:768px){#localBox{width:150px;height:110px}}

        .control-bar{
          position:fixed;bottom:18px;left:50%;transform:translateX(-50%);
          display:flex;gap:18px;padding:12px 16px;background:rgba(0,0,0,.6);
          border:1px solid rgba(255,255,255,.12);border-radius:16px;z-index:3000;
          backdrop-filter: blur(8px);
        }
        .control-btn{
          position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;
          background:#18181b;color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:14px;
          width:68px;height:68px;cursor:pointer;transition:transform .15s,border-color .15s,background .15s;
        }
        .control-btn i{font-size:22px;line-height:1}
        .control-btn span{
          position:absolute;bottom:-30px;opacity:0;pointer-events:none;
          background:#111;color:#fff;padding:6px 10px;border-radius:8px;font-size:12px;white-space:nowrap;
          border:1px solid rgba(255,255,255,.15);transition:opacity .2s,transform .2s;transform:translateY(5px);
        }
        .control-btn:hover{border-color:#ff4d8d;transform:scale(1.05)}
        .control-btn:hover span{opacity:1;transform:translateY(0)}
        .control-btn.inactive{opacity:.55}
        .control-btn.danger{background:#9b1c2a;border-color:#ff5a79}

        #ratingOverlay{
          position:fixed;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;
          background:rgba(0,0,0,.9);color:#fff;z-index:4000
        }
        .hearts{display:flex;gap:12px;font-size:44px}
        .hearts i{color:#666;cursor:pointer}
        .hearts i:hover{color:#ff4d8d}
        .hearts i.selected{color:#ff1744}
        .rating-buttons{display:flex;gap:16px;margin-top:20px}
        .rating-buttons button{background:#ff4d8d;color:#fff;border:none;border-radius:8px;padding:10px 16px;cursor:pointer}

        #toast{
          position:fixed;left:50%;bottom:110px;transform:translateX(-50%);
          background:#111;color:#fff;padding:10px 14px;border-radius:8px;display:none;z-index:5000;
          border:1px solid rgba(255,255,255,.12)
        }
      `}</style>
    </>
  );
}
