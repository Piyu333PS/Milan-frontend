// server/index.js
// ✅ FIXED: Friend request system with proper user tracking
// NOTE: This is your original file with targeted friend-request improvements only.

require("dotenv").config();
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");

// Load question packs
let QUESTION_PACKS = null;
try {
  const packsPath = path.join(__dirname, "question_packs.json");
  if (fs.existsSync(packsPath)) {
    QUESTION_PACKS = JSON.parse(fs.readFileSync(packsPath, "utf8"));
    console.log("Loaded question packs:", Object.keys(QUESTION_PACKS));
  } else {
    console.log("question_packs.json not found – using inline pool");
    QUESTION_PACKS = null;
  }
} catch (err) {
  console.warn("Failed to load question_packs.json – using inline pool", err);
  QUESTION_PACKS = null;
}

// CORS Config
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.set("trust proxy", 1);

// Socket.IO setup
const io = require("socket.io")(http, {
  cors: {
    origin: (origin, callback) => { callback(null, true); },
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingInterval: 10000,
  pingTimeout: 20000,
});

try {
  io.engine.on('connection_error', (err) => {
    console.error('[server][engine] connection_error', err);
  });
} catch(e) {}

app.use(express.json({ limit: "10mb" }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  message: { status: 429, message: "Too many requests. Please try again later." },
});
app.use(apiLimiter);

// MongoDB Connection
(async () => {
  try {
    if (!process.env.MONGO_URI) throw new Error("MONGO_URI missing");
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
  }
})();

// Schemas
const userSchema = new mongoose.Schema({
  emailOrMobile: { type: String, unique: true, required: true },
  mobile: { type: String },
  email: { type: String },
  password: { type: String, required: true },
  name: String,
  avatar: String,
  gender: String,
  dob: String,
  city: String,
  reason: String,
  isPremium: { type: Boolean, default: false },
  
  friends: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: String,
    addedAt: { type: Date, default: Date.now }
  }],
  
  pendingRequests: [{
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fromUsername: String,
    sentAt: { type: Date, default: Date.now }
  }]
});
userSchema.index({ mobile: 1 }, { sparse: true });
userSchema.index({ email: 1 }, { sparse: true });

const User = mongoose.model("User", userSchema);

const messageSchema = new mongoose.Schema({
  sender: String,
  text: String,
  profilePic: String,
  timestamp: { type: Date, default: Date.now },
  roomCode: String,
  type: { type: String, enum: ["text", "file"], default: "text" },
});
messageSchema.index({ roomCode: 1, timestamp: -1 });
const Message = mongoose.model("Message", messageSchema);

// Utilities
function generateRoomCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * Math.random() * chars.length)]).join("");
}

const queues = { text: [], video: [], game: [] };
const socketState = new Map();
const rooms = new Map();
const roomMembers = new Map();

// ✅ User socket tracking for friend requests
const userSocketMap = new Map(); // userId -> socketId
const socketUserMap = new Map(); // socketId -> userId

const offerDebounce = new Map();
const OFFER_DEBOUNCE_MS = 700;

// Game / Question Support
const QUESTIONS = [
  "Tumhe apne partner ki sabse acchi baat kya lagti hai?",
  "Agar tumhe ek magical date mil jaye to kahan le jaoge?",
  "Sabse pehle 'I love you' kisne bola tha?",
  "Tumhari love story ek movie banti to uska naam kya hota?",
  "Tum partner ko ek word me describe karo.",
  "Sabse awkward date ka experience kya tha?",
  "Tumne kabhi galti se wrong person ko 'I love you' message bheja hai?",
  "Tumhara funniest pet name jo kisi ne diya ho?",
  "Agar tumhe ek din ke liye opposite gender banna pad jaye to kya karoge?",
  "Kya tum bathroom me gaana gaate ho?",
];

const questionTimers = new Map();
const lastGameStart = new Map();
const lastGameBySocket = new Map();
const GAME_COOLDOWN_MS = 12 * 1000;
const PER_SOCKET_COOLDOWN_MS = 8 * 1000;

// Zero-DB Invite Rooms
const inviteRooms = new Map();

function getInviteRoom(roomId) {
  if (!inviteRooms.has(roomId)) {
    inviteRooms.set(roomId, { users: new Set(), mode: "auto" });
  }
  return inviteRooms.get(roomId);
}
function inviteOther(roomId, me) {
  const r = inviteRooms.get(roomId);
  if (!r) return null;
  for (const id of r.users) if (id !== me) return id;
  return null;
}
function cleanupInviteMembership(s) {
  try {
    const roomId = s?.data?.inviteRoomId;
    if (!roomId) return;
    const r = inviteRooms.get(roomId);
    if (!r) return;
    r.users.delete(s.id);
    if (r.users.size === 0) {
      inviteRooms.delete(roomId);
    } else {
      const other = inviteOther(roomId, s.id);
      if (other) io.to(other).emit("invitePeerLeft", { roomId });
    }
    s.data.inviteRoomId = null;
  } catch (e) {
    console.warn("[invite] cleanup error:", e);
  }
}

// Root Route
app.get("/", (req, res) => {
  res.send("✅ Milan backend is running successfully.");
});

