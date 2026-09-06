/// <reference types="vite/client" />
import React from 'react';
import { createRoot } from 'react-dom/client';
import Terminal from '../components/terminal';
import '../app/globals.css';
import '../lib/market/runtime';
globalThis.__ALBION_RUNTIME__ = {
  static: true,
  base: import.meta.env.BASE_URL,
  playerProxy: import.meta.env.VITE_PLAYER_PROXY_URL,
};
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Terminal />
  </React.StrictMode>,
);
