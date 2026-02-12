import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Inscrito, EquipeComParticipantes, Equipe, Gincana, Pontuacao } from '@/types';
import type { Torneio, Confronto } from '@/types/torneio';

// Helper to convert hex color to RGB array
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [34, 197, 94]; // Default green if invalid
}

// Helper to darken a color
function darkenColor(rgb: [number, number, number], factor: number = 0.7): [number, number, number] {
  return [
    Math.round(rgb[0] * factor),
    Math.round(rgb[1] * factor),
    Math.round(rgb[2] * factor)
  ];
}

// Helper to lighten a color for backgrounds
function lightenColor(rgb: [number, number, number], factor: number = 0.15): [number, number, number] {
  return [
    Math.round(255 - (255 - rgb[0]) * factor),
    Math.round(255 - (255 - rgb[1]) * factor),
    Math.round(255 - (255 - rgb[2]) * factor)
  ];
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const fallbackTeamColors = [
  '#22c55e',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#a855f7',
  '#06b6d4',
  '#f97316',
  '#10b981',
];

function getEquipeColorHex(equipe: Equipe, fallbackIndex: number = 0) {
  if (equipe.corPulseira) return equipe.corPulseira;
  if (typeof equipe.cor === 'number') {
    return fallbackTeamColors[(equipe.cor - 1) % fallbackTeamColors.length];
  }
  return fallbackTeamColors[fallbackIndex % fallbackTeamColors.length];
}

// Helper to load image as base64
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error loading image:', error);
    return null;
  }
}

// Cache for loaded images
const imageCache = new Map<string, string>();
const PAGE_MARGIN = 20; // 2cm
const HEADER_HEIGHT = 12;
const FOOTER_HEIGHT = 8;
const HEADER_GAP = 4;
const FOOTER_GAP = 4;
const DEFAULT_FOOTER_TEXT = 'Documento gerado pelo sistema';
const COLORS = {
  text: [30, 41, 59] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  line: [226, 232, 240] as [number, number, number],
  soft: [248, 250, 252] as [number, number, number],
};

type PdfBranding = {
  eventName?: string;
  subtitle?: string;
  logoUrl?: string;
  footerText?: string;
};

type ResolvedBranding = {
  eventName?: string;
  subtitle?: string;
  logoBase64?: string | null;
  footerText?: string;
};

async function resolveBranding(branding?: PdfBranding): Promise<ResolvedBranding> {
  if (!branding) return {};
  const logoBase64 = branding.logoUrl ? await getImageBase64(branding.logoUrl) : null;
  return {
    eventName: branding.eventName,
    subtitle: branding.subtitle,
    logoBase64,
    footerText: branding.footerText,
  };
}

type StandardLayout = {
  pageWidth: number;
  pageHeight: number;
  contentTop: number;
  contentBottom: number;
  tableMargin: { left: number; right: number; top: number; bottom: number };
};

type StandardHeaderOptions = {
  title: string;
  subtitle?: string;
  dateText: string;
  logoBase64?: string | null;
  titleRgb?: [number, number, number];
  lineRgb?: [number, number, number];
};

function getStandardLayout(doc: jsPDF): StandardLayout {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentTop = PAGE_MARGIN + HEADER_HEIGHT + HEADER_GAP;
  const contentBottom = pageHeight - PAGE_MARGIN - FOOTER_HEIGHT - FOOTER_GAP;
  return {
    pageWidth,
    pageHeight,
    contentTop,
    contentBottom,
    tableMargin: {
      left: PAGE_MARGIN,
      right: PAGE_MARGIN,
      top: contentTop,
      bottom: pageHeight - contentBottom,
    },
  };
}

function drawStandardHeader(doc: jsPDF, layout: StandardLayout, header: StandardHeaderOptions) {
  const headerY = PAGE_MARGIN;
  const logoSize = 10;
  const logoGap = 4;
  const leftX = PAGE_MARGIN;
  let titleStartX = leftX;

  if (header.logoBase64) {
    try {
      const format = header.logoBase64.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(header.logoBase64, format, leftX, headerY, logoSize, logoSize);
      titleStartX = leftX + logoSize + logoGap;
    } catch (error) {
      // ignore logo errors
    }
  }

  const dateText = header.dateText;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const dateWidth = Math.max(28, doc.getTextWidth(dateText));

  const availableLeft = titleStartX;
  const availableRight = layout.pageWidth - PAGE_MARGIN - dateWidth;
  const maxTitleWidth = Math.max(40, availableRight - availableLeft - 4);
  const titleCenterX = (availableLeft + availableRight) / 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const title = fitTextToWidth(doc, header.title, maxTitleWidth);
  doc.setTextColor(...(header.titleRgb || COLORS.text));
  doc.text(title, titleCenterX, headerY + 6, { align: 'center' });

  if (header.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    const subtitle = fitTextToWidth(doc, header.subtitle, maxTitleWidth);
    doc.text(subtitle, titleCenterX, headerY + 11, { align: 'center' });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
  doc.text(dateText, layout.pageWidth - PAGE_MARGIN, headerY + 6, { align: 'right' });

  doc.setDrawColor(...(header.lineRgb || COLORS.line));
  doc.setLineWidth(0.6);
  doc.line(PAGE_MARGIN, headerY + HEADER_HEIGHT, layout.pageWidth - PAGE_MARGIN, headerY + HEADER_HEIGHT);
}

function drawStandardFooter(
  doc: jsPDF,
  layout: StandardLayout,
  footerText: string,
  pageNumber: number
) {
  const footerY = layout.pageHeight - PAGE_MARGIN - FOOTER_HEIGHT;
  doc.setDrawColor(COLORS.line[0], COLORS.line[1], COLORS.line[2]);
  doc.setLineWidth(0.3);
  doc.line(PAGE_MARGIN, footerY, layout.pageWidth - PAGE_MARGIN, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
  const pageLabel = `Página ${pageNumber}`;
  const pageLabelWidth = doc.getTextWidth(pageLabel);
  const maxFooterWidth = Math.max(30, layout.pageWidth - PAGE_MARGIN * 2 - pageLabelWidth - 4);
  const footerSafeText = fitTextToWidth(doc, footerText, maxFooterWidth);
  doc.text(footerSafeText, PAGE_MARGIN, footerY + 6);
  doc.text(pageLabel, layout.pageWidth - PAGE_MARGIN, footerY + 6, { align: 'right' });
}

function applyStandardTemplate(
  doc: jsPDF,
  layout: StandardLayout,
  header: StandardHeaderOptions,
  footerText: string
) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawStandardHeader(doc, layout, header);
    drawStandardFooter(doc, layout, footerText, i);
  }
}

function applyAccentBarToPages(doc: jsPDF, layout: StandardLayout, accentRgb?: [number, number, number]) {
  if (!accentRgb) return;
  const pageCount = doc.getNumberOfPages();
  const barX = PAGE_MARGIN - 6;
  const barWidth = 3;
  const barHeight = layout.contentBottom - layout.contentTop;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
    doc.rect(barX, layout.contentTop, barWidth, barHeight, 'F');
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function measureMaxTextWidth(doc: jsPDF, values: Array<string | number>, fontSize: number): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  let maxWidth = 0;
  values.forEach((value) => {
    const text = String(value ?? '');
    maxWidth = Math.max(maxWidth, doc.getTextWidth(text));
  });
  return maxWidth;
}

