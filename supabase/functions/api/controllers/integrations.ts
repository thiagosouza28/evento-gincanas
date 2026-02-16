import { normalizeProviderName } from "../services/paymentProviders.ts";

const INTEGRATION_SELECT =
  "id, user_id, provider, access_token, public_key, client_id, client_secret, webhook_secret, is_active, created_at, updated_at";

function jsonResponse(
  payload: Record<string, unknown>,
  status: number,
  corsHeaders: Record<string, string>,
) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeTextField(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const cleaned = String(value).trim();
  return cleaned.length === 0 ? null : cleaned;
}

function parseIntegrationPayload(body: Record<string, unknown>, isPatch = false) {
  const payload: Record<string, unknown> = {};

  if (!isPatch || body.provider !== undefined) {
    const providerValue = normalizeTextField(body.provider);
    if (!providerValue) {
      throw new Error("Provider is required");
    }
    payload.provider = normalizeProviderName(String(providerValue));
  }

  if (body.access_token !== undefined) {
    payload.access_token = normalizeTextField(body.access_token);
  }
  if (body.public_key !== undefined) {
    payload.public_key = normalizeTextField(body.public_key);
  }
  if (body.client_id !== undefined) {
    payload.client_id = normalizeTextField(body.client_id);
  }
  if (body.client_secret !== undefined) {
    payload.client_secret = normalizeTextField(body.client_secret);
  }
  if (body.webhook_secret !== undefined) {
    payload.webhook_secret = normalizeTextField(body.webhook_secret);
  }
  if (body.is_active !== undefined) {
    payload.is_active = Boolean(body.is_active);
  }

  return payload;
}

export async function listUserIntegrations({
  supabase,
  userId,
  corsHeaders,
}: {
  supabase: any;
  userId: string;
  corsHeaders: Record<string, string>;
}) {
  const { data, error } = await supabase
    .from("payment_integrations")
    .select(INTEGRATION_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return jsonResponse({ error: error.message }, 500, corsHeaders);
  }

  return jsonResponse({ integrations: data || [] }, 200, corsHeaders);
}

export async function createUserIntegration({
  req,
  supabase,
  userId,
  corsHeaders,
}: {
  req: Request;
  supabase: any;
  userId: string;
  corsHeaders: Record<string, string>;
}) {
  const body = await req.json().catch(() => ({}));
  let payload: Record<string, unknown>;
  try {
    payload = parseIntegrationPayload(body);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Invalid payload" },
      400,
      corsHeaders,
    );
  }

  const { data, error } = await supabase
    .from("payment_integrations")
    .insert({
      ...payload,
      user_id: userId,
    })
    .select(INTEGRATION_SELECT)
    .single();

  if (error) {
    return jsonResponse({ error: error.message }, 400, corsHeaders);
  }

  return jsonResponse({ integration: data }, 201, corsHeaders);
}

export async function updateUserIntegration({
  req,
  supabase,
  userId,
  integrationId,
  corsHeaders,
}: {
  req: Request;
  supabase: any;
  userId: string;
  integrationId: string;
  corsHeaders: Record<string, string>;
}) {
  const body = await req.json().catch(() => ({}));
  let payload: Record<string, unknown>;
  try {
    payload = parseIntegrationPayload(body, true);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Invalid payload" },
      400,
      corsHeaders,
    );
  }

  if (Object.keys(payload).length === 0) {
    return jsonResponse({ error: "No fields to update" }, 400, corsHeaders);
  }

  const { data, error } = await supabase
    .from("payment_integrations")
    .update(payload)
    .eq("id", integrationId)
    .eq("user_id", userId)
    .select(INTEGRATION_SELECT)
    .maybeSingle();

  if (error) {
    return jsonResponse({ error: error.message }, 400, corsHeaders);
  }
  if (!data) {
    return jsonResponse({ error: "Integration not found" }, 404, corsHeaders);
  }

  return jsonResponse({ integration: data }, 200, corsHeaders);
}

export async function deleteUserIntegration({
  supabase,
  userId,
  integrationId,
  corsHeaders,
}: {
  supabase: any;
  userId: string;
  integrationId: string;
  corsHeaders: Record<string, string>;
}) {
  const { data, error } = await supabase
    .from("payment_integrations")
    .delete()
    .eq("id", integrationId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    return jsonResponse({ error: error.message }, 400, corsHeaders);
  }
  if (!data) {
    return jsonResponse({ error: "Integration not found" }, 404, corsHeaders);
  }

  return jsonResponse({ ok: true }, 200, corsHeaders);
}

export async function activateUserIntegration({
  supabase,
  userId,
  integrationId,
  corsHeaders,
}: {
  supabase: any;
  userId: string;
  integrationId: string;
  corsHeaders: Record<string, string>;
}) {
  const { data, error } = await supabase
    .from("payment_integrations")
    .update({ is_active: true })
    .eq("id", integrationId)
    .eq("user_id", userId)
    .select(INTEGRATION_SELECT)
    .maybeSingle();

  if (error) {
    return jsonResponse({ error: error.message }, 400, corsHeaders);
  }
  if (!data) {
    return jsonResponse({ error: "Integration not found" }, 404, corsHeaders);
  }

  return jsonResponse({ integration: data }, 200, corsHeaders);
}
