/* Updated connect.js */

"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import io from "socket.io-client";

export default function ConnectPage() {
  // ... (existing states and logic remain same, no change)

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <>
      {/* canvas hearts */}
      <canvas id="heartCanvas" aria-hidden />

      {/* hamburger for mobile */}
      <button
        type="button"
        className="hamburger"
        aria-label="Toggle menu"
        onClick={() => setSidebarOpen((s) => !s)}
      >
        ☰
      </button>

      {/* Sidebar */}
      {/* ... sidebar code unchanged ... */}

      {/* Main content area */}
      <main className="content-wrap" role="main">
        <div className="glass-card compact">
          <div className="center-box compact">
            <div className="center-top">
              <h2>Select Milan Mode</h2>
              <div className="mode-text" id="modeText">
                {modeText}
              </div>
            </div>

            <div className="mode-options" aria-live="polite">
              {/* Video card */}
              {showModeButtons && (
                <div
                  className="mode-card small"
                  role="button"
                  onClick={() => startSearch("video")}
                >
                  <div className="mode-animation video-animation">
                    <svg viewBox="0 0 64 48" className="video-svg small">
                      <rect x="6" y="12" width="32" height="24" rx="5" fill="#fff" />
                      <path d="M46 14 L62 6 L62 42 L46 34 Z" fill="#ffd2e0" />
                      <circle cx="22" cy="24" r="6" fill="#ec4899" />
                    </svg>
                  </div>
                  <button className="mode-btn small">Start Video Chat</button>
                  <p className="mode-desc small">
                    Meet face-to-face instantly in Milan’s romantic video room.
                  </p>
                </div>
              )}

              {/* Text card */}
              {showModeButtons && (
                <div
                  className="mode-card small"
                  role="button"
                  onClick={() => startSearch("text")}
                >
                  <div className="mode-animation text-animation">
                    <div className="phone-mock small">
                      <div className="typing-dots">
                        <span className="dot" />
                        <span className="dot" />
                        <span className="dot" />
                      </div>
                    </div>
                  </div>
                  <button className="mode-btn small">Start Text Chat</button>
                  <p className="mode-desc small">
                    Express your feelings through sweet and romantic messages.
                  </p>
                </div>
              )}
            </div>

            <div className="quote-box small">{statusMessage}</div>
          </div>
        </div>
      </main>

      <style jsx global>{`
        /* Glass card now compact */
        .glass-card.compact {
          max-width: 500px;
          background: rgba(255, 255, 255, 0.14);
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 16px;
          padding: 12px;
        }

        .center-box.compact {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .center-box.compact h2 {
          font-size: 20px;
          margin-bottom: 4px;
        }

        .mode-card.small {
          width: 90%;
          padding: 10px;
          border-radius: 10px;
          min-height: 80px;
        }

        .video-svg.small {
          width: 64px;
          height: 44px;
        }

        .phone-mock.small {
          width: 48px;
          height: 70px;
        }

        .mode-btn.small {
          font-size: 14px;
          padding: 6px;
        }

        .mode-desc.small {
          font-size: 12px;
        }

        .quote-box.small {
          font-size: 12px;
          padding: 8px;
          margin-top: 6px;
        }

        @media (max-width: 768px) {
          .glass-card.compact {
            max-width: 95%;
          }
          .mode-card.small {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
