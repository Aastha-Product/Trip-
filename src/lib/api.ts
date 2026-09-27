import "server-only";

/** Turns a server failure into a message the person can act on (never an empty 500). */
function explain(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/Supabase is not configured/i.test(msg)) {
    return "The server isn't set up yet: Supabase keys are missing. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then redeploy.";
  }
  if (/Could not find the table|schema cache|relation .* does not exist/i.test(msg)) {
    return "The database tables don't exist yet. Run supabase/schema.sql in the Supabase SQL Editor.";
  }
  if (/Invalid API key|JWT|permission denied|row-level security/i.test(msg)) {
    return "The server's Supabase key was rejected. SUPABASE_SERVICE_ROLE_KEY must be the secret (sb_secret_…) key, not the publishable one.";
  }
  return "Something went wrong on the server. Please try again.";
}

type Handler<C> = (request: Request, ctx: C) => Promise<Response>;

export function withErrors<C>(handler: Handler<C>): Handler<C> {
  return async (request, ctx) => {
    try {
      return await handler(request, ctx);
    } catch (err) {
      console.error("[api]", request.method, new URL(request.url).pathname, err);
      return Response.json({ error: explain(err) }, { status: 500 });
    }
  };
}
