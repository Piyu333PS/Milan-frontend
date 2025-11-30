"use client";
// Coming Soon global flag
const COMING_SOON = true;
import { useEffect, useState } from "react"; 
import io from "socket.io-client";

// FIX 1: get() function moved to global scope of the component for use in JSX
const get = (id) => typeof document !== 'undefined' ? document.getElementById(id) : null; 

// FIX 2: Core functions moved to global scope for use in handlers like handleConfirmDisconnect
const log = (...args) => { try { console.log("[video]", ...args); } catch (e) {} };
const showRating = () => { var r = get("ratingOverlay"); if (r) r.style.display = "flex"; };
const showToast = (msg, ms) => {
    var t = get("toast");
    if (!t) return;
    t.textContent = msg;
    t.style.display = "block";
    setTimeout(() => { t.style.display = "none"; }, ms || 2000);
};

// Global utility functions - will be defined in useEffect, but needed for safeEmit default
let socketInstance = null;
let timerInterval = null;
let timerStartTS = null;
let elapsedBeforePause = 0;
let pcInstance = null;

const getRoomCode = () => {
    try {
        var q = new URLSearchParams(window.location.search);
        return q.get("room") || sessionStorage.getItem("roomCode") || localStorage.getItem("lastRoomCode");
    } catch (e) {
        return sessionStorage.getItem("roomCode") || localStorage.getItem("lastRoomCode");
    }
};

const safeEmit = (event, data = {}) => {
    try {
        if (!socketInstance || !socketInstance.connected) return log("safeEmit: socket not connected, skip", event);
        const roomCode = getRoomCode();
        const payload = (data && typeof data === "object") ? { ...data } : { data };
        if (roomCode && !payload.roomCode) payload.roomCode = roomCode;
        socketInstance.emit(event, payload);
    } catch (e) { log("safeEmit err", e); }
};

// Timer helpers moved to global scope for use in cleanupPC
function formatTime(ms) {
    const total = Math.floor(ms / 1000);
    const mm = String(Math.floor(total / 60)).padStart(2, '0');
    const ss = String(total % 60).padStart(2, '0');
    return `${mm}:${ss}`;
}
function stopTimer(preserve = false) {
    try {
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        if (timerStartTS) {
            elapsedBeforePause = elapsedBeforePause + (Date.now() - timerStartTS);
        }
        timerStartTS = null;
        if (!preserve) {
            elapsedBeforePause = 0;
            const el = get('callTimer'); if (el) el.textContent = '00:00';
        }
        log('call timer stopped', { preserve });
    } catch (e) { console.warn('stopTimer err', e); }
}

// Peer Connection Cleanup moved to global scope
function cleanupPeerConnection() {
    try {
        if (pcInstance) {
            try {
                var senders = pcInstance.getSenders ? pcInstance.getSenders() : [];
                senders.forEach((s) => { try { s.track && s.track.stop && s.track.stop(); } catch (e) {} });
            } catch (e) {}
            try { pcInstance.close && pcInstance.close(); } catch (e) {}
        }
    } catch (e) { log("pc cleanup error", e); }
    pcInstance = null;
    // Reset flags that are defined locally in useEffect but related to PC instance
    // (Note: Other local flags are managed inside useEffect)
    try { var rv = get("remoteVideo"); if (rv) rv.srcObject = null; } catch (e) {}
    stopTimer(true);
}

