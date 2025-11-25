import React, { useEffect, useState } from "react";

export default function Navbar() {
  const [user, setUser] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("milanUser")) ||
        JSON.parse(localStorage.getItem("milanProfile")) ||
        null
      );
    } catch {
      return null;
    }
  });

  useEffect(() => {
    function updateUser(e) {
      setUser(
        e.detail ||
          JSON.parse(localStorage.getItem("milanUser")) ||
          JSON.parse(localStorage.getItem("milanProfile")) ||
          null
      );
    }

    window.addEventListener("milan:user-updated", updateUser);
    window.addEventListener("storage", updateUser);

    return () => {
      window.removeEventListener("milan:user-updated", updateUser);
      window.removeEventListener("storage", updateUser);
    };
  }, []);

  return (
    <nav
      style={{
        padding: "1rem",
        background: "#eee",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {/* LEFT side menu */}
      <div>
        <a href="/">Home</a> | <a href="/login">Login</a> |{" "}
        <a href="/register">Register</a> | <a href="/chat">Chat</a> |{" "}
        <a href="/ai">Milan AI Studio</a>
      </div>

      {/* RIGHT side Avatar */}
      <div style={{ marginLeft: "1rem" }}>
        {user?.photo ? (
          <img
            src={user.photo}
            alt="avatar"
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid #ff4da6",
            }}
          />
        ) : (
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "#ccc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
            }}
          >
            🙂
          </div>
        )}
      </div>
    </nav>
  );
}
