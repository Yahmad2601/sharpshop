import { useState } from "react";
import { CHAT_API_BASE } from "@/lib/api";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatProduct {
  id: string;
  name: string;
  price: number;
  image_url?: string;
}

/**
 * Shared state + API wiring for the customer chat, used by both the floating
 * CustomerChat widget and the ProductChatModal bottom sheet.
 */
export function useCustomerChat(traderId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [products, setProducts] = useState<ChatProduct[]>([]);

  /** Send `overrideMessage` if given, otherwise the current input value. */
  const sendMessage = async (overrideMessage?: string) => {
    const userMsg = (overrideMessage ?? inputValue).trim();
    if (!userMsg || isLoading) return;

    if (!overrideMessage) setInputValue("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);

    try {
      const response = await fetch(`${CHAT_API_BASE}/api/chat/customer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trader_id: traderId,
          message: userMsg,
          session_id: sessionId,
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const data = await response.json();
      if (data.session_id) setSessionId(data.session_id);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (data.products && data.products.length > 0) {
        setProducts(data.products);
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I'm having trouble connecting right now." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return { messages, inputValue, setInputValue, isLoading, products, sendMessage };
}
