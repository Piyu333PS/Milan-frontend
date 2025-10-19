export default function Navbar() {
  return (
    <nav style={{ padding: "1rem", background: "#eee" }}>
      <a href="/">Home</a> |{" "}
      <a href="/login">Login</a> |{" "}
      <a href="/register">Register</a> |{" "}
      <a href="/chat">Chat</a> |{" "}
      <a href="/ai">Milan AI Studio</a>
    </nav>
  );
}
