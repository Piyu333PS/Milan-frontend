// pages/_app.js
import { useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

// Import global styles WITH Tailwind CSS
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const isChatRoute = router.pathname === "/chat";

  // Restore saved theme class on <body> without touching page styles
  useEffect(() => {
    try {
      const saved = localStorage.getItem("milan-theme") || "theme-romantic";
      document.body.classList.remove("theme-light", "theme-dark", "theme-romantic");
      document.body.classList.add(saved);

      // If theme is changed elsewhere, reflect here too
      const onStorage = (e) => {
        if (e.key === "milan-theme") {
          document.body.classList.remove("theme-light", "theme-dark", "theme-romantic");
          document.body.classList.add(e.newValue || "theme-romantic");
        }
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    } catch {}
  }, []);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Milan Love - Connect, Chat, Create</title>
        {/* Chat-specific stylesheet is injected ONLY on /chat to avoid bleeding into Studio or other pages */}
        {isChatRoute && (
          <link rel="stylesheet" href="/styles/chat.css" />
        )}
      </Head>
      <Component {...pageProps} />
    </>
  );
}
