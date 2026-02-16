export function extractBearerToken(req: Request) {
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function unauthorizedResponse(
  message: string,
  corsHeaders: Record<string, string>,
) {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function requireAuthenticatedUser({
  req,
  supabase,
  corsHeaders,
}: {
  req: Request;
  supabase: any;
  corsHeaders: Record<string, string>;
}) {
  const token = extractBearerToken(req);
  if (!token) {
    return {
      user: null,
      response: unauthorizedResponse("Missing bearer token", corsHeaders),
    };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return {
      user: null,
      response: unauthorizedResponse("Invalid or expired token", corsHeaders),
    };
  }

  return { user: data.user, response: null };
}