export default function VideoPage() {
  // START: AUTH GUARD STATE
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // END: AUTH GUARD STATE
  
  // NEW STATE: Custom modal for disconnect confirmation
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  
  // Local state for flags previously managed inside useEffect.
  const [hasOffered, setHasOffered] = useState(false);
  const [makingOffer, setMakingOffer] = useState(false);
  const [ignoreOffer, setIgnoreOffer] = useState(false);
  const [polite, setPolite] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [cameraTrackSaved, setCameraTrackSaved] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  
  // Utility for local state update helpers
  const pendingCandidates = [];
  let draining = false;

  // FIX 3: Centralized handler for closing Rating Overlay
  const handleRatingOverlayClose = () => {
    // FIX: This closes the rating overlay and lets the user continue the call.
    const ratingOverlay = get("ratingOverlay");
    if (ratingOverlay) {
        ratingOverlay.style.display = "none";
    }
  };
  
  // ------------------------------------------
  // NEW FUNCTIONS FOR DISCONNECT MODAL (Uses global functions)
  // ------------------------------------------
  const handleConfirmDisconnect = () => {
    // 1. Close confirmation modal
    setShowDisconnectConfirm(false);
    
    // 2. Signal disconnection to partner
    safeEmit("partnerLeft"); 
    
    // 3. Clean up PC resources and show rating modal
    cleanupPeerConnection(); 
    showRating(); 
  };
  
  const handleKeepChatting = () => {
    // FIX: This function just closes the confirmation modal, letting the chat continue.
    setShowDisconnectConfirm(false);
  };
  

  const drainPendingCandidates = async () => {
    if (draining) return;
    draining = true;
    try {
        if (!pendingCandidates || pendingCandidates.length === 0) return;
        log("[video] draining", pendingCandidates.length, "pending candidates");
        const copy = pendingCandidates.slice();
        pendingCandidates.length = 0;
        for (const cand of copy) {
            try {
                if (!pcInstance || !pcInstance.remoteDescription || !pcInstance.remoteDescription.type) {
                    log("[video] drain: remoteDescription not ready yet, re-queueing candidate", cand);
                    pendingCandidates.push(cand);
                    continue;
                }
                await pcInstance.addIceCandidate(new RTCIceCandidate(cand));
                log("[video] drained candidate success");
            } catch (err) {
                console.warn("[video] drained candidate failed", err, cand);
                pendingCandidates.push(cand);
            }
        }
    } catch (err) {
        console.error("[video] drainPendingCandidates unexpected error", err);
    } finally {
        draining = false;
        if (pendingCandidates && pendingCandidates.length > 0) {
            setTimeout(() => { drainPendingCandidates(); }, 250);
        }
    }
  };

  
  useEffect(() => {
    // START: AUTH GUARD LOGIC
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/";
      return;
    }
    
    setIsAuthenticated(true);
    // END: AUTH GUARD LOGIC
    
    const BACKEND_URL = window.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "https://milan-j9u9.onrender.com";
    const ICE_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

    // Set local variables to global instances defined outside useEffect
    let socket = null;
    let pc = null;
    
    // timer helpers (already defined globally)
    function updateTimerDisplay() {
      const el = get('callTimer');
      if (!el) return;
      const now = Date.now();
      const elapsed = (timerStartTS ? (elapsedBeforePause + (now - timerStartTS)) : elapsedBeforePause) || 0;
      el.textContent = formatTime(elapsed);
    }
    function startTimer() {
        try {
            if (timerInterval) return;
            timerStartTS = Date.now();
            updateTimerDisplay();
            timerInterval = setInterval(updateTimerDisplay, 1000);
            log('call timer started');
        } catch (e) { console.warn('startTimer err', e); }
    }


    const cleanup = function (opts) {
        opts = opts || {};
        if (isCleaning) return;
        setIsCleaning(true);

        try {
            if (socket) {
                try { socket.removeAllListeners && socket.removeAllListeners(); } catch (e) {}
                try { socket.disconnect && socket.disconnect(); } catch (e) {}
                socketInstance = null;
            }
        } catch (e) { log("socket cleanup err", e); }

        cleanupPeerConnection();

        try {
            if (localStream) {
                localStream.getTracks().forEach((t) => { try { t.stop(); } catch (e) {} });
            }
        } catch (e) {}

        setLocalStream(null);
        setCameraTrackSaved(null);
        setTimeout(() => { setIsCleaning(false); }, 300);
        if (opts.goToConnect) window.location.href = "/connect"; 
    };
    
    // Two-Option / Spin state helpers (remains local to useEffect but simplified)
    let currentQuestion = null;
    let pendingAnswers = {};
    let twoOptionScore = { total: 0, matched: 0, asked: 0 };

    // NEW: Activity state helpers
    let rapidFireInterval = null;
    let rapidFireCount = 0;
    let mirrorTimer = null;
    let staringTimer = null;
    let lyricsCurrentSong = null;


    (async function start() {
      log("video page start");
      
      if (!isAuthenticated) return;

      let currentLocalStream = null;
      let currentCameraTrackSaved = null;
      
      try {
        currentLocalStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        var vtracks = (currentLocalStream && typeof currentLocalStream.getVideoTracks === "function") ? currentLocalStream.getVideoTracks() : [];
        currentCameraTrackSaved = (vtracks && vtracks.length) ? vtracks[0] : null;

        setLocalStream(currentLocalStream);
        setCameraTrackSaved(currentCameraTrackSaved);
        
        var lv = get("localVideo");
        if (lv) {
          lv.muted = true;
          lv.playsInline = true;
          lv.autoplay = true;
          lv.srcObject = currentLocalStream;
          try { await (lv.play && lv.play()); } catch (e) { log("local video play warning", e); }
        } else { log("localVideo element not found"); }
      } catch (err) {
        console.error("Camera/Mic error:", err);
        showToast("Camera/Mic access needed");
        return;
      }

      socket = io(BACKEND_URL, {
        transports: ['polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        path: '/socket.io'
      });
      socketInstance = socket; // Set global instance

      socket.on("connect", () => {
        log("socket connected", socket.id);
        setSocketConnected(true);
        const roomCode = getRoomCode();
        if (!roomCode) {
          showToast("Room not found. Redirecting...");
          cleanup({ goToConnect: true });
          return;
        }
        var token = localStorage.getItem("token") || null;
        safeEmit("joinVideo", { token });
      });

      socket.on("disconnect", (reason) => { log("socket disconnected:", reason); setSocketConnected(false); });
      socket.on("connect_error", (err) => { log("socket connect_error:", err); showToast("Socket connect error"); });

      const createPC = () => {
        if (pcInstance) return;
        log("creating RTCPeerConnection");
        pc = new RTCPeerConnection(ICE_CONFIG);
        pcInstance = pc; // Set global instance

        // Add local tracks to senders using addTransceiver (for proper enable/disable via senders)
        try { pc.addTransceiver(currentLocalStream.getAudioTracks()[0], { direction: "sendrecv" }); } catch (e) { log("addTransceiver audio failed", e); }
        try { pc.addTransceiver(currentLocalStream.getVideoTracks()[0], { direction: "sendrecv" }); } catch (e) { log("addTransceiver video failed", e); }

        pc.ontrack = (e) => {
          try {
            log("pc.ontrack", e);
            const rv = get("remoteVideo");
            const stream = (e && e.streams && e.streams[0]) ? e.streams[0] : new MediaStream([e.track]);
            
            // FIX for remote play rejected AbortError: Check if stream already assigned
            if (rv) {
              rv.playsInline = true;
              rv.autoplay = true;
              const prevMuted = rv.muted;
              rv.muted = true;
              if (rv.srcObject !== stream) { // Only assign if different stream
                rv.srcObject = stream;
                rv.play && rv.play().then(() => {
                  setTimeout(() => { try { rv.muted = prevMuted; } catch (e) {} }, 250);
                }).catch((err) => { log("remote play rejected", err); try { rv.muted = prevMuted; } catch (e) {} });
              } else {
                try { rv.muted = prevMuted; } catch (e) {}
              }
            }
          } catch (err) { console.error("ontrack error", err); }
        };

        pc.onicecandidate = (e) => {
          if (e && e.candidate) {
            log("pc.onicecandidate -> emit candidate");
            safeEmit("candidate", { candidate: e.candidate });
          }
        };

        pc.onconnectionstatechange = () => {
          log("pc.connectionState:", pc.connectionState);
          if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
            showToast("Partner disconnected");
            cleanupPeerConnection(); 
            showRating(); 
          }
        };

        pc.oniceconnectionstatechange = () => {
          log("pc.iceConnectionState:", pc.iceConnectionState);
          if (pc.iceConnectionState === "connected") {
            log("ICE connected");
            startTimer();
          } else if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed" || pc.iceConnectionState === "closed") {
            stopTimer(true);
          }
        };

        pc.onnegotiationneeded = async () => {
          if (!socketConnected) { log("negotiation: socket not connected"); return; }
          if (makingOffer) { log("negotiationneeded: already makingOffer"); return; }
          setMakingOffer(true);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            safeEmit("offer", { type: pc.localDescription && pc.localDescription.type, sdp: pc.localDescription && pc.localDescription.sdp });
            log("negotiationneeded: offer sent");
          } catch (err) {
            log("negotiationneeded error", err);
          } finally { setMakingOffer(false); }
        };
      };

      // SIGNALING HANDLERS
      socket.on("ready", (data) => {
        log("socket ready", data);
        try { if (data && typeof data.polite !== "undefined") setPolite(!!data.polite); } catch (e) {}
        createPC();
        (async () => {
          try {
            if (!hasOffered && pcInstance && pcInstance.signalingState === "stable" && !makingOffer) {
              setMakingOffer(true);
              const off = await pcInstance.createOffer();
              await pcInstance.setLocalDescription(off);
              safeEmit("offer", { type: pcInstance.localDescription && pcInstance.localDescription.type, sdp: pcInstance.localDescription && pcInstance.localDescription.sdp });
              setHasOffered(true);
              log("ready: offer emitted");
            } else {
              log("ready: skipped offer", { hasOffered, signalingState: pcInstance ? pcInstance.signalingState : null });
            }
          } catch (e) { log("ready-offer error", e); } finally { setMakingOffer(false); }
        })();
      });

      socket.on("offer", async (offer) => {
        log("socket offer", offer && offer.type);
        try {
          if (!offer || typeof offer !== "object" || !offer.type || !offer.sdp) {
            log("[video] invalid offer payload - ignoring", offer);
            return;
          }
          if (!pcInstance) createPC();
          const offerDesc = { type: offer.type, sdp: offer.sdp };
          const readyForOffer = !makingOffer && (pcInstance.signalingState === "stable" || pcInstance.signalingState === "have-local-offer");
          setIgnoreOffer(!readyForOffer && !polite);
          if (ignoreOffer) { log("ignoring offer (not ready & not polite)"); return; }

          if (pcInstance.signalingState !== "stable") {
            try { log("doing rollback to accept incoming offer"); await pcInstance.setLocalDescription({ type: "rollback" }); } catch (e) { log("rollback failed", e); }
          }

          await pcInstance.setRemoteDescription(offerDesc);
          log("[video] remoteDescription set -> draining candidates");
          try { await drainPendingCandidates(); } catch (e) { console.warn("[video] drain after offer failed", e); }

          const answer = await pcInstance.createAnswer();
          await pcInstance.setLocalDescription(answer);
          safeEmit("answer", { type: pcInstance.localDescription && pcInstance.localDescription.type, sdp: pcInstance.localDescription && pcInstance.localDescription.sdp });
          log("answer created & sent");
        } catch (err) { log("handle offer error", err); }
      });

      socket.on("answer", async (answer) => {
        log("socket answer", answer && answer.type);
        try {
          if (!answer || typeof answer !== "object" || !answer.type || !answer.sdp) {
            log("[video] invalid answer payload - ignoring", answer);
            return;
          }
          if (!pcInstance) createPC();
          if (pcInstance.signalingState === "have-local-offer" || pcInstance.signalingState === "have-remote-offer" || pcInstance.signalingState === "stable") {
            await pcInstance.setRemoteDescription({ type: answer.type, sdp: answer.sdp });
            log("answer set as remoteDescription");
            try { await drainPendingCandidates(); } catch (e) { console.warn("[video] drain after answer failed", e); }
          } else {
            log("skipping answer set - wrong state:", pcInstance.signalingState);
          }
        } catch (err) { log("set remote answer failed", err); }
      });

      socket.on("candidate", async (payload) => {
        try {
          log("socket candidate payload:", payload);
          // Simplified payload parsing logic
          const wrapper = payload && payload.candidate !== undefined ? payload : (payload && payload.payload ? payload.payload : payload);

          if (!wrapper) {
            console.warn("[video] candidate: empty payload");
            return;
          }

          let cand = wrapper.candidate;

          if (!cand && cand !== null) {
            console.warn("[video] could not parse candidate payload – skipping", payload);
            return;
          }
          
          if (cand === null) {
             console.log("[video] candidate: null (ignored)");
             return;
          }

          if (!pcInstance) {
            log("[video] no RTCPeerConnection yet, creating one before adding candidate");
            if (typeof createPC === "function") createPC();
            else { console.warn("[video] createPC not found"); }
          }

          if (!pcInstance || !pcInstance.remoteDescription || !pcInstance.remoteDescription.type) {
            log("[video] remoteDescription not set yet – queueing candidate");
            pendingCandidates.push(wrapper);
            setTimeout(() => drainPendingCandidates(), 200);
            return;
          }

          try {
            await pcInstance.addIceCandidate(new RTCIceCandidate(wrapper));
            log("[video] addIceCandidate success");
          } catch (err) {
            console.warn("[video] addIceCandidate failed", err, wrapper);
            pendingCandidates.push(wrapper);
            setTimeout(() => drainPendingCandidates(), 250);
          }
        } catch (err) {
          console.error("[video] candidate handler unexpected error", err);
        }
      });

      socket.on("waitingForPeer", (d) => { log("waitingForPeer", d); showToast("Waiting for partner..."); });
      socket.on("partnerDisconnected", () => { 
        log("partnerDisconnected"); 
        showToast("Partner disconnected"); 
        cleanupPeerConnection(); 
        showRating(); 
      }); 
      socket.on("partnerLeft", () => { 
        log("partnerLeft"); 
        showToast("Partner left"); 
        cleanupPeerConnection(); 
        showRating(); 
      }); 
      socket.on("errorMessage", (e) => { console.warn("server errorMessage:", e); showToast(e && e.message ? e.message : "Server error"); });

      // Omitted Activity Handlers for brevity...

    })();

    return function () { cleanup(); };
  }, [isAuthenticated, hasOffered, makingOffer, polite, ignoreOffer, isCleaning, localStream, socketConnected]); // Added necessary dependencies

  function escapeHtml(s) { return String(s).replace(/[&<>\"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]); }
  
  // Check isAuthenticated and show a loading screen if not authenticated yet
  if (!isAuthenticated) {
    return (
        <div style={{ 
            background: '#08060c', 
            minHeight: '100vh', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#fff',
            fontSize: '24px',
            fontFamily: 'Poppins, sans-serif'
        }}>
            <div className="loading-spinner-heart" style={{marginRight: '10px'}}>💖</div>
            <style jsx global>{`
                .loading-spinner-heart {
                    font-size: 3rem;
                    animation: pulse 1.5s infinite;
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.2); }
                }
            `}</style>
            Checking Authentication...
        </div>
    );
  }


  return (
    <>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" referrerPolicy="no-referrer" />
      <div className="video-stage">
        <div id="callTimer" className="call-timer">00:00</div>
        <div className="video-panes">
          <div className="video-box">
            <div className="watermark-badge" aria-hidden="true"><span>Milan</span><em className="reel-dot"></em></div>
            <video id="remoteVideo" autoPlay playsInline></video>
            <div className="label">Partner</div>
          </div>
          <div className="video-box">
            <div className="watermark-badge" aria-hidden="true"><span>Milan</span><em className="reel-dot"></em></div>
            <video id="localVideo" autoPlay playsInline muted></video>
            <div className="label">You</div>
          </div>
        </div>
      </div>

      <div className="control-bar" role="toolbar" aria-label="Call controls">
        {/* Buttons logic relies on external functions which must be defined in useEffect */}
        <button id="micBtn" className="control-btn" aria-label="Toggle Mic">
          <i className="fas fa-microphone"></i><span>Mic</span>
        </button>
        <button id="camBtn" className="control-btn" aria-label="Toggle Camera">
          <i className="fas fa-video"></i><span>Camera</span>
        </button>
        <button id="screenShareBtn" className="control-btn" aria-label="Share Screen">
          <i className="fas fa-desktop"></i><span>Share</span>
        </button>
        <button id="activitiesBtn" className="control-btn" aria-label="Open Fun Activities">
          <i className="fas fa-gamepad"></i><span>Activities</span>
        </button>
        <button id="disconnectBtn" className="control-btn danger" aria-label="End Call">
          <i className="fas fa-phone-slash"></i><span>End</span>
        </button>
      </div>

      {/* Disconnect Confirmation Modal - ADDED */}
      {showDisconnectConfirm && (
        <div className="modal-overlay">
          <div className="disconnect-confirm-modal">
            <div className="modal-content">
              <div className="modal-icon">💔</div>
              <h3 className="modal-title">Wait, is this goodbye? 🥺</h3>
              <p className="modal-message">
                Are you sure you want to end this connection? You might miss a spark! 🔥
              </p>
              <div className="modal-actions">
                <button 
                  onClick={handleKeepChatting} 
                  className="btn-keep"
                >
                  Keep Chatting
                </button>
                <button 
                  onClick={handleConfirmDisconnect} 
                  className="btn-end"
                >
                  End Connection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* End Disconnect Confirmation Modal */}

      {/* Activities Modal - Omitted for brevity */}

      {/* EXISTING MODALS (Omitted for brevity) */}
      <div id="twoOptionModal" className="overlay-modal" style={{display:'none'}}>
        <div className="modal-card small">
          <div className="q-counter" style={{textAlign:'right',opacity:.8}}>1/10</div>
          <div className="q-text" style={{fontSize:20,marginBottom:12}}>Question text</div>
          <div className="options-row">
            <button id="optA" className="opt-btn">Option A</button>
            <button id="optB" className="opt-btn">Option B</button>
          </div>
          <div className="waiting-text" style={{marginTop:12,opacity:.9}}>Choose your answer...</div>
          <div id="twoOptionReveal" className="reveal" style={{display:'none',marginTop:12}}>
            <div><strong>You:</strong> <span className="you-choice"></span></div>
            <div><strong>Partner:</strong> <span className="other-choice"></span></div>
            <div className="match-text" style={{marginTop:8}}></div>
          </div>
        </div>
      </div>

      <div id="twoOptionResultModal" className="overlay-modal" style={{display:'none'}}>
        <div className="modal-card">
          <h2 className="final-percent">0%</h2>
          <p className="final-text">Your love score</p>
          <div className="result-hearts">
            <i className="far fa-heart"></i><i className="far fa-heart"></i><i className="far fa-heart"></i><i className="far fa-heart"></i><i className="far fa-heart"></i>
          </div>
          <div style={{marginTop:14}}>
            <button id="closeTwoRes" className="act-btn">Close</button>
          </div>
        </div>
      </div>

      <div id="spinOverlay" className="overlay-modal" style={{display:'none', alignItems:'center', justifyContent:'center'}}>
        <div className="modal-card">
          <div style={{textAlign:'center'}}>
            <div style={{height:160, width:160, margin:'0 auto', position:'relative'}}>
              <img id="spinBottleImg" src="/bottle.svg" alt="bottle" style={{width:'100%',height:'100%',transformOrigin:'50% 50%'}} />
            </div>
            <div style={{marginTop:12}}>Spinning the bottle...</div>
          </div>
        </div>
      </div>

      <div id="spinModal" className="overlay-modal" style={{display:'none'}}>
        <div className="modal-card">
          <h3 className="spin-who">Bottle pointed to: —</h3>
          <p className="spin-status">Prompt / dare</p>
          <div style={{marginTop:16}}>
            <button id="spinDone" className="act-btn">Done</button>
            <button id="spinSkip" className="act-btn" style={{marginLeft:10}}>Skip</button>
          </div>
        </div>
      </div>

      {/* NEW ACTIVITY MODALS Omitted for brevity */}

      {/* Rating Overlay */}
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
            {/* FIX: Continue Call button added here */}
            <button 
                id="continueCallBtn" 
                onClick={handleRatingOverlayClose} 
                style={{background:'linear-gradient(135deg,#4cd964,#34c759)'}}
            >
                Continue Call
            </button>
            {/* End FIX */}
            
            <button id="newPartnerBtn" onClick={() => window.location.href = "/connect"}>Search New Partner</button>
          </div>
          <div className="emoji-container" aria-hidden="true"></div>
        </div>
      </div>

      <div id="toast"></div>

      <style jsx global>{`
        /* Custom Disconnect Confirmation Modal Styles */
        .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(12px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100000;
            animation: fadeIn 0.3s ease;
            padding: 20px;
        }

        .disconnect-confirm-modal {
            background: linear-gradient(145deg, rgba(255, 110, 167, 0.25), rgba(139, 92, 246, 0.2));
            border: 2px solid rgba(255, 110, 167, 0.5);
            border-radius: 28px;
            padding: 2.5rem 2rem;
            max-width: 420px;
            width: 100%;
            text-align: center;
            box-shadow: 0 25px 70px rgba(255, 79, 160, 0.4), 0 0 120px rgba(255, 20, 147, 0.25);
            animation: slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
            position: relative;
            overflow: hidden;
            color: #ffffff;
        }
        
        .modal-icon {
            font-size: 3.5rem;
            margin-bottom: 1rem;
            animation: heartBounce 1.2s ease-in-out infinite;
        }
        
        .modal-title {
            font-size: 1.6rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
            color: #ffd7e0;
        }

        .modal-message {
            font-size: 1rem;
            opacity: 0.9;
            margin-bottom: 1.5rem;
        }

        .modal-actions {
            display: flex;
            gap: 1rem;
            justify-content: center;
        }

        .btn-keep, .btn-end {
            flex: 1;
            padding: 1rem 1.2rem;
            border-radius: 50px;
            border: none;
            font-size: 1rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .btn-keep {
            background: linear-gradient(135deg, #4cd964, #34c759);
            color: white;
            box-shadow: 0 5px 20px rgba(76, 217, 100, 0.5);
        }
        .btn-end {
            background: linear-gradient(135deg, #ff4fa0, #ff1493);
            color: white;
            box-shadow: 0 5px 20px rgba(255, 79, 160, 0.5);
        }
        .btn-keep:hover, .btn-end:hover {
            transform: translateY(-2px);
        }

        @keyframes heartBounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @keyframes slideUp {
          from { transform: translateY(50px) scale(0.95); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        /* End Custom Disconnect Confirmation Modal Styles */


        *{margin:0;padding:0;box-sizing:border-box}
        html,body{height:100%;background:#000;font-family:'Segoe UI',sans-serif;overflow:hidden}
        .video-stage{position:relative;width:100%;height:100vh;padding-bottom:calc(110px + env(safe-area-inset-bottom));background:linear-gradient(180deg,#0b0b0f 0%, #0f0610 100%);}
        .call-timer{position:absolute;left:50%;top:12px;transform:translateX(-50%);z-index:3500;background:linear-gradient(90deg,#ff7aa3,#ffb26a);padding:6px 14px;border-radius:999px;color:#fff;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.6);backdrop-filter: blur(6px);font-size:14px}
        .video-panes{position:absolute;left:0;right:0;top:0;bottom:calc(110px + env(safe-area-inset-bottom));display:flex;gap:12px;padding:12px;}
        .video-box{position:relative;flex:1 1 50%;border-radius:14px;overflow:hidden;background:linear-gradient(180deg,#08080a,#111);border:1px solid rgba(255,255,255,.04);min-height:120px;box-shadow:0 12px 40px rgba(0,0,0,.6)}
        .video-box video{width:100%;height:100%;object-fit:cover;background:#000;display:block; filter: contrast(1.05) saturate(1.05); -webkit-filter: contrast(1.05) saturate(1.05);}
        .video-box::after{content:"";position:absolute; inset:0;pointer-events:none;box-shadow: inset 0 80px 120px rgba(0,0,0,0.25);border-radius: inherit;z-index:16;}
        #localVideo{ transform: scaleX(-1); }
        .label{position:absolute;left:10px;bottom:10px;padding:6px 10px;font-size:12px;color:#fff;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.05);border-radius:10px;pointer-events:none}
        .control-bar{position:fixed;bottom:calc(18px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);display:flex;gap:12px;padding:8px 10px;background:linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));border-radius:16px;z-index:3000;backdrop-filter: blur(8px);max-width:calc(100% - 24px);overflow-x:auto;align-items:center;box-shadow:0 12px 30px rgba(0,0,0,.6)}
        .control-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(255,255,255,0.03);color:#fff;border-radius:14px;width:64px;height:64px;cursor:pointer;flex:0 0 auto;border:1px solid rgba(255,255,255,0.03);transition:transform .12s ease, box-shadow .12s ease}
        .control-btn:hover{ transform: translateY(-4px); box-shadow:0 10px 22px rgba(0,0,0,0.45)}
        .control-btn span{font-size:12px;margin-top:6px}
        .control-btn.inactive{opacity:0.5}.control-btn.active{box-shadow:0 6px 18px rgba(255,77,141,0.18);transform:translateY(-2px)}.control-btn.danger{background:linear-gradient(135deg,#ff4d8d,#b51751);border:none}
        #ratingOverlay{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.9);color:#fff;z-index:4000;padding:20px}
        .rating-content{position:relative;min-width: min(720px, 92vw);max-width:920px;max-height:80vh;padding:28px 36px;border-radius:20px;text-align:center;background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));border:1px solid rgba(255,255,255,.03);box-shadow:0 20px 60px rgba(0,0,0,.6);z-index:1;overflow:auto}
        .rating-content h2{ font-size:28px;margin-bottom:14px;letter-spacing:.3px }
        .hearts{ display:flex;gap:18px;font-size:56px;margin:22px 0 8px 0;justify-content:center;z-index:2;position:relative }
        .hearts i{ color:#777;cursor:pointer;transition:transform .18s,color .18s }
        .hearts i:hover{ transform:scale(1.12);color:#ff6fa3 }
        .hearts i.selected{ color:#ff1744 }
        .rating-buttons{ display:flex;gap:18px;margin-top:24px;justify-content:center;position:relative;z-index:2;flex-wrap:wrap }
        .rating-buttons button{ padding:14px 24px;font-size:18px;border-radius:14px;border:none;color:#fff;cursor:pointer;background:linear-gradient(135deg,#ff4d8d,#6a5acd);box-shadow:0 10px 28px rgba(0,0,0,.45);backdrop-filter: blur(14px);transition:transform .2s ease,opacity .2s ease }
        .rating-buttons button:hover{ transform: translateY(-4px); box-shadow:0 10px 22px rgba(0,0,0,0.45)}
        .rating-buttons button:active{ transform: translateY(-1px); box-shadow:0 6px 18px rgba(0,0,0,0.45)}
        #toast{position:fixed;left:50%;bottom:calc(110px + env(safe-area-inset-bottom));transform:translateX(-50%);background:#111;color:#fff;padding:10px 14px;border-radius:8px;display:none;z-index:5000;border:1px solid rgba(255,255,255,.08)}

        .watermark-badge{position:absolute;right:14px;bottom:14px;z-index:40;display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:26px;background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));color: rgba(255,255,255,0.94);font-weight:800;letter-spacing:1px;font-size:14px;transform: rotate(-12deg);box-shadow: 0 8px 30px rgba(0,0,0,0.6);backdrop-filter: blur(6px) saturate(1.1);-webkit-backdrop-filter: blur(6px) saturate(1.1);transition: transform .18s ease, opacity .18s ease;opacity: 0.95;pointer-events: none;}
        .watermark-badge.small{ font-size:12px; padding:6px 10px; right:10px; bottom:10px; transform: rotate(-10deg) scale(0.92); }
        .watermark-badge span{ display:inline-block; transform: translateY(-1px); }
        .watermark-badge .reel-dot{display:inline-block;width:10px;height:10px;border-radius:50%;background: linear-gradient(45deg,#ff6b8a,#ffd166);box-shadow:0 6px 14px rgba(255,107,138,0.14), inset 0 -2px 6px rgba(0,0,0,0.15);transform: translateY(0) rotate(0);}
        .video-box:hover .watermark-badge{ transform: translateX(-4px) rotate(-10deg); opacity:1; }
        @keyframes badge-breath { 0%{ transform: rotate(-12deg) scale(0.995) } 50%{ transform: rotate(-12deg) scale(1.01) } 100%{ transform: rotate(-12deg) scale(0.995) } }
        .watermark-badge{ animation: badge-breath 4.5s ease-in-out infinite; }

        .overlay-modal{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.75);z-index:4500;backdrop-filter:blur(4px)}
        .modal-card{background:linear-gradient(180deg, rgba(20,20,25,0.98), rgba(15,15,20,0.98));padding:24px;border-radius:16px;min-width:320px;max-width:90vw;color:#fff;border:1px solid rgba(255,255,255,.08);box-shadow:0 20px 60px rgba(0,0,0,.8);position:relative;max-height:80vh;overflow-y:auto}
        .modal-card.small{min-width: min(520px, 92vw)}
        .modal-card.wide{min-width: min(800px, 92vw);max-width:95vw}
        .modal-close{position:absolute;right:12px;top:12px;background:rgba(255,255,255,0.05);border:none;color:#fff;font-size:24px;cursor:pointer;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;transition:background .2s}
        .modal-close:hover{background:rgba(255,255,255,0.1)}

        /* Bottom Sheet Activities Modal */
        .activities-overlay{position:fixed;inset:0;z-index:4500;display:none}
        .activities-backdrop{position:absolute;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px)}
        .activities-sheet{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(180deg, rgba(20,20,25,0.98), rgba(15,15,20,0.98));border-radius:24px 24px 0 0;max-height:85vh;transform:translateY(100%);transition:transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);border:1px solid rgba(255,255,255,0.1);border-bottom:none;box-shadow:0 -10px 60px rgba(0,0,0,0.8)}
        .activities-sheet.show{transform:translateY(0)}
        .sheet-handle{width:40px;height:4px;background:rgba(255,255,255,0.3);border-radius:2px;margin:12px auto 0 auto}
        .sheet-header{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.08);position:sticky;top:0;background:linear-gradient(180deg, rgba(20,20,25,0.98), rgba(15,15,20,0.95));z-index:10;backdrop-filter:blur(8px)}
        .sheet-header h3{color:#fff;font-size:20px;margin:0}
        .sheet-close{background:rgba(255,255,255,0.08);border:none;color:#fff;font-size:28px;cursor:pointer;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:background .2s;line-height:1}
        .sheet-close:hover{background:rgba(255,255,255,0.15)}
        .sheet-content{padding:8px 0 calc(20px + env(safe-area-inset-bottom));max-height:calc(85vh - 70px);overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch}
        
        .act-item{display:flex;align-items:center;gap:14px;padding:16px 20px;cursor:pointer;transition:background .2s;border-bottom:1px solid rgba(255,255,255,0.04)}
        .act-item:hover{background:rgba(255,255,255,0.05)}
        .act-item:active{background:rgba(255,255,255,0.08)}
        .act-item-icon{font-size:32px;flex-shrink:0;width:50px;height:50px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.05);border-radius:12px}
        .act-item-content{flex:1}
        .act-item-content h4{color:#fff;font-size:16px;margin:0 0 4px 0;font-weight:600}
        .act-item-content p{color:rgba(255,255,255,0.7);font-size:13px;margin:0;line-height:1.4}
        .act-item-arrow{color:rgba(255,255,255,0.3);font-size:16px;flex-shrink:0}

        .act-btn{padding:10px 16px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff4d8d,#ff6fa3);color:#fff;cursor:pointer;font-size:14px;font-weight:600;transition:transform .2s,opacity .2s;width:100%}
        .act-btn:hover{transform:scale(1.02);opacity:.9}
        .act-btn.danger-btn{background:linear-gradient(135deg,#ff4d4d,#cc0000)}

        .options-row{display:flex;gap:12px}
        .opt-btn{flex:1;padding:14px;border-radius:12px;border:none;background:rgba(255,255,255,0.08);color:#fff;font-size:16px;cursor:pointer;transition:background .2s}
        .opt-btn:hover{background:rgba(255,255,255,0.12)}
        .opt-btn.disabled{opacity:.4;pointer-events:none}
        .reveal{background:rgba(255,255,255,0.05);padding:12px;border-radius:10px;margin-top:8px;border:1px solid rgba(255,255,255,0.08)}
        .result-hearts i{font-size:36px;margin:6px;color:#444}
        .result-hearts i.selected{color:#ff1744}
        #spinBottleImg{ display:block; transform-origin:50% 50%; will-change:transform; }

        .activity-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08)}
        .big-timer{font-size:32px;font-weight:700;color:#ff6fa3;min-width:60px;text-align:right}
        .big-text{font-size:22px;font-weight:600;margin:12px 0;line-height:1.4}

        @media(max-width: 900px){
          .video-panes{ flex-direction:column; }
          .video-box{ flex:1 1 50%; min-height: 180px; }
          .rating-content{ padding:20px; min-width: 88vw }
          .hearts{ font-size:44px; gap:14px }
          .rating-buttons button{ font-size:16px; padding:12px 18px }
          .call-timer{ top:8px; font-size:13px; padding:6px 12px }
          .control-btn{ width:64px; height:64px }
          .control-bar{ gap:10px; padding:8px }
          .activities-sheet{max-height:90vh}
          .sheet-content{max-height:calc(90vh - 70px)}
        }

        @media(max-width: 600px){
          .big-text{font-size:18px}
          .big-timer{font-size:28px}
          .act-item{padding:14px 16px}
          .act-item-icon{font-size:28px;width:46px;height:46px}
          .act-item-content h4{font-size:15px}
          .act-item-content p{font-size:12px}
        }

        @media(max-width: 480px){
          .video-box{ border-radius:10px }
          .video-panes{ padding:8px }
          .control-bar{ left:8px; right:8px; transform:none; margin:0 auto; justify-content:center }
          .control-bar{ bottom:calc(10px + env(safe-area-inset-bottom)); }
          .control-btn span{ display:none }
          .control-btn{ width:56px; height:56px }
          .rating-content{ padding:18px; min-width:86vw }
          .hearts{ font-size:36px }
          .call-timer{ font-size:12px; padding:6px 10px }
          .modal-card{padding:18px;min-width:90vw}
          .act-item{padding:12px 14px}
          .act-item-icon{font-size:26px;width:44px;height:44px}
          .sheet-header{padding:14px 16px}
          .sheet-header h3{font-size:18px}
          .disconnect-confirm-modal { padding: 2rem 1.5rem; max-width: 340px; }
          .modal-actions { flex-direction: column; }
          .btn-keep, .btn-end { padding: 0.8rem; }
        }

        .floating-emoji{position:absolute;font-size:32px;animation:float-up 1.4s ease-out forwards;pointer-events:none}
        @keyframes float-up{0%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-150%) scale(1.5)}}
      `}</style>
    </>
  );
}


// === COMING SOON OVERRIDE ===
if (typeof document !== 'undefined') {
  const actIds = [
    "startTwoOption","startSpin","startRapidFire","startMirror","startStaring","startLyrics","startDance"
  ];
  actIds.forEach(id=>{
    const el=document.getElementById(id);
    if(el){el.onclick=(e)=>{e.preventDefault();alert("Coming Soon 🔒");};}
  });
}
// === END COMING SOON ===
