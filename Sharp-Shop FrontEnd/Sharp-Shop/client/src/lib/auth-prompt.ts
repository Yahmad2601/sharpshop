// Opens the login/signup modal from anywhere in the app (AuthPromptHost in
// App.tsx listens for this). Guests can roam freely; interactions like liking,
// saving, commenting, and following call this instead of acting.
const EVENT = "sharpshop:prompt-login";

export function promptLogin(): void {
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function onPromptLogin(handler: () => void): () => void {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
