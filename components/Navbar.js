import React, { useEffect, useState } from "react";
import { Menu, X, Heart, User, LogOut, Settings, Home, MessageCircle } from "lucide-react";

/**
 * Uploaded file reference (for your CI / automation to transform to a public URL if needed)
 * Path: /mnt/data/Navbar (1).js
 */
const uploadedFileRef = "/mnt/data/Navbar (1).js";

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
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function updateUser(e) {
      setUser(
        e?.detail ||
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

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("milanUser");
    localStorage.removeItem("milanProfile");
    setUser(null);
    // optional redirect
    window.location.href = "/";
  };

  return (
    <header className="w-full bg-gradient-to-r from-pink-50 via-white to-purple-50 shadow-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* LEFT: Logo */}
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white shadow-xl transform hover:scale-105 transition"
              title="Milan"
              style={{ boxShadow: "0 6px 18px rgba(139, 92, 246, 0.16)" }}
            >
              <Heart className="w-6 h-6" />
            </div>
            <div className="hidden sm:block">
              <a href="/" className="text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-purple-700">
                Milan
              </a>
              <div className="text-xs text-gray-500">Find gentle connections</div>
            </div>
          </div>

          {/* CENTER: nav links (hidden on small screens) */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="/" className="text-gray-600 hover:text-pink-600 transition">Home</a>
            <a href="/connect" className="text-gray-600 hover:text-pink-600 transition">Connect</a>
            <a href="/chat" className="text-gray-600 hover:text-pink-600 transition">Chat</a>
            <a href="/ai" className="text-gray-600 hover:text-pink-600 transition">Milan AI</a>
          </nav>

          {/* RIGHT: Avatar + hamburger */}
          <div className="flex items-center gap-3">
            {/* Animated heart pulse (small) */}
            <div className="hidden sm:flex items-center gap-2 mr-2">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-md">
                  <Heart className="text-pink-500" />
                </div>
                <span className="absolute -right-1 -top-1 w-2.5 h-2.5 bg-pink-500 rounded-full animate-pulse" />
              </div>
              <div className="text-sm text-gray-600">Let hearts float</div>
            </div>

            {/* Avatar */}
            <div className="relative">
              <button
                onClick={() => setOpen(!open)}
                className="w-10 h-10 rounded-full overflow-hidden shadow-sm ring-1 ring-pink-100 focus:outline-none focus:ring-2 focus:ring-pink-300"
                aria-label="Profile menu"
              >
                {user?.photo ? (
                  <img src={user.photo} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center text-gray-700">
                    <User className="w-5 h-5" />
                  </div>
                )}
              </button>

              {/* Dropdown */}
              {open && (
                <div className="absolute right-0 mt-3 w-48 bg-white rounded-xl shadow-lg ring-1 ring-black ring-opacity-5 py-2 animate-slide-down">
                  <div className="px-3 py-2 border-b">
                    <div className="text-sm font-semibold text-gray-800">{user?.name || "Guest"}</div>
                    <div className="text-xs text-gray-500 truncate">{user?.city || "Unknown"}</div>
                  </div>
                  <a href="/profile" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50">
                    <User className="w-4 h-4 text-pink-500" /> Profile
                  </a>
                  <a href="/connect" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50">
                    <MessageCircle className="w-4 h-4 text-purple-500" /> Connect
                  </a>
                  <a href="/settings" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50">
                    <Settings className="w-4 h-4 text-indigo-500" /> Settings
                  </a>
                  <button onClick={handleLogout} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50">
                    <LogOut className="w-4 h-4 text-red-500" /> Logout
                  </button>
                </div>
              )}
            </div>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="ml-2 md:hidden p-2 rounded-md bg-white shadow-sm"
              aria-label="Open menu"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile slide-down menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t shadow-inner">
          <div className="px-4 pt-3 pb-4 space-y-2">
            <a href="/" className="block text-gray-700 py-2">Home</a>
            <a href="/connect" className="block text-gray-700 py-2">Connect</a>
            <a href="/chat" className="block text-gray-700 py-2">Chat</a>
            <a href="/ai" className="block text-gray-700 py-2">Milan AI</a>
          </div>
        </div>
      )}

      {/* small styles for animation (Tailwind does most; fallback CSS) */}
      <style jsx>{`
        .animate-slide-down {
          animation: slideDown 160ms ease-out;
        }
        @keyframes slideDown {
          from { transform: translateY(-6px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </header>
  );
}
