import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { watchInstallPrompt } from "./lib/installHint";

// Chrome offers its install prompt early on; listen before the app renders.
watchInstallPrompt();

createRoot(document.getElementById("root")!).render(<App />);

// Keeps the app itself available without signal; the list data lives in localStorage (see useGroceryItems).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => console.error("Service worker failed:", error));
  });
}
