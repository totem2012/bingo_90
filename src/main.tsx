import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/*
      Si algún componente tira durante el render, React desmonta el árbol
      entero y queda una pantalla en blanco. El boundary lo cambia por una
      pantalla que muestra la semilla, que es lo único irreemplazable.
    */}
    <ErrorBoundary nombre="la app">
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
