// Public Supabase settings. Both values are meant to be public (the browser
// sees them anyway; RLS protects the data), so the family project's values
// are the defaults. Env vars override them, e.g. for a local or test project.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jvzwbguwoafayxmdirnj.supabase.co";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_5RJVcgvTeEXPCbYD2zVQKw_TZ948mTX";