// Auth Routes
app.post("/register", async (req, res) => {
  try {
    const { name, emailOrMobile, password, gender, dob, city, reason } = req.body;
    if (!name || !emailOrMobile || !password) return res.status(400).json({ message: "Name, email/mobile, password required" });

    const existingUser = await User.findOne({ emailOrMobile });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    let mobile = null, email = null;
    const trimmed = String(emailOrMobile || '').trim();
    if (/^\d+$/.test(trimmed)) mobile = trimmed;
    else if (/@/.test(trimmed)) email = trimmed;

    const user = new User({ name, emailOrMobile: trimmed, password: hashedPassword, mobile, email, gender, dob, city, reason });
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "secret", { expiresIn: "7d" });

    res.status(201).json({ message: "User registered", token, user: { name: user.name, emailOrMobile: user.emailOrMobile } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error during registration" });
  }
});

// Login
app.post("/login", async (req, res) => {
  try {
    const body = req.body || {};
    const rawEmail = (body.email || "").toString();
    const rawMobile = (body.mobile || "").toString();
    const rawLegacy = (body.emailOrMobile || "").toString();
    const rawIdentifier = (body.identifier || "").toString();
    const rawPassword = (body.password || "").toString();

    if (!rawPassword) return res.status(400).json({ message: "Password required" });

    const normalizeEmail = (s) => s ? s.trim().toLowerCase() : "";
    const normalizeMobile = (s) => {
      if (!s) return "";
      const digits = s.replace(/\D/g, "");
      return digits.length > 10 ? digits.slice(-10) : digits;
    };

    let identifier = rawIdentifier || rawMobile || rawEmail || rawLegacy;
    identifier = (identifier || "").toString().trim();
    if (!identifier) return res.status(400).json({ message: "Email or mobile required" });

    const searchCandidates = [];
    if (/@/.test(identifier)) {
      searchCandidates.push({ email: normalizeEmail(identifier) });
      searchCandidates.push({ emailOrMobile: identifier.trim() });
    } else {
      const normMobile = normalizeMobile(identifier);
      if (normMobile) {
        searchCandidates.push({ mobile: normMobile });
        searchCandidates.push({ emailOrMobile: normMobile });
      }
      searchCandidates.push({ emailOrMobile: identifier.trim() });
      searchCandidates.push({ email: normalizeEmail(identifier) });
    }

    let user = null;
    for (const q of searchCandidates) {
      const hasNonEmpty = Object.values(q).some(v => v !== "" && v !== null && typeof v !== "undefined");
      if (!hasNonEmpty) continue;
      user = await User.findOne(q).lean();
      if (user) break;
    }

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (!user.password || typeof user.password !== "string") {
      return res.status(500).json({ message: "User record malformed (contact support)" });
    }

    const isMatch = await bcrypt.compare(rawPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "secret", { expiresIn: "7d" });

    const safeUser = {
      name: user.name,
      email: user.email || null,
      mobile: user.mobile || null,
      emailOrMobile: user.emailOrMobile || null,
      avatar: user.avatar || null,
      isPremium: !!user.isPremium,
      id: user._id
    };

    return res.status(200).json({ message: "Login successful", token, user: safeUser });
  } catch (err) {
    console.error("[/login] unexpected error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error during login" });
  }
});

app.get("/api/profile/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Queue & Room Helpers
function enqueue(mode, socketId) {
  if (!queues[mode].includes(socketId)) queues[mode].push(socketId);
  setState(socketId, { queuedAt: Date.now() });
}
function dequeue(mode) { return queues[mode].shift(); }
function removeFromQueues(socketId) {
  ["text", "video", "game"].forEach((m) => { queues[m] = queues[m].filter((id) => id !== socketId); });
  const st = socketState.get(socketId) || {};
  if (st.queuedAt) setState(socketId, { queuedAt: null });
}
function getPartnerFor(mode, exceptId) {
  for (let i = 0; i < queues[mode].length; i++) {
    const id = queues[mode][i];
    if (id === exceptId) continue;
    const s = safeGetSocket(id);
    const st = socketState.get(id) || {};
    if (!s || !s.connected || st.roomCode) { queues[mode].splice(i, 1); i--; continue; }
    queues[mode].splice(i, 1);
    return id;
  }
  return null;
}
function safeGetSocket(id) { return io.sockets.sockets.get(id); }
function setState(id, patch) { const prev = socketState.get(id) || {}; const next = { ...prev, ...patch }; socketState.set(id, next); return next; }
function clearState(id) { socketState.delete(id); }

function makeRoom(mode, aId, bId) {
  const code = generateRoomCode();
  const init = Math.random() < 0.5 ? aId : bId;
  const roomObj = { mode, a: aId, b: bId, createdAt: Date.now(), initiator: init };
  if (mode === "game") roomObj.state = { game: "tic-tac-toe", board: Array(9).fill(null), turn: "X", winner: null };
  rooms.set(code, roomObj);
  return code;
}

function peersInRoom(code) {
  const r = rooms.get(code);
  if (!r) return [];
  return [r.a, r.b].filter(Boolean).map(safeGetSocket).filter(Boolean);
}

function dissolveRoom(code) {
  const r = rooms.get(code);
  if (!r) return;
  [r.a, r.b].forEach((id) => {
    const s = safeGetSocket(id);
    if (s) { try { s.leave(code); } catch {} const st = socketState.get(id) || {}; if (st.roomCode === code) setState(id, { roomCode: null, partnerId: null }); }
  });
  rooms.delete(code);
}

function checkWinner(board) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  if (board.every(Boolean)) return "draw";
  return null;
}

function getOtherParticipant(roomCode, fromId) {
  const members = roomMembers.get(roomCode) || new Set();
  for (const id of members) { if (id !== fromId) return id; }
  return null;
}

