import path from 'path';
import { execSync } from 'child_process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// A build stamp baked into the web bundle at build time (date + git short hash).
// Shown in-app (Profile footer) so a tester can confirm at a glance they're on the
// latest WEB build — the fastest way to catch a stale APK that never got `cap copy`.
function computeBuildId(): string {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  try {
    const hash = execSync('git rev-parse --short HEAD').toString().trim();
    return `${stamp} · ${hash}`;
  } catch {
    return stamp;
  }
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 5173,
        host: '0.0.0.0',
        proxy: {
          // Proxy SerpApi in dev to avoid CORS. In production (Capacitor native),
          // the app calls SerpApi directly — CORS doesn't apply to native HTTP.
          '/serpapi': {
            target: 'https://serpapi.com',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/serpapi/, ''),
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        __BUILD_ID__: JSON.stringify(computeBuildId()),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
