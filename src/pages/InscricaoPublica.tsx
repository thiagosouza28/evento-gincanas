import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Calendar, Check, MapPin, Users } from "lucide-react";
import { formatCurrencyBR, maskCpf, maskPhone, stripNonDigits } from "@/lib/masks";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface EventoPublico {
  id: string;
  nome: string;
  data_inicio?: string | null;
  data_fim?: string | null;
  local?: string | null;
  status?: string | null;
  slug?: string | null;
}

interface Distrito {
  id: string;
  nome: string;
}

interface Igreja {
  id: string;
  nome: string;
  distrito_id?: string | null;
}

interface LoteInfo {
  id: string;
  nome: string;
  valor: number;
  inicio?: string | null;
  fim?: string | null;
}

interface ParticipanteForm {
  nome: string;
  cpf: string;
  nascimento: string;
  genero: string;
  distritoId: string;
  igrejaId: string;
}

interface PixResult {
  inscricao_id?: string;
  total: number;
  lote?: {
    id: string;
    nome: string;
    valor: number;
  };
  pix?: {
    copiaecola?: string | null;
    qrcode_base64?: string | null;
    payment_id?: string;
    expires_at?: string | null;
  };
}

const steps = [
  { id: 1, title: "CPF", subtitle: "Informe o CPF do pagador" },
  { id: 2, title: "Unidade", subtitle: "Escolha distrito e igreja" },
  { id: 3, title: "Participantes", subtitle: "Dados individuais" },
  { id: 4, title: "Revisao", subtitle: "Revise os dados" },
];

function normalizeCpf(raw: string) {
  return raw.replace(/\D/g, "");
}

