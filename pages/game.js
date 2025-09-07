// client/game.js  (React functional component for Play & Chat)
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

export default function GamePage() {
  const [socket, setSocket] = useState(null);
  const [room, setRoom] = useState("");
  const [gameState, setGameState] = useState({
    board: Array(9).fill(null),
    turn: "X",
    winner: null,
  });
  const [mySymbol, setMySymbol] = useState(null);
  const [status, setStatus] = useState("Waiting for partner...");
  const [chatMessages, setChatMessages] = useState([]);
  const chatInputRef = useRef();

  useEffect(() => {
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "https://milan-j9u9.onrender.com";
    const s = io(backend, { transports: ["websocket", "polling"] });
    setSocket(s);

    s.on("connect", () => {
      const roomCode = (typeof window !== "undefined" && sessionStorage.getItem("roomCode")) || "";
      if (roomCode) setRoom(roomCode);
    });

    s.on("startGame", (data) => {
      setRoom(data.roomCode || "");
      setGameState(data.state);
      setStatus("Game started! Turn: " + data.state.turn);
    });

    s.on("playerSymbol", (data) => {
      if (data?.symbol) setMySymbol(data.symbol);
    });

    s.on("gameMove", (d) => {
      if (!d) return;
      setGameState({ board: d.newBoard, turn: d.nextTurn, winner: d.winner });
      if (d.winner) {
        setStatus(d.winner === "draw" ? "Draw!" : `Player ${d.winner} won!`);
      } else {
        setStatus("Turn: " + d.nextTurn);
      }
    });

    s.on("gameChat", (msg) => {
      setChatMessages((m) => [...m, msg]);
    });

    return () => {
      try { s.removeAllListeners(); s.disconnect(); } catch (e) {}
    };
  }, []);

  function handleCellClick(idx) {
    if (!socket || !room || gameState.winner) return;
    if (gameState.board[idx]) return;
    if (mySymbol !== gameState.turn) return; // not your turn

    const newBoard = [...gameState.board];
    newBoard[idx] = mySymbol;
    const nextTurn = mySymbol === "X" ? "O" : "X";
    let winner = null;
    winner = checkWinner(newBoard);

    socket.emit("gameMove", { roomCode: room, cellIndex: idx, symbol: mySymbol, newBoard, nextTurn, winner });
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

  function sendChat(e) {
    e.preventDefault();
    const text = chatInputRef.current?.value?.trim();
    if (!text || !socket || !room) return;
    const msg = { roomCode: room, text, from: socket.id, ts: Date.now() };
    socket.emit("gameChat", msg);
    setChatMessages((m) => [...m, msg]);
    chatInputRef.current.value = "";
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fef6f9", padding: 16, fontFamily: "Poppins, sans-serif" }}>
      <h2 style={{ textAlign: "center" }}>🎮 Play & Chat — Tic Tac Toe</h2>
      <p style={{ textAlign: "center", fontWeight: 600 }}>{status}</p>

      <div style={{ display: "flex", gap: 16, maxWidth: 960, margin: "0 auto" }}>
        {/* Game Board */}
        <div style={{ flex: 0.6, background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 4px 18px rgba(0,0,0,0.1)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {gameState.board.map((cell, idx) => (
              <button key={idx} onClick={() => handleCellClick(idx)}
                style={{ height: 90, fontSize: 28, fontWeight: 800, borderRadius: 8, border: "1px solid #eee", background: "#fff", cursor: cell || gameState.winner ? "default" : "pointer" }}>
                {cell || ""}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Panel */}
        <div style={{ flex: 0.4, background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 4px 18px rgba(0,0,0,0.1)", display: "flex", flexDirection: "column" }}>
          <h4 style={{ margin: 0 }}>💬 Chat</h4>
          <div style={{ flex: 1, overflowY: "auto", marginTop: 8, padding: 8, border: "1px solid #f1f1f3", borderRadius: 8, background: "#fafafa" }}>
            {chatMessages.map((m, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: "#666" }}>{m.from === (socket && socket.id) ? "You" : "Partner"} • {new Date(m.ts || Date.now()).toLocaleTimeString()}</div>
                <div style={{ background: m.from === (socket && socket.id) ? "#ffeef5" : "#fff", padding: 6, borderRadius: 6, marginTop: 2 }}>{m.text}</div>
              </div>
            ))}
          </div>
          <form onSubmit={sendChat} style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input ref={chatInputRef} placeholder="Type message..." style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #eee" }} />
            <button type="submit" style={{ padding: "8px 12px", borderRadius: 8, background: "#ff6b81", color: "#fff", border: "none", fontWeight: 800 }}>Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}
