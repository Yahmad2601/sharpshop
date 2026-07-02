import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useCustomerChat } from "@/hooks/use-customer-chat";
import { ChatHeader, ChatMessages, ChatProductStrip, ChatInput } from "@/components/chat/ChatParts";

interface CustomerChatProps {
  traderId: string;
  traderName: string;
}

export function CustomerChat({ traderId, traderName }: CustomerChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { messages, inputValue, setInputValue, isLoading, products, sendMessage } =
    useCustomerChat(traderId);

  return (
    <>
      {/* Floating Button */}
      <motion.div
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        {!isOpen && (
          <Button
            onClick={() => setIsOpen(true)}
            size="icon"
            className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-black hover:bg-neutral-900 text-white shadow-lg border border-white/20"
          >
            <MessageCircle className="h-6 w-6 md:h-8 md:w-8" />
          </Button>
        )}
      </motion.div>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 w-[calc(100vw-2rem)] md:w-[360px] h-[320px] bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            <ChatHeader traderName={traderName} onClose={() => setIsOpen(false)} />
            <ChatMessages
              welcomeText="Hello! I'm here to help you verify products and check availability. What are you looking for today?"
              messages={messages}
              isLoading={isLoading}
            />
            <ChatProductStrip products={products} />
            <ChatInput
              value={inputValue}
              onChange={setInputValue}
              onSend={() => sendMessage()}
              isLoading={isLoading}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