function distributeWidths(
  columns: Array<{ key: string; min: number; max: number; desired: number }>,
  availableWidth: number
): Record<string, number> {
  const widths = columns.map((column) => clamp(column.desired, column.min, column.max));
  const minSum = columns.reduce((sum, column) => sum + column.min, 0);
  let total = widths.reduce((sum, width) => sum + width, 0);

  if (availableWidth <= minSum) {
    return columns.reduce((acc, column) => {
      acc[column.key] = column.min;
      return acc;
    }, {} as Record<string, number>);
  }

  if (total > availableWidth) {
    const reducible = columns.map((column, index) => Math.max(0, widths[index] - column.min));
    const reducibleTotal = reducible.reduce((sum, value) => sum + value, 0);
    const reduceBy = total - availableWidth;
    const result = columns.reduce((acc, column, index) => {
      if (reducibleTotal === 0) {
        acc[column.key] = column.min;
      } else {
        acc[column.key] = widths[index] - (reduceBy * (reducible[index] / reducibleTotal));
      }
      return acc;
    }, {} as Record<string, number>);
    return result;
  }

  if (total < availableWidth) {
    const growable = columns.map((column, index) => Math.max(0, column.max - widths[index]));
    const growableTotal = growable.reduce((sum, value) => sum + value, 0);
    const addBy = Math.min(availableWidth - total, growableTotal);
    const result = columns.reduce((acc, column, index) => {
      if (growableTotal === 0) {
        acc[column.key] = widths[index];
      } else {
        acc[column.key] = widths[index] + (addBy * (growable[index] / growableTotal));
      }
      return acc;
    }, {} as Record<string, number>);
    return result;
  }

  return columns.reduce((acc, column, index) => {
    acc[column.key] = widths[index];
    return acc;
  }, {} as Record<string, number>);
}

function getFooterText(branding?: ResolvedBranding): string {
  return branding?.footerText || DEFAULT_FOOTER_TEXT;
}

