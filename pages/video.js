"use client";
import { useEffect } from "react";
import io from "socket.io-client";

export default function VideoPage() {
  useEffect(() => {
    const BACKEND_URL = "https://milan-j9u9.onrender.com";
    let socket = null;
    let localStream = null;
    let peerConnection = null;

    const config = {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    };

    const localVideo = document.getElementById("localVideo");
    const remoteVideo = document.getElementById("remoteVideo");
    const welcomeOverlay = document.getElementById("welcomeOverlay");
    const ratingOverlay = document.getElementById("ratingOverlay");
    const toast = document.getElementById("toast");

    // 🎵 Toast helper
    function showToast(msg, duration = 2000) {
      if (!toast) return;
      toast.textContent = msg;
      toast.style.display = "block";
      setTimeout(() => (toast.style.display = "none"), duration);
    }

    // 🎵 Init
    async function init() {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        localVideo.style.display = "block";
      } catch (err) {
        console.error("Media error:", err);
        showToast("Camera/Mic access denied");
        return;
      }

      socket = io(BACKEND_URL);

      const token = localStorage.getItem("token");
      const roomCode = sessionStorage.getItem("roomCode");

      socket.emit("joinVideo", { token, roomCode });

      socket.on("offer", async (offer) => {
        peerConnection = new RTCPeerConnection(config);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
        peerConnection.ontrack = (event) => {
          remoteVideo.srcObject = event.streams[0];
          remoteVideo.style.display = "block";
        };
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit("answer", answer);
      });

      socket.on("answer", async (answer) => {
        if (peerConnection) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }
      });

      socket.on("candidate", (candidate) => {
        if (peerConnection) {
          peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      });

      peerConnection = new RTCPeerConnection(config);
      localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
      peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
        remoteVideo.style.display = "block";
      };
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) socket.emit("candidate", event.candidate);
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit("offer", offer);

      // Disconnect handling
      socket.on("partnerDisconnected", () => {
        showToast("Partner disconnected");
        ratingOverlay.style.display = "flex";
      });
    }

    init();

    // 🎵 Button controls
    document.getElementById("micBtn").onclick = () => {
      if (!localStream) return;
      const audioTrack = localStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      document.getElementById("micBtn").classList.toggle("active");
    };

    document.getElementById("camBtn").onclick = () => {
      if (!localStream) return;
      const videoTrack = localStream.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
      document.getElementById("camBtn").classList.toggle("active");
    };

    document.getElementById("screenShareBtn").onclick = async () => {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnection.getSenders().find(s => s.track.kind === "video");
        sender.replaceTrack(screenTrack);
        screenTrack.onended = () => {
          sender.replaceTrack(localStream.getVideoTracks()[0]);
        };
        document.getElementById("screenShareBtn").classList.toggle("active");
      } catch {
        showToast("Screen share cancelled");
      }
    };

    document.getElementById("disconnectBtn").onclick = () => {
      if (socket) socket.disconnect();
      if (peerConnection) peerConnection.close();
      ratingOverlay.style.display = "flex";
    };

    // 🎵 Rating hearts
    const hearts = document.querySelectorAll(".hearts i");
    hearts.forEach(h => {
      h.addEventListener("click", () => {
        hearts.forEach(x => x.classList.remove("selected"));
        h.classList.add("selected");
        showToast(`You rated ${h.dataset.value} ❤️`);
      });
    });

    // Cleanup
    return () => {
      if (socket) socket.disconnect();
      if (peerConnection) peerConnection.close();
    };
  }, []);

  return (
    <>
      {/* Welcome Overlay */}
      <div id="welcomeOverlay">
        <h1 id="welcomeText">Connecting you to a romantic partner...</h1>
        <div className="big-heart"><i className="fas fa-heart"></i></div>
        <audio id="heartbeatAudio" src="/sounds/heartbeat.mp3" preload="auto"></audio>
      </div>

      {/* Video Container */}
      <div className="video-container">
        <div className="video-box">
          <video id="localVideo" autoPlay muted playsInline></video>
        </div>
        <div className="video-box">
          <video id="remoteVideo" autoPlay playsInline></video>
        </div>
      </div>

      {/* Controls */}
      <div className="control-bar">
        <div className="control-item">
          <button id="micBtn" className="control-btn"><i className="fas fa-microphone"></i></button>
          <span className="control-label">Mic</span>
        </div>
        <div className="control-item">
          <button id="camBtn" className="control-btn"><i className="fas fa-video"></i></button>
          <span className="control-label">Camera</span>
        </div>
        <div className="control-item">
          <button id="screenShareBtn" className="control-btn"><i className="fas fa-desktop"></i></button>
          <span className="control-label">Share</span>
        </div>
        <div className="control-item">
          <button id="disconnectBtn" className="control-btn"><i className="fas fa-phone-slash"></i></button>
          <span className="control-label">End</span>
        </div>
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
          <button id="newPartnerBtn" onClick={() => (window.location.href = "/connect")}>
            Search New Partner
          </button>
        </div>
      </div>

      {/* Toast */}
      <div id="toast"></div>

      {/* Styles */}
      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: #000; color: #fff; font-family: 'Segoe UI', sans-serif; overflow: hidden; }
        .video-container { height: 100%; display: flex; align-items: center; justify-content: center; gap: 4px; background: #000; }
        .video-box { flex: 1; height: 100%; position: relative; overflow: hidden; background: #000; border-radius: 8px; box-shadow: 0 0 20px rgba(236,72,153,.5); }
        .video-box video { width: 100%; height: 100%; object-fit: cover; background: #000; display: none; }
        #localVideo { transform: scaleX(-1); }
        @media (max-width: 768px) { .video-container { flex-direction: column; } .video-box { height: 50%; width: 100%; } }
        .control-bar { position: fixed; left: 0; bottom: 0; width: 100%; display: flex; justify-content: center; gap: 20px; padding: 10px; background: rgba(0,0,0,.4); z-index: 1000; }
        .control-item { display: flex; flex-direction: column; align-items: center; }
        .control-btn { background: #ec4899; border: none; color: #fff; border-radius: 50%; padding: 12px 16px; font-size: 20px; cursor: pointer; transition: .25s; }
        .control-btn.active { background: #db2777; }
        .control-btn:hover { background: #f472b6; }
        .control-label { margin-top: 4px; font-size: 12px; color: #ddd; }
        #welcomeOverlay { position: fixed; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: rgba(0,0,0,.9); z-index: 3000; }
        #welcomeOverlay h1 { font-size: 32px; margin-bottom: 18px; color: #ec4899; }
        .big-heart { font-size: 140px; color: #ff1744; animation: heartbeat 1s infinite; }
        @keyframes heartbeat { 0%,100%{transform:scale(1);} 25%{transform:scale(1.3);} 50%{transform:scale(1.1);} 75%{transform:scale(1.4);} }
        #ratingOverlay { position: fixed; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: rgba(0,0,0,.9); z-index: 3000; color: #fff; }
        #ratingOverlay h2 { font-size: 28px; margin-bottom: 20px; }
        .hearts { display: flex; gap: 10px; font-size: 48px; cursor: pointer; }
        .hearts i { color: #555; transition: .25s; }
        .hearts i:hover { color: #ec4899; transform: scale(1.2); }
        .hearts i.selected { color: #ff1744; transform: scale(1.35); text-shadow: 0 0 10px rgba(255,23,68,.6); }
        .rating-buttons { display: flex; gap: 20px; margin-top: 28px; }
        .rating-buttons button { background: #ec4899; border: none; color: #fff; border-radius: 8px; padding: 10px 20px; font-size: 18px; cursor: pointer; transition: .25s; }
        .rating-buttons button:hover { background: #f472b6; }
        #toast { position: fixed; left: 50%; bottom: 80px; transform: translateX(-50%); background: #111; border: 1px solid #444; color: #fff; padding: 10px 14px; border-radius: 8px; display: none; z-index: 3200; }
      `}</style>
    </>
  );
}
