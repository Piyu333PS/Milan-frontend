// pages/game.js
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

export default function GamePage() {
  const [socket, setSocket] = useState(null);
  const [room, setRoom] = useState("");
  const [gameState, setGameState] = useState({ board: Array(9).fill(null), turn: "X", winner: null });
  const [mySymbol, setMySymbol] = useState(null);
  const [status, setStatus] = useState("Waiting for partner...");
  const [chatMessages, setChatMessages] = useState([]);
  const chatInputRef = useRef();

  useEffect(() => {
    // backend URL: prefer env, fallback to current origin
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:5000");
    const s = io(backendUrl, { transports: ["websocket", "polling"] });
    setSocket(s);

    s.on("connect", () => {
      console.log("[game] socket connected", s.id);
      setStatus("Connected to server.");

      // if connect page stored a roomCode -> try to re-join
      const roomCode = (typeof window !== "undefined" && sessionStorage.getItem("roomCode")) || "";
      if (roomCode) {
        console.log("[game] attempting joinRoom:", roomCode);
        s.emit("joinRoom", { roomCode });
        setRoom(roomCode);
        setStatus("Joining game room...");
      } else {
        setStatus("No room found. Go back to Connect and start Play & Chat.");
      }
    });

    s.on("startGame", (data) => {
      console.log("[game] startGame", data);
      if (data?.state) setGameState(data.state);
      if (data?.roomCode) setRoom(data.roomCode);
      setStatus("Game started — Turn: " + (data?.state?.turn || "X"));
    });

    s.on("playerSymbol", (d) => {
      console.log("[game] playerSymbol", d);
      if (d?.symbol) setMySymbol(d.symbol);
    });

    s.on("gameMove", (d) => {
      console.log("[game] gameMove", d);
      if (!d) return;
      if (d.newBoard) setGameState({ board: d.newBoard, turn: d.nextTurn, winner: d.winner });
      else {
        // fallback apply
        setGameState(prev => {
          const nb = [...prev.board];
          if (typeof d.cellIndex === "number") nb[d.cellIndex] = d.symbol;
          return { board: nb, turn: d.nextTurn || (prev.turn === "X" ? "O" : "X"), winner: d.winner || null };
        });
      }
      if (d.winner) setStatus(d.winner === "draw" ? "Draw!" : `Player ${d.winner} won!`);
      else setStatus("Turn: " + (d.nextTurn || (d.symbol === "X" ? "O" : "X")));
    });

    s.on("gameChat", (msg) => {
      console.log("[game] gameChat", msg);
      setChatMessages((m) => [...m, msg]);
    });

    s.on("joinError", (err) => {
      console.warn("[game] joinError", err);
      setStatus("Could not join room: " + (err?.reason || "unknown"));
    });

    s.on("partnerDisconnected", () => {
      setStatus("Partner disconnected. You may be requeued.");
    });

    s.on("requeued", (info) => {
      console.log("[game] requeued", info);
      setStatus("Partner lost. Requeued for a new match.");
    });

    s.on("connect_error", (err) => {
      console.warn("[game] connect_error", err);
      setStatus("Connection error — check server.");
    });

    return () => {
      try { s.removeAllListeners(); s.disconnect(); } catch (e) {}
    };
  }, []);

  function checkWinner(board) {
    const lines = [
      [0,1,2],[3,4,5],[6,7,8],
      [0,3,6],[1,4,7],[2,5,8],
      [0,4,8],[2,4,6]
    ];
    for (const [a,b,c] of lines) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    if (board.every(Boolean)) return "draw";
    return null;
  }

  function handleCellClick(idx) {
    if (!socket) return;
    if (!room) { alert("Room not found. Go to Connect and start Play & Chat."); return; }
    if (gameState.winner) return;
    if (gameState.board[idx]) return;
    // Use symbol assigned by server, fall back to current turn
    const symbol = mySymbol || gameState.turn;
    if (symbol !== gameState.turn) {
      // Not your turn; silently ignore (or optionally show brief message)
      console.log("[game] not your turn", { symbol, turn: gameState.turn });
      return;
    }

    const newBoard = [...gameState.board];
    newBoard[idx] = symbol;
    const winner = checkWinner(newBoard);
    const nextTurn = symbol === "X" ? "O" : "X";

    // Optimistic update, server will broadcast authoritative state
    setGameState({ board: newBoard, turn: nextTurn, winner: winner || null });
    if (winner) setStatus(winner === "draw" ? "Draw!" : `Player ${winner} won!`);
    else setStatus("Turn: " + nextTurn);

    socket.emit("gameMove", { roomCode: room, cellIndex: idx, symbol, newBoard, nextTurn, winner });
  }

  function sendChat(e) {
    e && e.preventDefault && e.preventDefault();
    const text = chatInputRef.current?.value?.trim();
    if (!text) return;
    if (!socket || !room) { alert("Not connected to a room."); return; }
    const payload = { roomCode: room, text, from: socket.id, ts: Date.now() };
    socket.emit("gameChat", payload);
    setChatMessages(m => [...m, payload]);
    chatInputRef.current.value = "";
  }

  function resetGame() {
    if (!socket || !room) return;
    const newBoard = Array(9).fill(null);
    socket.emit("gameMove", { roomCode: room, cellIndex: null, symbol: null, newBoard, nextTurn: "X", winner: null });
    setGameState({ board: newBoard, turn: "X", winner: null });
    setStatus("New game started. Turn: X");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fff7f9", padding: 18, fontFamily: "Poppins, sans-serif" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ margin: 0 }}>🎮 Play & Chat — Tic Tac Toe</h2>
        <div style={{ marginTop: 8, fontWeight: 700 }}>{status}</div>
        <div style={{ marginTop: 6, fontSize: 13, color: "#666" }}>Room: <strong>{room || "—"}</strong> • Your symbol: <strong>{mySymbol || "—"}</strong></div>
      </div>

      <div style={{ display: "flex", gap: 16, maxWidth: 980, margin: "18px auto", flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 480px", background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {gameState.board.map((cell, idx) => (
              <button
                key={idx}
                onClick={() => handleCellClick(idx)}
                aria-label={`cell-${idx}`}
                style={{
                  height: 88,
                  fontSize: 32,
                  fontWeight: 900,
                  borderRadius: 10,
                  border: "1px solid #f1f1f3",
                  background: cell ? (cell === "X" ? "#ffeef5" : "#eef8ff") : "#fff",
                  cursor: gameState.winner ? "default" : "pointer",
                  touchAction: "manipulation",
                }}
              >
                {cell || ""}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={resetGame} style={{ padding: "8px 12px", background: "#ff6b81", color: "#fff", border: "none", borderRadius: 8, fontWeight: 800 }}>
              Play Again
            </button>
            <button onClick={() => { if (socket) { socket.emit("disconnectByUser"); window.location.href = "/"; }}} style={{ padding: "8px 12px", borderRadius: 8 }}>
              Quit
            </button>
            <div style={{ marginLeft: "auto", alignSelf: "center", fontSize: 13, color: "#666" }}>
              Turn: <strong>{gameState.turn}</strong>
            </div>
          </div>
        </div>

        <div style={{ width: 360, minWidth: 280, background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column" }}>
          <h4 style={{ margin: 0 }}>💬 Chat</h4>
          <div style={{ flex: 1, overflowY: "auto", marginTop: 8, padding: 8, borderRadius: 8, background: "#fafafa", border: "1px solid #f2f2f4", minHeight: 220 }}>
            {chatMessages.length === 0 && <div style={{ color: "#888" }}>No messages yet — say Hi 👋</div>}
            {chatMessages.map((m, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: "#888" }}>{m.from === (socket && socket.id) ? "You" : "Partner"} • {new Date(m.ts || Date.now()).toLocaleTimeString()}</div>
                <div style={{ background: m.from === (socket && socket.id) ? "#ffeef5" : "#fff", padding: 8, borderRadius: 8, marginTop: 4 }}>{m.text}</div>
              </div>
            ))}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); sendChat(); }} style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input ref={chatInputRef} placeholder="Type message..." style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #eee" }} />
            <button type="submit" style={{ padding: "8px 12px", borderRadius: 8, background: "#ff6b81", color: "#fff", border: "none", fontWeight: 800 }}>Send</button>
          </form>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          div[style*="display: flex"][style*="gap: 16px"] { flex-direction: column; padding-bottom: 40px; }
          button[aria-label^="cell-"] { height: 70px; font-size: 24px; }
          div[style*="width: 360"] { width: 100% !important; min-width: unset !important; }
        }
      `}</style>
    </div>
  );
}
