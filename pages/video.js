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
          if (rv) rv.srcObject = e.streams[0];
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            console.log("📡 Sending ICE candidate:", e.candidate);
            socket.emit("candidate", e.candidate);
          }
        };

        pc.onconnectionstatechange = () => {
          console.log("🔄 PC state changed:", pc.connectionState);
        };
      };

      socket.on("ready", () => {
        console.log("✅ Partner ready, creating PeerConnection...");
        createPC();
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

      // Initial offer
      setTimeout(async () => {
        createPC();
        if (pc.signalingState === "stable") {
          console.log("📡 Creating offer...");
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("offer", offer);
          console.log("📡 Offer sent:", offer);
        }
      }, 1000);
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
        const sender = pc.getSenders().find((s) => s.track.kind === "video");
        sender.replaceTrack(track);
        track.onended = () => {
          console.log("🖥️ Screen share ended, restoring camera");
          sender.replaceTrack(localStream.getVideoTracks()[0]);
        };
        showToast("Screen sharing");
      } catch {
        console.warn("❌ Screen share cancelled");
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

    // Draggable local video
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

      <div className="control-bar">
        <button id="micBtn" className="control-btn"><i className="fas fa-microphone"></i><span>Mic</span></button>
        <button id="camBtn" className="control-btn"><i className="fas fa-video"></i><span>Camera</span></button>
        <button id="screenShareBtn" className="control-btn"><i className="fas fa-desktop"></i><span>Share</span></button>
        <button id="disconnectBtn" className="control-btn danger"><i className="fas fa-phone-slash"></i><span>End</span></button>
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
    </>
  );
}
