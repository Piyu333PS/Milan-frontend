export default function Footer() {
  return (
    <footer style={{
      background: "rgba(255, 192, 203, 0.2)",
      padding: "20px",
      textAlign: "center",
      marginTop: "40px",
      borderTop: "2px solid #f2a6c0",
      fontFamily: "Arial, sans-serif"
    }}>
      <p style={{ margin: "8px 0", color: "#b30059", fontWeight: "bold" }}>
        🌹 Made with Love in Milan 💖
      </p>
      <nav>
        <a href="/terms.html" style={{ margin: "0 12px", color: "#b30059", textDecoration: "none" }}>Terms of Service</a> |
        <a href="/privacy.html" style={{ margin: "0 12px", color: "#b30059", textDecoration: "none" }}>Privacy Policy</a> |
        <a href="/guidelines.html" style={{ margin: "0 12px", color: "#b30059", textDecoration: "none" }}>Community Guidelines</a>
      </nav>
      <p style={{ marginTop: "12px", fontSize: "14px", color: "#666" }}>
        © 2025 Milan. All Rights Reserved.
      </p>
    </footer>
  );
}
