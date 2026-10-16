import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { vangAuthTerugkeer } from "./lib/accountUpgrade";
import "./index.css";

// Before the first render: an auth error in the URL (#error=…) would otherwise
// be read as a route by the HashRouter and show the 404 page.
vangAuthTerugkeer();

createRoot(document.getElementById("root")!).render(<App />);

// Keeps the app itself available without signal; the list data lives in localStorage (see useGroceryItems).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => console.error("Service worker failed:", error));
  });
}
