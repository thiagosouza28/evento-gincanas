// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.25.76";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, whatsapp_webhook_secret, WHATSAPP_WEBHOOK_SECRET, x-whatsapp-webhook-secret",
};

const logger = {
  info: (message: string, extra: Record<string, unknown> = {}) =>
    console.log(JSON.stringify({ level: "info", message, ...extra })),
  warn: (message: string, extra: Record<string, unknown> = {}) =>
    console.warn(JSON.stringify({ level: "warn", message, ...extra })),
  error: (message: string, extra: Record<string, unknown> = {}) =>
    console.error(JSON.stringify({ level: "error", message, ...extra })),
};

const whatsappKeywords = [
  "quero me inscrever",
  "inscricao",
  "inscrição",
  "evento",
  "inscrever",
  "participar",
];
const consultaKeywords = [
  "consultar inscricao",
  "consultar inscrição",
  "consultar",
  "minha inscricao",
  "minha inscrição",
];
const cancelKeywords = ["cancelar", "sair", "reset", "reiniciar", "voltar"];
const menuKeywords = ["menu", "opcoes", "opcoes", "ajuda", "inicio"];
const pixCopyKeywords = [
  "copiar pix",
  "copia e cola",
  "pix copia",
  "copiar codigo pix",
  "copiar codigo",
];
const pixConsultKeywords = [
  "consultar pix",
  "pix pendente",
  "meu pix",
  "pix pagamento",
  "reenvie pix",
  "reenviar pix",
];
const pixQrKeywords = ["reenviar qr", "reenviar qr code", "qr code", "qrcode"];
const pixPaidKeywords = ["ja paguei", "já paguei", "paguei"];
const supportKeywords = ["suporte", "falar com suporte", "ajuda", "atendimento"];

const whatsappPayloadSchema = z.object({
  phone: z.string().optional(),
  messageId: z.string().optional(),
  momment: z.number().optional(),
  fromMe: z.boolean().optional(),
  text: z
    .object({
      message: z.string().optional(),
    })
    .optional(),
  message: z.any().optional(),
  data: z.any().optional(),
  sender: z.any().optional(),
});

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

const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID") || "";
const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN") || "";
const ZAPI_BASE_URL = Deno.env.get("ZAPI_BASE_URL") || "https://api.z-api.io";
const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN") || "";
const WHATSAPP_WEBHOOK_SECRET = Deno.env.get("WHATSAPP_WEBHOOK_SECRET") || "";

const MERCADO_PAGO_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") || "";
const MERCADO_PAGO_WEBHOOK_SECRET =
  Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET") || "";

const MAX_RETRIES = 3;

