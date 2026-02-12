// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-reset-token",
};

const CLEAR_DATA_TABLES = [
  "confrontos",
  "torneios",
  "sorteios",
  "pontuacoes",
  "equipes",
  "gincanas",
  "inscritos",
  "pagamentos",
  "participantes",
  "inscricoes",
  "lotes",
  "igrejas",
  "distritos",
  "eventos",
  "whatsapp_sessions",
];

const DUMMY_UUID = "00000000-0000-0000-0000-000000000000";

function getSupabaseAdmin() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizePath(prefix: string, name: string) {
  if (!prefix) return name;
  return `${prefix}/${name}`;
}

async function listAllObjects(
  supabase: any,
  bucket: string,
  prefix = "",
): Promise<string[]> {
  const collected: string[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit, offset });
    if (error) {
      throw new Error(`Erro ao listar bucket ${bucket}: ${error.message}`);
    }

    if (!data || data.length === 0) break;

    for (const item of data) {
      if (!item?.name) continue;
      if (!item.id) {
        const nested = await listAllObjects(
          supabase,
          bucket,
          normalizePath(prefix, item.name),
        );
        collected.push(...nested);
      } else {
        collected.push(normalizePath(prefix, item.name));
      }
    }

    if (data.length < limit) break;
    offset += data.length;
  }

  return collected;
}

async function clearBucket(supabase: any, bucket: string) {
  const paths = await listAllObjects(supabase, bucket);
  if (paths.length === 0) return 0;

  let removed = 0;
  const chunkSize = 1000;
  for (let i = 0; i < paths.length; i += chunkSize) {
    const slice = paths.slice(i, i + chunkSize);
    const { error } = await supabase.storage.from(bucket).remove(slice);
    if (error) {
      throw new Error(`Erro ao limpar bucket ${bucket}: ${error.message}`);
    }
    removed += slice.length;
  }

  return removed;
}

async function clearAllBuckets(supabase: any) {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    throw new Error(`Erro ao listar buckets: ${error.message}`);
  }

  const buckets = (data || []).map((b: any) => b.name).filter(Boolean);
  const summary: Record<string, number> = {};

  for (const bucket of buckets) {
    summary[bucket] = await clearBucket(supabase, bucket);
  }

  return summary;
}

async function deleteAllRows(supabase: any, table: string) {
  const { error, count } = await supabase
    .from(table)
    .delete({ count: "exact" })
    .neq("id", DUMMY_UUID);

  if (error) {
    throw new Error(`Erro ao limpar tabela ${table}: ${error.message}`);
  }

  return count ?? 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const resetTokenEnv =
      Deno.env.get("SYSTEM_RESET_TOKEN") || Deno.env.get("RESET_TOKEN");
    if (!resetTokenEnv) {
      return new Response(
        JSON.stringify({ error: "Reset token not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json().catch(() => ({}));
    const providedToken =
      req.headers.get("x-reset-token") ||
      body?.token ||
      body?.resetToken ||
      "";

    if (!providedToken || providedToken !== resetTokenEnv) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabaseAdmin();

    const tableSummary: Record<string, number> = {};
    for (const table of CLEAR_DATA_TABLES) {
      tableSummary[table] = await deleteAllRows(supabase, table);
    }

    const storageSummary = await clearAllBuckets(supabase);
    return new Response(
      JSON.stringify({
        success: true,
        rowsDeleted: tableSummary,
        storage: storageSummary,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("admin-reset error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
