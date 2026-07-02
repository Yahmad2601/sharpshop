import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCustomerChat } from "@/hooks/use-customer-chat";
import { ChatHeader, ChatMessages, ChatProductStrip, ChatInput } from "@/components/chat/ChatParts";

interface ProductChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  traderId: string;
  traderName: string;
  productName?: string;
}

export function ProductChatModal({
  isOpen,
  onClose,
  traderId,
  traderName,
  productName,
}: ProductChatModalProps) {
  const { messages, inputValue, setInputValue, isLoading, products, sendMessage } =
    useCustomerChat(traderId);
  const didAutoSendRef = useRef(false);

  // Auto-ask about the product on first open. The session persists across
  // opens; resetting it would make the assistant lose context.
  useEffect(() => {
    if (!isOpen) return;
    if (!productName || didAutoSendRef.current || messages.length > 0) return;
    didAutoSendRef.current = true;
    sendMessage(`Tell me about ${productName}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, productName]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 h-[65dvh] max-h-[560px] bg-[#1a1a1a] rounded-t-3xl shadow-2xl flex flex-col overflow-hidden md:max-w-[430px] md:mx-auto"
          >
            <ChatHeader traderName={traderName} onClose={onClose} />
            <ChatMessages
              welcomeText={`Hello! I'm here to help you with products from ${traderName}. What would you like to know?`}
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
        </>
      )}
    </AnimatePresence>
  );
}