function normalizePhoneBR(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function normalizeCpf(raw: string) {
  return raw.replace(/\D/g, "");
}

function isValidCpf(raw: string) {
  const cpf = normalizeCpf(raw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const digits = cpf.split("").map(Number);
  const calcCheck = (factor: number) => {
    let total = 0;
    for (let i = 0; i < factor - 1; i += 1) {
      total += digits[i] * (factor - i);
    }
    const rest = (total * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  const d1 = calcCheck(10);
  const d2 = calcCheck(11);
  return d1 === digits[9] && d2 === digits[10];
}

function normalizeText(raw: string) {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function sanitizeZapiMessage(message: string) {
  return message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function sendZapiRequest(endpoint: string, payload: Record<string, unknown>) {
  if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
    throw new Error("Z-API not configured");
  }
  const url = `${ZAPI_BASE_URL}/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (ZAPI_CLIENT_TOKEN) {
    headers["Client-Token"] = ZAPI_CLIENT_TOKEN;
  }

  let attempt = 0;
  let lastError: Error | null = null;
  while (attempt < MAX_RETRIES) {
    attempt += 1;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Z-API error: ${response.status} ${text}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Z-API error");
      logger.warn("Z-API retry", { attempt, error: lastError.message });
    }
  }
  throw lastError || new Error("Z-API error");
}

async function sendText(to: string, message: string) {
  const phone = normalizePhoneBR(to);
  const safeMessage = sanitizeZapiMessage(message);
  return sendZapiRequest("send-text", { phone, message: safeMessage });
}

async function sendImage(to: string, image: string, caption?: string) {
  const phone = normalizePhoneBR(to);
  const payload: Record<string, unknown> = { phone, image };
  if (caption) payload.caption = caption;
  return sendZapiRequest("send-image", payload);
}

async function sendPixButtons(to: string) {
  const phone = normalizePhoneBR(to);
  const labels = ["Copiar PIX", "Reenviar QR Code", "Ja paguei"];
  const safeMessage = "Escolha uma opcao para pagamento:";
  const buttonsList = labels.map((label, index) => ({
    id: String(index + 1),
    label: sanitizeZapiMessage(label),
  }));

  // Tentativa 1: button-list (payload completo)
  try {
    await sendZapiRequest("send-button-list", {
      phone,
      message: safeMessage,
      buttonList: {
        buttons: buttonsList,
        title: "Pagamento PIX",
        description: "Selecione uma opcao",
        buttonText: "Opcoes",
      },
    });
    return;
  } catch (error) {
    logger.warn("Falha ao enviar button list", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Tentativa 2: button-actions (REPLY)
  try {
    const buttonActions = labels.map((label) => ({
      type: "REPLY",
      label: sanitizeZapiMessage(label),
    }));
    await sendZapiRequest("send-button-actions", {
      phone,
      message: safeMessage,
      buttonActions,
    });
    return;
  } catch (error) {
    logger.warn("Falha ao enviar button actions (label)", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Tentativa 3: button-actions (title/id)
  try {
    const buttonActions = [
      { id: "pix_copy", title: "Copiar PIX" },
      { id: "pix_qr", title: "Reenviar QR Code" },
      { id: "pix_paid", title: "Ja paguei" },
    ];
    await sendZapiRequest("send-button-actions", {
      phone,
      message: safeMessage,
      buttonActions,
    });
    return;
  } catch (error) {
    logger.warn("Falha ao enviar button actions (title)", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Fallback: texto com opções numeradas
  await sendText(
    to,
    "Opcoes:\n1. Copiar PIX\n2. Reenviar QR Code\n3. Ja paguei\nResponda com o numero.",
  );
}

async function getPendingPixByCpf(supabase: any, cpf: string) {
  const { data: participante } = await supabase
    .from("participantes")
    .select("cpf, inscricao_id")
    .eq("cpf", cpf)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!participante?.inscricao_id) return null;

  const { data: inscricao } = await supabase
    .from("inscricoes")
    .select("id, total, created_at")
    .eq("id", participante.inscricao_id)
    .maybeSingle();

  if (!inscricao?.id) return null;

  const { data: pagamento } = await supabase
    .from("pagamentos")
    .select("copiaecola, qrcode, status, expires_at")
    .eq("inscricao_id", inscricao.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pagamento || pagamento.status !== "PENDING") return null;
  return {
    ...pagamento,
    total: inscricao.total,
    created_at: inscricao.created_at,
  };
}

function extractMessagePayload(raw: unknown) {
  const parsed = whatsappPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  const payload = parsed.data as any;
  const phone =
    payload.phone ||
    payload.data?.phone ||
    payload.sender?.phone ||
    payload.data?.sender?.phone;
  const messageId =
    payload.messageId || payload.data?.messageId || payload.id || payload.data?.id;
  const timestamp =
    payload.momment || payload.data?.momment || payload.timestamp || Date.now() / 1000;
  const fromMe = payload.fromMe ?? payload.data?.fromMe ?? false;

  let text = payload.text?.message || payload.data?.text?.message;
  if (!text && typeof payload.message === "string") {
    text = payload.message;
  }
  if (!text && typeof payload.data?.message === "string") {
    text = payload.data.message;
  }
  if (!text && typeof payload.text === "string") {
    text = payload.text;
  }

  return {
    phone: phone ? String(phone) : null,
    messageId: messageId ? String(messageId) : null,
    timestamp: Number(timestamp) || Date.now() / 1000,
    text: text ? String(text) : "",
    fromMe: Boolean(fromMe),
  };
}

async function getOrCreateSession(supabase: any, phone: string) {
  const { data, error } = await supabase
    .from("whatsapp_sessions")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (data) return data;

  const { data: created, error: insertError } = await supabase
    .from("whatsapp_sessions")
    .insert({ phone, state: "idle", payload_json: {} })
    .select("*")
    .single();
  if (insertError) throw insertError;
  return created;
}

async function updateSession(
  supabase: any,
  sessionId: string,
  state: string,
  payload: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("whatsapp_sessions")
    .update({ state, payload_json: payload })
    .eq("id", sessionId);
  if (error) throw error;
}

async function resetSession(supabase: any, sessionId: string) {
  await updateSession(supabase, sessionId, "idle", {});
}

function parseQuantidade(text: string) {
  const value = Number(text.replace(/\D/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.min(value, 50);
}

function parseParticipantData(message: string) {
  const lines = message
    .split(/\n|\r/)
    .map((line) => line.trim())
    .filter(Boolean);

  const data: Record<string, string> = {};
  for (const line of lines) {
    const parts = line.split(/:|-/).map((part) => part.trim());
    if (parts.length < 2) continue;
    const key = normalizeText(parts[0]);
    const value = parts.slice(1).join(":").trim();
    data[key] = value;
  }

  const getByKeys = (keys: string[]) => {
    for (const key of keys) {
      if (data[key]) return data[key];
    }
    return "";
  };

  const nome = getByKeys(["nome", "nome completo", "participante"]);
  const cpf = getByKeys(["cpf"]);
  const nascimento = getByKeys([
    "data de nascimento",
    "nascimento",
    "data nascimento",
    "data",
  ]);
  const genero = getByKeys(["genero", "gênero", "sexo"]);
  const distrito = getByKeys(["distrito"]);
  const igreja = getByKeys(["igreja"]);
  const telefone = getByKeys(["telefone", "celular", "whatsapp"]);

  return { nome, cpf, nascimento, genero, distrito, igreja, telefone };
}

function normalizeDateInput(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }
  return null;
}

function isTrigger(text: string, keywords: string[]) {
  const normalized = normalizeText(text);
  return keywords.some((keyword) => normalized.includes(keyword));
}

function calculateAge(dateStr?: string | null) {
  if (!dateStr) return 0;
  const birth = new Date(dateStr);
  if (Number.isNaN(birth.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return Math.max(age, 0);
}

async function getDefaultUserId(supabase: any) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, created_at")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (profile?.user_id) return profile.user_id;

  try {
    const { data } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });
    if (data?.users?.length) return data.users[0].id;
  } catch (error) {
    logger.warn("Nao foi possivel listar usuarios", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return null;
}

async function appendInscritosFromParticipantes({
  supabase,
  participantes,
  status,
}: {
  supabase: any;
  participantes: Array<{
    id: string;
    nome: string;
    nascimento?: string | null;
    igreja_id?: string | null;
    distrito_id?: string | null;
  }>;
  status: string;
}) {
  if (!participantes || participantes.length === 0) return;
  const userId = await getDefaultUserId(supabase);
  if (!userId) {
    logger.warn("Sem user_id para sincronizar inscritos");
    return;
  }

  const participantIds = participantes.map((p) => p.id).filter(Boolean);
  if (participantIds.length === 0) return;

  const { data: existing } = await supabase
    .from("inscritos")
    .select("numero_original")
    .eq("user_id", userId)
    .in("numero_original", participantIds);

  const existingSet = new Set(
    (existing || []).map((row: any) => row.numero_original).filter(Boolean),
  );

  const toInsert = participantes.filter((p) => !existingSet.has(p.id));
  if (toInsert.length === 0) return;

  const igrejaIds = Array.from(
    new Set(toInsert.map((p) => p.igreja_id).filter(Boolean)),
  );
  const distritoIds = Array.from(
    new Set(toInsert.map((p) => p.distrito_id).filter(Boolean)),
  );

  const [igrejasRes, distritosRes] = await Promise.all([
    igrejaIds.length
      ? supabase.from("igrejas").select("id, nome").in("id", igrejaIds)
      : { data: [] },
    distritoIds.length
      ? supabase.from("distritos").select("id, nome").in("id", distritoIds)
      : { data: [] },
  ]);

  const igrejaMap = new Map(
    (igrejasRes.data || []).map((row: any) => [row.id, row.nome]),
  );
  const distritoMap = new Map(
    (distritosRes.data || []).map((row: any) => [row.id, row.nome]),
  );

  let attempts = 0;
  while (attempts < 3) {
    attempts += 1;
    const { data: last } = await supabase
      .from("inscritos")
      .select("numero")
      .eq("user_id", userId)
      .order("numero", { ascending: false })
      .limit(1)
      .maybeSingle();
    const startNumero = (last?.numero || 0) + 1;

    const payload = toInsert.map((p, index) => ({
      user_id: userId,
      numero: startNumero + index,
      nome: p.nome || `Participante ${startNumero + index}`,
      data_nascimento: p.nascimento || null,
      idade: p.nascimento ? calculateAge(p.nascimento) : 0,
      igreja: igrejaMap.get(p.igreja_id || "") || "Nao informado",
      distrito: distritoMap.get(p.distrito_id || "") || "Nao informado",
      foto_url: null,
      status_pagamento: status,
      is_manual: false,
      numero_original: p.id,
      numero_pulseira: String(startNumero + index),
    }));

    const { error } = await supabase.from("inscritos").insert(payload);
    if (!error) return;

    const message = error.message || "";
    if (message.includes("duplicate") || message.includes("unique")) {
      continue;
    }
    logger.warn("Erro ao sincronizar inscritos", { error: message });
    return;
  }
}

async function updateInscritosStatusByParticipantes({
  supabase,
  participantIds,
  status,
}: {
  supabase: any;
  participantIds: string[];
  status: string;
}) {
  if (!participantIds || participantIds.length === 0) return;
  const userId = await getDefaultUserId(supabase);
  if (!userId) return;
  await supabase
    .from("inscritos")
    .update({ status_pagamento: status })
    .eq("user_id", userId)
    .in("numero_original", participantIds);
}

async function findActiveEvents(supabase: any) {
  const { data, error } = await supabase
    .from("eventos")
    .select("id, nome, status")
    .eq("status", "ativo")
    .order("nome", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function findLoteVigente(supabase: any, eventoId: string) {
  const hoje = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("lotes")
    .select("*")
    .eq("evento_id", eventoId)
    .eq("status", "ativo")
    .lte("inicio", hoje)
    .gte("fim", hoje)
    .order("inicio", { ascending: true })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

async function findDistritoId(supabase: any, nome: string) {
  if (!nome) return null;
  const { data } = await supabase
    .from("distritos")
    .select("id")
    .ilike("nome", `%${nome}%`)
    .limit(1);
  return data?.[0]?.id || null;
}

async function findIgrejaId(supabase: any, nome: string) {
  if (!nome) return null;
  const { data } = await supabase
    .from("igrejas")
    .select("id")
    .ilike("nome", `%${nome}%`)
    .limit(1);
  return data?.[0]?.id || null;
}

async function listIgrejas(supabase: any, limit = 20, distritoId?: string | null) {
  let query = supabase
    .from("igrejas")
    .select("id, nome, distrito_id")
    .order("nome", { ascending: true })
    .limit(limit);
  if (distritoId) {
    query = query.eq("distrito_id", distritoId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function listDistritos(supabase: any, limit = 20) {
  const { data, error } = await supabase
    .from("distritos")
    .select("id, nome")
    .order("nome", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function createPixPayment({
  amount,
  description,
  cpf,
  name,
  metadata,
}: {
  amount: number;
  description: string;
  cpf: string;
  name: string;
  metadata?: Record<string, unknown>;
}) {
  if (!MERCADO_PAGO_TOKEN) {
    throw new Error("Mercado Pago token not configured");
  }

  const notificationUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/api/payments/mercadopago/webhook`;
  const expiration = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const idempotencyKey =
    (metadata?.inscricao_id ? `inscricao-${metadata.inscricao_id}` : null) ||
    crypto.randomUUID();

  const response = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MERCADO_PAGO_TOKEN}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      transaction_amount: amount,
      description: sanitizeZapiMessage(description || "Inscricao"),
      payment_method_id: "pix",
      notification_url: notificationUrl,
      date_of_expiration: expiration,
      payer: {
        email: `${cpf}@exemplo.com`,
        first_name: name?.split(" ")[0] || "Participante",
        last_name: name?.split(" ").slice(1).join(" ") || "",
        identification: {
          type: "CPF",
          number: cpf,
        },
      },
      metadata: metadata || {},
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mercado Pago error: ${response.status} ${errorText}`);
  }

  return await response.json();
}

async function createInscricaoWithPix({
  supabase,
  eventId,
  participantes,
  whatsapp,
  payerCpf,
  payerName,
}: {
  supabase: any;
  eventId: string;
  participantes: Array<Record<string, any>>;
  whatsapp?: string | null;
  payerCpf?: string | null;
  payerName?: string | null;
}) {
  const lote = await findLoteVigente(supabase, eventId);
  if (!lote) {
    throw new Error("Nao ha lote vigente para este evento.");
  }

  const total = Number(lote.valor) * participantes.length;
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error("Valor do lote invalido.");
  }

  const { data: inscricao, error: inscricaoError } = await supabase
    .from("inscricoes")
    .insert({
      evento_id: eventId,
      whatsapp: whatsapp || null,
      total,
      status: "PENDING",
    })
    .select("*")
    .single();

  if (inscricaoError || !inscricao) {
    throw new Error("Erro ao registrar inscricao.");
  }

  const participantesPayload = [];
  for (const participante of participantes) {
    const distritoId =
      participante.distritoId ||
      (participante.distrito
        ? await findDistritoId(supabase, participante.distrito)
        : null);
    const igrejaId =
      participante.igrejaId ||
      (participante.igreja ? await findIgrejaId(supabase, participante.igreja) : null);

    participantesPayload.push({
      inscricao_id: inscricao.id,
      evento_id: eventId,
      nome: participante.nome,
      cpf: participante.cpf,
      nascimento: participante.nascimento || null,
      genero: participante.genero || null,
      distrito_id: distritoId,
      igreja_id: igrejaId,
      telefone: participante.telefone || null,
    });
  }

  const { error: participantesError } = await supabase
    .from("participantes")
    .insert(participantesPayload);

  if (participantesError) {
    throw new Error("Erro ao registrar participantes.");
  }

  const first = participantes[0];
  const effectivePayerCpf = payerCpf || first?.cpf;
  const effectivePayerName = payerName || first?.nome || "Responsavel";
  if (!effectivePayerCpf) {
    throw new Error("CPF do responsavel nao informado.");
  }
  const pagamentoResponse = await createPixPayment({
    amount: Number(total),
    description: `Inscricao ${inscricao.id}`,
    cpf: effectivePayerCpf,
    name: effectivePayerName,
    metadata: { inscricao_id: inscricao.id, evento_id: eventId },
  });

  const pixData = pagamentoResponse?.point_of_interaction?.transaction_data || {};
  const qrcode = pixData.qr_code || "";
  const qrcodeBase64 = pixData.qr_code_base64 || "";

  await supabase.from("pagamentos").insert({
    inscricao_id: inscricao.id,
    provider: "mercadopago",
    provider_payment_id: String(pagamentoResponse.id),
    status: pagamentoResponse.status === "approved" ? "PAID" : "PENDING",
    copiaecola: qrcode || null,
    qrcode: qrcodeBase64 || null,
    expires_at: pixData.expiration_date || null,
  });

  return {
    inscricao_id: inscricao.id,
    total,
    lote: {
      id: lote.id,
      nome: lote.nome,
      valor: lote.valor,
    },
    pix: {
      copiaecola: qrcode || null,
      qrcode_base64: qrcodeBase64 || null,
      payment_id: String(pagamentoResponse.id),
      expires_at: pixData.expiration_date || null,
    },
  };
}

async function handlePublicEvent(req: Request) {
  const supabase = getSupabaseAdmin();
  const pathname = new URL(req.url).pathname;
  const match = pathname.match(/\/public\/event\/([^\/\?]+)/);
  const slug = match?.[1];
  if (!slug) {
    return new Response(JSON.stringify({ error: "Evento nao informado" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const normalizedSlug = slug
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

  const { data: event } = await supabase
    .from("eventos")
    .select("id, nome, data_inicio, data_fim, local, status, slug")
    .or(`slug.eq.${slug},slug.ilike.${slug},id.eq.${slug}`)
    .maybeSingle();

  let resolvedEvent = event;

  if (!resolvedEvent) {
    const { data: events } = await supabase
      .from("eventos")
      .select("id, nome, data_inicio, data_fim, local, status, slug");

    resolvedEvent = (events || []).find((item: any) => {
      const itemSlug = (item.slug || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
      const nameSlug = (item.nome || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "")
        .replace(/[^a-z0-9]/g, "");
      return normalizedSlug === itemSlug || normalizedSlug === nameSlug;
    }) as any;

    if (resolvedEvent && !resolvedEvent.slug) {
      await supabase
        .from("eventos")
        .update({ slug })
        .eq("id", resolvedEvent.id);
    }
  }

  if (!resolvedEvent) {
    return new Response(JSON.stringify({ error: "Evento nao encontrado" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const loteVigente = await findLoteVigente(supabase, resolvedEvent.id);
  const hoje = new Date().toISOString().slice(0, 10);
  const { data: proximoLote } = await supabase
    .from("lotes")
    .select("id, nome, valor, inicio, fim")
    .eq("evento_id", resolvedEvent.id)
    .eq("status", "ativo")
    .gt("inicio", hoje)
    .order("inicio", { ascending: true })
    .limit(1)
    .maybeSingle();

  const [distritosRes, igrejasRes] = await Promise.all([
    supabase.from("distritos").select("id, nome").order("nome"),
    supabase.from("igrejas").select("id, nome, distrito_id").order("nome"),
  ]);

  return new Response(
    JSON.stringify({
      event: resolvedEvent,
      lote: loteVigente,
      proximo_lote: proximoLote || null,
      distritos: distritosRes.data || [],
      igrejas: igrejasRes.data || [],
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

async function handlePublicResponsavel(req: Request) {
  const supabase = getSupabaseAdmin();
  const pathname = new URL(req.url).pathname;
  const match = pathname.match(/\/public\/responsavel\/([^\/\?]+)/);
  const cpfRaw = match?.[1];
  if (!cpfRaw) {
    return new Response(JSON.stringify({ error: "CPF nao informado" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const cpf = normalizeCpf(cpfRaw);
  if (!isValidCpf(cpf)) {
    return new Response(JSON.stringify({ error: "CPF invalido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: igreja } = await supabase
    .from("igrejas")
    .select(
      "id, nome, distrito_id, diretor_jovem_nome, diretor_jovem_cpf, diretor_jovem_telefone, diretor_jovem_email",
    )
    .eq("diretor_jovem_cpf", cpf)
    .maybeSingle();

  if (!igreja) {
    return new Response(JSON.stringify({ error: "Responsavel nao encontrado" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: distrito } = await supabase
    .from("distritos")
    .select("id, nome")
    .eq("id", igreja.distrito_id)
    .maybeSingle();

  return new Response(
    JSON.stringify({
      igreja: {
        id: igreja.id,
        nome: igreja.nome,
        distrito_id: igreja.distrito_id,
      },
      distrito: distrito || null,
      diretor: {
        nome: igreja.diretor_jovem_nome,
        cpf: igreja.diretor_jovem_cpf,
        telefone: igreja.diretor_jovem_telefone,
        email: igreja.diretor_jovem_email,
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

async function handlePublicInscricao(req: Request) {
  const supabase = getSupabaseAdmin();
  const body = await req.json().catch(() => ({}));

  const schema = z.object({
    eventSlug: z.string().min(1),
    responsavelCpf: z.string().min(11),
    whatsapp: z.string().optional(),
    igrejaId: z.string().optional().nullable(),
    distritoId: z.string().optional().nullable(),
    participantes: z
      .array(
        z.object({
          nome: z.string().min(1),
          cpf: z.string().min(11),
          nascimento: z.string().optional().nullable(),
          genero: z.string().optional().nullable(),
          telefone: z.string().optional().nullable(),
          distritoId: z.string().optional().nullable(),
          distrito: z.string().optional().nullable(),
          igrejaId: z.string().optional().nullable(),
          igreja: z.string().optional().nullable(),
        }),
      )
      .min(1),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Dados invalidos" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const {
    eventSlug,
    participantes,
    whatsapp,
    responsavelCpf,
    igrejaId,
    distritoId,
  } = parsed.data;
  const responsavelCpfNormalized = normalizeCpf(responsavelCpf);
  if (!isValidCpf(responsavelCpfNormalized)) {
    return new Response(JSON.stringify({ error: "CPF do responsavel invalido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: event } = await supabase
    .from("eventos")
    .select("id, status, nome")
    .or(`slug.eq.${eventSlug},id.eq.${eventSlug}`)
    .maybeSingle();

  if (!event || event.status !== "ativo") {
    return new Response(JSON.stringify({ error: "Evento inativo ou inexistente" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const cpfs = participantes.map((p) => normalizeCpf(p.cpf));
  const uniqueCpfs = new Set(cpfs);
  if (uniqueCpfs.size !== cpfs.length) {
    return new Response(JSON.stringify({ error: "CPF duplicado no envio" }), {
      status: 409,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const invalidCpf = cpfs.find((cpf) => !isValidCpf(cpf));
  if (invalidCpf) {
    return new Response(JSON.stringify({ error: "CPF invalido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: igrejaResponsavel } = await supabase
    .from("igrejas")
    .select("id, distrito_id")
    .eq("diretor_jovem_cpf", responsavelCpfNormalized)
    .maybeSingle();

  let finalIgrejaId = igrejaResponsavel?.id || igrejaId || null;
  let finalDistritoId =
    igrejaResponsavel?.distrito_id || distritoId || null;

  if (!finalIgrejaId) {
    return new Response(JSON.stringify({ error: "Igreja nao informada" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!igrejaResponsavel) {
    const { data: igrejaData } = await supabase
      .from("igrejas")
      .select("id, distrito_id")
      .eq("id", finalIgrejaId)
      .maybeSingle();
    if (!igrejaData?.id) {
      return new Response(JSON.stringify({ error: "Igreja invalida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!finalDistritoId) {
      finalDistritoId = igrejaData?.distrito_id || null;
    }
  }

  if (!finalDistritoId) {
    const { data: igrejaData } = await supabase
      .from("igrejas")
      .select("distrito_id")
      .eq("id", finalIgrejaId)
      .maybeSingle();
    finalDistritoId = igrejaData?.distrito_id || null;
  }

  if (!finalDistritoId) {
    return new Response(JSON.stringify({ error: "Distrito nao informado" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: existing } = await supabase
    .from("participantes")
    .select("cpf")
    .eq("evento_id", event.id)
    .in("cpf", cpfs);

  if (existing && existing.length > 0) {
    return new Response(
      JSON.stringify({ error: "CPF ja inscrito neste evento", cpfs: existing.map((e: any) => e.cpf) }),
      {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const mappedParticipants = participantes.map((p, index) => ({
    nome: p.nome.trim(),
    cpf: cpfs[index],
    nascimento: normalizeDateInput(p.nascimento) || null,
    genero: p.genero || null,
    telefone: p.telefone || null,
    distritoId: finalDistritoId,
    distrito: p.distrito || null,
    igrejaId: finalIgrejaId,
    igreja: p.igreja || null,
  }));

  const whatsappNormalized = whatsapp ? normalizePhoneBR(whatsapp) : null;
  if (whatsappNormalized) {
    const digits = whatsappNormalized.replace(/\D/g, "");
    if (digits.length < 12) {
      return new Response(JSON.stringify({ error: "WhatsApp invalido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const result = await createInscricaoWithPix({
      supabase,
      eventId: event.id,
      participantes: mappedParticipants,
      whatsapp: whatsappNormalized,
      payerCpf: responsavelCpfNormalized,
      payerName: mappedParticipants[0]?.nome || "Responsavel",
    });

    if (whatsappNormalized) {
      try {
        await sendText(
          whatsappNormalized,
          `Inscricao registrada no evento ${event.nome}.\nValor total: R$ ${Number(result.total).toFixed(2).replace(".", ",")}\nPague via PIX abaixo:`,
        );
        if (result.pix?.qrcode_base64) {
          await sendImage(
            whatsappNormalized,
            `data:image/png;base64,${result.pix.qrcode_base64}`,
          );
        }
        if (result.pix?.copiaecola) {
          await sendText(
            whatsappNormalized,
            `Copia e Cola PIX:\n${result.pix.copiaecola}`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 600));
        await sendPixButtons(whatsappNormalized);
      } catch (error) {
        logger.warn("Falha ao enviar PIX via WhatsApp", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro ao gerar PIX",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}

async function finalizeInscricao({
  supabase,
  phone,
  eventId,
  participantes,
  sessionId,
}: {
  supabase: any;
  phone: string;
  eventId: string;
  participantes: Array<Record<string, any>>;
  sessionId: string;
}) {
  if (!participantes || participantes.length === 0) {
    await sendText(
      phone,
      "Nenhum participante válido foi informado. Envie *Inscrição* para tentar novamente.",
    );
    await resetSession(supabase, sessionId);
    return;
  }

  const lote = await findLoteVigente(supabase, eventId);
  if (!lote) {
    await sendText(
      phone,
      "Não há lote vigente para este evento. Fale com a organização.",
    );
    await resetSession(supabase, sessionId);
    return;
  }

  const total = Number(lote.valor) * participantes.length;
  if (!Number.isFinite(total) || total <= 0) {
    await sendText(
      phone,
      "Não foi possível calcular o valor do lote. Verifique o valor cadastrado.",
    );
    await resetSession(supabase, sessionId);
    return;
  }

  const { data: inscricao, error: inscricaoError } = await supabase
    .from("inscricoes")
    .insert({
      evento_id: eventId,
      whatsapp: phone,
      total,
      status: "PENDING",
    })
    .select("*")
    .single();

  if (inscricaoError || !inscricao) {
    logger.error("Erro ao criar inscrição", { error: inscricaoError?.message });
    await sendText(phone, "Erro ao registrar inscrição. Tente novamente.");
    await resetSession(supabase, sessionId);
    return;
  }

  const participantesPayload = [];
  for (const participante of participantes) {
    const distritoId = await findDistritoId(
      supabase,
      participante.distrito || "",
    );
    const igrejaId =
      participante.igrejaId ||
      (participante.igreja ? await findIgrejaId(supabase, participante.igreja) : null);

    participantesPayload.push({
      inscricao_id: inscricao.id,
      evento_id: eventId,
      nome: participante.nome,
      cpf: participante.cpf,
      nascimento: participante.nascimento || null,
      genero: participante.genero || null,
      distrito_id: distritoId,
      igreja_id: igrejaId,
      telefone: participante.telefone || null,
    });
  }

  const { error: participantesError } = await supabase
    .from("participantes")
    .insert(participantesPayload);

  if (participantesError) {
    logger.warn("Erro ao inserir participantes", {
      error: participantesError.message,
    });
  }

  const first = participantes[0];
  let pagamentoResponse: any;
  try {
    pagamentoResponse = await createPixPayment({
      amount: Number(total),
      description: `Inscricao ${inscricao.id}`,
      cpf: first.cpf,
      name: first.nome,
      metadata: { inscricao_id: inscricao.id, evento_id: eventId },
    });
  } catch (error) {
    logger.error("Erro ao gerar PIX", {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendText(
      phone,
      `Erro ao gerar o PIX. Sua inscrição foi registrada, mas o pagamento precisa ser feito com suporte. Detalhe: ${error instanceof Error ? error.message : "Erro Mercado Pago"}`,
    );
    await resetSession(supabase, sessionId);
    return;
  }

  const pixData = pagamentoResponse?.point_of_interaction?.transaction_data || {};
  const qrcode = pixData.qr_code || "";
  const qrcodeBase64 = pixData.qr_code_base64 || "";

  await supabase.from("pagamentos").insert({
    inscricao_id: inscricao.id,
    provider: "mercadopago",
    provider_payment_id: String(pagamentoResponse.id),
    status: pagamentoResponse.status === "approved" ? "PAID" : "PENDING",
    copiaecola: qrcode || null,
    qrcode: qrcodeBase64 || null,
    expires_at: pixData.expiration_date || null,
  });

  await sendText(
    phone,
    `✅ Inscrição registrada!\nValor total: R$ ${total.toFixed(2).replace(".", ",")}\nPague via PIX abaixo (válido por 24h):`,
  );
  if (qrcodeBase64) {
    await sendImage(phone, `data:image/png;base64,${qrcodeBase64}`);
  }
  if (qrcode) {
    await sendText(phone, `Copia e Cola PIX:\n${qrcode}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 600));
  await sendPixButtons(phone);

  await resetSession(supabase, sessionId);
}

async function handleBotMessage(payload: {
  phone: string;
  messageId: string | null;
  text: string;
}) {
  const supabase = getSupabaseAdmin();
  const phone = normalizePhoneBR(payload.phone);
  const session = await getOrCreateSession(supabase, phone);
  const sessionPayload = (session.payload_json as Record<string, unknown>) || {};

  if (payload.messageId && sessionPayload.lastMessageId === payload.messageId) {
    logger.info("Mensagem duplicada ignorada", {
      phone,
      messageId: payload.messageId,
    });
    return;
  }

  const messageText = payload.text || "";
  const normalized = normalizeText(messageText);

  if (cancelKeywords.some((keyword) => normalized.includes(keyword))) {
    await resetSession(supabase, session.id);
    await sendText(
      phone,
      "Sessão reiniciada. Envie *Inscrição* para começar novamente.",
    );
    return;
  }

  if (supportKeywords.some((keyword) => normalized.includes(keyword))) {
    await sendText(
      phone,
      "Suporte: entre em contato pelo WhatsApp (91) 99332-0376 ou pelo e-mail suporte@evento.ideartcloud.com.br",
    );
    return;
  }

  const showMenu = async () => {
    await updateSession(supabase, session.id, "menu", {
      lastMessageId: payload.messageId,
    });
    await sendText(
      phone,
      "Escolha uma opcao:\n\n1. Fazer inscricao\n2. Consultar inscricao\n3. Consultar PIX pendente\n4. Falar com suporte\n\nResponda apenas com o numero.",
    );
  };

  if (pixConsultKeywords.some((keyword) => normalized.includes(keyword))) {
    await updateSession(supabase, session.id, "consulta_pix_cpf", {
      lastMessageId: payload.messageId,
    });
    await sendText(phone, "Informe o CPF para consultar o PIX pendente.");
    return;
  }

  if (pixCopyKeywords.some((keyword) => normalized.includes(keyword))) {
    const pagamento = await getPendingPixByCpf(supabase, normalizeCpf(messageText));
    if (!pagamento?.copiaecola) {
      await sendText(phone, "Nao encontrei o codigo PIX copia e cola.");
      return;
    }
    await sendText(phone, `Copia e Cola PIX:\n${pagamento.copiaecola}`);
    await sendPixButtons(phone);
    return;
  }

  if (pixQrKeywords.some((keyword) => normalized.includes(keyword)) || normalized.includes("pix_qr")) {
    const pagamento = await getPendingPixByCpf(supabase, normalizeCpf(messageText));
    if (!pagamento?.qrcode) {
      await sendText(phone, "Nao encontrei QR Code pendente.");
      return;
    }
    await sendImage(phone, `data:image/png;base64,${pagamento.qrcode}`);
    return;
  }

  if (pixPaidKeywords.some((keyword) => normalized.includes(keyword)) || normalized.includes("pix_paid")) {
    await sendText(
      phone,
      "Recebemos sua confirmacao. Assim que o Mercado Pago aprovar, avisaremos aqui.",
    );
    return;
  }

  if (session.state === "idle") {
    const menuChoice = parseInt(messageText.replace(/\D/g, ""), 10);
    if (menuChoice >= 1 && menuChoice <= 4) {
      await updateSession(supabase, session.id, "menu", {
        lastMessageId: payload.messageId,
      });
      session.state = "menu";
    }

    if (isTrigger(messageText, consultaKeywords)) {
      await updateSession(supabase, session.id, "consulta_cpf", {
        lastMessageId: payload.messageId,
      });
      await sendText(phone, "Envie o CPF para consulta.");
      return;
    }

    if (isTrigger(messageText, whatsappKeywords)) {
      const events = await findActiveEvents(supabase);
      if (events.length === 0) {
        await sendText(phone, "Nenhum evento ativo no momento.");
        return;
      }
      if (events.length === 1) {
        await updateSession(supabase, session.id, "quantidade", {
          eventId: events[0].id,
          lastMessageId: payload.messageId,
        });
      await sendText(
        phone,
        "Quantos participantes deseja inscrever?\nResponda apenas com um número.",
      );
      return;
    }
      const options = events
        .map((event: any, index: number) => `${index + 1}. ${event.nome}`)
        .join("\n");
      await updateSession(supabase, session.id, "selecionar_evento", {
        eventOptions: events,
        lastMessageId: payload.messageId,
      });
      await sendText(
        phone,
        `Temos mais de um evento aberto. Escolha um:\n\n${options}\nResponda apenas com o número.`,
      );
      return;
    }

    if (menuKeywords.some((keyword) => normalized.includes(keyword))) {
      await showMenu();
      return;
    }

    await showMenu();
    return;
  }

  if (session.state === "menu") {
    const choice = parseInt(messageText.replace(/\D/g, ""), 10);
    if (!choice || choice < 1 || choice > 4) {
      await sendText(phone, "Opcao invalida. Responda com 1, 2, 3 ou 4.");
      return;
    }

    if (choice === 1) {
      const events = await findActiveEvents(supabase);
      if (events.length === 0) {
        await sendText(phone, "Nenhum evento ativo no momento.");
        await resetSession(supabase, session.id);
        return;
      }
      if (events.length === 1) {
        await updateSession(supabase, session.id, "quantidade", {
          eventId: events[0].id,
          lastMessageId: payload.messageId,
        });
        await sendText(
          phone,
          "Quantos participantes deseja inscrever?\nResponda apenas com um numero.",
        );
        return;
      }
      const options = events
        .map((event: any, index: number) => `${index + 1}. ${event.nome}`)
        .join("\n");
      await updateSession(supabase, session.id, "selecionar_evento", {
        eventOptions: events,
        lastMessageId: payload.messageId,
      });
      await sendText(
        phone,
        `Temos mais de um evento aberto. Escolha um:\n\n${options}\nResponda apenas com o numero.`,
      );
      return;
    }

    if (choice === 2) {
      await updateSession(supabase, session.id, "consulta_cpf", {
        lastMessageId: payload.messageId,
      });
      await sendText(phone, "Envie o CPF para consulta.");
      return;
    }

    if (choice === 3) {
      await updateSession(supabase, session.id, "consulta_pix_cpf", {
        lastMessageId: payload.messageId,
      });
      await sendText(phone, "Informe o CPF para consultar o PIX pendente.");
      return;
    }

    if (choice === 4) {
      await sendText(
        phone,
        "Suporte: entre em contato pelo WhatsApp (91) 99332-0376 ou pelo e-mail suporte@evento.ideartcloud.com.br",
      );
      await resetSession(supabase, session.id);
      return;
    }
  }

  if (session.state === "consulta_pix_cpf") {
    const cpf = normalizeCpf(messageText);
    if (!isValidCpf(cpf)) {
      await sendText(phone, "CPF inválido. Envie um CPF válido com 11 dígitos.");
      return;
    }

    const pagamento = await getPendingPixByCpf(supabase, cpf);
    if (!pagamento) {
      await sendText(phone, "Não encontrei PIX pendente para esse CPF.");
      await resetSession(supabase, session.id);
      return;
    }

    const valor = Number(pagamento.total || 0)
      .toFixed(2)
      .replace(".", ",");
    const validade = pagamento.expires_at
      ? new Date(pagamento.expires_at).toLocaleString("pt-BR")
      : "não informado";
    await sendText(
      phone,
      `PIX pendente encontrado.\nValor: R$ ${valor}\nValidade: ${validade}`,
    );
    if (pagamento.qrcode) {
      await sendImage(phone, `data:image/png;base64,${pagamento.qrcode}`);
    }
    if (pagamento.copiaecola) {
      await sendText(phone, `Copia e Cola PIX:\n${pagamento.copiaecola}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
    await sendPixButtons(phone);
    await resetSession(supabase, session.id);
    return;
  }

  if (session.state === "selecionar_evento") {
    const options = Array.isArray(sessionPayload.eventOptions)
      ? sessionPayload.eventOptions
      : [];
    const choice = parseInt(messageText.replace(/\D/g, ""), 10);
    if (!choice || choice < 1 || choice > options.length) {
      await sendText(phone, "Opção inválida. Responda apenas com o número do evento.");
      return;
    }
    const selected = options[choice - 1];
    await updateSession(supabase, session.id, "quantidade", {
      eventId: selected.id,
      lastMessageId: payload.messageId,
    });
    await sendText(
      phone,
      "Quantos participantes deseja inscrever?\nResponda apenas com um número.",
    );
    return;
  }

  if (session.state === "quantidade") {
    const quantidade = parseQuantidade(messageText);
    if (!quantidade) {
      await sendText(phone, "Informe apenas um número válido para a quantidade.");
      return;
    }
    await updateSession(supabase, session.id, "coletar_participante", {
      eventId: sessionPayload.eventId,
      quantidade,
      currentIndex: 1,
      participantes: [],
      lastMessageId: payload.messageId,
    });
    if (quantidade === 1) {
      await sendText(
        phone,
        "Você vai cadastrar 1 participante.\nEnvie os dados neste formato (uma única mensagem):\n\nNome: \nCPF: \nData de Nascimento (DD/MM/AAAA): \nGênero: \nTelefone:\n\nDepois você escolherá o distrito e a igreja.",
      );
    } else {
      await sendText(
        phone,
        `Você vai cadastrar ${quantidade} participantes.\nEnvie 1 participante por mensagem neste formato:\n\nNome: \nCPF: \nData de Nascimento (DD/MM/AAAA): \nGênero: \nTelefone:\n\nApós cada participante, vou pedir o distrito e a igreja, e depois o próximo participante.`,
      );
    }
    return;
  }

  if (session.state === "coletar_participante") {
    const quantidade = Number(sessionPayload.quantidade || 0);
    const currentIndex = Number(sessionPayload.currentIndex || 1);
    const participantes = Array.isArray(sessionPayload.participantes)
      ? sessionPayload.participantes
      : [];
    const eventId = String(sessionPayload.eventId || "");

    const parsed = parseParticipantData(messageText);
    if (!parsed.nome || !parsed.cpf) {
      await sendText(
        phone,
        "Não consegui entender. Envie no formato:\nNome: \nCPF: \nData de Nascimento (DD/MM/AAAA): \nGênero: \nTelefone:",
      );
      return;
    }

    const cpf = normalizeCpf(parsed.cpf);
    if (!isValidCpf(cpf)) {
      await sendText(phone, "CPF inválido. Envie um CPF válido com 11 dígitos.");
      return;
    }

    const { data: existingCpf } = await supabase
      .from("participantes")
      .select("id")
      .eq("evento_id", eventId)
      .eq("cpf", cpf)
      .limit(1);

    if (existingCpf && existingCpf.length > 0) {
      await sendText(
        phone,
        "❌ Este CPF já está inscrito neste evento. Não é permitido duplicidade.",
      );
      const nextIndex = currentIndex + 1;
      if (nextIndex <= quantidade) {
        await updateSession(supabase, session.id, "coletar_participante", {
          ...sessionPayload,
          participantes,
          currentIndex: nextIndex,
          lastMessageId: payload.messageId,
        });
        await sendText(
          phone,
          `Envie os dados do Participante ${nextIndex}:\n\nNome: \nCPF: \nData de Nascimento (DD/MM/AAAA): \nGênero: \nTelefone:`,
        );
        return;
      }

      await finalizeInscricao({
        supabase,
        phone,
        eventId,
        participantes,
        sessionId: session.id,
      });
      return;
    }

    const pendingParticipant = {
      nome: parsed.nome,
      cpf,
      nascimento: normalizeDateInput(parsed.nascimento) || null,
      genero: parsed.genero || null,
      telefone: parsed.telefone || null,
    };

    const distritos = await listDistritos(supabase, 20);
    if (distritos.length === 0) {
      const igrejas = await listIgrejas(supabase, 20);
      if (igrejas.length === 0) {
        participantes.push({
          ...pendingParticipant,
          distritoId: null,
          igrejaId: null,
        });
      } else {
        await updateSession(supabase, session.id, "selecionar_igreja", {
          ...sessionPayload,
          participantes,
          pendingParticipant: {
            ...pendingParticipant,
            distritoId: null,
            distrito: null,
          },
          igrejaOptions: igrejas,
          lastMessageId: payload.messageId,
        });
        const options = igrejas
          .map((igreja: any, index: number) => `${index + 1}. ${igreja.nome}`)
          .join("\n");
        await sendText(
          phone,
          `Selecione a igreja do Participante ${currentIndex}:\n\n${options}\n\nResponda apenas com o número. Se não aparecer, responda 0.`,
        );
        return;
      }
    } else {
      await updateSession(supabase, session.id, "selecionar_distrito", {
        ...sessionPayload,
        participantes,
        pendingParticipant,
        distritoOptions: distritos,
        lastMessageId: payload.messageId,
      });
      const options = distritos
        .map((distrito: any, index: number) => `${index + 1}. ${distrito.nome}`)
        .join("\n");
      await sendText(
        phone,
        `Selecione o distrito do Participante ${currentIndex}:\n\n${options}\n\nResponda apenas com o número. Se não aparecer, responda 0.`,
      );
      return;
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex <= quantidade) {
      await updateSession(supabase, session.id, "coletar_participante", {
        ...sessionPayload,
        participantes,
        currentIndex: nextIndex,
        lastMessageId: payload.messageId,
      });
      await sendText(
        phone,
        `Envie os dados do Participante ${nextIndex}:\n\nNome: \nCPF: \nData de Nascimento (DD/MM/AAAA): \nGênero: \nTelefone:`,
      );
      return;
    }

    await finalizeInscricao({
      supabase,
      phone,
      eventId,
      participantes,
      sessionId: session.id,
    });
    return;
  }

  if (session.state === "selecionar_igreja") {
    const options = Array.isArray(sessionPayload.igrejaOptions)
      ? sessionPayload.igrejaOptions
      : [];
    const choice = parseInt(messageText.replace(/\D/g, ""), 10);
    if (Number.isNaN(choice) || choice < 0 || choice > options.length) {
      await sendText(phone, "Opção inválida. Responda com o número da igreja.");
      return;
    }

    const participantes = Array.isArray(sessionPayload.participantes)
      ? sessionPayload.participantes
      : [];
    const pending = sessionPayload.pendingParticipant as any;
    if (!pending?.nome || !pending?.cpf) {
      await sendText(phone, "Dados do participante não encontrados. Envie novamente.");
      await updateSession(supabase, session.id, "coletar_participante", {
        ...sessionPayload,
        lastMessageId: payload.messageId,
      });
      return;
    }

    const selectedIgreja = choice === 0 ? null : options[choice - 1];
    participantes.push({
      ...pending,
      igrejaId: selectedIgreja?.id || null,
      igreja: selectedIgreja?.nome || null,
    });

    const quantidade = Number(sessionPayload.quantidade || 0);
    const currentIndex = Number(sessionPayload.currentIndex || 1);
    const nextIndex = currentIndex + 1;

    if (nextIndex <= quantidade) {
      await updateSession(supabase, session.id, "coletar_participante", {
        ...sessionPayload,
        participantes,
        currentIndex: nextIndex,
        pendingParticipant: null,
        igrejaOptions: null,
        lastMessageId: payload.messageId,
      });
      await sendText(
        phone,
        `Envie os dados do Participante ${nextIndex}:\n\nNome: \nCPF: \nData de Nascimento (DD/MM/AAAA): \nGênero: \nDistrito: \nTelefone:`,
      );
      return;
    }

    await finalizeInscricao({
      supabase,
      phone,
      eventId: String(sessionPayload.eventId || ""),
      participantes,
      sessionId: session.id,
    });
    return;
  }

  if (session.state === "selecionar_distrito") {
    const options = Array.isArray(sessionPayload.distritoOptions)
      ? sessionPayload.distritoOptions
      : [];
    const choice = parseInt(messageText.replace(/\D/g, ""), 10);
    if (Number.isNaN(choice) || choice < 0 || choice > options.length) {
      await sendText(phone, "Opção inválida. Responda com o número do distrito.");
      return;
    }

    const participantes = Array.isArray(sessionPayload.participantes)
      ? sessionPayload.participantes
      : [];
    const pending = sessionPayload.pendingParticipant as any;
    if (!pending?.nome || !pending?.cpf) {
      await sendText(phone, "Dados do participante não encontrados. Envie novamente.");
      await updateSession(supabase, session.id, "coletar_participante", {
        ...sessionPayload,
        lastMessageId: payload.messageId,
      });
      return;
    }

    const selectedDistrito = choice === 0 ? null : options[choice - 1];
    const pendingWithDistrito = {
      ...pending,
      distritoId: selectedDistrito?.id || null,
      distrito: selectedDistrito?.nome || null,
    };

    const igrejas = await listIgrejas(supabase, 20, selectedDistrito?.id || null);
    if (igrejas.length === 0) {
      participantes.push({
        ...pendingWithDistrito,
        igrejaId: null,
        igreja: null,
      });
      const quantidade = Number(sessionPayload.quantidade || 0);
      const currentIndex = Number(sessionPayload.currentIndex || 1);
      const nextIndex = currentIndex + 1;

      if (nextIndex <= quantidade) {
        await updateSession(supabase, session.id, "coletar_participante", {
          ...sessionPayload,
          participantes,
          currentIndex: nextIndex,
          pendingParticipant: null,
          distritoOptions: null,
          igrejaOptions: null,
          lastMessageId: payload.messageId,
        });
        await sendText(
          phone,
          `Envie os dados do Participante ${nextIndex}:\n\nNome: \nCPF: \nData de Nascimento (DD/MM/AAAA): \nGênero: \nTelefone:`,
        );
        return;
      }

      await finalizeInscricao({
        supabase,
        phone,
        eventId: String(sessionPayload.eventId || ""),
        participantes,
        sessionId: session.id,
      });
      return;
    }

    await updateSession(supabase, session.id, "selecionar_igreja", {
      ...sessionPayload,
      participantes,
      pendingParticipant: pendingWithDistrito,
      igrejaOptions: igrejas,
      lastMessageId: payload.messageId,
    });
    const optionsText = igrejas
      .map((igreja: any, index: number) => `${index + 1}. ${igreja.nome}`)
      .join("\n");
    await sendText(
      phone,
      `Selecione a igreja do Participante ${Number(sessionPayload.currentIndex || 1)}:\n\n${optionsText}\n\nResponda apenas com o número. Se não aparecer, responda 0.`,
    );
    return;
  }

  if (session.state === "consulta_cpf") {
    const cpf = normalizeCpf(messageText);
    if (cpf.length !== 11) {
      await sendText(phone, "CPF inválido. Envie apenas os números (11 dígitos).");
      return;
    }

    const { data, error } = await supabase
      .from("participantes")
      .select("nome, cpf, inscricoes(status, created_at, evento_id), eventos(nome)")
      .eq("cpf", cpf)
      .limit(3);

    if (error) {
      logger.error("Erro na consulta CPF", { error: error.message });
      await sendText(phone, "Erro ao consultar inscrição.");
      return;
    }

    if (!data || data.length === 0) {
      await sendText(phone, "❌ Nenhuma inscrição encontrada para esse CPF.");
      await resetSession(supabase, session.id);
      return;
    }

    const resposta = data
      .map((item: any) => {
        const inscricao = item.inscricoes?.[0] || item.inscricoes;
        const evento = item.eventos?.nome || "Evento";
        const status = inscricao?.status || "PENDING";
        const dataInscricao = inscricao?.created_at
          ? new Date(inscricao.created_at).toLocaleDateString("pt-BR")
          : "-";
        return `✅ INSCRIÇÃO ENCONTRADA\nNome: ${item.nome}\nEvento: ${evento}\nStatus: ${status}\nData: ${dataInscricao}`;
      })
      .join("\n\n");

    await sendText(phone, resposta);
    await resetSession(supabase, session.id);
    return;
  }

  await sendText(phone, "Fluxo não reconhecido. Envie *Inscrição* para começar.");
  await updateSession(supabase, session.id, "idle", {
    lastMessageId: payload.messageId,
  });
}

async function handleWhatsappWebhook(req: Request) {
  const secretHeader =
    req.headers.get("WHATSAPP_WEBHOOK_SECRET") ||
    req.headers.get("whatsapp_webhook_secret") ||
    req.headers.get("x-whatsapp-webhook-secret");

  if (WHATSAPP_WEBHOOK_SECRET && secretHeader !== WHATSAPP_WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const message = extractMessagePayload(body);
  if (!message || !message.phone) {
    logger.warn("Webhook inválido", { body });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (message.fromMe) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await handleBotMessage({
    phone: message.phone,
    messageId: message.messageId,
    text: message.text || "",
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function generateReceiptPdf({
  eventoNome,
  inscritos,
  pagamentoId,
}: {
  eventoNome: string;
  inscritos: string[];
  pagamentoId: string;
}) {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let height = page.getSize().height;

  page.drawText("Comprovante de Pagamento", {
    x: 50,
    y: height - 60,
    size: 18,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText(`Evento: ${eventoNome}`, { x: 50, y: height - 90, size: 12, font });
  page.drawText(`Pagamento: ${pagamentoId}`, {
    x: 50,
    y: height - 110,
    size: 11,
    font,
  });

  let y = height - 150;
  page.drawText("Participantes:", { x: 50, y, size: 12, font });
  y -= 20;
  for (const nome of inscritos) {
    page.drawText(`- ${nome}`, { x: 60, y, size: 10, font });
    y -= 16;
    if (y < 50) {
      page = pdfDoc.addPage();
      height = page.getSize().height;
      y = height - 60;
      page.drawText("Participantes (continua):", { x: 50, y, size: 12, font });
      y -= 20;
    }
  }

  return await pdfDoc.save();
}

async function ensureStorageBucket(supabase: any, bucketName: string) {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  const exists = buckets?.some((b: any) => b.name === bucketName);
  if (!exists) {
    await supabase.storage.createBucket(bucketName, { public: true });
  }
}

async function handleMercadoPagoWebhook(req: Request) {
  const body = await req.json().catch(() => ({}));
  const query = new URL(req.url).searchParams;

  const signature = req.headers.get("x-signature") || "";
  const requestId = req.headers.get("x-request-id") || "";
  if (MERCADO_PAGO_WEBHOOK_SECRET && signature) {
    // Optional signature validation can be added here if needed
  }

  const paymentId =
    body?.data?.id || body?.id || query.get("id") || query.get("data.id");

  if (!paymentId) {
    logger.warn("Webhook MP sem paymentId", { body, requestId });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const paymentResponse = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      headers: { Authorization: `Bearer ${MERCADO_PAGO_TOKEN}` },
    },
  );
  if (!paymentResponse.ok) {
    const text = await paymentResponse.text();
    logger.error("Erro ao buscar pagamento", { paymentId, text });
    return new Response(JSON.stringify({ error: "Payment not found" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const paymentData = await paymentResponse.json();
  const status = paymentData.status;

  const supabase = getSupabaseAdmin();
  const { data: pagamento, error } = await supabase
    .from("pagamentos")
    .select("*, inscricoes(evento_id, whatsapp)")
    .eq("provider_payment_id", String(paymentId))
    .maybeSingle();

  if (error) {
    logger.error("Erro ao buscar pagamento no banco", { error: error.message });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!pagamento) {
    logger.warn("Pagamento não encontrado no banco", { paymentId });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (pagamento.status === "PAID") {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (status === "approved") {
    await supabase
      .from("pagamentos")
      .update({ status: "PAID", paid_at: new Date().toISOString() })
      .eq("id", pagamento.id);
    await supabase
      .from("inscricoes")
      .update({ status: "PAID" })
      .eq("id", pagamento.inscricao_id);

    const { data: participantes } = await supabase
      .from("participantes")
      .select("id, nome")
      .eq("inscricao_id", pagamento.inscricao_id);

    await updateInscritosStatusByParticipantes({
      supabase,
      participantIds: (participantes || []).map((p: any) => p.id),
      status: "PAID",
    });

    const { data: evento } = await supabase
      .from("eventos")
      .select("nome")
      .eq("id", pagamento.inscricoes?.evento_id)
      .maybeSingle();

    const pdfBytes = await generateReceiptPdf({
      eventoNome: evento?.nome || "Evento",
      inscritos: (participantes || []).map((p: any) => p.nome),
      pagamentoId: String(paymentId),
    });

    const bucketName = "comprovantes";
    await ensureStorageBucket(supabase, bucketName);
    const filePath = `${pagamento.inscricao_id}/comprovante-${paymentId}.pdf`;

    await supabase.storage.from(bucketName).upload(filePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    const { data: publicUrl } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    if (pagamento.inscricoes?.whatsapp) {
      const phone = pagamento.inscricoes.whatsapp;
      await sendText(phone, "🎉 Pagamento aprovado! Sua inscrição foi confirmada.");
      if (publicUrl?.publicUrl) {
        await sendText(phone, `Comprovante: ${publicUrl.publicUrl}`);
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleReports(req: Request, routeParts: string[]) {
  const supabase = getSupabaseAdmin();
  const eventId = routeParts[4];
  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "pdf";

  const { data: evento } = await supabase
    .from("eventos")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();
  const { data: participantes } = await supabase
    .from("participantes")
    .select("nome, cpf, inscricoes(status, created_at), igrejas(nome), distritos(nome)")
    .eq("evento_id", eventId);

  const { data: inscricoes } = await supabase
    .from("inscricoes")
    .select("status, total")
    .eq("evento_id", eventId);

  const totalInscritos = inscricoes?.length || 0;
  const totalPago = inscricoes?.filter((i: any) => i.status === "PAID").length || 0;
  const totalPendente =
    inscricoes?.filter((i: any) => i.status === "PENDING").length || 0;
  const totalArrecadado =
    inscricoes
      ?.filter((i: any) => i.status === "PAID")
      .reduce((sum: number, item: any) => sum + Number(item.total || 0), 0) || 0;

  const porIgreja = new Map<string, { total: number; pago: number }>();
  const porDistrito = new Map<string, number>();

  (participantes || []).forEach((p: any) => {
    const igrejaNome = p.igrejas?.nome || "Não informado";
    const distritoNome = p.distritos?.nome || "Não informado";
    const status = p.inscricoes?.[0]?.status || p.inscricoes?.status || "PENDING";

    if (!porIgreja.has(igrejaNome)) porIgreja.set(igrejaNome, { total: 0, pago: 0 });
    const igrejaData = porIgreja.get(igrejaNome)!;
    igrejaData.total += 1;
    if (status === "PAID") igrejaData.pago += 1;

    porDistrito.set(distritoNome, (porDistrito.get(distritoNome) || 0) + 1);
  });

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();

    const sheetParticipantes = XLSX.utils.json_to_sheet(
      (participantes || []).map((p: any) => ({
        Nome: p.nome,
        CPF: p.cpf,
        Igreja: p.igrejas?.nome || "-",
        Distrito: p.distritos?.nome || "-",
        Status: p.inscricoes?.[0]?.status || p.inscricoes?.status || "-",
        Data: p.inscricoes?.[0]?.created_at || p.inscricoes?.created_at || "-",
      })),
    );
    XLSX.utils.book_append_sheet(wb, sheetParticipantes, "Participantes");

    const sheetFinanceiro = XLSX.utils.json_to_sheet([
      {
        TotalInscritos: totalInscritos,
        TotalPago: totalPago,
        TotalPendente: totalPendente,
        TotalArrecadado: totalArrecadado,
      },
    ]);
    XLSX.utils.book_append_sheet(wb, sheetFinanceiro, "Financeiro");

    const sheetIgrejas = XLSX.utils.json_to_sheet(
      Array.from(porIgreja.entries()).map(([igreja, data]) => ({
        Igreja: igreja,
        Total: data.total,
        Pago: data.pago,
      })),
    );
    XLSX.utils.book_append_sheet(wb, sheetIgrejas, "Por Igreja");

    const sheetDistritos = XLSX.utils.json_to_sheet(
      Array.from(porDistrito.entries()).map(([distrito, total]) => ({
        Distrito: distrito,
        Total: total,
      })),
    );
    XLSX.utils.book_append_sheet(wb, sheetDistritos, "Por Distrito");

    const wbout = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    return new Response(wbout, {
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=relatorio-${eventId}.xlsx`,
      },
    });
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let page = pdfDoc.addPage();
  let height = page.getSize().height;

  let y = height - 50;
  page.drawText(`Relatório do Evento: ${evento?.nome || eventId}`, {
    x: 50,
    y,
    size: 14,
    font,
  });
  y -= 20;
  page.drawText(`Total inscritos: ${totalInscritos}`, { x: 50, y, size: 11, font });
  y -= 16;
  page.drawText(`Total pagos: ${totalPago}`, { x: 50, y, size: 11, font });
  y -= 16;
  page.drawText(`Total pendentes: ${totalPendente}`, { x: 50, y, size: 11, font });
  y -= 16;
  page.drawText(
    `Total arrecadado: R$ ${totalArrecadado.toFixed(2).replace(".", ",")}`,
    { x: 50, y, size: 11, font },
  );
  y -= 24;
  page.drawText("Participantes:", { x: 50, y, size: 12, font });
  y -= 16;

  (participantes || []).forEach((p: any) => {
    if (y < 60) {
      page = pdfDoc.addPage();
      height = page.getSize().height;
      y = height - 50;
    }
    const linha = `${p.nome} | CPF ${p.cpf} | ${
      p.igrejas?.nome || "-"
    } | ${p.distritos?.nome || "-"} | ${
      p.inscricoes?.[0]?.status || p.inscricoes?.status || "-"
    }`;
    page.drawText(linha, { x: 50, y, size: 9, font });
    y -= 12;
  });

  const pdfBytes = await pdfDoc.save();
  return new Response(pdfBytes, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=relatorio-${eventId}.pdf`,
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const pathMatch = (segment: string) => pathname.includes(segment);

    if (pathMatch("/whatsapp/webhook") && req.method === "POST") {
      return handleWhatsappWebhook(req);
    }

    if (
      pathMatch("/payments/mercadopago/webhook") &&
      req.method === "POST"
    ) {
      return handleMercadoPagoWebhook(req);
    }

    if (pathMatch("/admin/reports/event/") && req.method === "GET") {
      const parts = pathname.split("/");
      return handleReports(req, parts);
    }

    if (pathMatch("/public/event/") && req.method === "GET") {
      return handlePublicEvent(req);
    }

    if (pathMatch("/public/responsavel/") && req.method === "GET") {
      return handlePublicResponsavel(req);
    }

    if (pathMatch("/public/inscricoes") && req.method === "POST") {
      return handlePublicInscricao(req);
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("Unhandled error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