// Socket.IO Logic
io.on("connection", (socket) => {
  console.log('[server] socket connected:', socket.id);

  function cleanupSocket(s) {
    const st = socketState.get(s.id);
    
    // Remove from user socket map
    if (st?.userId) {
      userSocketMap.delete(st.userId);
      socketUserMap.delete(s.id);
      console.log(`[cleanup] Removed userId ${st.userId} from socket map`);
    }
    
    removeFromQueues(s.id);

    if (st?.partnerId) {
      const partner = safeGetSocket(st.partnerId);
      if (partner && partner.connected) {
        setState(partner.id, { partnerId: null, roomCode: null });
        const pst = socketState.get(partner.id) || {};
        if (pst.mode) { removeFromQueues(partner.id); enqueue(pst.mode, partner.id); try { partner.emit("requeued", { mode: pst.mode }); } catch (e) {} }
      }
    }

    if (st?.roomCode && rooms.has(st.roomCode)) {
      const r = rooms.get(st.roomCode);
      const otherId = r.a === s.id ? r.b : r.a;
      const other = safeGetSocket(otherId);
      if (other && other.connected) { try { other.emit("partnerDisconnected"); } catch (e) {} setState(other.id, { partnerId: null, roomCode: null }); const pst = socketState.get(other.id) || {}; if (pst.mode) { enqueue(pst.mode, other.id); try { other.emit("requeued", { mode: pst.mode }); } catch (e) {} } }
      dissolveRoom(st.roomCode);
    }

    try {
      const roomCode = st?.roomCode;
      if (roomCode) {
        const members = roomMembers.get(roomCode);
        if (members) {
          members.delete(s.id);
          if (members.size === 0) roomMembers.delete(roomCode);
          else {
            roomMembers.set(roomCode, members);
            const otherId = Array.from(members).find(id => id !== s.id) || null;
            if (otherId) {
              const other = safeGetSocket(otherId);
              if (other && other.connected) {
                try { other.emit("partnerDisconnected"); } catch (e) {}
                setState(other.id, { partnerId: null, roomCode: null });
                const pst = socketState.get(other.id) || {};
                if (pst.mode) { enqueue(pst.mode, other.id); try { other.emit("requeued", { mode: pst.mode }); } catch (e) {} }
              }
            }
          }
        }
      }
    } catch (e) { console.warn("roomMembers cleanup failed:", e); }

    cleanupInviteMembership(s);
    clearState(s.id);
  }

  socket.on("disconnect", (reason) => {
    console.log("❌ Socket disconnected:", socket.id, "reason:", reason);
    cleanupSocket(socket);
  });

  // ✅ FIXED: User Info with userId tracking
  socket.on("userInfo", (data = {}) => {
    try {
      const { userId, name, avatar, gender } = data || {};
      
      if (userId) {
        userSocketMap.set(userId, socket.id);
        socketUserMap.set(socket.id, userId);
        console.log(`✅ [userInfo] Mapped userId ${userId} to socket ${socket.id} (name: ${name})`);
      }
      
      setState(socket.id, { userId, name, avatar, gender });
    } catch (e) {
      console.warn("[userInfo] error:", e);
    }
  });

  // ====== UPDATED: Send Friend Request (flexible target + socket fallback + safe DB writes) ======
  socket.on("send-friend-request", async (payload = {}) => {
    try {
      // Accept different key names for backward compatibility
      const targetCandidate = payload.targetUserId || payload.targetSocketId || payload.targetUserIdOrSocketId || null;
      const providedMyUserId = payload.myUserId || payload.fromUserId || payload.senderId || null;
      const providedMyUsername = payload.myUsername || payload.fromUsername || payload.senderUsername || null;
      const roomCode = payload.roomCode || null;

      // Determine sender identity (prefer supplied myUserId, else server state, else socket.id)
      const st = socketState.get(socket.id) || {};
      const fromUserId = providedMyUserId || st.userId || null;
      const fromUsername = providedMyUsername || st.name || "Someone";

      if (!targetCandidate) {
        console.warn("❌ [friend-request] missing target (targetUserId/targetSocketId)");
        return socket.emit("friend-request-result", { success: false, reason: "missing-target" });
      }

      console.log(`📤 [friend-request] ${fromUsername} (${fromUserId || socket.id}) → ${targetCandidate} (room ${roomCode})`);

      // Try to resolve targetCandidate as userId -> socketId
      let targetSocketId = null;
      // If targetCandidate is mapped to a user -> socket
      if (userSocketMap.has(String(targetCandidate))) {
        targetSocketId = userSocketMap.get(String(targetCandidate));
      }

      // Fallback: maybe client sent a direct socket id (check if such a socket exists)
      if (!targetSocketId && io.sockets.sockets.has(String(targetCandidate))) {
        targetSocketId = String(targetCandidate);
        console.log(`🔁 [friend-request] fallback: using direct socket id ${targetSocketId}`);
      }

      // If still not found, try to see if we can find by socketUserMap reverse (rare)
      if (!targetSocketId) {
        // if provided candidate is actually a userId and mapped to socketUserMap we tried above,
        // but try a fallback search: look through socketUserMap for value === candidate (less efficient)
        for (const [sockId, uid] of socketUserMap.entries()) {
          if (String(uid) === String(targetCandidate)) { targetSocketId = sockId; break; }
        }
      }

      if (targetSocketId) {
        try {
          io.to(targetSocketId).emit("friend-request-received", {
            fromUserId: fromUserId || null,
            fromUsername: fromUsername || "Someone",
            timestamp: new Date().toISOString(),
            roomCode
          });
          console.log(`✅ [friend-request] Emitted to socket ${targetSocketId}`);
          socket.emit("friend-request-result", { success: true, deliveredToSocket: targetSocketId });
        } catch (e) {
          console.warn(`❌ [friend-request] emit failed to ${targetSocketId}`, e);
          socket.emit("friend-request-result", { success: false, reason: "emit-failed" });
        }
      } else {
        console.log(`⚠️ [friend-request] Target ${targetCandidate} not online`);
        socket.emit("friend-request-result", { success: false, reason: "target-not-online" });
      }

      // Save to database ONLY if targetCandidate looks like a valid ObjectId (i.e., a real user id)
      const isTargetObjectId = mongoose.Types.ObjectId.isValid(String(targetCandidate));
      const isFromObjectId = mongoose.Types.ObjectId.isValid(String(fromUserId));
      if (isTargetObjectId) {
        try {
          // If fromUserId is a valid ObjectId, push as ObjectId. Else, push only username
          const pushObj = {
            from: isFromObjectId ? fromUserId : undefined,
            fromUsername: fromUsername || "Someone",
            sentAt: new Date()
          };
          // Clean pushObj if from is undefined to avoid schema mismatch
          if (!pushObj.from) delete pushObj.from;

          await User.findByIdAndUpdate(String(targetCandidate), {
            $push: { pendingRequests: pushObj }
          }, { safe: true, upsert: false });
          console.log(`💾 [friend-request] Saved pending request in DB for user ${targetCandidate}`);
        } catch (dbErr) {
          console.warn("❌ [friend-request] DB save failed:", dbErr);
        }
      } else {
        // Not a valid ObjectId: likely a socket id. Skip DB write.
        console.log("ℹ️ [friend-request] targetCandidate not an ObjectId — skipping DB write.");
      }

    } catch (error) {
      console.error("❌ [friend-request] unexpected error:", error);
      try { socket.emit("friend-request-result", { success: false, reason: "server-error" }); } catch (e) {}
    }
  });
  // ====== END updated friend-request handler ======

  // ✅ FIXED: Friend Request Response (Accept/Reject)
  socket.on("friend-request-response", async ({ accepted, requesterId, responderId, responderUsername } = {}) => {
    try {
      if (!requesterId || !responderId) {
        console.warn("❌ [friend-response] missing IDs");
        return socket.emit("friend-response-error", { message: "Missing IDs" });
      }

      console.log(`📬 [friend-response] ${responderId} ${accepted ? '✅ ACCEPTED' : '❌ REJECTED'} ${requesterId}`);

      if (accepted) {
        // Add to both users' friends list
        try {
          await User.findByIdAndUpdate(requesterId, {
            $push: { 
              friends: { 
                userId: responderId, 
                username: responderUsername || "Friend" 
              } 
            }
          });
          
          await User.findByIdAndUpdate(responderId, {
            $push: { 
              friends: { 
                userId: requesterId 
              } 
            },
            $pull: { 
              pendingRequests: { from: requesterId } 
            }
          });

          console.log(`💾 [friend-response] DB updated for both users`);
        } catch (dbErr) {
          console.error("❌ [friend-response] DB update failed:", dbErr);
        }
        
        // Notify requester - ACCEPTED
        const requesterSocketId = userSocketMap.get(requesterId);
        if (requesterSocketId) {
          io.to(requesterSocketId).emit("friend-request-accepted", {
            responderId,
            responderUsername: responderUsername || "Friend",
            timestamp: new Date().toISOString()
          });
          console.log(`✅ [friend-response] Acceptance sent to ${requesterSocketId}`);
        }

      } else {
        // REJECTED - Just remove pending request
        try {
          await User.findByIdAndUpdate(responderId, {
            $pull: { 
              pendingRequests: { from: requesterId } 
            }
          });
          console.log(`💾 [friend-response] Removed pending request from DB`);
        } catch (dbErr) {
          console.warn("❌ [friend-response] DB remove failed:", dbErr);
        }
        
        // Notify requester - REJECTED
        const requesterSocketId = userSocketMap.get(requesterId);
        if (requesterSocketId) {
          io.to(requesterSocketId).emit("friend-request-rejected", {
            responderId,
            timestamp: new Date().toISOString()
          });
          console.log(`❌ [friend-response] Rejection sent to ${requesterSocketId}`);
        }
      }

    } catch (error) {
      console.error("❌ [friend-response] error:", error);
      socket.emit("friend-response-error", { message: "Response failed" });
    }
  });

  // ✅ FIXED: Partner Finding with proper user info sharing
  socket.on("lookingForPartner", ({ type, token } = {}) => {
    const mode = type || "video";
    enqueue(mode, socket.id);
    const partnerId = getPartnerFor(mode, socket.id);

    if (partnerId) {
      const roomCode = makeRoom(mode, socket.id, partnerId);
      setState(socket.id, { roomCode, partnerId, mode });
      setState(partnerId, { roomCode, partnerId: socket.id, mode });

      socket.join(roomCode);
      safeGetSocket(partnerId).join(roomCode);

      // ✅ Get user info from state
      const myState = socketState.get(socket.id) || {};
      const partnerState = socketState.get(partnerId) || {};

      // ✅ Share user info with partner
      socket.emit("partnerFound", { 
        partner: { 
          id: partnerId,
          userId: partnerState.userId || null,
          name: partnerState.name || "Romantic Stranger",
          avatar: partnerState.avatar || null,
          gender: partnerState.gender || "unknown"
        }, 
        roomCode 
      });
      
      safeGetSocket(partnerId).emit("partnerFound", { 
        partner: { 
          id: socket.id,
          userId: myState.userId || null,
          name: myState.name || "Romantic Stranger",
          avatar: myState.avatar || null,
          gender: myState.gender || "unknown"
        }, 
        roomCode 
      });

      console.log(`✅ [partnerFound] ${myState.name || socket.id} ↔️ ${partnerState.name || partnerId} in room ${roomCode}`);

      if (mode === "game") {
        const roomObj = rooms.get(roomCode);
        const initialState = roomObj.state || { game: "tic-tac-toe", board: Array(9).fill(null), turn: "X", winner: null };
        const initiatorId = roomObj.initiator;
        const playerSymbols = {};
        playerSymbols[roomObj.a] = initiatorId === roomObj.a ? "X" : "O";
        playerSymbols[roomObj.b] = initiatorId === roomObj.b ? "X" : "O";
        io.to(roomCode).emit("startGame", { roomCode, state: initialState });
        try {
          const sA = safeGetSocket(roomObj.a);
          const sB = safeGetSocket(roomObj.b);
          if (sA && sA.connected) sA.emit("playerSymbol", { symbol: playerSymbols[roomObj.a] });
          if (sB && sB.connected) sB.emit("playerSymbol", { symbol: playerSymbols[roomObj.b] });
        } catch (e) { console.warn("playerSymbol emit failed", e); }
      }
    } else {
      try { socket.emit("queued", { mode }); } catch (e) {}
    }
  });

  socket.on("joinRoom", ({ roomCode } = {}) => {
    if (!roomCode) { socket.emit("joinError", { reason: "missing_roomCode" }); return; }
    const room = rooms.get(roomCode);
    if (!room) { socket.emit("joinError", { reason: "room_not_found" }); return; }

    const aAlive = safeGetSocket(room.a);
    const bAlive = safeGetSocket(room.b);

    let replaced = false;
    if (!aAlive) { room.a = socket.id; replaced = true; }
    else if (!bAlive) { room.b = socket.id; replaced = true; }
    else { socket.emit("joinError", { reason: "room_full" }); return; }

    try { socket.join(roomCode); } catch (e) {}
    rooms.set(roomCode, room);

    const partnerId = room.a === socket.id ? room.b : room.a;
    setState(socket.id, { roomCode, partnerId, mode: room.mode });

    const initiatorId = room.initiator;
    const playerSymbols = {};
    playerSymbols[room.a] = initiatorId === room.a ? "X" : "O";
    playerSymbols[room.b] = initiatorId === room.b ? "X" : "O";

    const stateToSend = room.state || { game: "tic-tac-toe", board: Array(9).fill(null), turn: "X", winner: null };
    socket.emit("startGame", { roomCode, state: stateToSend });
    socket.emit("playerSymbol", { symbol: playerSymbols[socket.id] });

    const peers = peersInRoom(roomCode);
    peers.forEach((skt) => {
      try {
        const partner = peers.find(p => p.id !== skt.id);
        const partnerState = partner ? socketState.get(partner.id) || {} : {};
        skt.emit("partnerFound", { 
          partner: partner ? { 
            id: partner.id,
            userId: partnerState.userId || null,
            name: partnerState.name || "Romantic Stranger",
            avatar: partnerState.avatar || null,
            gender: partnerState.gender || "unknown"
          } : null, 
          roomCode 
        });
      } catch (e) {}
    });

    io.to(roomCode).emit("rejoined", { by: socket.id });
  });

  // TEXT CHAT CORE
  socket.on("message", (data = {}) => {
    const { id, text, roomCode, senderId } = data || {};
    if (!roomCode || !text) return;
    io.to(roomCode).emit("message", {
      id: id || `${Date.now()}-${Math.random()}`,
      text: String(text),
      roomCode,
      senderId: senderId || socket.id
    });
  });

  socket.on("fileMessage", (data = {}) => {
    const { id, fileName, fileType, fileData, roomCode, senderId } = data || {};
    if (!roomCode || !fileData) return;
    io.to(roomCode).emit("fileMessage", {
      id: id || `${Date.now()}-${Math.random()}`,
      fileName: fileName || "file",
      fileType: fileType || "application/octet-stream",
      fileData,
      roomCode,
      senderId: senderId || socket.id
    });
  });

  socket.on("typing", ({ roomCode } = {}) => {
    if (!roomCode) return;
    socket.to(roomCode).emit("partnerTyping");
  });

  socket.on("reaction", ({ roomCode, messageId, emoji } = {}) => {
    if (!roomCode || !messageId || !emoji) return;
    io.to(roomCode).emit("reaction", { messageId, emoji, from: socket.id });
  });

  // Video signalling & room membership
  socket.on("joinVideo", ({ roomCode, token } = {}) => {
    try {
      if (!roomCode) { socket.emit("errorMessage", { message: "missing roomCode" }); return; }

      socket.join(roomCode);
      let members = roomMembers.get(roomCode);
      if (!members) members = new Set();

      if (members.has(socket.id)) {
        if (members.size === 2) {
          const arr = Array.from(members);
          const a = arr[0], b = arr[1];
          const politeFor = a < b ? a : b;
          io.to(a).emit("ready", { roomCode, count: members.size, polite: politeFor === a });
          io.to(b).emit("ready", { roomCode, count: members.size, polite: politeFor === b });
        } else {
          socket.emit("waitingForPeer", { roomCode });
        }
        setState(socket.id, { roomCode });
        roomMembers.set(roomCode, members);
        return;
      }

      if (members.size >= 2) {
        console.log(`[server] joinVideo: room ${roomCode} is full (members=${members.size}). rejecting ${socket.id}`);
        try { socket.emit("roomFull", { roomCode }); socket.leave(roomCode); } catch (e) {}
        return;
      }

      members.add(socket.id);
      roomMembers.set(roomCode, members);
      setState(socket.id, { roomCode });

      if (members.size === 2) {
        const arr = Array.from(members);
        const a = arr[0];
        const b = arr[1];
        const politeFor = a < b ? a : b;
        setState(a, { roomCode, partnerId: b, mode: 'video' });
        setState(b, { roomCode, partnerId: a, mode: 'video' });
        try {
          io.to(a).emit("ready", { roomCode, count: members.size, polite: politeFor === a });
          io.to(b).emit("ready", { roomCode, count: members.size, polite: politeFor === b });
        } catch (e) { console.log("[server] emit ready error", e); }
      } else {
        socket.emit("waitingForPeer", { roomCode });
      }
    } catch (err) {
      console.error("[server] joinVideo error:", err);
    }
  });

  socket.on("offer", (offer) => {
    try {
      if (!offer || typeof offer !== 'object' || !offer.type || !offer.sdp) {
        console.warn(`[server] invalid offer from ${socket.id} – ignoring`, offer);
        return;
      }

      const st = socketState.get(socket.id) || {};
      const roomCode = st.roomCode || offer.roomCode;
      if (!roomCode) {
        console.warn(`[server] offer received but missing roomCode from ${socket.id}`);
        return;
      }
      const otherId = getOtherParticipant(roomCode, socket.id);
      if (!otherId) {
        console.warn(`[server] offer received but other participant not found in room ${roomCode} for ${socket.id}`);
        return;
      }
      const last = offerDebounce.get(roomCode) || 0;
      const now = Date.now();
      if (now - last < OFFER_DEBOUNCE_MS) { console.log(`[server] offer debounce: ignoring offer from ${socket.id} in ${roomCode}`); return; }
      offerDebounce.set(roomCode, now);

      const forwardOffer = { type: String(offer.type), sdp: String(offer.sdp), from: socket.id, roomCode };
      io.to(otherId).emit("offer", forwardOffer);
    } catch (e) { console.error("offer forward error", e); }
  });

  socket.on("answer", (answer) => {
    try {
      if (!answer || typeof answer !== 'object' || !answer.type || !answer.sdp) {
        console.warn(`[server] invalid answer from ${socket.id} – ignoring`, answer);
        return;
      }

      const st = socketState.get(socket.id) || {};
      const roomCode = st.roomCode || answer.roomCode;
      if (!roomCode) {
        console.warn(`[server] answer received but missing roomCode from ${socket.id}`);
        return;
      }
      const otherId = getOtherParticipant(roomCode, socket.id);
      if (!otherId) {
        console.warn(`[server] answer received but other participant not found in room ${roomCode} for ${socket.id}`);
        return;
      }

      const forwardAnswer = { type: String(answer.type), sdp: String(answer.sdp), from: socket.id, roomCode };
      io.to(otherId).emit("answer", forwardAnswer);
    } catch (e) { console.error("answer forward error", e); }
  });

  socket.on("candidate", (candidate) => {
    try {
      const candPayload = candidate && (candidate.candidate || candidate);
      if (!candPayload || !candPayload.candidate) {
        return;
      }

      const st = socketState.get(socket.id) || {};
      const roomCode = st.roomCode || candidate.roomCode;
      if (!roomCode) {
        return;
      }
      const otherId = getOtherParticipant(roomCode, socket.id);
      if (!otherId) {
        return;
      }

      const forwardCandidate = { candidate: candPayload, from: socket.id, roomCode };
      io.to(otherId).emit("candidate", forwardCandidate);
    } catch (e) { console.error("candidate forward error", e); }
  });

  socket.on("leaveVideo", () => {
    try {
      const st = socketState.get(socket.id) || {};
      const roomCode = st.roomCode;
      if (roomCode) {
        socket.leave(roomCode);
        const members = roomMembers.get(roomCode);
        if (members) { members.delete(socket.id); if (members.size === 0) roomMembers.delete(roomCode); else roomMembers.set(roomCode, members); }
        setState(socket.id, { roomCode: null, partnerId: null });
        const otherId = getOtherParticipant(roomCode, socket.id);
        if (otherId) io.to(otherId).emit("partnerLeft");
      }
    } catch (e) { console.error("leaveVideo error", e); }
  });

  // Invite Link (Zero-DB)
  socket.on("inviteJoin", ({ roomId, mode = "auto", username = "Guest" } = {}) => {
    try {
      if (!roomId || typeof roomId !== "string") return;

      const r = getInviteRoom(roomId);
      if (r.users.size >= 2 && !r.users.has(socket.id)) {
        return socket.emit("inviteRoomFull", { roomId });
      }

      r.users.add(socket.id);
      if (mode !== "auto") r.mode = mode;
      inviteRooms.set(roomId, r);
      socket.data.inviteRoomId = roomId;
      socket.data.inviteUsername = username;

      socket.emit("inviteJoined", { roomId, users: Array.from(r.users), mode: r.mode });

      const other = inviteOther(roomId, socket.id);
      if (other) {
        io.to(other).emit("invitePeerJoined", { roomId, socketId: socket.id, username });
      }

      if (r.users.size === 2) {
        const mmode = r.mode === "auto" ? "text" : r.mode;
        r.mode = mmode;
        inviteRooms.set(roomId, r);
        for (const id of r.users) io.to(id).emit("inviteReady", { roomId, mode: mmode });
      } else {
        socket.emit("inviteWaiting", { roomId });
      }
    } catch (e) {
      console.error("[inviteJoin] error:", e);
    }
  });

  socket.on("inviteChat", ({ roomId, text, clientId, ts } = {}) => {
    try {
      if (!roomId || !text) return;
      const r = inviteRooms.get(roomId);
      if (!r || !r.users.has(socket.id)) return;

      socket.emit("inviteDelivered", { clientId, ts });

      const other = inviteOther(roomId, socket.id);
      if (other) {
        io.to(other).emit("inviteChat", {
          roomId,
          from: socket.id,
          username: socket.data?.inviteUsername || "Partner",
          text,
          ts
        });
        io.to(other).emit("inviteAck", { clientId, ts });
      }
    } catch (e) {
      console.error("[inviteChat] error:", e);
    }
  });

  socket.on("inviteSeen", ({ roomId, clientId } = {}) => {
    try {
      const other = inviteOther(roomId, socket.id);
      if (other) io.to(other).emit("inviteSeen", { clientId });
    } catch (e) {}
  });

  socket.on("inviteSignal", ({ roomId, data } = {}) => {
    try {
      if (!roomId || !data) return;
      const r = inviteRooms.get(roomId);
      if (!r || !r.users.has(socket.id)) return;
      const other = inviteOther(roomId, socket.id);
      if (other) io.to(other).emit("inviteSignal", { from: socket.id, data });
    } catch (e) {
      console.error("[inviteSignal] error:", e);
    }
  });

  socket.on("inviteLeave", ({ roomId } = {}) => {
    try {
      if (!roomId) return;
      const r = inviteRooms.get(roomId);
      if (!r) return;
      r.users.delete(socket.id);
      if (r.users.size === 0) inviteRooms.delete(roomId);
      else {
        inviteRooms.set(roomId, r);
        const other = inviteOther(roomId, socket.id);
        if (other) io.to(other).emit("invitePeerLeft", { roomId });
      }
      if (socket.data) socket.data.inviteRoomId = null;
    } catch (e) {
      console.error("[inviteLeave] error:", e);
    }
  });

  // QUESTION GAME
  socket.on("startQuestionGame", ({ roomCode, timeout } = {}) => {
    try {
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room) return;
      const q = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
      room.questionGame = { question: q, answers: {} };
      rooms.set(roomCode, room);
      const t = typeof timeout === "number" ? Math.max(5, Math.min(120, timeout)) : 30;
      if (questionTimers.has(roomCode)) { clearTimeout(questionTimers.get(roomCode)); questionTimers.delete(roomCode); }
      io.to(roomCode).emit("newQuestion", { question: q, timeout: t });
      const tid = setTimeout(() => {
        try {
          const r = rooms.get(roomCode);
          if (!r || !r.questionGame) return;
          const players = [r.a, r.b].filter(Boolean);
          const results = players.map(pid => ({ user: pid, answer: (r.questionGame.answers && r.questionGame.answers[pid]) ? r.questionGame.answers[pid] : "(no answer)" }));
          io.to(roomCode).emit("questionResult", { question: r.questionGame.question, results });
          r.questionGame = null; rooms.set(roomCode, r); questionTimers.delete(roomCode);
        } catch (err) { console.warn("question reveal timer error", err); }
      }, t * 1000);
      questionTimers.set(roomCode, tid);
    } catch (err) { console.warn("startQuestionGame error", err); }
  });

  socket.on("submitAnswer", ({ roomCode, answer } = {}) => {
    try {
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room || !room.questionGame) return;
      room.questionGame.answers = room.questionGame.answers || {};
      room.questionGame.answers[socket.id] = typeof answer === "string" ? answer : String(answer || "");
      rooms.set(roomCode, room);
      const players = [room.a, room.b].filter(Boolean);
      const allAnswered = players.every(pid => room.questionGame.answers && Object.prototype.hasOwnProperty.call(room.questionGame.answers, pid));
      if (allAnswered) {
        if (questionTimers.has(roomCode)) { clearTimeout(questionTimers.get(roomCode)); questionTimers.delete(roomCode); }
        const results = players.map(pid => ({ user: pid, answer: room.questionGame.answers[pid] || "(no answer)" }));
        io.to(roomCode).emit("questionResult", { question: room.questionGame.question, results });
        room.questionGame = null; rooms.set(roomCode, room);
      } else {
        try { io.to(roomCode).emit("questionProgress", { by: socket.id }); } catch (e) {}
      }
    } catch (err) { console.warn("submitAnswer error", err); }
  });

  socket.on("twoOptionStart", ({ roomCode, questionsPack = "default", count = 10 } = {}) => {
    try {
      if (!roomCode) return;
      const last = lastGameStart.get(roomCode) || 0;
      if (Date.now() - last < GAME_COOLDOWN_MS) { return socket.emit("errorMessage", { message: "Please wait a bit before starting another quiz." }); }
      const soc = lastGameBySocket.get(socket.id) || {};
      const socLast = soc.twoOption || 0;
      if (Date.now() - socLast < PER_SOCKET_COOLDOWN_MS) { return socket.emit("errorMessage", { message: "You're starting quizzes too quickly." }); }
      lastGameStart.set(roomCode, Date.now());
      lastGameBySocket.set(socket.id, { ...(lastGameBySocket.get(socket.id)||{}), twoOption: Date.now() });

      const room = rooms.get(roomCode);
      if (!room) return;
      const pool = (QUESTION_PACKS && QUESTION_PACKS[questionsPack]) ? QUESTION_PACKS[questionsPack].slice() : QUESTIONS.slice();
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      const qlist = pool.slice(0, Math.max(1, Math.min(count, pool.length)));
      const prepared = qlist.map((q, idx) => {
        let text = (typeof q === "string") ? q : (q.text || String(q));
        let optionA = (q && q.optionA) ? q.optionA : "Agree";
        let optionB = (q && q.optionB) ? q.optionB : "Disagree";
        return { questionId: `twoopt-${Date.now()}-${idx}-${Math.floor(Math.random()*1000)}`, text, optionA, optionB };
      });

      room.twoOption = { questions: prepared, idx: 0, answers: {}, matched: 0, totalAsked: 0 };
      rooms.set(roomCode, room);

      const q0 = prepared[0];
      io.to(roomCode).emit("twoOptionQuestion", {
        questionId: q0.questionId,
        text: q0.text,
        optionA: q0.optionA,
        optionB: q0.optionB,
        currentIndex: 1,
        totalQuestions: prepared.length,
      });
    } catch (err) { console.warn("twoOptionStart error", err); }
  });

  socket.on("twoOptionAnswer", ({ roomCode, questionId, choice } = {}) => {
    try {
      if (!roomCode || !questionId) return;
      const room = rooms.get(roomCode);
      if (!room || !room.twoOption) return;
      room.twoOption.answers[questionId] = room.twoOption.answers[questionId] || {};
      room.twoOption.answers[questionId][socket.id] = choice;
      rooms.set(roomCode, room);

      const otherId = getOtherParticipant(roomCode, socket.id);
      if (otherId) { try { io.to(otherId).emit("twoOptionPartnerAnswered", { partnerName: "Partner" }); } catch (e) {} }

      const clients = Array.from(roomMembers.get(roomCode) || new Set());
      if (clients.length < 2) return;

      const answersForQ = room.twoOption.answers[questionId];
      const allAnswered = clients.every(id => answersForQ && typeof answersForQ[id] !== "undefined");
      if (!allAnswered) return;

      const aChoice = answersForQ[clients[0]];
      const bChoice = answersForQ[clients[1]];
      const matched = aChoice === bChoice ? 1 : 0;
      room.twoOption.matched = (room.twoOption.matched || 0) + matched;
      room.twoOption.totalAsked = (room.twoOption.totalAsked || 0) + 1;
      rooms.set(roomCode, room);

      clients.forEach((clientId) => {
        const you = answersForQ[clientId];
        const partnerId = clients.find(id => id !== clientId);
        const partner = answersForQ[partnerId];
        try {
          io.to(clientId).emit("twoOptionReveal", {
            questionId,
            answers: { you, partner },
            matched: room.twoOption.matched,
            totalAsked: room.twoOption.totalAsked,
          });
        } catch (e) { console.warn("emit twoOptionReveal fail", e); }
      });

      room.twoOption.idx = (room.twoOption.idx || 0) + 1;
      const nextIdx = room.twoOption.idx;
      if (nextIdx < (room.twoOption.questions.length || 0)) {
        const qn = room.twoOption.questions[nextIdx];
        setTimeout(() => {
          try {
            io.to(roomCode).emit("twoOptionQuestion", {
              questionId: qn.questionId,
              text: qn.text,
              optionA: qn.optionA,
              optionB: qn.optionB,
              currentIndex: nextIdx + 1,
              totalQuestions: room.twoOption.questions.length,
            });
          } catch (e) { console.warn("emit next twoOptionQuestion failed", e); }
        }, 900);
      } else {
        const percent = Math.round(((room.twoOption.matched || 0) / (room.twoOption.totalAsked || 1)) * 100);
        setTimeout(() => {
          try {
            io.to(roomCode).emit("twoOptionResult", {
              percent,
              text: "Love Compatibility",
              matched: room.twoOption.matched || 0,
              totalAsked: room.twoOption.totalAsked || 0
            });
            room.twoOption = null;
            rooms.set(roomCode, room);
          } catch (e) { console.warn("emit twoOptionResult failed", e); }
        }, 900);
      }

    } catch (err) { console.warn("twoOptionAnswer error", err); }
  });

  // SPIN THE BOTTLE
  socket.on("spinBottleStart", ({ roomCode } = {}) => {
    try {
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room) return;

      const last = lastGameStart.get(roomCode) || 0;
      if (Date.now() - last < GAME_COOLDOWN_MS) { return socket.emit("errorMessage", { message: "Please wait before spinning again." });
  // ======== FUN ACTIVITIES (ADDED BY CODE GPT - FIXED LOCATION) ========

  // 1️⃣ Mirror Challenge
  socket.on("mirrorChallengeStart", ({ roomCode, duration = 30 } = {}) => {
    if (!roomCode) return;
    io.to(roomCode).emit("mirrorChallengeStarted", {
      instruction: "Copy your partner’s moves!",
      duration: duration * 1000,
      startedAt: Date.now(),
    });
    setTimeout(() => {
      io.to(roomCode).emit("mirrorChallengeEnd", {
        message: "Mirror Challenge Complete! 🎉",
      });
    }, duration * 1000);
  });

  // 2️⃣ Staring Contest
  socket.on("staringContestStart", ({ roomCode, duration = 20 } = {}) => {
    if (!roomCode) return;
    io.to(roomCode).emit("staringContestStarted", {
      instruction: "Don’t blink! Keep staring 👀",
      startedAt: Date.now(),
      duration: duration * 1000,
    });
    setTimeout(() => {
      const members = Array.from(io.sockets.adapter.rooms.get(roomCode) || []);
      if (!members.length) return;
      const winner = members[Math.floor(Math.random() * members.length)];
      io.to(roomCode).emit("staringContestEnd", {
        winnerId: winner,
        message: "Contest Over!",
      });
    }, duration * 1000);
  });

  // 3️⃣ Lyrics Game
  socket.on("lyricsGameStart", ({ roomCode, rounds = 3 } = {}) => {
    if (!roomCode) return;
    const lyrics = [
      { lyric: "Tera ban jaunga...", song: "Kabir Singh" },
      { lyric: "Tum hi ho...", song: "Aashiqui 2" },
      { lyric: "Apna bana le...", song: "Bhediya" },
    ];
    io.to(roomCode).emit("lyricsGameStarted", {
      instruction: "Complete the lyrics of this Bollywood song! 🎤",
      totalRounds: rounds,
    });
    let index = 0;
    const interval = setInterval(() => {
      if (index >= rounds) {
        clearInterval(interval);
        io.to(roomCode).emit("lyricsGameEnd", { message: "Lyrics Game Complete!" });
        return;
      }
      const current = lyrics[index % lyrics.length];
      io.to(roomCode).emit("lyricsRound", {
        lyric: current.lyric,
        song: current.song,
        round: index + 1,
        totalRounds: rounds,
      });
      index++;
    }, 10000);
  });

  // 4️⃣ Dance Dare
  socket.on("danceDareStart", ({ roomCode, duration = 15 } = {}) => {
    if (!roomCode) return;
    const moves = ["Freestyle!", "Wave your hands!", "Spin around!", "Jump twice!"];
    const move = moves[Math.floor(Math.random() * moves.length)];
    io.to(roomCode).emit("danceDareStarted", {
      instruction: move,
      duration: duration * 1000,
    });
    setTimeout(() => {
      io.to(roomCode).emit("danceDareEnd", { message: "Dance Dare Complete! 🕺💃" });
    }, duration * 1000);
  });

  // ======== END FUN ACTIVITIES ========
 }
      const soc = lastGameBySocket.get(socket.id) || {};
      if (Date.now() - (soc.spin || 0) < PER_SOCKET_COOLDOWN_MS) { return socket.emit("errorMessage", { message: "You're spinning too fast." }); }
      lastGameStart.set(roomCode, Date.now());
      lastGameBySocket.set(socket.id, { ...(lastGameBySocket.get(socket.id)||{}), spin: Date.now() });

      const membersSet = roomMembers.get(roomCode) || new Set();
      const clients = Array.from(membersSet);
      if (clients.length < 2) { io.to(socket.id).emit("errorMessage", { message: "Need another partner to play." }); return; }

      const spinDuration = 5000 + Math.floor(Math.random() * 3000);
      const spinId = randomUUID();
      const startAt = Date.now() + 300;
      io.to(roomCode).emit("spinStarted", { spinId, startAt, duration: spinDuration });

      setTimeout(() => {
        try {
          const idx = Math.floor(Math.random() * clients.length);
          const targetId = clients[idx];
          const isTruth = Math.random() < 0.5;
          const truthPrompts = [
            "Reveal your first crush.",
            "Tell a secret you've never told anyone.",
            "What's the most embarrassing thing that happened to you?"
          ];
          const datePrompts = [
            "Sing a short romantic line for your partner.",
            "Describe your perfect date in 15 seconds.",
            "Do a 10-second surprise compliment for your partner."
          ];
          const promptPool = isTruth ? truthPrompts : datePrompts;
          const prompt = promptPool[Math.floor(Math.random() * promptPool.length)];

          room.spin = { targetId, questionType: isTruth ? "truth" : "date", prompt, startedAt: Date.now() };
          rooms.set(roomCode, room);

          clients.forEach((clientId) => {
            try {
              io.to(clientId).emit("spinBottleResult", {
                spinId,
                targetSocketId: targetId,
                isYou: clientId === targetId,
                questionType: isTruth ? "truth" : "date",
                prompt,
                partnerName: "Partner"
              });
            } catch (e) { console.warn("emit spinBottleResult fail", e); }
          });
        } catch (err) { console.warn("spin finalize error", err); }
      }, spinDuration + 350);

    } catch (err) { console.warn("spinBottleStart error", err); }
  });

  socket.on("spinBottleDone", ({ roomCode } = {}) => { 
    try { 
      if (roomCode) io.to(roomCode).emit("spinDoneAck", { by: socket.id }); 
      const r = rooms.get(roomCode); 
      if (r && r.spin) { r.spin = null; rooms.set(roomCode, r); } 
    } catch (e) {} 
  });

  socket.on("spinBottleSkip", ({ roomCode } = {}) => { 
    try { 
      if (roomCode) io.to(roomCode).emit("spinSkipped", { by: socket.id }); 
      const r = rooms.get(roomCode); 
      if (r && r.spin) { r.spin = null; rooms.set(roomCode, r); } 
    } catch (e) {} 
  });

  // Game handlers
  socket.on("gameMove", (data = {}) => {
    const { roomCode, cellIndex, symbol } = data || {};
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;
    const isPlayer = socket.id === room.a || socket.id === room.b;
    if (!isPlayer) return;
    if (!room.state) room.state = { game: "tic-tac-toe", board: Array(9).fill(null), turn: "X", winner: null };
    if (room.state.winner) { socket.emit("gameInvalid", { reason: "game_already_finished" }); return; }
    const expected = room.state.turn;
    if (!symbol || symbol !== expected) { socket.emit("gameInvalid", { reason: "not_your_turn", expected }); return; }
    if (typeof cellIndex !== "number" || cellIndex < 0 || cellIndex > 8) { socket.emit("gameInvalid", { reason: "invalid_cell" }); return; }
    if (room.state.board[cellIndex]) { socket.emit("gameInvalid", { reason: "cell_occupied" }); return; }
    room.state.board[cellIndex] = symbol;
    const winner = checkWinner(room.state.board);
    room.state.winner = winner || null;
    room.state.turn = winner ? room.state.turn : (symbol === "X" ? "O" : "X");
    rooms.set(roomCode, room);
    io.to(roomCode).emit("gameMove", { roomCode, cellIndex, symbol, newBoard: room.state.board, nextTurn: room.state.turn, winner: room.state.winner, by: socket.id });
  });

  socket.on("gameChat", (data = {}) => {
    const { roomCode, text } = data || {};
    if (!roomCode || !text) return;
    const room = rooms.get(roomCode);
    if (!room) return;
    io.to(roomCode).emit("gameChat", { roomCode, text, from: socket.id, ts: Date.now() });
  });

  socket.on("partnerLeft", () => { cleanupSocket(socket); });
  socket.on("disconnectByUser", () => { cleanupSocket(socket); try { socket.disconnect(true); } catch (e) {} });

});

// Start Server
const PORT = process.env.PORT || 5000;
http.listen(PORT, "0.0.0.0", () => { 
  console.log(`🚀 Server running at: http://localhost:${PORT}`); 

  
