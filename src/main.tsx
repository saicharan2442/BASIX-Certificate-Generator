import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

/* Bundled fonts — everything below ships inside the app and works offline. */
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/poppins/800.css";
import "@fontsource/great-vibes/latin-400.css";
import "@fontsource/great-vibes/latin-ext-400.css";
import "@fontsource/noto-serif-ethiopic/latin-400.css";
import "@fontsource/noto-serif-ethiopic/latin-600.css";

import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
