/* Entry point: mount the trainer component at #root.
 *
 * The host page (trainer.html in production, trainer-dev.html in development)
 * provides window.storage. If none is present we fall back to localStorage,
 * mirroring the original bundle's behavior so the build runs standalone too. */
import React from "react";
import { createRoot } from "react-dom/client";
import L5ETrainer from "./l5e-trainer.jsx";

if (!window.storage) {
  window.storage = {
    async get(key) { const v = localStorage.getItem(key); return v == null ? null : { key, value: v }; },
    async set(key, value) { localStorage.setItem(key, value); return { key, value }; },
  };
}

createRoot(document.getElementById("root")).render(React.createElement(L5ETrainer));
