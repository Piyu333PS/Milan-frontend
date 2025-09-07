"use client";
import dynamic from "next/dynamic";

// SSR disable so that sessionStorage error na aaye
const ChatPage = dynamic(() => import("../components/ChatPage"), {
  ssr: false,
});

export default function Chat() {
  return <ChatPage />;
}
