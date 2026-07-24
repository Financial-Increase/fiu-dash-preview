import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { PreviewBanner } from "./components/PreviewBanner";

createRoot(document.getElementById("root")!).render(
  <>
    <PreviewBanner />
    <App />
  </>
);
