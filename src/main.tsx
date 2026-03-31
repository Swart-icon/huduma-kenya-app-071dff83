import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global unhandled error catcher — prevents silent crashes
window.addEventListener("unhandledrejection", (event) => {
  console.error("[Unhandled Promise Rejection]:", {
    reason: event.reason,
    timestamp: new Date().toISOString(),
  });
});

window.addEventListener("error", (event) => {
  console.error("[Global Error]:", {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    timestamp: new Date().toISOString(),
  });
});

createRoot(document.getElementById("root")!).render(<App />);
