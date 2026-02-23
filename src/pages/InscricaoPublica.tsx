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
  formas_pagamento?: Array<"pix" | "manual">;
  seguro_valor?: number | null;
  seguro_obrigatorio?: boolean | null;
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
  pcd: boolean;
  autista: boolean;
  outraCondicao: boolean;
  outraDesc: string;
  necDesc: string;
  fichaTipo: "texto" | "arquivo";
  fichaConteudo: string;
  fichaArquivo: string;
  seguro: boolean;
  total: number;
}

interface PixResult {
  inscricao_id?: string;
  total: number;
  payment_provider?: string;
  payment_method?: "pix" | "manual";
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
  { id: 4, title: "Revisão", subtitle: "Revise os dados" },
];

const DEFAULT_SEGURO_ADICIONAL = 15;

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

function isEventoAtivo(status?: string | null) {
  return String(status || "").trim().toLowerCase() === "ativo";
}

function hasNecessidadesEspeciais(participante: Pick<ParticipanteForm, "pcd" | "autista" | "outraCondicao">) {
  return Boolean(participante.pcd || participante.autista || participante.outraCondicao);
}

function normalizeSeguroValor(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_SEGURO_ADICIONAL;
  }
  return Number(parsed.toFixed(2));
}

function calcSeguroAdicional(seguro: boolean, seguroValor: number) {
  return seguro ? seguroValor : 0;
}

function calcTotalParticipante(valorLote: number, seguro: boolean, seguroValor: number) {
  return valorLote + calcSeguroAdicional(seguro, seguroValor);
}

function normalizeStatusLabel(status?: string | null) {
  const upper = String(status || "").trim().toUpperCase();
  if (upper === "PAID") return "PAGO";
  if (upper === "CONFIRMED") return "CONFIRMADO";
  if (upper === "PENDING") return "PENDENTE";
  if (upper === "CANCELLED") return "CANCELADO";
  if (upper === "REFUNDED") return "ESTORNADO";
  return upper || "PENDENTE";
}

