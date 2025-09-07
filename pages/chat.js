"use client";
import dynamic from "next/dynamic";

const ChatPage = dynamic(() => import("../components/ChatPage"), {
  ssr: false, // SSR disable so sessionStorage error won't come
});

export default function Chat() {
  return <ChatPage />;
}
