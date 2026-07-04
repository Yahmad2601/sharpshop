import { useState, useEffect } from "react";
import { AuthModal } from "@/components/AuthModal";
import { onPromptLogin } from "@/lib/auth-prompt";

/**
 * Single app-level mount point for the login modal, opened via promptLogin()
 * from any component (rail buttons, follow, comments, bottom nav...).
 */
export function AuthPromptHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => onPromptLogin(() => setOpen(true)), []);

  return <AuthModal isOpen={open} onClose={() => setOpen(false)} />;
}