function isValidCpf(raw: string) {
  const cpf = normalizeCpf(raw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const digits = cpf.split("").map(Number);
  const calc = (factor: number) => {
    let total = 0;
    for (let i = 0; i < factor - 1; i += 1) {
      total += digits[i] * (factor - i);
    }
    const rest = (total * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  const d1 = calc(10);
  const d2 = calc(11);
  return d1 === digits[9] && d2 === digits[10];
}
function formatDateRange(inicio?: string | null, fim?: string | null) {
  if (!inicio && !fim) return "";
  const start = inicio ? new Date(inicio) : null;
  const end = fim ? new Date(fim) : null;
  const format = (date: Date) =>
    date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  if (start && end) return `${format(start)} - ${format(end)}`;
  if (start) return format(start);
  if (end) return format(end);
  return "";
}

function daysUntil(date?: string | null) {
  if (!date) return null;
  const target = new Date(date).getTime();
  const now = new Date().getTime();
  const diff = target - now;
  if (diff <= 0) return null;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function InscricaoPublica() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [event, setEvent] = useState<EventoPublico | null>(null);
  const [lote, setLote] = useState<LoteInfo | null>(null);
  const [proximoLote, setProximoLote] = useState<LoteInfo | null>(null);
  const [distritos, setDistritos] = useState<Distrito[]>([]);
  const [igrejas, setIgrejas] = useState<Igreja[]>([]);

  const [step, setStep] = useState(1);
  const [responsavelCpf, setResponsavelCpf] = useState("");
  const [responsavelWhatsapp, setResponsavelWhatsapp] = useState("");
  const [whatsappTouched, setWhatsappTouched] = useState(false);
  const [distritoId, setDistritoId] = useState("");
  const [igrejaId, setIgrejaId] = useState("");
  const [responsavelInfo, setResponsavelInfo] = useState<{
    igrejaId: string;
    distritoId: string;
    igrejaNome: string;
    distritoNome: string;
    diretorTelefone?: string | null;
  } | null>(null);
  const [responsavelStatus, setResponsavelStatus] = useState<
    "idle" | "loading" | "found" | "not_found" | "error"
  >("idle");
  const [lockIgreja, setLockIgreja] = useState(false);
  const [quantidade, setQuantidade] = useState(1);
  const [participantes, setParticipantes] = useState<ParticipanteForm[]>([]);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pixResult, setPixResult] = useState<PixResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadEvent() {
      try {
        setLoading(true);
        setLoadError(null);
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/api/public/event/${slug}`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
            },
          },
        );
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Evento nao encontrado");
        }
        const data = await response.json();
        if (!isMounted) return;
        setEvent(data.event || null);
        setLote(data.lote || null);
        setProximoLote(data.proximo_lote || null);
        setDistritos(data.distritos || []);
        setIgrejas(data.igrejas || []);
        if (data.distritos?.length) {
          setDistritoId(data.distritos[0].id);
        }
      } catch (error) {
        if (!isMounted) return;
        setLoadError(error instanceof Error ? error.message : "Erro ao carregar");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (slug) {
      loadEvent();
    }

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const igrejasFiltradas = useMemo(() => {
    if (!distritoId) return igrejas;
    return igrejas.filter((igreja) => igreja.distrito_id === distritoId);
  }, [igrejas, distritoId]);

  useEffect(() => {
    if (!igrejaId && igrejasFiltradas.length > 0) {
      setIgrejaId(igrejasFiltradas[0].id);
    }
    if (igrejaId && igrejasFiltradas.length > 0) {
      const exists = igrejasFiltradas.some((igreja) => igreja.id === igrejaId);
      if (!exists) {
        setIgrejaId(igrejasFiltradas[0].id);
      }
    }
  }, [igrejasFiltradas, igrejaId]);

  useEffect(() => {
    const cpfDigits = stripNonDigits(responsavelCpf);
    if (cpfDigits.length !== 11) {
      setResponsavelStatus("idle");
      setResponsavelInfo(null);
      setLockIgreja(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setResponsavelStatus("loading");
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/api/public/responsavel/${cpfDigits}`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
            },
          },
        );
        if (!response.ok) {
          setResponsavelStatus("not_found");
          setResponsavelInfo(null);
          setLockIgreja(false);
          return;
        }
        const data = await response.json();
        if (!data?.igreja?.id) {
          setResponsavelStatus("not_found");
          setResponsavelInfo(null);
          setLockIgreja(false);
          return;
        }

        const igrejaData = data.igreja;
        const distritoData = data.distrito;
        const diretorTelefone = data.diretor?.telefone || null;
        setResponsavelInfo({
          igrejaId: igrejaData.id,
          distritoId: distritoData?.id || igrejaData.distrito_id || "",
          igrejaNome: igrejaData.nome,
          distritoNome: distritoData?.nome || "",
          diretorTelefone,
        });
        if (igrejaData.distrito_id) {
          setDistritoId(igrejaData.distrito_id);
        }
        setIgrejaId(igrejaData.id);
        setLockIgreja(true);
        setResponsavelStatus("found");
        if (!whatsappTouched && diretorTelefone) {
          setResponsavelWhatsapp(maskPhone(diretorTelefone));
        }
      } catch (error) {
        setResponsavelStatus("error");
        setResponsavelInfo(null);
        setLockIgreja(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [responsavelCpf, whatsappTouched]);

  const totalValue = (lote?.valor || 0) * quantidade;

  function updateParticipantes(count: number) {
    setParticipantes((prev) => {
      const next = [...prev];
      while (next.length < count) {
        next.push({
          nome: "",
          cpf: "",
          nascimento: "",
          genero: "",
          distritoId: distritoId || "",
          igrejaId: igrejaId || "",
        });
      }
      if (next.length > count) {
        next.length = count;
      }
      return next.map((p, index) => ({
        ...p,
        cpf: index === 0 && !p.cpf ? responsavelCpf : p.cpf,
        distritoId: distritoId || "",
        igrejaId: igrejaId || "",
      }));
    });
  }

  function handleNextFromCpf() {
    setStepError(null);
    if (!isValidCpf(responsavelCpf)) {
      setStepError("CPF invalido. Informe 11 digitos.");
      return;
    }
    const whatsappDigits = responsavelWhatsapp.replace(/\D/g, "");
    if (whatsappDigits.length < 10) {
      setStepError("Informe um WhatsApp valido com DDD.");
      return;
    }
    setStep(2);
  }

  function handleNextFromUnidade() {
    setStepError(null);
    if (!distritoId) {
      setStepError("Selecione o distrito.");
      return;
    }
    if (!igrejaId) {
      setStepError("Selecione a igreja.");
      return;
    }
    updateParticipantes(quantidade);
    setStep(3);
  }

  function handleNextFromParticipantes() {
    setStepError(null);
    if (participantes.length === 0) {
      setStepError("Informe os participantes.");
      return;
    }

    const cpfs = participantes.map((p) => normalizeCpf(p.cpf));
    if (cpfs.some((cpf) => !isValidCpf(cpf))) {
      setStepError("Existe CPF invalido. Verifique os participantes.");
      return;
    }

    const unique = new Set(cpfs);
    if (unique.size !== cpfs.length) {
      setStepError("Existem CPFs duplicados nos participantes.");
      return;
    }

    if (participantes.some((p) => !p.nome.trim())) {
      setStepError("Preencha o nome de todos os participantes.");
      return;
    }

    setStep(4);
  }

  function handleParticipanteChange(
    index: number,
    field: keyof ParticipanteForm,
    value: string,
  ) {
    setParticipantes((prev) =>
      prev.map((p, idx) => {
        if (idx !== index) return p;
        return { ...p, [field]: value };
      }),
    );
  }

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/api/public/inscricoes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
          body: JSON.stringify({
            eventSlug: slug,
            responsavelCpf: responsavelCpf,
            whatsapp: responsavelWhatsapp,
            igrejaId,
            distritoId,
            participantes: participantes.map((p) => ({
              nome: p.nome,
              cpf: p.cpf,
              nascimento: p.nascimento,
              genero: p.genero,
              distritoId,
              igrejaId,
            })),
          }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Erro ao gerar pagamento");
      }

      setPixResult(data as PixResult);
      setStep(5);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Erro ao gerar pagamento",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const distritoSelecionado =
    distritos.find((d) => d.id === distritoId)?.nome || "";
  const igrejaSelecionada = igrejas.find((i) => i.id === igrejaId)?.nome || "";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-600">
        Carregando evento...
      </div>
    );
  }

  if (loadError || !event) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-600">
        {loadError || "Evento nao encontrado."}
      </div>
    );
  }

  if (event.status && event.status !== "ativo") {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-600">
        Evento indisponivel no momento.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-500">
                {lote?.nome ? lote.nome : "Lote atual"}
              </span>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{event.nome}</h1>
                <p className="text-sm text-slate-500">{event.local || ""}</p>
              </div>
              <div className="flex flex-col gap-2 text-sm text-slate-600">
                {event.local ? (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <span>{event.local}</span>
                  </div>
                ) : null}
                {event.data_inicio || event.data_fim ? (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span>
                      {formatDateRange(event.data_inicio, event.data_fim)}
                    </span>
                  </div>
                ) : null}
                {proximoLote?.inicio ? (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span>
                      Proximo lote em {daysUntil(proximoLote.inicio) || "-"} dias
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Valor da inscricao
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrencyBR(lote?.valor || 0)}
              </p>
              {lote?.nome ? (
                <p className="text-xs text-slate-500">Lote vigente: {lote.nome}</p>
              ) : null}
              {lote?.fim ? (
                <p className="text-xs text-slate-400">
                  Encerramento em {daysUntil(lote.fim) || "-"} dias
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {step <= 4 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="relative">
              <div className="absolute left-0 right-0 top-5 h-px bg-slate-200" />
              <div className="relative grid grid-cols-2 gap-4 md:grid-cols-4">
                {steps.map((item) => {
                  const isCompleted = step > item.id;
                  const isCurrent = step === item.id;
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col items-center gap-2 text-center"
                    >
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                          isCompleted
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : isCurrent
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-slate-200 bg-white text-slate-400"
                        }`}
                      >
                        {isCompleted ? <Check className="h-4 w-4" /> : item.id}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-400">{item.subtitle}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Identificacao</h2>
            <p className="text-sm text-slate-500">
              Informe o CPF e o WhatsApp do responsavel financeiro pela inscricao.
            </p>
            <div className="mt-6 grid gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  CPF do Responsavel
                </label>
                <input
                  type="text"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="000.000.000-00"
                  value={responsavelCpf}
                  onChange={(event) => setResponsavelCpf(maskCpf(event.target.value))}
                />
                {responsavelStatus === "loading" ? (
                  <p className="mt-2 text-xs text-slate-400">Buscando responsavel...</p>
                ) : null}
                {responsavelStatus === "found" && responsavelInfo ? (
                  <p className="mt-2 text-xs text-emerald-600">
                    Igreja identificada: {responsavelInfo.igrejaNome}
                  </p>
                ) : null}
                {responsavelStatus === "not_found" ? (
                  <p className="mt-2 text-xs text-slate-400">
                    CPF não localizado. Prosseguindo com nova inscrição.
                  </p>
                ) : null}
                {responsavelStatus === "error" ? (
                  <p className="mt-2 text-xs text-red-500">
                    Não foi possível validar o CPF agora.
                  </p>
                ) : null}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">
                  WhatsApp do Responsavel
                </label>
                <input
                  type="text"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="(91) 99999-9999"
                  value={responsavelWhatsapp}
                  onChange={(event) => {
                    setWhatsappTouched(true);
                    setResponsavelWhatsapp(maskPhone(event.target.value));
                  }}
                />
              </div>
              {stepError ? (
                <p className="text-sm text-red-500">{stepError}</p>
              ) : null}
              <button
                type="button"
                className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                onClick={handleNextFromCpf}
              >
                Verificar CPF
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Selecione sua Unidade
            </h2>
            <p className="text-sm text-slate-500">Escolha o distrito e a igreja.</p>
            <div className="mt-6 grid gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Distrito</label>
                <select
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                  value={distritoId}
                  onChange={(event) => setDistritoId(event.target.value)}
                  disabled={lockIgreja}
                >
                  <option value="">Selecione</option>
                  {distritos.map((distrito) => (
                    <option key={distrito.id} value={distrito.id}>
                      {distrito.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Igreja</label>
                <select
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                  value={igrejaId}
                  onChange={(event) => setIgrejaId(event.target.value)}
                  disabled={lockIgreja}
                >
                  <option value="">Selecione</option>
                  {igrejasFiltradas.map((igreja) => (
                    <option key={igreja.id} value={igreja.id}>
                      {igreja.nome}
                    </option>
                  ))}
                </select>
                {lockIgreja ? (
                  <p className="mt-2 text-xs text-emerald-600">
                    Igreja vinculada ao responsavel. Alteracao bloqueada.
                  </p>
                ) : null}
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">Participantes</p>
                  <p className="text-xs text-slate-400">Numero de participantes</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="h-8 w-8 rounded-full border border-slate-200 text-slate-600"
                    onClick={() => setQuantidade((prev) => Math.max(1, prev - 1))}
                  >
                    -
                  </button>
                  <span className="text-sm font-semibold text-slate-700">
                    {quantidade}
                  </span>
                  <button
                    type="button"
                    className="h-8 w-8 rounded-full border border-slate-200 text-slate-600"
                    onClick={() => setQuantidade((prev) => Math.min(20, prev + 1))}
                  >
                    +
                  </button>
                </div>
              </div>
              {stepError ? (
                <p className="text-sm text-red-500">{stepError}</p>
              ) : null}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600"
                  onClick={() => setStep(1)}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  onClick={handleNextFromUnidade}
                >
                  Avancar
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Detalhes dos Participantes
            </h2>
            <p className="text-sm text-slate-500">
              Preencha as informacoes de quem ira ao evento.
            </p>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-xs uppercase text-slate-400">CPF Responsavel</p>
                  <p className="font-semibold text-slate-700">{responsavelCpf}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Distrito</p>
                  <p className="font-semibold text-slate-700">
                    {distritoSelecionado || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Igreja</p>
                  <p className="font-semibold text-slate-700">
                    {igrejaSelecionada || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Participantes</p>
                  <p className="font-semibold text-slate-700">{quantidade}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-6">
              {participantes.map((participante, index) => {
                return (
                  <div key={index} className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase text-slate-400">
                          Participante {index + 1}
                        </p>
                        <p className="text-sm font-semibold text-slate-700">
                          Dados individuais
                        </p>
                      </div>
                      {index === 0 ? (
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                          Principal
                        </span>
                      ) : null}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium text-slate-700">CPF</label>
                        <input
                          type="text"
                          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                          placeholder="000.000.000-00"
                          value={participante.cpf}
                          onChange={(event) =>
                            handleParticipanteChange(
                              index,
                              "cpf",
                              maskCpf(event.target.value),
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700">
                          Nome completo
                        </label>
                        <input
                          type="text"
                          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                          placeholder="Nome do participante"
                          value={participante.nome}
                          onChange={(event) =>
                            handleParticipanteChange(index, "nome", event.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700">
                          Data de nascimento
                        </label>
                        <input
                          type="date"
                          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                          value={participante.nascimento}
                          onChange={(event) =>
                            handleParticipanteChange(
                              index,
                              "nascimento",
                              event.target.value,
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700">
                          Genero
                        </label>
                        <select
                          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                          value={participante.genero}
                          onChange={(event) =>
                            handleParticipanteChange(index, "genero", event.target.value)
                          }
                        >
                          <option value="">Selecione</option>
                          <option value="Masculino">Masculino</option>
                          <option value="Feminino">Feminino</option>
                          <option value="Outro">Outro</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-xs text-slate-400">
                          Igreja vinculada: {igrejaSelecionada || "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {stepError ? (
              <p className="mt-4 text-sm text-red-500">{stepError}</p>
            ) : null}

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600"
                onClick={() => setStep(2)}
              >
                Voltar
              </button>
              <button
                type="button"
                className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                onClick={handleNextFromParticipantes}
              >
                Revisar inscricoes
              </button>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Revisao dos dados</h2>
            <p className="text-sm text-slate-500">
              Confira as informacoes antes do pagamento.
            </p>

            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase text-slate-400">Responsavel financeiro</p>
                <p className="text-sm font-semibold text-slate-700">
                  CPF: {responsavelCpf}
                </p>
                <p className="text-xs text-slate-500">
                  WhatsApp: {responsavelWhatsapp}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase text-slate-400">Unidade</p>
                <p className="text-sm font-semibold text-slate-700">
                  {distritoSelecionado}
                </p>
                <p className="text-xs text-slate-500">{igrejaSelecionada}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm font-semibold text-slate-700">Forma de pagamento</p>
                <div className="mt-3 flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      PIX (Mercado Pago)
                    </p>
                    <p className="text-xs text-slate-500">
                      Pagamento automatico via Pix
                    </p>
                  </div>
                  <div className="h-4 w-4 rounded-full border-4 border-blue-600 bg-white" />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm font-semibold text-slate-700">
                  Participantes ({participantes.length})
                </p>
                <div className="mt-3 space-y-3">
                  {participantes.map((p, index) => (
                    <div
                      key={`${p.cpf}-${index}`}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-700">{p.nome}</p>
                        <p className="text-xs text-slate-500">{p.genero || "-"}</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-700">
                        {formatCurrencyBR(lote?.valor || 0)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Inscricoes ({participantes.length}x)</span>
                  <span>{formatCurrencyBR(totalValue)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
                  <span>Taxas de processamento</span>
                  <span>Gratis</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-base font-semibold text-slate-900">
                  <span>Total a pagar</span>
                  <span>{formatCurrencyBR(totalValue)}</span>
                </div>
              </div>
            </div>

            {submitError ? (
              <p className="mt-4 text-sm text-red-500">{submitError}</p>
            ) : null}

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600"
                onClick={() => setStep(3)}
              >
                Voltar
              </button>
              <button
                type="button"
                className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? "Gerando..." : "Gerar pagamento"}
              </button>
            </div>
          </div>
        ) : null}

        {step === 5 && pixResult ? (
          <div className="flex flex-col gap-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Check className="h-6 w-6" />
              </div>
              <p className="mt-4 text-xs uppercase text-slate-400">
                Aguardando confirmacao
              </p>
              <h2 className="text-xl font-semibold text-slate-900">Pedido Gerado!</h2>
              <p className="text-sm text-slate-500">
                Estamos monitorando o Mercado Pago. Assim que o pagamento for aprovado,
                atualizaremos automaticamente.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs uppercase text-slate-400">Valor a pagar</p>
                <p className="text-xl font-semibold text-slate-900">
                  {formatCurrencyBR(pixResult.total || totalValue)}
                </p>
                {pixResult.pix?.qrcode_base64 ? (
                  <div className="mt-4 flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <img
                      src={`data:image/png;base64,${pixResult.pix.qrcode_base64}`}
                      alt="QR Code PIX"
                      className="h-48 w-48"
                    />
                  </div>
                ) : null}
                <p className="mt-4 text-xs text-slate-500">
                  Escaneie com o app do seu banco ou copie o codigo Pix abaixo.
                </p>
                <button
                  type="button"
                  className="mt-4 w-full rounded-xl border border-blue-200 bg-blue-50 py-2 text-sm font-semibold text-blue-700"
                  onClick={async () => {
                    if (!pixResult.pix?.copiaecola) return;
                    await navigator.clipboard.writeText(pixResult.pix.copiaecola);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? "Codigo copiado" : "Copiar Codigo PIX"}
                </button>
                {pixResult.pix?.copiaecola ? (
                  <textarea
                    className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"
                    rows={4}
                    readOnly
                    value={pixResult.pix.copiaecola}
                  />
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs uppercase text-slate-400">Detalhes do pedido</p>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>ID do pedido</span>
                    <span className="font-semibold text-slate-700">
                      {pixResult.inscricao_id || pixResult.pix?.payment_id || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Evento</span>
                    <span className="font-semibold text-slate-700">{event.nome}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Valor por inscricao</span>
                    <span className="font-semibold text-slate-700">
                      {formatCurrencyBR(lote?.valor || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Total</span>
                    <span className="font-semibold text-slate-700">
                      {formatCurrencyBR(pixResult.total || totalValue)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Lote vigente</span>
                    <span className="font-semibold text-slate-700">
                      {pixResult.lote?.nome || lote?.nome || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Forma de pagamento</span>
                    <span className="font-semibold text-slate-700">
                      PIX (Mercado Pago)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
