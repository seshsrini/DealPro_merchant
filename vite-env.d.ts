/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Build stamp injected by vite.config.ts (define). Shown in the Profile footer so
// testers can confirm they're on the latest web build.
declare const __BUILD_ID__: string;
