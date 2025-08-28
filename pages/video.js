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

    const cleanup = () => {
      try { socket?.disconnect(); } catch {}
      try { pc?.close(); } catch {}
      pc = null;
      localStream = null;
    };

    (async function start() {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      get("localVideo").srcObject = localStream;

      socket = io(BACKEND_URL, { transports: ["websocket"] });
      socket.on("connect", () => {
        socket.emit("joinVideo", { token: localStorage.getItem("token"), roomCode: "defaultRoom" });
      });

      const createPC = () => {
        if (pc) return;
        pc = new RTCPeerConnection(ICE_CONFIG);
        localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

        pc.ontrack = (e) => {
          if (e.streams && e.streams[0]) get("remoteVideo").srcObject = e.streams[0];
        };
        pc.onicecandidate = (e) => { if (e.candidate) socket.emit("candidate", e.candidate); };
      };

      socket.on("ready", () => createPC());
      socket.on("offer", async (offer) => {
        createPC();
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", answer);
      });
      socket.on("answer", async (answer) => { await pc.setRemoteDescription(new RTCSessionDescription(answer)); });
      socket.on("candidate", async (c) => { await pc.addIceCandidate(new RTCIceCandidate(c)); });

      setTimeout(async () => {
        createPC();
        if (pc.signalingState === "stable") {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("offer", offer);
        }
      }, 1000);
    })();

    return () => cleanup();
  }, []);

  return (
    <>
      <div className="video-container">
        <video id="remoteVideo" autoPlay playsInline></video>
        <div id="localBox"><video id="localVideo" autoPlay playsInline muted></video></div>
      </div>

      <div className="control-bar">
        <button id="micBtn" title="Mic"><i className="fas fa-microphone"></i></button>
        <button id="camBtn" title="Camera"><i className="fas fa-video"></i></button>
        <button id="screenShareBtn" title="Share"><i className="fas fa-desktop"></i></button>
        <button id="disconnectBtn" className="danger" title="End"><i className="fas fa-phone-slash"></i></button>
      </div>

      <style jsx global>{`
        .video-container { position:relative;width:100%;height:100%; }
        #remoteVideo { width:100%;height:100%;object-fit:cover;background:#000; }
        #localBox { position:absolute;bottom:20px;right:20px;width:200px;height:140px; }
        #localBox video { width:100%;height:100%;object-fit:cover;transform:scaleX(-1); }
        .control-bar { position:fixed;bottom:20px;left:50%;transform:translateX(-50%);display:flex;gap:20px; }
        .control-bar button { width:65px;height:65px;border-radius:50%;font-size:22px;color:#fff;background:#ec4899; }
        .control-bar button:hover { transform:scale(1.2);background:#f472b6; }
        .danger { background:#dc2626; }
      `}</style>
    </>
  );
}