function formatDateTime(date: Date = new Date()): string {
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fitTextToWidth(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 1 && doc.getTextWidth(`${trimmed}...`) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}...`;
}

function drawSectionTitle(
  doc: jsPDF,
  title: string,
  y: number,
  accentRgb: [number, number, number] = [34, 197, 94]
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
  doc.text(title, PAGE_MARGIN, y);
  doc.setDrawColor(accentRgb[0], accentRgb[1], accentRgb[2]);
  doc.setLineWidth(1);
  doc.line(PAGE_MARGIN, y + 2, PAGE_MARGIN + 28, y + 2);
  doc.setDrawColor(COLORS.line[0], COLORS.line[1], COLORS.line[2]);
  doc.setLineWidth(0.2);
  doc.line(PAGE_MARGIN, y + 4, pageWidth - PAGE_MARGIN, y + 4);
  return y + 8;
}

async function getImageBase64(url: string): Promise<string | null> {
  if (!url) return null;
  
  if (imageCache.has(url)) {
    return imageCache.get(url)!;
  }
  
  const base64 = await loadImageAsBase64(url);
  if (base64) {
    imageCache.set(url, base64);
  }
  return base64;
}

function drawTeamHeader(
  doc: jsPDF, 
  equipe: EquipeComParticipantes, 
  participantesCount: number,
  startY: number = 0,
  imageBase64?: string | null
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const teamColor = equipe.corPulseira || '#22c55e';
  const rgb = hexToRgb(teamColor);
  
  const headerHeight = 28;
  const infoHeight = 22;
  const hasImage = !!imageBase64;
  const imageSize = 20;
  const imageX = PAGE_MARGIN;
  const imageY = startY + (headerHeight - imageSize) / 2;
  const textStartX = hasImage ? imageX + imageSize + 6 : PAGE_MARGIN;
  
  // Top colored bar
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  doc.rect(0, startY, pageWidth, headerHeight, 'F');
  
  // Participant count badge
  const peopleLabel = participantesCount === 1 ? 'pessoa' : 'pessoas';
  const badgeText = `${participantesCount} ${peopleLabel}`;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const badgePaddingX = 6;
  const badgeHeight = 12;
  const badgeWidth = doc.getTextWidth(badgeText) + badgePaddingX * 2;
  const badgeX = pageWidth - PAGE_MARGIN - badgeWidth;
  const badgeY = startY + 8;
  
  // Team image (if available)
  if (hasImage && imageBase64) {
    try {
      // White circular background for image
      doc.setFillColor(255, 255, 255);
      doc.circle(imageX + imageSize / 2, startY + headerHeight / 2, imageSize / 2 + 1, 'F');
      
      // Add the image
      doc.addImage(imageBase64, 'JPEG', imageX, imageY, imageSize, imageSize);
    } catch (e) {
      console.error('Error adding image to PDF:', e);
    }
  }
  
  // Team name on colored bar
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  const maxTitleWidth = pageWidth - textStartX - badgeWidth - 12;
  const teamTitle = fitTextToWidth(doc, equipe.nome.toUpperCase(), Math.max(60, maxTitleWidth));
  doc.text(teamTitle, textStartX, startY + 18);
  
  // Badge
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 3, 3, 'F');
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  doc.setFontSize(10);
  doc.text(badgeText, badgeX + badgeWidth / 2, badgeY + 8.5, { align: 'center' });
  
  // Info section with light background
  const lightBg = lightenColor(rgb, 0.12);
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.rect(0, startY + headerHeight, pageWidth, infoHeight, 'F');
  
  // Team details
  const infoY = startY + headerHeight + 14;
  doc.setFontSize(9);
  doc.setTextColor(70, 70, 70);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Equipe Nº:', PAGE_MARGIN, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(String(equipe.numero ?? '-'), PAGE_MARGIN + 26, infoY);
  
  const leaderLabelX = 64;
  doc.setFont('helvetica', 'bold');
  doc.text('Líder:', leaderLabelX, infoY);
  doc.setFont('helvetica', 'normal');
  const leaderText = fitTextToWidth(doc, equipe.lider || '-', 45);
  doc.text(leaderText, leaderLabelX + 16, infoY);
  
  const viceLabelX = 124;
  doc.setFont('helvetica', 'bold');
  doc.text('Vice:', viceLabelX, infoY);
  doc.setFont('helvetica', 'normal');
  const viceText = fitTextToWidth(doc, equipe.vice || '-', 35);
  doc.text(viceText, viceLabelX + 14, infoY);
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  doc.text(`Pontuação: ${equipe.pontuacaoTotal} pts`, pageWidth - PAGE_MARGIN, infoY, { align: 'right' });
  
  return startY + headerHeight + infoHeight + 8; // Return the Y position after header
}

async function drawParticipantsTable(
  doc: jsPDF,
  participantes: Array<Inscrito & { cpf?: string; funcao?: string }>,
  equipe: EquipeComParticipantes,
  startY: number,
  layout: StandardLayout,
  accentRgb?: [number, number, number]
) {
  const teamColor = equipe.corPulseira || '#22c55e';
  const rgb = hexToRgb(teamColor);
  const darkRgb = darkenColor(rgb, 0.8);
  const tableStartY = drawSectionTitle(doc, 'Participantes', startY, rgb) + 2;
  const margin = layout.tableMargin;

  const drawAccentBar = () => {
    if (!accentRgb) return;
    const barX = PAGE_MARGIN - 6;
    const barWidth = 3;
    const barHeight = layout.contentBottom - layout.contentTop;
    doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
    doc.rect(barX, layout.contentTop, barWidth, barHeight, 'F');
  };

  drawAccentBar();

  if (participantes.length > 0) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const tableWidth = pageWidth - PAGE_MARGIN * 2;
    const fontSize = 9;
    const padding = 6;

    const fixedWidths = {
      numero: 14,
      cpf: 34,
      funcao: 30,
    };
    const fixedSum = Object.values(fixedWidths).reduce((sum, value) => sum + value, 0);
    const availableWidth = Math.max(60, tableWidth - fixedSum);

    const nomeWidth = measureMaxTextWidth(doc, ['Nome', ...participantes.map((p) => p.nome || '-')], fontSize) + padding;
    const flexWidths = distributeWidths(
      [{ key: 'nome', min: 70, max: 110, desired: nomeWidth }],
      availableWidth
    );

    const columnStyles: Record<number, { halign?: 'center' | 'left' | 'right'; cellWidth?: number }> = {
      0: { halign: 'center', cellWidth: fixedWidths.numero },
      1: { cellWidth: flexWidths.nome },
      2: { halign: 'center', cellWidth: fixedWidths.cpf },
      3: { cellWidth: fixedWidths.funcao },
    };

    autoTable(doc, {
      startY: tableStartY,
      margin,
      showHead: 'everyPage',
      head: [['Nº', 'Nome', 'CPF', 'Função']],
      body: participantes.map((p) => [
        String(p.numero ?? '-'),
        p.nome || '-',
        p.cpf || '-',
        p.funcao || '-',
      ]),
      styles: {
        fontSize,
        cellPadding: 3,
        lineColor: [COLORS.line[0], COLORS.line[1], COLORS.line[2]],
        lineWidth: 0.1,
        overflow: 'ellipsize',
      },
      headStyles: {
        fillColor: [darkRgb[0], darkRgb[1], darkRgb[2]],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 9,
      },
      columnStyles,
      alternateRowStyles: {
        fillColor: [COLORS.soft[0], COLORS.soft[1], COLORS.soft[2]],
      },
      bodyStyles: {
        textColor: [COLORS.text[0], COLORS.text[1], COLORS.text[2]],
        valign: 'middle',
      },
      didDrawPage: () => {
        drawAccentBar();
      },
    });
  } else {
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(11);
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    doc.text('Nenhum participante sorteado para esta equipe ainda.', pageWidth / 2, tableStartY + 14, { align: 'center' });
  }
}

export async function generateTeamParticipantsPDF(
  equipe: EquipeComParticipantes,
  participantes: Inscrito[],
  branding?: PdfBranding
) {
  const doc = new jsPDF();
  const resolvedBranding = await resolveBranding(branding);
  const layout = getStandardLayout(doc);
  
  // Load team image if available
  let imageBase64: string | null = null;
  if (equipe.imagemUrl) {
    imageBase64 = await getImageBase64(equipe.imagemUrl);
  }

  const dataAtual = formatDateTime();
  const teamColor = equipe.corPulseira || '#22c55e';
  const teamRgb = hexToRgb(teamColor);

  const afterHeaderY = drawTeamHeader(doc, equipe, participantes.length, layout.contentTop, imageBase64);
  await drawParticipantsTable(doc, participantes, equipe, afterHeaderY, layout, teamRgb);

  // Date for footer
  const subtitle = resolvedBranding.eventName
    ? resolvedBranding.subtitle
      ? `${resolvedBranding.eventName} • ${resolvedBranding.subtitle}`
      : resolvedBranding.eventName
    : resolvedBranding.subtitle;
  const headerTitle = `Equipe ${equipe.nome}`;
  applyStandardTemplate(
    doc,
    layout,
    {
      title: headerTitle,
      subtitle,
      dateText: dataAtual,
      logoBase64: resolvedBranding.logoBase64,
      titleRgb: teamRgb,
      lineRgb: teamRgb,
    },
    getFooterText(resolvedBranding)
  );
  
  // Save
  const fileName = `equipe-${equipe.nome.toLowerCase().replace(/\s+/g, '-')}-participantes.pdf`;
  doc.save(fileName);
}

export async function generateAllTeamsPDF(
  equipes: EquipeComParticipantes[],
  getParticipantes: (equipeId: string) => Inscrito[],
  branding?: PdfBranding
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const resolvedBranding = await resolveBranding(branding);
  const layout = getStandardLayout(doc);
  
  const dataAtual = formatDateTime();
  
  // Pre-load all team images in parallel
  const imagePromises = equipes.map(async (equipe) => {
    if (equipe.imagemUrl) {
      return { id: equipe.id, base64: await getImageBase64(equipe.imagemUrl) };
    }
    return { id: equipe.id, base64: null };
  });
  const imageResults = await Promise.all(imagePromises);
  const imageMap = new Map(imageResults.map(r => [r.id, r.base64]));
  
  // ============ COVER PAGE ============
  const coverTop = layout.contentTop;
  
  // Gradient-like header (multiple rectangles)
  doc.setFillColor(34, 197, 94);
  doc.rect(0, coverTop, pageWidth, 76, 'F');
  doc.setFillColor(22, 163, 74);
  doc.rect(0, coverTop + 66, pageWidth, 10, 'F');
  
  // Main title
  doc.setFontSize(30);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('LISTA DE PARTICIPANTES', pageWidth / 2, coverTop + 38, { align: 'center' });
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text('Distribuição por Equipes', pageWidth / 2, coverTop + 52, { align: 'center' });
  
  // Date badge
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageWidth / 2 - 48, coverTop + 92, 96, 26, 4, 4, 'F');
  doc.setDrawColor(COLORS.line[0], COLORS.line[1], COLORS.line[2]);
  doc.roundedRect(pageWidth / 2 - 48, coverTop + 92, 96, 26, 4, 4, 'S');
  doc.setFontSize(10);
  doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
  doc.text('Gerado em', pageWidth / 2, coverTop + 103, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(dataAtual, pageWidth / 2, coverTop + 113, { align: 'center' });
  
  // Summary cards
  const totalParticipantes = equipes.reduce((sum, e) => sum + e.participantes, 0);
  const cardY = coverTop + 138;
  const cardWidth = 78;
  const cardHeight = 48;
  const cardSpacing = 14;
  const startX = (pageWidth - (cardWidth * 2 + cardSpacing)) / 2;
  
  // Teams card
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(startX, cardY, cardWidth, cardHeight, 5, 5, 'F');
  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(1);
  doc.roundedRect(startX, cardY, cardWidth, cardHeight, 5, 5, 'S');
  doc.setFontSize(28);
  doc.setTextColor(34, 197, 94);
  doc.setFont('helvetica', 'bold');
  doc.text(String(equipes.length), startX + cardWidth / 2, cardY + 28, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
  doc.setFont('helvetica', 'normal');
  doc.text('Equipes', startX + cardWidth / 2, cardY + 42, { align: 'center' });
  
  // Participants card
  const card2X = startX + cardWidth + cardSpacing;
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 5, 5, 'F');
  doc.setDrawColor(59, 130, 246);
  doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 5, 5, 'S');
  doc.setFontSize(28);
  doc.setTextColor(59, 130, 246);
  doc.setFont('helvetica', 'bold');
  doc.text(String(totalParticipantes), card2X + cardWidth / 2, cardY + 28, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
  doc.setFont('helvetica', 'normal');
  doc.text('Participantes', card2X + cardWidth / 2, cardY + 42, { align: 'center' });
  
  // Teams summary list
  doc.setFontSize(14);
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo por Equipe', pageWidth / 2, coverTop + 208, { align: 'center' });
  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(1);
  doc.line(pageWidth / 2 - 30, coverTop + 211, pageWidth / 2 + 30, coverTop + 211);
  
  autoTable(doc, {
    startY: coverTop + 218,
    margin: { left: 24, right: 24, top: layout.contentTop, bottom: layout.pageHeight - layout.contentBottom },
    showHead: 'everyPage',
    head: [['Equipe', 'Participantes', 'Pontuação']],
    body: equipes.map((equipe) => [
      equipe.nome,
      `${equipe.participantes}`,
      `${equipe.pontuacaoTotal} pts`
    ]),
    styles: {
      fontSize: 9,
      cellPadding: 4,
      lineColor: [COLORS.line[0], COLORS.line[1], COLORS.line[2]],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 90, cellPadding: { left: 10, right: 4 } },
      1: { halign: 'center', cellWidth: 35 },
      2: { halign: 'right', cellWidth: 35 },
    },
    alternateRowStyles: {
      fillColor: [COLORS.soft[0], COLORS.soft[1], COLORS.soft[2]],
    },
    bodyStyles: {
      textColor: [COLORS.text[0], COLORS.text[1], COLORS.text[2]],
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const equipe = equipes[data.row.index];
        const teamColor = equipe.corPulseira || '#22c55e';
        const rgb = hexToRgb(teamColor);
        const centerY = data.cell.y + data.cell.height / 2;
        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
        doc.circle(data.cell.x + 4.5, centerY, 2, 'F');
      }
    },
  });
  
  // ============ TEAM PAGES ============
  for (const equipe of equipes) {
    doc.addPage();
    
    const participantes = getParticipantes(equipe.id);
    const imageBase64 = imageMap.get(equipe.id);
    
    const afterHeaderY = drawTeamHeader(doc, equipe, participantes.length, layout.contentTop, imageBase64);
    const teamRgb = hexToRgb(equipe.corPulseira || '#22c55e');
    await drawParticipantsTable(doc, participantes, equipe, afterHeaderY, layout, teamRgb);
  }

  const subtitle = resolvedBranding.eventName
    ? resolvedBranding.subtitle
      ? `${resolvedBranding.eventName} • ${resolvedBranding.subtitle}`
      : resolvedBranding.eventName
    : resolvedBranding.subtitle;
  applyStandardTemplate(
    doc,
    layout,
    {
      title: 'Lista de Participantes',
      subtitle,
      dateText: dataAtual,
      logoBase64: resolvedBranding.logoBase64,
    },
    getFooterText(resolvedBranding)
  );
  
  doc.save('todas-equipes-participantes.pdf');
}

export async function generateInscritosPDF(
  inscritos: Inscrito[],
  titulo: string = 'Lista de Inscritos',
  filtro?: { sorteados?: Set<number>; apenasNaoSorteados?: boolean; apenasSorteados?: boolean },
  branding?: PdfBranding
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const resolvedBranding = await resolveBranding(branding);
  const layout = getStandardLayout(doc);
  const headerTop = layout.contentTop;
  
  const dataAtual = formatDateTime();

  // Filter inscritos if needed
  let inscritosFiltrados = [...inscritos];
  if (filtro?.sorteados) {
    if (filtro.apenasNaoSorteados) {
      inscritosFiltrados = inscritos.filter(i => !filtro.sorteados!.has(i.numero));
    } else if (filtro.apenasSorteados) {
      inscritosFiltrados = inscritos.filter(i => filtro.sorteados!.has(i.numero));
    }
  }

  // ============ HEADER ============
  doc.setFillColor(34, 197, 94);
  doc.rect(0, headerTop, pageWidth, 32, 'F');
  doc.setFillColor(22, 163, 74);
  doc.rect(0, headerTop + 28, pageWidth, 4, 'F');
  
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(titulo.toUpperCase(), PAGE_MARGIN, headerTop + 20);
  
  doc.setFontSize(9);
  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'normal');
  doc.text(dataAtual, pageWidth - PAGE_MARGIN, headerTop + 13, { align: 'right' });
  
  // Count badge
  const inscritoLabel = inscritosFiltrados.length === 1 ? 'inscrito' : 'inscritos';
  const badgeText = `${inscritosFiltrados.length} ${inscritoLabel}`;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const badgePaddingX = 6;
  const badgeWidth = doc.getTextWidth(badgeText) + badgePaddingX * 2;
  const badgeHeight = 12;
  const badgeX = pageWidth - PAGE_MARGIN - badgeWidth;
  const badgeY = headerTop + 36;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 3, 3, 'F');
  doc.setDrawColor(COLORS.line[0], COLORS.line[1], COLORS.line[2]);
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 3, 3, 'S');
  doc.setTextColor(34, 197, 94);
  doc.text(badgeText, badgeX + badgeWidth / 2, badgeY + 8, { align: 'center' });

  const statusLabelMap: Record<string, string> = {
    PAID: 'Pago',
    PENDING: 'Pendente',
    CANCELLED: 'Cancelado',
    MANUAL: 'Manual',
  };

  const tableWidth = pageWidth - PAGE_MARGIN * 2;
  const fixedWidths = {
    numero: 12,
    idade: 16,
    status: 18,
  };
  const fixedSum = Object.values(fixedWidths).reduce((sum, value) => sum + value, 0);
  const availableWidth = Math.max(60, tableWidth - fixedSum);
  const fontSize = 9;
  const padding = 6;

  const nomeWidth = measureMaxTextWidth(doc, ['Nome', ...inscritosFiltrados.map(i => i.nome)], fontSize) + padding;
  const igrejaWidth = measureMaxTextWidth(doc, ['Igreja', ...inscritosFiltrados.map(i => i.igreja)], fontSize) + padding;
  const distritoWidth = measureMaxTextWidth(doc, ['Distrito', ...inscritosFiltrados.map(i => i.distrito)], fontSize) + padding;

  const flexWidths = distributeWidths(
    [
      { key: 'nome', min: 60, max: 90, desired: nomeWidth },
      { key: 'igreja', min: 35, max: 55, desired: igrejaWidth },
      { key: 'distrito', min: 30, max: 55, desired: distritoWidth },
    ],
    availableWidth
  );

  // ============ TABLE ============
  autoTable(doc, {
    startY: headerTop + 54,
    margin: layout.tableMargin,
    showHead: 'everyPage',
    head: [['Nº', 'Nome', 'Idade', 'Igreja', 'Distrito', 'Status']],
    body: inscritosFiltrados.map(i => [
      String(i.numero),
      i.nome,
      i.idade ? `${i.idade}` : '-',
      i.igreja,
      i.distrito,
      statusLabelMap[i.statusPagamento] || 'Pendente',
    ]),
    styles: {
      fontSize,
      cellPadding: 3,
      lineColor: [COLORS.line[0], COLORS.line[1], COLORS.line[2]],
      lineWidth: 0.1,
      overflow: 'ellipsize',
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: fixedWidths.numero },
      1: { cellWidth: flexWidths.nome },
      2: { halign: 'center', cellWidth: fixedWidths.idade },
      3: { cellWidth: flexWidths.igreja },
      4: { cellWidth: flexWidths.distrito },
      5: { halign: 'center', cellWidth: fixedWidths.status },
    },
    alternateRowStyles: {
      fillColor: [COLORS.soft[0], COLORS.soft[1], COLORS.soft[2]],
    },
    bodyStyles: {
      textColor: [COLORS.text[0], COLORS.text[1], COLORS.text[2]],
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        const value = String(data.cell.raw);
        if (value.includes('Pago')) {
          data.cell.styles.textColor = [34, 197, 94];
          data.cell.styles.fontStyle = 'bold';
        } else if (value.includes('Pendente')) {
          data.cell.styles.textColor = [234, 179, 8];
        } else if (value.includes('Cancelado')) {
          data.cell.styles.textColor = [239, 68, 68];
        } else if (value.includes('Manual')) {
          data.cell.styles.textColor = [99, 102, 241];
        }
      }
    }
  });

  const subtitle = resolvedBranding.eventName
    ? resolvedBranding.subtitle
      ? `${resolvedBranding.eventName} • ${resolvedBranding.subtitle}`
      : resolvedBranding.eventName
    : resolvedBranding.subtitle;
  applyStandardTemplate(
    doc,
    layout,
    {
      title: titulo,
      subtitle,
      dateText: dataAtual,
      logoBase64: resolvedBranding.logoBase64,
    },
    getFooterText(resolvedBranding)
  );
  
  const fileName = `inscritos-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

export async function generatePodioPDF(
  equipes: EquipeComParticipantes[],
  gincanaName?: string,
  branding?: PdfBranding
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const resolvedBranding = await resolveBranding(branding);
  const layout = getStandardLayout(doc);
  const headerTop = layout.contentTop;
  
  const dataAtual = formatDateTime();

  // Sort by points
  const ranking = [...equipes].sort((a, b) => b.pontuacaoTotal - a.pontuacaoTotal);

  const fallbackColors = [
    '#22c55e',
    '#3b82f6',
    '#f59e0b',
    '#ef4444',
    '#a855f7',
    '#06b6d4',
    '#f97316',
    '#10b981',
  ];
  const getTeamColorHex = (equipe: EquipeComParticipantes, index: number) => {
    if (equipe.corPulseira) return equipe.corPulseira;
    if (typeof equipe.cor === 'number') {
      return fallbackColors[(equipe.cor - 1) % fallbackColors.length];
    }
    return fallbackColors[index % fallbackColors.length];
  };

  const imageMap = new Map<string, string | null>();
  await Promise.all(
    ranking.map(async (equipe) => {
      if (!equipe.imagemUrl) return;
      const base64 = await getImageBase64(equipe.imagemUrl);
      imageMap.set(equipe.id, base64);
    })
  );

  // ============ HEADER ============
  const headerHeight = 52;
  doc.setFillColor(15, 23, 42);
  doc.rect(0, headerTop, pageWidth, headerHeight, 'F');
  doc.setFillColor(250, 204, 21);
  doc.rect(0, headerTop + headerHeight - 4, pageWidth, 4, 'F');
  
  doc.setFontSize(26);
  doc.setTextColor(250, 204, 21);
  doc.setFont('helvetica', 'bold');
  doc.text('PÓDIO GERAL', pageWidth / 2, headerTop + 24, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'normal');
  doc.text(gincanaName || 'Pontuação Geral', pageWidth / 2, headerTop + 38, { align: 'center' });
  
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(dataAtual, pageWidth - PAGE_MARGIN, headerTop + 16, { align: 'right' });

  // ============ TOP 3 ============
  const podiumY = headerTop + headerHeight + 14;
  const medalColors = {
    gold: [255, 193, 7] as [number, number, number],
    silver: [192, 192, 192] as [number, number, number],
    bronze: [205, 127, 50] as [number, number, number]
  };

  const drawPodiumCard = (
    equipe: EquipeComParticipantes,
    index: number,
    rankLabel: string,
    x: number,
    y: number,
    w: number,
    h: number
  ) => {
    const teamHex = getTeamColorHex(equipe, index);
    const teamRgb = hexToRgb(teamHex);
    const imageBase64 = imageMap.get(equipe.id);
    const centerX = x + w / 2;
    
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(teamRgb[0], teamRgb[1], teamRgb[2]);
    doc.setLineWidth(1);
    doc.roundedRect(x, y, w, h, 4, 4, 'FD');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30, 30, 30);
    doc.text(rankLabel, centerX, y + 14, { align: 'center' });
    
    const imageCenterY = y + Math.round(h * 0.45);
    if (imageBase64) {
      try {
        doc.setFillColor(255, 255, 255);
        doc.circle(centerX, imageCenterY, 7, 'F');
        doc.addImage(imageBase64, 'JPEG', centerX - 7, imageCenterY - 7, 14, 14);
      } catch (e) {
        // ignore image errors
      }
    }
    
    const nameY = y + h - 8;
    const pointsY = y + h - 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(teamRgb[0], teamRgb[1], teamRgb[2]);
    const maxNameWidth = w - 16;
    const displayName = fitTextToWidth(doc, equipe.nome, maxNameWidth);
    doc.text(displayName, centerX, nameY, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.text(`${equipe.pontuacaoTotal} pts`, centerX, pointsY, { align: 'center' });
  };

  const cardW = 60;
  const cardH = 44;
  const gap = 10;
  const rowWidth = cardW * 3 + gap * 2;
  const startX = (pageWidth - rowWidth) / 2;
  const rowY = podiumY + 10;

  // 1st, 2nd, 3rd on the same row
  if (ranking[0]) {
    drawPodiumCard(ranking[0], 0, '1º', startX, rowY, cardW, cardH);
  }
  if (ranking[1]) {
    drawPodiumCard(ranking[1], 1, '2º', startX + cardW + gap, rowY, cardW, cardH);
  }
  if (ranking[2]) {
    drawPodiumCard(ranking[2], 2, '3º', startX + (cardW + gap) * 2, rowY, cardW, cardH);
  }

  // ============ FULL RANKING TABLE ============
  const tableTitleY = rowY + cardH + 24;
  doc.setFontSize(15);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text('Classificação Completa', pageWidth / 2, tableTitleY, { align: 'center' });

  autoTable(doc, {
    startY: tableTitleY + 8,
    margin: layout.tableMargin,
    showHead: 'everyPage',
    head: [['Posição', 'Equipe', 'Participantes', 'Pontuação']],
    body: ranking.map((equipe, index) => [
      `${index + 1}º`,
      equipe.nome,
      `${equipe.participantes}`,
      `${equipe.pontuacaoTotal} pts`
    ]),
    styles: {
      fontSize: 10,
      cellPadding: 5,
      lineColor: [COLORS.line[0], COLORS.line[1], COLORS.line[2]],
      lineWidth: 0.1,
      overflow: 'ellipsize',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 9,
      overflow: 'ellipsize',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 26 },
      1: { cellWidth: 72, cellPadding: { left: 16, right: 4 } },
      2: { halign: 'center', cellWidth: 50 },
      3: { halign: 'right', cellWidth: 38, fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [COLORS.soft[0], COLORS.soft[1], COLORS.soft[2]],
    },
    bodyStyles: {
      textColor: [COLORS.text[0], COLORS.text[1], COLORS.text[2]],
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index < 3) {
        const colors = [medalColors.gold, medalColors.silver, medalColors.bronze];
        if (data.column.index === 0) {
          data.cell.styles.fillColor = colors[data.row.index];
          data.cell.styles.textColor = [30, 30, 30];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const equipe = ranking[data.row.index];
        const teamHex = getTeamColorHex(equipe, data.row.index);
        const rgb = hexToRgb(teamHex);
        const imageBase64 = imageMap.get(equipe.id);
        const centerY = data.cell.y + data.cell.height / 2;
        
        if (imageBase64) {
          try {
            doc.setFillColor(255, 255, 255);
            doc.circle(data.cell.x + 6, centerY, 4, 'F');
            doc.addImage(imageBase64, 'JPEG', data.cell.x + 2, centerY - 4, 8, 8);
          } catch (e) {
            // ignore image errors
          }
        } else {
          doc.setFillColor(rgb[0], rgb[1], rgb[2]);
          doc.circle(data.cell.x + 6, centerY, 3, 'F');
        }
      }
    },
  });

  const subtitle = resolvedBranding.eventName
    ? resolvedBranding.subtitle
      ? `${resolvedBranding.eventName} • ${resolvedBranding.subtitle}`
      : resolvedBranding.eventName
    : resolvedBranding.subtitle;
  const headerTitle = gincanaName ? `Pódio - ${gincanaName}` : 'Pódio Geral';
  applyStandardTemplate(
    doc,
    layout,
    {
      title: headerTitle,
      subtitle,
      dateText: dataAtual,
      logoBase64: resolvedBranding.logoBase64,
    },
    getFooterText(resolvedBranding)
  );
  
  const fileName = `podio-${gincanaName?.toLowerCase().replace(/\s+/g, '-') || 'gincana'}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

function isPontuacaoTorneio(pontuacao: Pontuacao, torneio: Torneio) {
  if (!pontuacao.observacao) return false;
  const obs = normalizeText(pontuacao.observacao);
  const torneioNome = normalizeText(torneio.nome);
  return obs.includes(torneioNome);
}

export async function generatePontuacaoEquipePDF(
  equipe: Equipe,
  gincanas: Gincana[],
  torneios: Torneio[],
  pontuacoes: Pontuacao[],
  branding?: PdfBranding
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const teamColor = getEquipeColorHex(equipe);
  const rgb = hexToRgb(teamColor);
  const resolvedBranding = await resolveBranding(branding);
  const layout = getStandardLayout(doc);
  const headerTop = layout.contentTop;

  const dataAtual = formatDateTime();

  const pontuacoesEquipe = pontuacoes.filter(p => p.equipeId === equipe.id);
  const totalEquipe = pontuacoesEquipe.reduce((sum, p) => sum + p.pontos, 0);

  // Header
  const headerHeight = 32;
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  doc.rect(0, headerTop, pageWidth, headerHeight, 'F');
  const darkRgb = darkenColor(rgb, 0.85);
  doc.setFillColor(darkRgb[0], darkRgb[1], darkRgb[2]);
  doc.rect(0, headerTop + headerHeight - 4, pageWidth, 4, 'F');

  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DE PONTUAÇÃO', PAGE_MARGIN, headerTop + 20);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(equipe.nome, PAGE_MARGIN, headerTop + 28);

  doc.setFontSize(9);
  doc.setTextColor(226, 232, 240);
  doc.text(dataAtual, pageWidth - PAGE_MARGIN, headerTop + 13, { align: 'right' });

  doc.setFontSize(10);
  doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
  doc.setFont('helvetica', 'normal');
  doc.text(`Equipe Nº ${equipe.numero}`, PAGE_MARGIN, headerTop + headerHeight + 10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  doc.text(`Total: ${totalEquipe} pts`, pageWidth - PAGE_MARGIN, headerTop + headerHeight + 10, { align: 'right' });

  let currentY = headerTop + headerHeight + 18;

  // Pontuação por gincana
  if (gincanas.length > 0) {
    currentY = drawSectionTitle(doc, 'Pontuação por Gincana', currentY, rgb);

    autoTable(doc, {
      startY: currentY + 2,
      margin: layout.tableMargin,
      showHead: 'everyPage',
      head: [['Gincana', 'Pontos']],
      body: gincanas.map((g) => {
        const pontos = pontuacoesEquipe
          .filter(p => p.gincanaId === g.id)
          .reduce((sum, p) => sum + p.pontos, 0);
        return [g.nome, String(pontos)];
      }),
      styles: {
        fontSize: 9,
        cellPadding: 4,
        lineColor: [COLORS.line[0], COLORS.line[1], COLORS.line[2]],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        fontStyle: 'bold',
      },
      columnStyles: {
        1: { halign: 'right', cellWidth: 24 },
      },
      alternateRowStyles: {
        fillColor: [COLORS.soft[0], COLORS.soft[1], COLORS.soft[2]],
      },
      bodyStyles: {
        textColor: [COLORS.text[0], COLORS.text[1], COLORS.text[2]],
      },
    });

      const lastY = (doc as any).lastAutoTable?.finalY ?? currentY + 20;
    currentY = lastY + 10;
  } else {
    doc.setFontSize(10);
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    doc.text('Nenhuma gincana cadastrada.', PAGE_MARGIN, currentY + 4);
    currentY += 14;
  }

  // Pontuação por torneio
  if (torneios.length > 0) {
    if (currentY > layout.contentBottom - 20) {
      doc.addPage();
      currentY = headerTop + 20;
    }

    currentY = drawSectionTitle(doc, 'Pontuação por Competição', currentY, rgb);

    autoTable(doc, {
      startY: currentY + 2,
      margin: layout.tableMargin,
      showHead: 'everyPage',
      head: [['Competição', 'Gincana', 'Pontos']],
      body: torneios.map((t) => {
        const pontos = pontuacoesEquipe
          .filter(p => isPontuacaoTorneio(p, t))
          .reduce((sum, p) => sum + p.pontos, 0);
        const gincanaNome = gincanas.find(g => g.id === t.gincana_id)?.nome || '-';
        return [t.nome, gincanaNome, String(pontos)];
      }),
      styles: {
        fontSize: 9,
        cellPadding: 4,
        lineColor: [COLORS.line[0], COLORS.line[1], COLORS.line[2]],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        fontStyle: 'bold',
      },
      columnStyles: {
        2: { halign: 'right', cellWidth: 24 },
      },
      alternateRowStyles: {
        fillColor: [COLORS.soft[0], COLORS.soft[1], COLORS.soft[2]],
      },
      bodyStyles: {
        textColor: [COLORS.text[0], COLORS.text[1], COLORS.text[2]],
      },
    });
  } else {
    if (currentY > layout.contentBottom - 20) {
      doc.addPage();
      currentY = headerTop + 20;
    }
    doc.setFontSize(10);
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    doc.text('Nenhuma competição cadastrada.', PAGE_MARGIN, currentY + 4);
  }

  const subtitle = resolvedBranding.eventName
    ? resolvedBranding.subtitle
      ? `${resolvedBranding.eventName} • ${resolvedBranding.subtitle}`
      : resolvedBranding.eventName
    : resolvedBranding.subtitle;
  applyStandardTemplate(
    doc,
    layout,
    {
      title: 'Relatório de Pontuação',
      subtitle: subtitle ? `${equipe.nome} • ${subtitle}` : equipe.nome,
      dateText: dataAtual,
      logoBase64: resolvedBranding.logoBase64,
      titleRgb: rgb,
      lineRgb: rgb,
    },
    getFooterText(resolvedBranding)
  );

  const fileName = `pontuacao-${equipe.nome.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

export async function generatePontuacaoGeralPDF(
  equipes: Equipe[],
  gincanas: Gincana[],
  torneios: Torneio[],
  pontuacoes: Pontuacao[],
  branding?: PdfBranding
) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const resolvedBranding = await resolveBranding(branding);
  const layout = getStandardLayout(doc);
  const headerTop = layout.contentTop;

  const dataAtual = formatDateTime();

  const equipesMap = new Map<string, { total: number; porGincana: Map<string, number>; porTorneio: Map<string, number> }>();
  equipes.forEach((e) => {
    equipesMap.set(e.id, { total: 0, porGincana: new Map(), porTorneio: new Map() });
  });

  pontuacoes.forEach((p) => {
    const entry = equipesMap.get(p.equipeId);
    if (!entry) return;
    entry.total += p.pontos;
    entry.porGincana.set(p.gincanaId, (entry.porGincana.get(p.gincanaId) || 0) + p.pontos);

    for (const torneio of torneios) {
      if (isPontuacaoTorneio(p, torneio)) {
        entry.porTorneio.set(torneio.id, (entry.porTorneio.get(torneio.id) || 0) + p.pontos);
        break;
      }
    }
  });

  const equipesOrdenadas = [...equipes].sort((a, b) => {
    const totalA = equipesMap.get(a.id)?.total || 0;
    const totalB = equipesMap.get(b.id)?.total || 0;
    return totalB - totalA;
  });

  // Header
  const headerHeight = 26;
  doc.setFillColor(15, 23, 42);
  doc.rect(0, headerTop, pageWidth, headerHeight, 'F');
  doc.setFillColor(34, 197, 94);
  doc.rect(0, headerTop + headerHeight - 4, pageWidth, 4, 'F');

  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO GERAL DE PONTUAÇÃO', PAGE_MARGIN, headerTop + 17);
  doc.setFontSize(9);
  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'normal');
  doc.text(dataAtual, pageWidth - PAGE_MARGIN, headerTop + 13, { align: 'right' });

  doc.setFontSize(10);
  doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
  doc.text(`Equipes: ${equipes.length}`, PAGE_MARGIN, headerTop + headerHeight + 8);

  let currentY = headerTop + headerHeight + 16;

  if (gincanas.length > 0) {
    currentY = drawSectionTitle(doc, 'Pontuação por Gincana', currentY, [34, 197, 94]);

    autoTable(doc, {
      startY: currentY + 2,
      margin: layout.tableMargin,
      showHead: 'everyPage',
      head: [['Equipe', ...gincanas.map(g => g.nome), 'Total']],
      body: equipesOrdenadas.map((e) => {
        const entry = equipesMap.get(e.id);
        const valores = gincanas.map(g => String(entry?.porGincana.get(g.id) || 0));
        return [e.nome, ...valores, String(entry?.total || 0)];
      }),
      styles: {
        fontSize: 8,
        cellPadding: 3,
        lineColor: [COLORS.line[0], COLORS.line[1], COLORS.line[2]],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 45 },
      },
      alternateRowStyles: {
        fillColor: [COLORS.soft[0], COLORS.soft[1], COLORS.soft[2]],
      },
      bodyStyles: {
        textColor: [COLORS.text[0], COLORS.text[1], COLORS.text[2]],
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index > 0) {
          data.cell.styles.halign = 'right';
        }
      },
    });

    const lastY = (doc as any).lastAutoTable?.finalY ?? currentY + 20;
    currentY = lastY + 10;
  }

  if (torneios.length > 0) {
    if (currentY > layout.contentBottom - 20) {
      doc.addPage();
      currentY = headerTop + 20;
    }

    currentY = drawSectionTitle(doc, 'Pontuação por Competição', currentY, [34, 197, 94]);

    autoTable(doc, {
      startY: currentY + 2,
      margin: layout.tableMargin,
      showHead: 'everyPage',
      head: [['Equipe', ...torneios.map(t => t.nome), 'Total Competições']],
      body: equipesOrdenadas.map((e) => {
        const entry = equipesMap.get(e.id);
        const valores = torneios.map(t => String(entry?.porTorneio.get(t.id) || 0));
        const totalTorneios = torneios.reduce((sum, t) => sum + (entry?.porTorneio.get(t.id) || 0), 0);
        return [e.nome, ...valores, String(totalTorneios)];
      }),
      styles: {
        fontSize: 8,
        cellPadding: 3,
        lineColor: [COLORS.line[0], COLORS.line[1], COLORS.line[2]],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 45 },
      },
      alternateRowStyles: {
        fillColor: [COLORS.soft[0], COLORS.soft[1], COLORS.soft[2]],
      },
      bodyStyles: {
        textColor: [COLORS.text[0], COLORS.text[1], COLORS.text[2]],
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index > 0) {
          data.cell.styles.halign = 'right';
        }
      },
    });
  }

  const subtitle = resolvedBranding.eventName
    ? resolvedBranding.subtitle
      ? `${resolvedBranding.eventName} • ${resolvedBranding.subtitle}`
      : resolvedBranding.eventName
    : resolvedBranding.subtitle;
  applyStandardTemplate(
    doc,
    layout,
    {
      title: 'Relatório Geral de Pontuação',
      subtitle,
      dateText: dataAtual,
      logoBase64: resolvedBranding.logoBase64,
    },
    getFooterText(resolvedBranding)
  );

  const fileName = `pontuacao-geral-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

type StandardPDFTemplateType = 'generic' | 'team';

type StandardTextBlock = {
  type: 'text';
  text: string;
  options?: {
    fontSize?: number;
    bold?: boolean;
    color?: [number, number, number];
    align?: 'left' | 'center' | 'right';
    gap?: number;
  };
};

type StandardTableBlock = {
  type: 'table';
  head: string[];
  body: Array<Array<string | number>>;
  options?: {
    styles?: Record<string, unknown>;
    headStyles?: Record<string, unknown>;
    bodyStyles?: Record<string, unknown>;
    columnStyles?: Record<number, Record<string, unknown>>;
    alternateRowStyles?: Record<string, unknown>;
  };
};

type StandardPDFData = {
  title: string;
  subtitle?: string;
  blocks: Array<StandardTextBlock | StandardTableBlock>;
  branding?: PdfBranding;
  footerText?: string;
  orientation?: 'portrait' | 'landscape';
  fileName?: string;
};

export async function generateStandardPDF(
  data: StandardPDFData,
  templateType: StandardPDFTemplateType = 'generic',
  teamColor?: string
) {
  const doc = new jsPDF({ orientation: data.orientation || 'portrait' });
  const resolvedBranding = await resolveBranding(data.branding);
  const layout = getStandardLayout(doc);
  const dataAtual = formatDateTime();
  const accentRgb = templateType === 'team' ? hexToRgb(teamColor || '#22c55e') : undefined;

  let currentY = layout.contentTop;
  const contentWidth = layout.pageWidth - PAGE_MARGIN * 2;

  const ensureSpace = (height: number) => {
    if (currentY + height > layout.contentBottom) {
      doc.addPage();
      currentY = layout.contentTop;
    }
  };

  data.blocks.forEach((block) => {
    if (block.type === 'text') {
      const fontSize = block.options?.fontSize ?? 10;
      const gap = block.options?.gap ?? 6;
      doc.setFont('helvetica', block.options?.bold ? 'bold' : 'normal');
      doc.setFontSize(fontSize);
      doc.setTextColor(...(block.options?.color || COLORS.text));
      const lines = doc.splitTextToSize(block.text, contentWidth);
      const textHeight = doc.getTextDimensions(lines).h;
      ensureSpace(textHeight);
      doc.text(lines, PAGE_MARGIN, currentY, { align: block.options?.align || 'left' });
      currentY += textHeight + gap;
      return;
    }

    if (block.type === 'table') {
      if (currentY > layout.contentBottom - 20) {
        doc.addPage();
        currentY = layout.contentTop;
      }
      autoTable(doc, {
        startY: currentY,
        margin: layout.tableMargin,
        showHead: 'everyPage',
        head: [block.head],
        body: block.body,
        styles: {
          fontSize: 9,
          cellPadding: 3,
          lineColor: [COLORS.line[0], COLORS.line[1], COLORS.line[2]],
          lineWidth: 0.1,
          overflow: 'ellipsize',
          ...(block.options?.styles || {}),
        },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center',
          ...(block.options?.headStyles || {}),
        },
        bodyStyles: {
          textColor: [COLORS.text[0], COLORS.text[1], COLORS.text[2]],
          ...(block.options?.bodyStyles || {}),
        },
        columnStyles: block.options?.columnStyles || {},
        alternateRowStyles: {
          fillColor: [COLORS.soft[0], COLORS.soft[1], COLORS.soft[2]],
          ...(block.options?.alternateRowStyles || {}),
        },
      });
    const lastY = (doc as any).lastAutoTable?.finalY ?? currentY + 10;
      currentY = lastY + 8;
    }
  });

  const subtitle = data.subtitle
    ? data.subtitle
    : resolvedBranding.eventName
      ? resolvedBranding.subtitle
        ? `${resolvedBranding.eventName} • ${resolvedBranding.subtitle}`
        : resolvedBranding.eventName
      : resolvedBranding.subtitle;

  applyStandardTemplate(
    doc,
    layout,
    {
      title: data.title,
      subtitle,
      dateText: dataAtual,
      logoBase64: resolvedBranding.logoBase64,
      titleRgb: accentRgb,
      lineRgb: accentRgb,
    },
    data.footerText || getFooterText(resolvedBranding)
  );

  if (accentRgb) {
    applyAccentBarToPages(doc, layout, accentRgb);
  }

  if (data.fileName) {
    doc.save(data.fileName);
  }

  return doc;
}

export async function generateCompeticaoPDF(
  torneio: Torneio,
  confrontos: Confronto[],
  equipes: Equipe[],
  branding?: PdfBranding,
  gincanaNome?: string
) {
  const equipeMap = new Map(equipes.map((e) => [e.id, e]));
  const participantesIds = new Set<string>();
  confrontos.forEach((confronto) => {
    if (confronto.equipe1_id) participantesIds.add(confronto.equipe1_id);
    if (confronto.equipe2_id) participantesIds.add(confronto.equipe2_id);
  });

  const participantes = Array.from(participantesIds)
    .map((id) => equipeMap.get(id))
    .filter(Boolean) as Equipe[];

  participantes.sort((a, b) => {
    const numeroA = a.numero ?? 0;
    const numeroB = b.numero ?? 0;
    if (numeroA !== numeroB) return numeroA - numeroB;
    return a.nome.localeCompare(b.nome);
  });

  const faseOrder: Record<Confronto['fase'], number> = {
    quartas: 1,
    semifinal: 2,
    terceiro_lugar: 3,
    final: 4,
  };

  const faseLabel = (fase: Confronto['fase']) => {
    switch (fase) {
      case 'quartas':
        return 'Quartas de final';
      case 'semifinal':
        return 'Semifinal';
      case 'terceiro_lugar':
        return '3º lugar';
      case 'final':
        return 'Final';
      default:
        return fase;
    }
  };

  const confrontosOrdenados = [...confrontos].sort((a, b) => {
    const faseDiff = (faseOrder[a.fase] || 99) - (faseOrder[b.fase] || 99);
    if (faseDiff !== 0) return faseDiff;
    return a.ordem - b.ordem;
  });

  const formatDataHora = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusLabel: Record<Torneio['status'], string> = {
    pendente: 'Pendente',
    em_andamento: 'Em andamento',
    finalizado: 'Finalizado',
  };

  const infoLines = [
    `Competição: ${torneio.nome}`,
    gincanaNome ? `Gincana: ${gincanaNome}` : null,
    `Data: ${formatDataHora(torneio.created_at || torneio.updated_at)}`,
    `Status: ${statusLabel[torneio.status] || torneio.status}`,
  ].filter(Boolean).join('\n');

  const blocks: StandardPDFData['blocks'] = [
    {
      type: 'text',
      text: infoLines,
      options: { fontSize: 10, gap: 8 },
    },
    {
      type: 'text',
      text: 'Equipes participantes',
      options: { fontSize: 11, bold: true, gap: 4 },
    },
  ];

  if (participantes.length > 0) {
    blocks.push({
      type: 'table',
      head: ['Nº', 'Equipe', 'Líder', 'Vice'],
      body: participantes.map((equipe, index) => [
        String(equipe.numero ?? index + 1),
        equipe.nome,
        equipe.lider || '-',
        equipe.vice || '-',
      ]),
      options: {
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
        },
      },
    });
  } else {
    blocks.push({
      type: 'text',
      text: 'Nenhuma equipe definida.',
      options: { color: COLORS.muted, gap: 8 },
    });
  }

  blocks.push({
    type: 'text',
    text: 'Disputas',
    options: { fontSize: 11, bold: true, gap: 4 },
  });

  if (confrontosOrdenados.length > 0) {
    blocks.push({
      type: 'table',
      head: ['Fase', 'Confronto', 'Equipe A', 'Equipe B', 'Resultado', 'Data/Hora'],
      body: confrontosOrdenados.map((confronto) => {
        const equipeA = confronto.equipe1_id ? equipeMap.get(confronto.equipe1_id)?.nome : null;
        const equipeB = confronto.equipe2_id ? equipeMap.get(confronto.equipe2_id)?.nome : null;
        const vencedor = confronto.vencedor_id ? equipeMap.get(confronto.vencedor_id)?.nome : null;
        const resultado = vencedor
          ? vencedor
          : confronto.equipe1_id && confronto.equipe2_id
            ? 'Pendente'
            : '-';
        return [
          faseLabel(confronto.fase),
          `${confronto.ordem}º`,
          equipeA || 'A definir',
          equipeB || 'A definir',
          resultado,
          formatDataHora(confronto.updated_at || confronto.created_at),
        ];
      }),
      options: {
        columnStyles: {
          1: { halign: 'center', cellWidth: 18 },
          4: { halign: 'center', cellWidth: 32 },
          5: { halign: 'right', cellWidth: 34 },
        },
      },
    });
  } else {
    blocks.push({
      type: 'text',
      text: 'Nenhuma disputa sorteada ainda.',
      options: { color: COLORS.muted },
    });
  }

  const fileSlug = normalizeText(torneio.nome).replace(/\s+/g, '-');
  const fileName = `competicao-${fileSlug || 'competicao'}-${new Date().toISOString().split('T')[0]}.pdf`;

  return generateStandardPDF(
    {
      title: `Competição - ${torneio.nome}`,
      blocks,
      branding,
      fileName,
    },
    'generic'
  );
}