function gerarProtocolo() {
  const n = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `INS-${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

function formatDateValue(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function formatDateTimeValue(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR");
}

function desenharQR(protocolo: string, canvasId: string) {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = 88;
  canvas.height = 88;
  ctx.fillStyle = "#161920";
  ctx.fillRect(0, 0, 88, 88);

  let rng = protocolo.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const next = () => {
    rng = (rng * 1664525 + 1013904223) & 0xffffffff;
    return (rng >>> 0) / 0xffffffff;
  };

  const size = 4.8;
  ctx.fillStyle = "#e8ff47";

  [
    [0, 0],
    [7, 0],
    [0, 7],
  ].forEach(([gridX, gridY]) => {
    ctx.fillRect(gridX * size, gridY * size, size * 7, size * 7);
    ctx.fillStyle = "#161920";
    ctx.fillRect(gridX * size + size, gridY * size + size, size * 5, size * 5);
    ctx.fillStyle = "#e8ff47";
    ctx.fillRect(gridX * size + size * 2, gridY * size + size * 2, size * 3, size * 3);
  });

  ctx.fillStyle = "#e8ff47";
  for (let row = 0; row < 18; row += 1) {
    for (let col = 0; col < 18; col += 1) {
      const skip = (row < 8 && col < 8) || (row < 8 && col > 9) || (row > 9 && col < 8);
      if (!skip && next() > 0.48) {
        ctx.fillRect(col * size + 0.5, row * size + 0.5, size - 1, size - 1);
      }
    }
  }
}

export default function InscricaoPublica() {
  const { slug } = useParams();
  const testComprovanteMode = useMemo(() => {
    if (typeof window === "undefined") return false;
    const value = new URLSearchParams(window.location.search).get("testeComprovante");
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "sim";
  }, []);
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
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "manual">("pix");
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
  const [liveInscricaoStatus, setLiveInscricaoStatus] = useState<string | null>(null);
  const [livePagamentoStatus, setLivePagamentoStatus] = useState<string | null>(null);
  const [liveComprovanteUrl, setLiveComprovanteUrl] = useState<string | null>(null);
  const [liveStatusError, setLiveStatusError] = useState<string | null>(null);
  const [comprovanteProtocolo, setComprovanteProtocolo] = useState("");
  const [comprovanteGeradoEm, setComprovanteGeradoEm] = useState<string | null>(null);
  const [comprovanteParticipantes, setComprovanteParticipantes] = useState<ParticipanteForm[]>([]);

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
          throw new Error(text || "Evento não encontrado");
        }
        const data = await response.json();
        if (!isMounted) return;
        setEvent(data.event || null);
        setLote(data.lote || null);
        setProximoLote(data.proximo_lote || null);
        setDistritos(data.distritos || []);
        setIgrejas(data.igrejas || []);
        const formas = Array.isArray(data?.event?.formas_pagamento)
          ? (data.event.formas_pagamento as Array<"pix" | "manual">)
          : ["pix"];
        setPaymentMethod(formas[0] || "pix");
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

  const valorLoteAtual = Number(lote?.valor || 0);
  const seguroAdicionalValor = normalizeSeguroValor(event?.seguro_valor);
  const seguroObrigatorio = Boolean(event?.seguro_obrigatorio);

  const normalizeParticipante = (participante: ParticipanteForm): ParticipanteForm => {
    const hasNecessidade = hasNecessidadesEspeciais(participante);
    const seguroSelecionado = seguroObrigatorio ? true : Boolean(participante.seguro);
    const sanitized: ParticipanteForm = {
      ...participante,
      outraDesc: participante.outraCondicao ? participante.outraDesc : "",
      necDesc: hasNecessidade ? participante.necDesc : "",
      fichaTipo: participante.fichaTipo,
      fichaConteudo: participante.fichaTipo === "texto" ? participante.fichaConteudo : "",
      fichaArquivo: participante.fichaTipo === "arquivo" ? participante.fichaArquivo : "",
      seguro: seguroSelecionado,
      total: calcTotalParticipante(valorLoteAtual, seguroSelecionado, seguroAdicionalValor),
    };

    if (sanitized.fichaTipo === "texto") {
      sanitized.fichaArquivo = "";
    } else {
      sanitized.fichaConteudo = "";
    }

    return sanitized;
  };

  const participantesComSeguro = participantes.filter((participante) => Boolean(participante.seguro)).length;
  const totalSeguroParticipantes = participantes.reduce(
    (acc, participante) =>
      acc + calcSeguroAdicional(Boolean(participante.seguro), seguroAdicionalValor),
    0,
  );
  const totalValue = valorLoteAtual * participantes.length + totalSeguroParticipantes;
  const formasPagamentoDisponiveis = useMemo(() => {
    const formas = Array.isArray(event?.formas_pagamento) ? event.formas_pagamento : ["pix"];
    const normalized = formas.filter((forma) => forma === "pix" || forma === "manual");
    return normalized.length > 0 ? normalized : ["pix"];
  }, [event?.formas_pagamento]);

  useEffect(() => {
    if (!formasPagamentoDisponiveis.includes(paymentMethod)) {
      setPaymentMethod(formasPagamentoDisponiveis[0] || "pix");
    }
  }, [formasPagamentoDisponiveis, paymentMethod]);

  useEffect(() => {
    if (!testComprovanteMode || !event || !lote || step === 5) return;

    const cpfMock = maskCpf("52998224725");
    const agora = new Date().toISOString();
    const distritoMock = distritos[0]?.id || "";
    const igrejaMock = igrejas.find((igreja) => igreja.distrito_id === distritoMock)?.id || igrejas[0]?.id || "";
    const participanteBase: ParticipanteForm = {
      nome: "Participante Teste",
      cpf: cpfMock,
      nascimento: "2001-06-15",
      genero: "Masculino",
      distritoId: distritoMock,
      igrejaId: igrejaMock,
      pcd: false,
      autista: false,
      outraCondicao: false,
      outraDesc: "",
      necDesc: "",
      fichaTipo: "texto",
      fichaConteudo: "",
      fichaArquivo: "",
      seguro: true,
      total: calcTotalParticipante(valorLoteAtual, true, seguroAdicionalValor),
    };

    const participantesMock = [normalizeParticipante(participanteBase)];
    const totalMock = participantesMock.reduce((acc, participante) => acc + participante.total, 0);

    setResponsavelCpf(cpfMock);
    setResponsavelWhatsapp(maskPhone("91988887777"));
    setDistritoId(distritoMock);
    setIgrejaId(igrejaMock);
    setQuantidade(participantesMock.length);
    setParticipantes(participantesMock);

    setPixResult({
      inscricao_id: `TESTE-${Date.now()}`,
      total: totalMock,
      payment_method: "pix",
      lote: {
        id: lote.id,
        nome: lote.nome,
        valor: Number(lote.valor || 0),
      },
      pix: {
        copiaecola:
          "00020126580014BR.GOV.BCB.PIX0136TESTE-COMPROVANTE-INSCRICAO520400005303986540551.005802BR5920SISTEMA GINCANAS6008BELEM62070503***6304ABCD",
        qrcode_base64: null,
        payment_id: `PIX-TESTE-${Date.now()}`,
      },
    });

    setLiveInscricaoStatus("CONFIRMED");
    setLivePagamentoStatus("PAID");
    setLiveComprovanteUrl(null);
    setLiveStatusError(null);
    setComprovanteParticipantes(participantesMock);
    setComprovanteProtocolo(gerarProtocolo());
    setComprovanteGeradoEm(agora);
    setStep(5);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [
    testComprovanteMode,
    event,
    lote,
    step,
    distritos,
    igrejas,
    seguroAdicionalValor,
    seguroObrigatorio,
    valorLoteAtual,
  ]);

  useEffect(() => {
    setParticipantes((prev) =>
      prev.map((participante) =>
        normalizeParticipante({
          ...participante,
          seguro: seguroObrigatorio ? true : participante.seguro,
        }),
      ),
    );
  }, [seguroAdicionalValor, seguroObrigatorio, valorLoteAtual]);

  function updateParticipantes(count: number) {
    setParticipantes((prev) => {
      const next = [...prev];
      while (next.length < count) {
        next.push(
          normalizeParticipante({
            nome: "",
            cpf: "",
            nascimento: "",
            genero: "",
            distritoId: distritoId || "",
            igrejaId: igrejaId || "",
            pcd: false,
            autista: false,
            outraCondicao: false,
            outraDesc: "",
            necDesc: "",
            fichaTipo: "texto",
            fichaConteudo: "",
            fichaArquivo: "",
            seguro: seguroObrigatorio,
            total: calcTotalParticipante(valorLoteAtual, seguroObrigatorio, seguroAdicionalValor),
          }),
        );
      }
      if (next.length > count) {
        next.length = count;
      }
      return next.map((p, index) =>
        normalizeParticipante({
          ...p,
          cpf: index === 0 && !p.cpf ? responsavelCpf : p.cpf,
          distritoId: distritoId || "",
          igrejaId: igrejaId || "",
          pcd: p.pcd ?? false,
          autista: p.autista ?? false,
          outraCondicao: p.outraCondicao ?? false,
          outraDesc: p.outraDesc ?? "",
          necDesc: p.necDesc ?? "",
          fichaTipo: p.fichaTipo ?? "texto",
          fichaConteudo: p.fichaConteudo ?? "",
          fichaArquivo: p.fichaArquivo ?? "",
          seguro: seguroObrigatorio ? true : p.seguro ?? false,
          total: calcTotalParticipante(
            valorLoteAtual,
            seguroObrigatorio ? true : p.seguro ?? false,
            seguroAdicionalValor,
          ),
        }),
      );
    });
  }

  function handleNextFromCpf() {
    setStepError(null);
    if (!isValidCpf(responsavelCpf)) {
      setStepError("CPF inválido. Informe 11 dígitos.");
      return;
    }
    if (responsavelStatus === "loading") {
      setStepError("Aguarde a validação do CPF no banco.");
      return;
    }
    if (responsavelStatus !== "found" || !responsavelInfo) {
      setStepError(
        "CPF não vinculado a uma igreja. Cadastre o Diretor Jovem no cadastro de igrejas para continuar.",
      );
      return;
    }
    if (!responsavelInfo.igrejaId || !responsavelInfo.distritoId) {
      setStepError(
        "Cadastro da igreja incompleto para este Diretor Jovem. Verifique distrito e igreja no painel admin.",
      );
      return;
    }
    const whatsappDigits = responsavelWhatsapp.replace(/\D/g, "");
    if (whatsappDigits.length < 10) {
      setStepError("Informe um WhatsApp válido com DDD.");
      return;
    }
    setDistritoId(responsavelInfo.distritoId);
    setIgrejaId(responsavelInfo.igrejaId);
    setLockIgreja(true);
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

  function getParticipantesValidationError() {
    if (participantes.length === 0) {
      return "Informe os participantes.";
    }

    const cpfs = participantes.map((p) => normalizeCpf(p.cpf));
    if (cpfs.some((cpf) => !isValidCpf(cpf))) {
      return "Existe CPF inválido. Verifique os participantes.";
    }

    const unique = new Set(cpfs);
    if (unique.size !== cpfs.length) {
      return "Existem CPFs duplicados nos participantes.";
    }

    if (participantes.some((p) => !p.nome.trim())) {
      return "Preencha o nome de todos os participantes.";
    }

    for (let index = 0; index < participantes.length; index += 1) {
      const participante = participantes[index];
      const hasNecessidade = hasNecessidadesEspeciais(participante);
      const label = `Participante ${index + 1}`;

      if (participante.outraCondicao && !participante.outraDesc.trim()) {
        return `${label}: Descreva a outra condi��o`;
      }

      if (hasNecessidade && !participante.necDesc.trim()) {
        return `${label}: Descreva as necessidades de suporte`;
      }

      if (hasNecessidade) {
        const fichaTextoValida =
          participante.fichaTipo === "texto" && participante.fichaConteudo.trim().length > 0;
        const fichaArquivoValida =
          participante.fichaTipo === "arquivo" && participante.fichaArquivo.trim().length > 0;

        if (!fichaTextoValida && !fichaArquivoValida) {
          return `${label}: Ficha m�dica obrigat�ria para participantes com necessidades especiais`;
        }
      }
    }

    return null;
  }

  function handleNextFromParticipantes() {
    setStepError(null);
    const error = getParticipantesValidationError();
    if (error) {
      setStepError(error);
      return;
    }
    setStep(4);
  }

  function handleParticipanteChange(
    index: number,
    field: keyof ParticipanteForm,
    value: string | boolean,
  ) {
    setParticipantes((prev) =>
      prev.map((p, idx) => {
        if (idx !== index) return p;
        const updated = {
          ...p,
          [field]: value,
        } as ParticipanteForm;
        return normalizeParticipante(updated);
      }),
    );
  }

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const participantesValidationError = getParticipantesValidationError();
      if (participantesValidationError) {
        setSubmitError(participantesValidationError);
        setSubmitting(false);
        return;
      }

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
            paymentMethod,
            igrejaId,
            distritoId,
            participantes: participantes.map((p) => {
              const seguroSelecionado = seguroObrigatorio ? true : Boolean(p.seguro);
              return {
                nome: p.nome,
                cpf: p.cpf,
                nascimento: p.nascimento,
                genero: p.genero,
                distritoId,
                igrejaId,
                pcd: p.pcd,
                autista: p.autista,
                outraCondicao: p.outraCondicao,
                outraDesc: p.outraCondicao ? p.outraDesc.trim() || null : null,
                necDesc: hasNecessidadesEspeciais(p) ? p.necDesc.trim() || null : null,
                fichaTipo: p.fichaTipo,
                fichaConteudo: p.fichaTipo === "texto" ? p.fichaConteudo.trim() || null : null,
                fichaArquivo: p.fichaTipo === "arquivo" ? p.fichaArquivo.trim() || null : null,
                seguro: seguroSelecionado,
                total: calcTotalParticipante(valorLoteAtual, seguroSelecionado, seguroAdicionalValor),
              };
            }),
          }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Erro ao gerar pagamento");
      }

      setPixResult(data as PixResult);
      setComprovanteProtocolo(gerarProtocolo());
      setComprovanteGeradoEm(new Date().toISOString());
      setComprovanteParticipantes(participantes.map((participante) => normalizeParticipante({ ...participante })));
      setLiveInscricaoStatus("PENDING");
      setLivePagamentoStatus("PENDING");
      setLiveComprovanteUrl(null);
      setLiveStatusError(null);
      setStep(5);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Erro ao gerar pagamento",
      );
    } finally {
      setSubmitting(false);
    }
  }
  useEffect(() => {
    if (step !== 5 || !pixResult?.inscricao_id) return;
    if (testComprovanteMode || pixResult.inscricao_id.startsWith("TESTE-")) return;

    let active = true;

    const pollStatus = async () => {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/api/public/inscricoes/${pixResult.inscricao_id}/status`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
            },
          },
        );

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || 'Erro ao consultar status do pagamento');
        }

        const payload = await response.json();
        if (!active) return;

        setLiveInscricaoStatus(payload?.inscricao?.status || null);
        setLivePagamentoStatus(payload?.pagamento?.status || null);
        setLiveComprovanteUrl(payload?.pagamento?.comprovante_url || null);
        setLiveStatusError(null);
      } catch (error) {
        if (!active) return;
        setLiveStatusError(error instanceof Error ? error.message : 'Erro ao consultar status');
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 10000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [step, pixResult?.inscricao_id, testComprovanteMode]);

  useEffect(() => {
    if (step !== 5 || !comprovanteProtocolo) return;
    desenharQR(comprovanteProtocolo, "receipt-qr-canvas");
  }, [step, comprovanteProtocolo]);

  const distritoSelecionado =
    distritos.find((d) => d.id === distritoId)?.nome || "";
  const igrejaSelecionada = igrejas.find((i) => i.id === igrejaId)?.nome || "";
  const isManualPayment = pixResult?.payment_method === "manual";
  const livePagamentoLabel = normalizeStatusLabel(livePagamentoStatus);
  const liveInscricaoLabel = normalizeStatusLabel(liveInscricaoStatus);
  const pagamentoConfirmado = livePagamentoStatus === "PAID" || liveInscricaoStatus === "CONFIRMED";
  const pagamentoCancelado = livePagamentoStatus === "CANCELLED" || livePagamentoStatus === "REFUNDED";
  const participantesNoComprovante =
    comprovanteParticipantes.length > 0 ? comprovanteParticipantes : participantes;
  const participantesComNecessidades = participantesNoComprovante.filter((participante) => {
    const hasNecessidadeBase =
      participante.pcd || participante.autista || participante.outraCondicao;
    return hasNecessidadeBase || Boolean(participante.necDesc?.trim());
  });
  const exibirSecaoNecessidades = participantesComNecessidades.length > 0;
  const participantesComFicha = participantesNoComprovante.filter((participante) => {
    if (participante.fichaTipo === "texto") return Boolean(participante.fichaConteudo.trim());
    return Boolean(participante.fichaArquivo.trim());
  });
  const exibirSecaoFicha = participantesComFicha.length > 0;
  const totalSeguroComprovante = participantesNoComprovante.reduce(
    (acc, participante) => acc + (participante.seguro ? seguroAdicionalValor : 0),
    0,
  );
  const participantesComSeguroComprovante = participantesNoComprovante.filter(
    (participante) => participante.seguro,
  ).length;
  const valorBaseComprovante =
    Number(pixResult?.lote?.valor ?? lote?.valor ?? valorLoteAtual) || 0;
  const totalBaseComprovante = valorBaseComprovante * participantesNoComprovante.length;
  const totalComprovante = Number(
    pixResult?.total ??
      (totalBaseComprovante + totalSeguroComprovante),
  );
  const protocoloComprovante = comprovanteProtocolo || "INS-00000000-000000";
  const comprovanteDataHora = comprovanteGeradoEm || new Date().toISOString();

  function handleNovaInscricao() {
    setStep(1);
    setResponsavelCpf("");
    setResponsavelWhatsapp("");
    setWhatsappTouched(false);
    setResponsavelInfo(null);
    setResponsavelStatus("idle");
    setLockIgreja(false);
    setQuantidade(1);
    setParticipantes([]);
    setStepError(null);
    setSubmitError(null);
    setPixResult(null);
    setCopied(false);
    setLiveInscricaoStatus(null);
    setLivePagamentoStatus(null);
    setLiveComprovanteUrl(null);
    setLiveStatusError(null);
    setComprovanteProtocolo("");
    setComprovanteGeradoEm(null);
    setComprovanteParticipantes([]);
    setDistritoId(distritos[0]?.id || "");
    setIgrejaId("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-muted-foreground">
        Carregando evento...
      </div>
    );
  }

  if (loadError || !event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-muted-foreground">
        {loadError || "Evento nao encontrado."}
      </div>
    );
  }

  if (!isEventoAtivo(event.status)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-muted-foreground">
        Evento indisponivel no momento.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="page-shell flex w-full flex-col gap-6">
        <header className="card">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <span className="tag inline-flex items-center">
                {lote?.nome ? lote.nome : "Lote atual"}
              </span>
              <div>
                <h1>{event.nome}</h1>
                <p>{event.local || ""}</p>
              </div>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                {event.local ? (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{event.local}</span>
                  </div>
                ) : null}
                {event.data_inicio || event.data_fim ? (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {formatDateRange(event.data_inicio, event.data_fim)}
                    </span>
                  </div>
                ) : null}
                {proximoLote?.inicio ? (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Proximo lote em {daysUntil(proximoLote.inicio) || "-"} dias
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="text-left md:text-right">
              <p className="text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">
                Valor da inscricao
              </p>
              <p className="font-display text-[2rem] font-extrabold tracking-[-0.02em] text-accent">
                {formatCurrencyBR(lote?.valor || 0)}
              </p>
              {lote?.nome ? (
                <p className="text-xs text-muted-foreground">Lote vigente: {lote.nome}</p>
              ) : null}
              {lote?.fim ? (
                <p className="text-xs text-muted-deep">
                  Encerramento em {daysUntil(lote.fim) || "-"} dias
                </p>
              ) : null}
            </div>
          </div>
        </header>

        <div id="tela-form" className={step === 5 ? "hidden" : ""}>
          {step <= 4 ? (
            <div className="card p-6">
              <div className="relative">
                <div className="absolute left-0 right-0 top-5 h-px bg-border" />
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
                          className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                            isCompleted
                              ? "border-success bg-success text-[#0d0f14]"
                              : isCurrent
                                ? "border-accent bg-accent text-[#0d0f14]"
                                : "border-border bg-surface2 text-muted-foreground"
                          }`}
                        >
                          {isCompleted ? <Check className="h-4 w-4" /> : item.id}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {item.title}
                          </p>
                          <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

        {step === 1 ? (
          <div className="card">
            <p className="card-eyebrow">Passo 1</p>
            <h2 className="card-title text-[1.35rem] tracking-[-0.01em]">
              Identificacao
            </h2>
            <p className="card-desc mb-6 text-[0.88rem] leading-[1.55]">
              Informe o CPF e o WhatsApp do Diretor Jovem responsavel pela inscricao.
            </p>
            <div className="grid gap-4">
              <div className="field">
                <label>CPF do Responsavel</label>
                <input
                  type="text"
                  className="w-full"
                  placeholder="000.000.000-00"
                  value={responsavelCpf}
                  onChange={(event) => setResponsavelCpf(maskCpf(event.target.value))}
                />
                {responsavelStatus === "loading" ? (
                  <p className="text-xs text-muted-foreground">Buscando responsavel...</p>
                ) : null}
                {responsavelStatus === "found" && responsavelInfo ? (
                  <p className="text-xs text-success">
                    Igreja identificada: {responsavelInfo.igrejaNome}
                  </p>
                ) : null}
                {responsavelStatus === "not_found" ? (
                  <p className="text-xs text-warning">
                    CPF nao localizado no cadastro de diretor jovem. Faca o cadastro da igreja antes de inscrever.
                  </p>
                ) : null}
                {responsavelStatus === "error" ? (
                  <p className="text-xs text-danger">
                    Nao foi possivel validar o CPF agora.
                  </p>
                ) : null}
              </div>
              <div className="field">
                <label>WhatsApp do Responsavel</label>
                <input
                  type="text"
                  className="w-full"
                  placeholder="(91) 99999-9999"
                  value={responsavelWhatsapp}
                  onChange={(event) => {
                    setWhatsappTouched(true);
                    setResponsavelWhatsapp(maskPhone(event.target.value));
                  }}
                />
              </div>
              <div className={`alert alert-err ${stepError ? "show" : ""}`}>
                {stepError}
              </div>
              <button
                type="button"
                className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleNextFromCpf}
                disabled={responsavelStatus === "loading"}
              >
                Verificar CPF
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="card">
            <p className="card-eyebrow">Passo 2</p>
            <h2 className="card-title text-[1.35rem] tracking-[-0.01em]">
              Selecione sua Unidade
            </h2>
            <p className="card-desc mb-6 text-[0.88rem] leading-[1.55]">
              Escolha o distrito e a igreja.
            </p>
            <div className="grid gap-4">
              <div className="field">
                <label>Distrito</label>
                <select
                  className="w-full"
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
              <div className="field">
                <label>Igreja</label>
                <select
                  className="w-full"
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
                  <p className="text-xs text-success">
                    Igreja vinculada ao responsavel. Alteracao bloqueada.
                  </p>
                ) : null}
              </div>
              <div className="flex items-center justify-between rounded-[10px] border-[1.5px] border-border bg-surface2 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Participantes</p>
                  <p className="text-xs text-muted-foreground">Numero de participantes</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-border2 hover:text-foreground"
                    onClick={() => setQuantidade((prev) => Math.max(1, prev - 1))}
                  >
                    -
                  </button>
                  <span className="font-display text-base font-bold text-accent">
                    {quantidade}
                  </span>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-border2 hover:text-foreground"
                    onClick={() => setQuantidade((prev) => Math.min(20, prev + 1))}
                  >
                    +
                  </button>
                </div>
              </div>
              <div className={`alert alert-err ${stepError ? "show" : ""}`}>
                {stepError}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setStep(1)}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleNextFromUnidade}
                >
                  Avancar
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="card">
            <p className="card-eyebrow">Passo 3</p>
            <h2 className="card-title text-[1.35rem] tracking-[-0.01em]">
              Detalhes dos Participantes
            </h2>
            <p className="card-desc mb-6 text-[0.88rem] leading-[1.55]">
              Preencha as informacoes de quem ira ao evento.
            </p>

            <div className="rounded-[10px] border border-border bg-surface2 px-4 py-3 text-sm text-muted-foreground">
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-deep">
                    CPF Responsavel
                  </p>
                  <p className="font-semibold text-foreground">{responsavelCpf}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-deep">
                    Distrito
                  </p>
                  <p className="font-semibold text-foreground">
                    {distritoSelecionado || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-deep">
                    Igreja
                  </p>
                  <p className="font-semibold text-foreground">
                    {igrejaSelecionada || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-deep">
                    Participantes
                  </p>
                  <p className="font-semibold text-foreground">{quantidade}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-4">
              {participantes.map((participante, index) => {
                return (
                  <div key={index} className="rounded-[11px] border border-border bg-surface p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-accent">
                          Participante {index + 1}
                        </p>
                        <p className="text-sm font-semibold text-foreground">
                          Dados individuais
                        </p>
                      </div>
                      {index === 0 ? (
                        <span className="tag-pill pill-blue">Principal</span>
                      ) : null}
                    </div>
                    <div className="grid-2">
                      <div className="field">
                        <label>CPF</label>
                        <input
                          type="text"
                          className="w-full"
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
                      <div className="field">
                        <label>Nome completo</label>
                        <input
                          type="text"
                          className="w-full"
                          placeholder="Nome do participante"
                          value={participante.nome}
                          onChange={(event) =>
                            handleParticipanteChange(index, "nome", event.target.value)
                          }
                        />
                      </div>
                      <div className="field">
                        <label>Data de nascimento</label>
                        <input
                          type="date"
                          className="w-full"
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
                      <div className="field">
                        <label>Genero</label>
                        <select
                          className="w-full"
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
                    </div>
                    <div className="mt-4">
                      <p className="sect-title mb-3 pb-2">Necessidades especiais</p>
                      <div className="grid gap-2">
                        <label className={`check-card ${participante.pcd ? "active" : ""}`}>
                          <input
                            type="checkbox"
                            checked={participante.pcd}
                            onChange={(event) =>
                              handleParticipanteChange(index, "pcd", event.target.checked)
                            }
                          />
                          <div className="chk" />
                          <div className="chk-body">
                            <div className="chk-label">PCD - Pessoa com Deficiencia</div>
                          </div>
                        </label>
                        <label className={`check-card ${participante.autista ? "active" : ""}`}>
                          <input
                            type="checkbox"
                            checked={participante.autista}
                            onChange={(event) =>
                              handleParticipanteChange(index, "autista", event.target.checked)
                            }
                          />
                          <div className="chk" />
                          <div className="chk-body">
                            <div className="chk-label">Autista (TEA)</div>
                          </div>
                        </label>
                        <label
                          className={`check-card ${participante.outraCondicao ? "active" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={participante.outraCondicao}
                            onChange={(event) =>
                              handleParticipanteChange(
                                index,
                                "outraCondicao",
                                event.target.checked,
                              )
                            }
                          />
                          <div className="chk" />
                          <div className="chk-body">
                            <div className="chk-label">Outra condicao</div>
                          </div>
                        </label>
                      </div>
                    </div>
                    {participante.outraCondicao ? (
                      <div className="field mt-4">
                        <label>Qual condicao?</label>
                        <input
                          type="text"
                          className="w-full"
                          placeholder="Descreva brevemente"
                          value={participante.outraDesc}
                          onChange={(event) =>
                            handleParticipanteChange(index, "outraDesc", event.target.value)
                          }
                        />
                      </div>
                    ) : null}
                    {hasNecessidadesEspeciais(participante) ? (
                      <div className="field mt-4">
                        <label>Necessidades de suporte</label>
                        <textarea
                          className="w-full"
                          rows={3}
                          placeholder="Ex: cadeira de rodas, int�rprete, sala silenciosa..."
                          value={participante.necDesc}
                          onChange={(event) =>
                            handleParticipanteChange(index, "necDesc", event.target.value)
                          }
                        />
                      </div>
                    ) : null}
                    <div className="mt-4">
                      <p className="sect-title mb-3 pb-2">Ficha medica</p>
                      <div className="grid gap-2">
                        <label
                          className={`check-card ${participante.fichaTipo === "texto" ? "active" : ""}`}
                        >
                          <input
                            type="radio"
                            name={`ficha-tipo-${index}`}
                            checked={participante.fichaTipo === "texto"}
                            onChange={() =>
                              handleParticipanteChange(index, "fichaTipo", "texto")
                            }
                          />
                          <div className="chk radio" />
                          <div className="chk-body">
                            <div className="chk-label">Descrever ficha medica</div>
                          </div>
                        </label>
                        <label
                          className={`check-card ${participante.fichaTipo === "arquivo" ? "active" : ""}`}
                        >
                          <input
                            type="radio"
                            name={`ficha-tipo-${index}`}
                            checked={participante.fichaTipo === "arquivo"}
                            onChange={() =>
                              handleParticipanteChange(index, "fichaTipo", "arquivo")
                            }
                          />
                          <div className="chk radio" />
                          <div className="chk-body">
                            <div className="chk-label">Anexar nome do arquivo da ficha</div>
                          </div>
                        </label>
                      </div>
                      {participante.fichaTipo === "texto" ? (
                        <div className="field mt-4">
                          <label>Ficha medica (texto)</label>
                          <textarea
                            className="w-full"
                            rows={4}
                            placeholder="Descreva informa��es m�dicas relevantes"
                            value={participante.fichaConteudo}
                            onChange={(event) =>
                              handleParticipanteChange(
                                index,
                                "fichaConteudo",
                                event.target.value,
                              )
                            }
                          />
                        </div>
                      ) : (
                        <div className="field mt-4">
                          <label>Ficha medica (arquivo)</label>
                          <input
                            type="file"
                            className="w-full"
                            onChange={(event) =>
                              handleParticipanteChange(
                                index,
                                "fichaArquivo",
                                event.target.files?.[0]?.name || "",
                              )
                            }
                          />
                          {participante.fichaArquivo ? (
                            <p className="text-xs text-muted-foreground">
                              Arquivo selecionado: {participante.fichaArquivo}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>
                    <div className="mt-4 rounded-[10px] border border-border bg-surface2 p-3">
                      <label className={`check-card ${participante.seguro ? "active" : ""}`}>
                        <input
                          type="checkbox"
                          checked={participante.seguro}
                          disabled={seguroObrigatorio}
                          onChange={(event) =>
                            handleParticipanteChange(index, "seguro", event.target.checked)
                          }
                        />
                        <div className="chk" />
                        <div className="chk-body">
                          <div className="chk-label">
                            {seguroObrigatorio
                              ? "Seguro de vida obrigat�rio"
                              : "Adicionar seguro de vida"}
                          </div>
                          <div className="chk-desc">
                            {seguroObrigatorio
                              ? "Este evento exige seguro para todos os participantes."
                              : `Adicional de ${formatCurrencyBR(seguroAdicionalValor)} por participante.`}
                          </div>
                        </div>
                      </label>
                      <div className="mt-3 flex items-center justify-between rounded-[10px] border border-border bg-surface px-3 py-2">
                        <div>
                          <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                            Total do participante
                          </p>
                          <p className="text-xs text-muted-deep">
                            {participante.seguro
                              ? `Base ${formatCurrencyBR(valorLoteAtual)} + Seguro ${formatCurrencyBR(seguroAdicionalValor)}`
                              : `Base ${formatCurrencyBR(valorLoteAtual)}`}
                          </p>
                        </div>
                        <p className="font-display text-[1.5rem] font-extrabold tracking-[-0.02em] text-accent">
                          {formatCurrencyBR(
                            calcTotalParticipante(
                              valorLoteAtual,
                              participante.seguro,
                              seguroAdicionalValor,
                            ),
                          )}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Igreja vinculada: {igrejaSelecionada || "-"}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className={`alert alert-err mt-4 ${stepError ? "show" : ""}`}>
              {stepError}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setStep(2)}
              >
                Voltar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleNextFromParticipantes}
              >
                Revisar inscricoes
              </button>
            </div>
          </div>
        ) : null}

          {step === 4 ? (
          <div className="card">
            <p className="card-eyebrow">Passo 4</p>
            <h2 className="card-title text-[1.35rem] tracking-[-0.01em]">
              Revisao dos dados
            </h2>
            <p className="card-desc mb-6 text-[0.88rem] leading-[1.55]">
              Confira as informacoes antes do pagamento.
            </p>

            <div className="space-y-4">
              <div className="rounded-[10px] border border-border bg-surface2 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-deep">
                  Responsavel financeiro
                </p>
                <p className="text-sm font-semibold text-foreground">
                  CPF: {responsavelCpf}
                </p>
                <p className="text-xs text-muted-foreground">
                  WhatsApp: {responsavelWhatsapp}
                </p>
              </div>
              <div className="rounded-[10px] border border-border bg-surface2 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-deep">
                  Unidade
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {distritoSelecionado}
                </p>
                <p className="text-xs text-muted-foreground">{igrejaSelecionada}</p>
              </div>
              <div className="rounded-[10px] border border-border bg-surface px-4 py-3">
                <p className="sect-title mb-3 pb-2">Forma de pagamento</p>
                <div className="space-y-2">
                  {formasPagamentoDisponiveis.map((forma) => {
                    const checked = paymentMethod === forma;
                    return (
                      <label key={forma} className={`check-card ${checked ? "active" : ""}`}>
                        <input
                          type="radio"
                          name="payment_method"
                          checked={checked}
                          onChange={() => setPaymentMethod(forma)}
                        />
                        <div className="chk radio" />
                        <div className="chk-body">
                          <div className="chk-label">
                            {forma === "pix" ? "PIX (Mercado Pago)" : "Pagamento manual"}
                          </div>
                          <div className="chk-desc">
                            {forma === "pix"
                              ? "Pagamento automatico via Pix"
                              : "Pagamento fora do sistema (presencial/organizacao)."}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-[10px] border border-border bg-surface px-4 py-3">
                <p className="sect-title mb-3 pb-2">
                  Participantes ({participantes.length})
                </p>
                <div className="flex flex-col gap-3">
                  {participantes.map((p, index) => {
                    const hasNecessidade = hasNecessidadesEspeciais(p);
                    return (
                      <div key={`${p.cpf}-${index}`} className="list-card py-2">
                        <div className="min-w-0 flex-1">
                          <p className="item-title truncate">{p.nome}</p>
                          <p className="item-meta">{p.genero || "-"}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {p.pcd ? <span className="tag-pill pill-blue">PCD</span> : null}
                            {p.autista ? (
                              <span className="tag-pill pill-purple">Autista</span>
                            ) : null}
                            {p.outraCondicao ? (
                              <span className="tag-pill pill-warn">Outra condicao</span>
                            ) : null}
                            <span
                              className={`tag-pill ${p.seguro ? "pill-success" : "pill-warn"}`}
                            >
                              {p.seguro ? "Seguro" : "Sem seguro"}
                            </span>
                          </div>
                          {hasNecessidade ? (
                            <p className="item-meta mt-2">
                              Suporte: {p.necDesc || "Nao informado"}
                            </p>
                          ) : null}
                          {hasNecessidade ? (
                            <p className="item-meta">
                              Ficha medica:{" "}
                              {p.fichaTipo === "texto"
                                ? p.fichaConteudo || "Nao informado"
                                : p.fichaArquivo || "Nao informado"}
                            </p>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <p className="item-value text-[1.05rem]">
                            {formatCurrencyBR(
                              calcTotalParticipante(
                                valorLoteAtual,
                                Boolean(p.seguro),
                                seguroAdicionalValor,
                              ),
                            )}
                          </p>
                          <p className="item-meta">
                            {p.seguro
                              ? `Lote ${formatCurrencyBR(valorLoteAtual)} + Seguro ${formatCurrencyBR(seguroAdicionalValor)}`
                              : `Lote ${formatCurrencyBR(valorLoteAtual)}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="total-box flex-wrap">
                <div>
                  <p className="total-label">Adicional de seguro</p>
                  <p className="total-breakdown">
                    {participantesComSeguro > 0
                      ? `Seguro ${formatCurrencyBR(seguroAdicionalValor)} x ${participantesComSeguro}`
                      : "Nenhum participante com seguro"}
                  </p>
                </div>
                <p className="total-amount">{formatCurrencyBR(totalSeguroParticipantes)}</p>
              </div>
              <div className="total-box flex-wrap">
                <div>
                  <p className="total-label">Total a pagar</p>
                  <p className="total-breakdown">
                    Lote {formatCurrencyBR(valorLoteAtual)} x {participantes.length}
                    {participantesComSeguro > 0
                      ? ` + Seguro ${formatCurrencyBR(seguroAdicionalValor)} x ${participantesComSeguro}`
                      : ""}
                  </p>
                </div>
                <p className="total-amount">{formatCurrencyBR(totalValue)}</p>
              </div>
            </div>

            <div className={`alert alert-err mt-4 ${submitError ? "show" : ""}`}>
              {submitError}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setStep(3)}
              >
                Voltar
              </button>
              <button
                type="button"
                className="btn btn-success disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? "Gerando..." : "Gerar pagamento"}
              </button>
            </div>
          </div>
          ) : null}
        </div>

        {step === 5 && pixResult ? (
          <div id="tela-comprovante" className="flex flex-col gap-6">
            <section className="inscricao-success">
              <div className="inscricao-success-icon" aria-hidden="true">
                <span>✓</span>
              </div>
              <h2 className="inscricao-success-title">
                Inscricao <span>confirmada!</span>
              </h2>
              <p className="inscricao-success-subtitle">
                Seu comprovante foi gerado abaixo · Protocolo unico emitido
              </p>
            </section>

            <div id="comprovante-wrapper">
              <article className="receipt">
                <div className="receipt-head">
                  <div>
                    <p className="receipt-head-overline">Comprovante Oficial</p>
                    <h3 className="receipt-head-title">Inscricao de Participante</h3>
                  </div>
                  <div className="receipt-head-protocol">
                    <p className="receipt-head-label">Protocolo</p>
                    <span className="receipt-head-number">{protocoloComprovante}</span>
                  </div>
                </div>

                <div className="receipt-status">
                  <span className="receipt-status-dot">●</span>
                  Inscricao confirmada
                </div>

                <div className="receipt-body">
                  <section className="receipt-section">
                    <h4 className="receipt-section-title">Dados do participante</h4>
                    <div className="receipt-stack">
                      {participantesNoComprovante.map((participante, index) => (
                        <div key={`${participante.cpf}-${index}`} className="receipt-participant">
                          {participantesNoComprovante.length > 1 ? (
                            <p className="receipt-participant-title">Participante {index + 1}</p>
                          ) : null}
                          <div className="receipt-grid">
                            <div className="receipt-field">
                              <p className="receipt-field-label">Nome completo</p>
                              <p className="receipt-field-value">{participante.nome || "—"}</p>
                            </div>
                            <div className="receipt-field">
                              <p className="receipt-field-label">CPF</p>
                              <p className="receipt-field-value">{participante.cpf || "—"}</p>
                            </div>
                            <div className="receipt-field">
                              <p className="receipt-field-label">Data nasc.</p>
                              <p className="receipt-field-value">
                                {formatDateValue(participante.nascimento)}
                              </p>
                            </div>
                            <div className="receipt-field">
                              <p className="receipt-field-label">E-mail</p>
                              <p className="receipt-field-value">—</p>
                            </div>
                            <div className="receipt-field">
                              <p className="receipt-field-label">Genero</p>
                              <p className="receipt-field-value">
                                {participante.genero || "Nao informado"}
                              </p>
                            </div>
                            <div className="receipt-field">
                              <p className="receipt-field-label">Data / hora</p>
                              <p className="receipt-field-value">
                                {formatDateTimeValue(comprovanteDataHora)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {exibirSecaoNecessidades ? (
                    <section className="receipt-section">
                      <h4 className="receipt-section-title">Necessidades especiais</h4>
                      <div className="receipt-stack">
                        {participantesComNecessidades.map((participante, index) => (
                          <div key={`needs-${participante.cpf}-${index}`} className="receipt-participant">
                            {participantesNoComprovante.length > 1 ? (
                              <p className="receipt-participant-title">
                                {participante.nome || `Participante ${index + 1}`}
                              </p>
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                              {participante.pcd ? (
                                <span className="tag-pill pill-blue">PCD</span>
                              ) : null}
                              {participante.autista ? (
                                <span className="tag-pill pill-purple">Autista (TEA)</span>
                              ) : null}
                              {participante.outraCondicao ? (
                                <span className="tag-pill pill-warn">
                                  {participante.outraDesc.trim() || "Outra condicao"}
                                </span>
                              ) : null}
                              {participante.seguro ? (
                                <span className="tag-pill pill-accent">Seguro de vida</span>
                              ) : null}
                            </div>
                            {participante.necDesc?.trim() ? (
                              <div className="receipt-field">
                                <p className="receipt-field-label">Suporte solicitado</p>
                                <p className="receipt-field-value">{participante.necDesc}</p>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {exibirSecaoFicha ? (
                    <section className="receipt-section">
                      <h4 className="receipt-section-title">Ficha medica</h4>
                      <div className="receipt-stack">
                        {participantesComFicha.map((participante, index) => (
                          <div key={`ficha-${participante.cpf}-${index}`} className="receipt-participant">
                            {participantesNoComprovante.length > 1 ? (
                              <p className="receipt-participant-title">
                                {participante.nome || `Participante ${index + 1}`}
                              </p>
                            ) : null}
                            <div className="receipt-grid">
                              <div className="receipt-field">
                                <p className="receipt-field-label">Tipo de registro</p>
                                <p className="receipt-field-value">
                                  {participante.fichaTipo === "texto"
                                    ? "Ficha de texto"
                                    : "Arquivo anexado"}
                                </p>
                              </div>
                              <div className="receipt-field">
                                <p className="receipt-field-label">Conteudo</p>
                                <p className="receipt-field-value">
                                  {participante.fichaTipo === "texto"
                                    ? participante.fichaConteudo
                                    : `📄 ${participante.fichaArquivo}`}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  <hr className="divider" />

                  <section className="receipt-section">
                    <h4 className="receipt-section-title">Resumo financeiro</h4>
                    <div className="receipt-breakdown-row">
                      <span>Inscricao (base)</span>
                      <strong>{formatCurrencyBR(totalBaseComprovante)}</strong>
                    </div>
                    {participantesComSeguroComprovante > 0 ? (
                      <div className="receipt-breakdown-row">
                        <span>Seguro de vida</span>
                        <strong className="text-accent">
                          + {formatCurrencyBR(totalSeguroComprovante)}
                        </strong>
                      </div>
                    ) : null}

                    <div className="receipt-total-box">
                      <div>
                        <p className="receipt-total-label">Total pago</p>
                        <p className="receipt-total-subtext">
                          {participantesComSeguroComprovante > 0
                            ? "Inscricao + Seguro de vida"
                            : "Apenas inscricao"}
                        </p>
                      </div>
                      <p className="receipt-total-value">{formatCurrencyBR(totalComprovante)}</p>
                    </div>
                  </section>

                  <hr className="divider" />

                  <section className="receipt-section">
                    <div className="receipt-verification">
                      <canvas
                        id="receipt-qr-canvas"
                        className="receipt-qr-canvas"
                        aria-label="Codigo de verificacao"
                      />
                      <div className="receipt-verification-copy">
                        <h4 className="receipt-section-title !mb-2">Verificacao</h4>
                        <p className="receipt-verify-text">
                          Apresente este comprovante na entrada do evento.
                        </p>
                        <p className="receipt-verify-text">
                          Protocolo: <strong>{protocoloComprovante}</strong>
                        </p>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="receipt-foot">
                  Gerado em {formatDateTimeValue(comprovanteDataHora)} · Sistema de Inscricoes ·
                  Dados armazenados localmente
                </div>
              </article>
            </div>

            <div className="no-print receipt-actions">
              <button type="button" className="btn btn-outline" onClick={handleNovaInscricao}>
                Nova inscricao
              </button>
              <button
                type="button"
                className="btn btn-primary receipt-print-btn"
                onClick={() => window.print()}
              >
                Imprimir comprovante
              </button>
            </div>

            <div className="no-print grid gap-6 md:grid-cols-2">
              <div className="card p-6">
                <p className="sect-title">Status do pedido</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className={`tag-pill ${
                      pagamentoConfirmado
                        ? "pill-success"
                        : pagamentoCancelado
                          ? "pill-warn"
                          : "pill-accent"
                    }`}
                  >
                    Pagamento: {livePagamentoLabel}
                  </span>
                  <span
                    className={`tag-pill ${
                      liveInscricaoStatus === "CONFIRMED"
                        ? "pill-success"
                        : liveInscricaoStatus === "CANCELLED"
                          ? "pill-warn"
                          : "pill-blue"
                    }`}
                  >
                    Inscricao: {liveInscricaoLabel}
                  </span>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {isManualPayment
                    ? "Inscricao registrada com pagamento manual. Siga as orientacoes da organizacao."
                    : pagamentoConfirmado
                      ? "Pagamento aprovado automaticamente. Sua inscricao foi confirmada."
                      : "Aguardando confirmacao do Mercado Pago."}
                </p>
                {liveStatusError ? (
                  <div className="alert alert-err show mt-4 text-left">{liveStatusError}</div>
                ) : null}
                {liveComprovanteUrl ? (
                  <a
                    href={liveComprovanteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline mt-4 inline-flex"
                  >
                    Baixar comprovante oficial
                  </a>
                ) : null}
              </div>

              <div className="card p-6">
                <div className="total-box">
                  <div>
                    <p className="total-label">Valor a pagar</p>
                    <p className="total-breakdown">Pedido #{pixResult.inscricao_id || "-"}</p>
                  </div>
                  <p className="font-display text-3xl font-extrabold tracking-[-0.02em] text-accent">
                    {formatCurrencyBR(totalComprovante)}
                  </p>
                </div>
                {!isManualPayment && pixResult.pix?.qrcode_base64 ? (
                  <div className="mt-4 flex items-center justify-center rounded-[11px] border border-border bg-surface2 p-4">
                    <img
                      src={`data:image/png;base64,${pixResult.pix.qrcode_base64}`}
                      alt="QR Code PIX"
                      className="h-48 w-48"
                    />
                  </div>
                ) : null}
                {isManualPayment ? (
                  <p className="mt-4 text-xs text-muted-foreground">
                    Pagamento manual selecionado para este pedido.
                  </p>
                ) : (
                  <p className="mt-4 text-xs text-muted-foreground">
                    Escaneie com o app do seu banco ou copie o codigo Pix abaixo.
                  </p>
                )}
                {!isManualPayment ? (
                  <button
                    type="button"
                    className="btn btn-primary mt-4 w-full"
                    onClick={async () => {
                      if (!pixResult.pix?.copiaecola) return;
                      await navigator.clipboard.writeText(pixResult.pix.copiaecola);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? "Codigo copiado" : "Copiar codigo PIX"}
                  </button>
                ) : null}
                {!isManualPayment && pixResult.pix?.copiaecola ? (
                  <textarea
                    className="mt-3 w-full text-xs leading-relaxed"
                    rows={4}
                    readOnly
                    value={pixResult.pix.copiaecola}
                  />
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

