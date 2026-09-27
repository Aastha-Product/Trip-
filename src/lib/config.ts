import "server-only";

const has = (name: string) => Boolean(process.env[name]?.trim());

/** Which services this deployment can reach. Booleans only; never expose values. */
export function configStatus() {
  const openai = has("OPENAI_API_KEY");
  const gemini = has("GEMINI_API_KEY");
  return {
    supabase: has("NEXT_PUBLIC_SUPABASE_URL") && has("SUPABASE_SERVICE_ROLE_KEY"),
    openai,
    gemini,
    ai: openai || gemini,
    onVercel: Boolean(process.env.VERCEL),
  };
}
