import { useRef, useEffect } from "react";
import { Send, X, Loader2, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { type ChatMessage, type ChatProduct } from "@/hooks/use-customer-chat";

// Shared building blocks for the two chat surfaces (floating widget + modal).

export function ChatHeader({ traderName, onClose }: { traderName: string; onClose: () => void }) {
  return (
    <div className="p-4 bg-[#222] border-b border-white/10 flex justify-between items-center shrink-0">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10 border border-white/10">
          <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(traderName)}`} />
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
        <div>
          <h3 className="font-bold text-white text-sm">{traderName} Assistant</h3>
          <p className="text-xs text-green-400 flex items-center gap-1">
            <span className="block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Online
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-white/50 hover:text-white hover:bg-white/10"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </Button>
    </div>
  );
}

function AssistantAvatar() {
  return (
    <Avatar className="h-8 w-8 mt-1 border border-white/10">
      <AvatarFallback className="bg-emerald-500 text-white text-xs">AI</AvatarFallback>
    </Avatar>
  );
}

export function ChatMessages({
  welcomeText,
  messages,
  isLoading,
}: {
  welcomeText: string;
  messages: ChatMessage[];
  isLoading: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only nudge to the newest message when the list changes. "nearest" +
    // "auto" scrolls the message container itself without smooth-scrolling the
    // whole page — which on mobile caused the input/layout to jump while typing.
    if (messages.length > 0) {
      scrollRef.current?.scrollIntoView({ behavior: "auto", block: "nearest" });
    }
  }, [messages.length]);

  return (
    <ScrollArea className="flex-1 p-4 bg-[#121212]">
      <div className="space-y-4">
        <div className="flex gap-3">
          <AssistantAvatar />
          <div className="bg-[#222] p-3 rounded-2xl rounded-tl-none text-white/90 text-sm max-w-[80%] border border-white/5">
            <p>{welcomeText}</p>
          </div>
        </div>

        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            {msg.role === "assistant" && <AssistantAvatar />}
            <div
              className={`p-3 rounded-2xl text-sm max-w-[80%] ${
                msg.role === "user"
                  ? "!bg-black text-white rounded-tr-none font-medium border border-white/20"
                  : "bg-[#222] text-white/90 rounded-tl-none border border-white/5 whitespace-pre-wrap"
              }`}
            >
              {msg.content}
            </div>
          </motion.div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <AssistantAvatar />
            <div className="bg-[#222] p-3 rounded-2xl rounded-tl-none border border-white/5">
              <Loader2 className="h-4 w-4 animate-spin text-white/50" />
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>
    </ScrollArea>
  );
}

export function ChatProductStrip({ products }: { products: ChatProduct[] }) {
  if (products.length === 0) return null;
  return (
    <div className="bg-[#1a1a1a] border-t border-white/10 p-2 overflow-x-auto whitespace-nowrap scrollbar-hide shrink-0">
      {products.map((p) => (
        <div key={p.id} className="inline-block w-32 mr-2 bg-[#222] rounded-lg p-2 border border-white/5 align-top">
          <div className="h-20 bg-black/20 rounded mb-2 overflow-hidden">
            {p.image_url ? (
              <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <ShoppingBag className="w-full h-full p-6 text-white/20" />
            )}
          </div>
          <p className="text-white text-xs truncate font-medium">{p.name}</p>
          <p className="text-emerald-500 text-xs font-bold">₦{p.price.toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}

export function ChatInput({
  value,
  onChange,
  onSend,
  isLoading,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="p-3 bg-[#222] border-t border-white/10 flex gap-2 shrink-0">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSend()}
        placeholder="Ask about products..."
        className="bg-[#121212] border-white/10 text-white placeholder:text-white/30 focus-visible:ring-emerald-500"
      />
      <Button
        onClick={onSend}
        disabled={!value.trim() || isLoading}
        size="icon"
        className="bg-emerald-500 hover:bg-emerald-600 text-white"
      >
        <Send className="h-5 w-5" />
      </Button>
    </div>
  );
}
