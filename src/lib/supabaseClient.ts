import { createClient } from "@supabase/supabase-js";

// Vite injects env vars at build time. These must be set in .env.local
// (NOT in .env.development — that file is loaded at HIGHER priority than
// .env.local during `npm run dev` and its placeholder values will silently
// override real values, leading to "your-project.supabase.co" call failures).

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured =
  Boolean(supabaseUrl) && Boolean(supabaseAnonKey);

// Defense in depth — fail loudly if the env points at a placeholder. This
// catches the case where someone ships a template URL (your-project, YOUR-PROJECT-REF)
// or pastes the .env.example values verbatim instead of the real ones.
function isPlaceholder(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return (
    v.includes("your-project") ||
    v.includes("your_project") ||
    v.includes("project-ref") ||
    v.includes("project_ref") ||
    v.includes("xxxx")
  );
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Set VITE_SUPABASE_URL and " +
    "VITE_SUPABASE_ANON_KEY in .env.local, then restart `npm run dev`."
  );
}

if (isPlaceholder(supabaseUrl) || isPlaceholder(supabaseAnonKey)) {
  throw new Error(
    `Supabase env vars look like placeholders, not real values ` +
    `(got URL='${supabaseUrl}'). ` +
    `Open .env.local and replace any 'your-project' / 'YOUR-PROJECT-REF' ` +
    `values with your real Supabase project URL + anon key, then restart Vite.`
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
