// Guest browsing identity, shared by likes, favorites, and comments.
// Merged into the real account by /api/user/merge-guest on login/register.

const GUEST_ID_KEY = "sharpshop_guest_id";
const GUEST_NAME_KEY = "sharpshop_guest_name";

export function getGuestId(): string {
  let userId = localStorage.getItem(GUEST_ID_KEY);
  if (!userId) {
    userId = "guest_" + Math.random().toString(36).slice(2, 11);
    localStorage.setItem(GUEST_ID_KEY, userId);
  }
  return userId;
}

export function getGuestName(): string {
  let userName = localStorage.getItem(GUEST_NAME_KEY);
  if (!userName) {
    const names = ["Chioma", "Emeka", "Fatima", "Tunde", "Ngozi", "Ade", "Kemi", "Chidi"];
    userName = names[Math.floor(Math.random() * names.length)];
    localStorage.setItem(GUEST_NAME_KEY, userName);
  }
  return userName;
}

/** Read the stored guest id without creating one. */
export function peekGuestId(): string | null {
  return localStorage.getItem(GUEST_ID_KEY);
}

/** Forget the guest identity (after it has been merged into an account). */
export function clearGuestId(): void {
  localStorage.removeItem(GUEST_ID_KEY);
}
