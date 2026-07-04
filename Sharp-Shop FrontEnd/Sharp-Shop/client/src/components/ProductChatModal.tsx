import { useRef, useEffect } from "react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useCustomerChat } from "@/hooks/use-customer-chat";
import { ChatHeader, ChatMessages, ChatProductStrip, ChatInput } from "@/components/chat/ChatParts";

interface ProductChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  traderId: string;
  traderName: string;
  productName?: string;
}

/**
 * Bottom-sheet product chat. Built on vaul/Radix Drawer so it gets dialog
 * semantics, focus trapping, Escape-to-close, and swipe-to-dismiss for free
 * (the previous hand-rolled motion.div had none of those).
 */
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
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent
        aria-describedby={undefined}
        className="h-[65vh] supports-[height:65dvh]:h-[65dvh] max-h-[560px] bg-[#1a1a1a] border-white/10 text-white p-0 md:max-w-[430px] md:mx-auto"
      >
        <DrawerTitle className="sr-only">Chat with {traderName} assistant</DrawerTitle>
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
      </DrawerContent>
    </Drawer>
  );
}
