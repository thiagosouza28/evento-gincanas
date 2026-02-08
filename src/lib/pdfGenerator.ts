import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Inscrito, EquipeComParticipantes, Equipe, Gincana, Pontuacao } from '@/types';
import type { Torneio } from '@/types/torneio';

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
const FOOTER_MARGIN = 22;

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
  
  const hasImage = !!imageBase64;
  const imageSize = 20;
  const textStartX = hasImage ? 14 + imageSize + 6 : 14;
  
  // Top colored bar
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  doc.rect(0, startY, pageWidth, 25, 'F');
  
  // Team image (if available)
  if (hasImage && imageBase64) {
    try {
      // White circular background for image
      doc.setFillColor(255, 255, 255);
      doc.circle(14 + imageSize / 2, startY + 12.5, imageSize / 2 + 1, 'F');
      
      // Add the image
      doc.addImage(imageBase64, 'JPEG', 14, startY + 2.5, imageSize, imageSize);
    } catch (e) {
      console.error('Error adding image to PDF:', e);
    }
  }
  
  // Team name on colored bar
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(equipe.nome.toUpperCase(), textStartX, startY + 17);
  
  // Participant count badge
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageWidth - 50, startY + 6, 36, 14, 3, 3, 'F');
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  doc.setFontSize(11);
  doc.text(`${participantesCount} pessoas`, pageWidth - 32, startY + 15, { align: 'center' });
  
  // Info section with light background
  const lightBg = lightenColor(rgb, 0.1);
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.rect(0, startY + 25, pageWidth, 20, 'F');
  
  // Team details
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  
  // Leader icon and text
  doc.setFont('helvetica', 'bold');
  doc.text('Líder:', 14, startY + 37);
  doc.setFont('helvetica', 'normal');
  doc.text(equipe.lider || '-', 32, startY + 37);
  
  // Vice leader
  doc.setFont('helvetica', 'bold');
  doc.text('Vice:', 80, startY + 37);
  doc.setFont('helvetica', 'normal');
  doc.text(equipe.vice || '-', 95, startY + 37);
  
  // Score
  doc.setFont('helvetica', 'bold');
  doc.text('Pontuação:', 145, startY + 37);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  doc.text(`${equipe.pontuacaoTotal} pts`, 172, startY + 37);
  
  return startY + 50; // Return the Y position after header
}

async function drawParticipantsTable(
  doc: jsPDF,
  participantes: Inscrito[],
  equipe: EquipeComParticipantes,
  startY: number,
  participantImages?: Map<number, string | null>
) {
  const teamColor = equipe.corPulseira || '#22c55e';
  const rgb = hexToRgb(teamColor);
  const darkRgb = darkenColor(rgb, 0.8);
  
  const hasImages = participantImages && participantImages.size > 0;
  const imageSize = 8; // Size of participant photo in mm
  
  if (participantes.length > 0) {
    autoTable(doc, {
      startY: startY + 5,
      margin: { bottom: FOOTER_MARGIN },
      head: [hasImages ? ['#', 'Foto', 'Nº', 'Nome', 'Idade', 'Igreja'] : ['#', 'Nº Inscr.', 'Nome', 'Idade', 'Igreja', 'Distrito']],
      body: participantes.map((p, index) => {
        if (hasImages) {
          return [
            String(index + 1),
            '', // Placeholder for photo
            String(p.numero ?? '-'),
            p.nome ?? '-',
            p.idade ? `${p.idade}` : '-',
            p.igreja ?? '-'
          ];
        }
        return [
          String(index + 1),
          String(p.numero ?? '-'),
          p.nome ?? '-',
          p.idade ? `${p.idade} anos` : '-',
          p.igreja ?? '-',
          p.distrito ?? '-'
        ];
      }),
      styles: {
        fontSize: 9,
        cellPadding: hasImages ? 2 : 4,
        lineColor: [220, 220, 220],
        lineWidth: 0.1,
        minCellHeight: hasImages ? imageSize + 2 : undefined,
      },
      headStyles: {
        fillColor: [darkRgb[0], darkRgb[1], darkRgb[2]],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: hasImages ? {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 12 }, // Photo column
        2: { halign: 'center', cellWidth: 15 },
        3: { cellWidth: 55 },
        4: { halign: 'center', cellWidth: 15 },
        5: { cellWidth: 35 },
      } : {
        0: { halign: 'center', cellWidth: 12 },
        1: { halign: 'center', cellWidth: 22 },
        2: { cellWidth: 60 },
        3: { halign: 'center', cellWidth: 22 },
        4: { cellWidth: 40 },
        5: { cellWidth: 35 },
      },
      alternateRowStyles: {
        fillColor: [250, 250, 252],
      },
      bodyStyles: {
        textColor: [50, 50, 50],
        valign: 'middle',
      },
      didDrawCell: (data) => {
        // Draw participant photos in the photo column (index 1)
        if (hasImages && data.section === 'body' && data.column.index === 1) {
          const participantIndex = data.row.index;
          const participant = participantes[participantIndex];
          if (participant && participantImages) {
            const imageBase64 = participantImages.get(participant.numero);
            if (imageBase64) {
              try {
                const cellX = data.cell.x + (data.cell.width - imageSize) / 2;
                const cellY = data.cell.y + (data.cell.height - imageSize) / 2;
                doc.addImage(imageBase64, 'JPEG', cellX, cellY, imageSize, imageSize);
              } catch (e) {
                // Silently fail if image can't be added
                console.error('Error adding participant image:', e);
              }
            }
          }
        }
      }
    });
  } else {
    doc.setFontSize(12);
    doc.setTextColor(150, 150, 150);
    doc.text('Nenhum participante sorteado para esta equipe ainda.', doc.internal.pageSize.getWidth() / 2, startY + 30, { align: 'center' });
  }
}

// Load participant images in parallel
async function loadParticipantImages(participantes: Inscrito[]): Promise<Map<number, string | null>> {
  const imageMap = new Map<number, string | null>();
  
  const promises = participantes.map(async (p) => {
    if (p.fotoUrl) {
      const base64 = await getImageBase64(p.fotoUrl);
      imageMap.set(p.numero, base64);
    }
  });
  
  await Promise.all(promises);
  return imageMap;
}

function addFooter(doc: jsPDF, dataAtual: string) {
  const pageCount = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Footer text
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(`Gerado em ${dataAtual}`, 14, pageHeight - 10);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
  }
}

export async function generateTeamParticipantsPDF(
  equipe: EquipeComParticipantes,
  participantes: Inscrito[]
) {
  const doc = new jsPDF();
  
  // Load team image if available
  let imageBase64: string | null = null;
  if (equipe.imagemUrl) {
    imageBase64 = await getImageBase64(equipe.imagemUrl);
  }
  
  // Load participant images
  const participantImages = await loadParticipantImages(participantes);
  
  // Draw team header with image
  const afterHeaderY = drawTeamHeader(doc, equipe, participantes.length, 0, imageBase64);
  
  // Draw participants table with photos
  await drawParticipantsTable(doc, participantes, equipe, afterHeaderY, participantImages);
  
  // Date for footer
  const dataAtual = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // Add footer
  addFooter(doc, dataAtual);
  
  // Save
  const fileName = `equipe-${equipe.nome.toLowerCase().replace(/\s+/g, '-')}-participantes.pdf`;
  doc.save(fileName);
}

export async function generateAllTeamsPDF(
  equipes: EquipeComParticipantes[],
  getParticipantes: (equipeId: string) => Inscrito[]
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  const dataAtual = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
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
  
  // Gradient-like header (multiple rectangles)
  doc.setFillColor(34, 197, 94);
  doc.rect(0, 0, pageWidth, 80, 'F');
  doc.setFillColor(22, 163, 74);
  doc.rect(0, 70, pageWidth, 20, 'F');
  
  // Main title
  doc.setFontSize(32);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('LISTA DE PARTICIPANTES', pageWidth / 2, 40, { align: 'center' });
  doc.setFontSize(18);
  doc.setFont('helvetica', 'normal');
  doc.text('Distribuição por Equipes', pageWidth / 2, 55, { align: 'center' });
  
  // Date badge
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageWidth / 2 - 45, 95, 90, 25, 4, 4, 'F');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Gerado em', pageWidth / 2, 105, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'bold');
  doc.text(dataAtual, pageWidth / 2, 115, { align: 'center' });
  
  // Summary cards
  const totalParticipantes = equipes.reduce((sum, e) => sum + e.participantes, 0);
  const cardY = 140;
  const cardWidth = 80;
  const cardSpacing = 15;
  const startX = (pageWidth - (cardWidth * 2 + cardSpacing)) / 2;
  
  // Teams card
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(startX, cardY, cardWidth, 50, 5, 5, 'F');
  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(1);
  doc.roundedRect(startX, cardY, cardWidth, 50, 5, 5, 'S');
  doc.setFontSize(28);
  doc.setTextColor(34, 197, 94);
  doc.setFont('helvetica', 'bold');
  doc.text(String(equipes.length), startX + cardWidth / 2, cardY + 28, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Equipes', startX + cardWidth / 2, cardY + 42, { align: 'center' });
  
  // Participants card
  const card2X = startX + cardWidth + cardSpacing;
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(card2X, cardY, cardWidth, 50, 5, 5, 'F');
  doc.setDrawColor(59, 130, 246);
  doc.roundedRect(card2X, cardY, cardWidth, 50, 5, 5, 'S');
  doc.setFontSize(28);
  doc.setTextColor(59, 130, 246);
  doc.setFont('helvetica', 'bold');
  doc.text(String(totalParticipantes), card2X + cardWidth / 2, cardY + 28, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Participantes', card2X + cardWidth / 2, cardY + 42, { align: 'center' });
  
  // Teams summary list
  doc.setFontSize(14);
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo por Equipe', pageWidth / 2, 215, { align: 'center' });
  
  // Draw team summary boxes
  const summaryStartY = 230;
  const boxHeight = 12;
  const boxSpacing = 3;
  
  equipes.forEach((equipe, index) => {
    const y = summaryStartY + (index * (boxHeight + boxSpacing));
    const teamColor = equipe.corPulseira || '#22c55e';
    const rgb = hexToRgb(teamColor);
    
    // Color indicator
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    doc.roundedRect(30, y, 6, boxHeight, 1, 1, 'F');
    
    // Team name
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'bold');
    doc.text(equipe.nome, 42, y + 8);
    
    // Participant count
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`${equipe.participantes} participantes`, 100, y + 8);
    
    // Score
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text(`${equipe.pontuacaoTotal} pts`, pageWidth - 30, y + 8, { align: 'right' });
  });
  
  // ============ TEAM PAGES ============
  // Load all participant images first
  const allParticipants: Inscrito[] = [];
  equipes.forEach((equipe) => {
    const participantes = getParticipantes(equipe.id);
    allParticipants.push(...participantes);
  });
  const allParticipantImages = await loadParticipantImages(allParticipants);
  
  for (const equipe of equipes) {
    doc.addPage();
    
    const participantes = getParticipantes(equipe.id);
    const imageBase64 = imageMap.get(equipe.id);
    
    // Draw team header with image
    const afterHeaderY = drawTeamHeader(doc, equipe, participantes.length, 0, imageBase64);
    
    // Draw participants table with photos
    await drawParticipantsTable(doc, participantes, equipe, afterHeaderY, allParticipantImages);
  }
  
  // Add footer to all pages
  addFooter(doc, dataAtual);
  
  doc.save('todas-equipes-participantes.pdf');
}

export function generateInscritosPDF(
  inscritos: Inscrito[],
  titulo: string = 'Lista de Inscritos',
  filtro?: { sorteados?: Set<number>; apenasNaoSorteados?: boolean; apenasSorteados?: boolean }
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  const dataAtual = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

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
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(titulo.toUpperCase(), 14, 22);
  
  // Count badge
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageWidth - 55, 10, 41, 16, 3, 3, 'F');
  doc.setTextColor(34, 197, 94);
  doc.setFontSize(11);
  doc.text(`${inscritosFiltrados.length} inscritos`, pageWidth - 34, 21, { align: 'center' });

  const statusLabelMap: Record<string, string> = {
    PAID: 'Pago',
    PENDING: 'Pendente',
    CANCELLED: 'Cancelado',
    MANUAL: 'Manual',
  };

  // ============ TABLE ============
  autoTable(doc, {
    startY: 45,
    margin: { bottom: FOOTER_MARGIN },
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
      fontSize: 8,
      cellPadding: 3,
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { cellWidth: 62 },
      2: { halign: 'center', cellWidth: 16 },
      3: { cellWidth: 40 },
      4: { cellWidth: 35 },
      5: { halign: 'center', cellWidth: 18 },
    },
    alternateRowStyles: {
      fillColor: [250, 250, 252],
    },
    bodyStyles: {
      textColor: [50, 50, 50],
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

  // ============ FOOTER ============
  addFooter(doc, dataAtual);
  
  const fileName = `inscritos-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

export async function generatePodioPDF(
  equipes: EquipeComParticipantes[],
  gincanaName?: string
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  const dataAtual = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

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
    ranking.map(async (equipe, index) => {
      if (!equipe.imagemUrl) return;
      const base64 = await getImageBase64(equipe.imagemUrl);
      imageMap.set(equipe.id, base64);
    })
  );

  // ============ HEADER ============
  const headerHeight = 52;
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');
  doc.setFillColor(250, 204, 21);
  doc.rect(0, headerHeight - 4, pageWidth, 4, 'F');
  
  doc.setFontSize(26);
  doc.setTextColor(250, 204, 21);
  doc.setFont('helvetica', 'bold');
  doc.text('PÓDIO GERAL', pageWidth / 2, 24, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'normal');
  doc.text(gincanaName || 'Pontuação Geral', pageWidth / 2, 38, { align: 'center' });
  
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(dataAtual, pageWidth - 12, 16, { align: 'right' });

  // ============ TOP 3 ============
  const podiumY = headerHeight + 14;
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
    let displayName = equipe.nome;
    while (doc.getTextWidth(displayName) > maxNameWidth && displayName.length > 3) {
      displayName = displayName.slice(0, -1);
    }
    if (displayName.length < equipe.nome.length) {
      displayName = `${displayName.slice(0, -1)}…`;
    }
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
    margin: { bottom: FOOTER_MARGIN },
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
      lineColor: [220, 220, 220],
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
      fillColor: [250, 250, 252],
    },
    bodyStyles: {
      textColor: [50, 50, 50],
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

  // ============ FOOTER ============
  addFooter(doc, dataAtual);
  
  const fileName = `podio-${gincanaName?.toLowerCase().replace(/\s+/g, '-') || 'gincana'}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

function isPontuacaoTorneio(pontuacao: Pontuacao, torneio: Torneio) {
  if (!pontuacao.observacao) return false;
  const obs = normalizeText(pontuacao.observacao);
  const torneioNome = normalizeText(torneio.nome);
  return obs.includes(torneioNome);
}

export function generatePontuacaoEquipePDF(
  equipe: Equipe,
  gincanas: Gincana[],
  torneios: Torneio[],
  pontuacoes: Pontuacao[]
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const teamColor = getEquipeColorHex(equipe);
  const rgb = hexToRgb(teamColor);

  const dataAtual = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const pontuacoesEquipe = pontuacoes.filter(p => p.equipeId === equipe.id);
  const totalEquipe = pontuacoesEquipe.reduce((sum, p) => sum + p.pontos, 0);

  // Header
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATORIO DE PONTUACAO', 14, 18);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(equipe.nome, 14, 25);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Equipe N ${equipe.numero}`, 14, 38);
  doc.text(`Total: ${totalEquipe} pts`, pageWidth - 14, 38, { align: 'right' });

  let currentY = 48;

  // Pontuacao por gincana
  if (gincanas.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text('Pontuacao por Gincana', 14, currentY);

    autoTable(doc, {
      startY: currentY + 6,
      margin: { bottom: FOOTER_MARGIN },
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
        lineColor: [220, 220, 220],
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
        fillColor: [250, 250, 252],
      },
      bodyStyles: {
        textColor: [50, 50, 50],
      },
    });

    const lastY = (doc as any).lastAutoTable?.finalY ?? currentY + 20;
    currentY = lastY + 10;
  } else {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text('Nenhuma gincana cadastrada.', 14, currentY + 6);
    currentY += 16;
  }

  // Pontuacao por torneio
  if (torneios.length > 0) {
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text('Pontuacao por Torneio', 14, currentY);

    autoTable(doc, {
      startY: currentY + 6,
      margin: { bottom: FOOTER_MARGIN },
      head: [['Torneio', 'Gincana', 'Pontos']],
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
        lineColor: [220, 220, 220],
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
        fillColor: [250, 250, 252],
      },
      bodyStyles: {
        textColor: [50, 50, 50],
      },
    });
  } else {
    if (currentY > pageHeight - 40) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text('Nenhum torneio cadastrado.', 14, currentY + 6);
  }

  addFooter(doc, dataAtual);

  const fileName = `pontuacao-${equipe.nome.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

export function generatePontuacaoGeralPDF(
  equipes: Equipe[],
  gincanas: Gincana[],
  torneios: Torneio[],
  pontuacoes: Pontuacao[]
) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const dataAtual = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

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

  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATORIO GERAL DE PONTUACAO', 14, 16);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(`Gerado em ${dataAtual}`, pageWidth - 14, 16, { align: 'right' });

  let currentY = 26;

  if (gincanas.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text('Pontuacao por Gincana', 14, currentY);

    autoTable(doc, {
      startY: currentY + 6,
      margin: { bottom: FOOTER_MARGIN },
      head: [['Equipe', ...gincanas.map(g => g.nome), 'Total']],
      body: equipesOrdenadas.map((e) => {
        const entry = equipesMap.get(e.id);
        const valores = gincanas.map(g => String(entry?.porGincana.get(g.id) || 0));
        return [e.nome, ...valores, String(entry?.total || 0)];
      }),
      styles: {
        fontSize: 8,
        cellPadding: 3,
        lineColor: [220, 220, 220],
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
        fillColor: [250, 250, 252],
      },
      bodyStyles: {
        textColor: [50, 50, 50],
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
    if (currentY > pageHeight - 40) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text('Pontuacao por Torneio', 14, currentY);

    autoTable(doc, {
      startY: currentY + 6,
      margin: { bottom: FOOTER_MARGIN },
      head: [['Equipe', ...torneios.map(t => t.nome), 'Total Torneios']],
      body: equipesOrdenadas.map((e) => {
        const entry = equipesMap.get(e.id);
        const valores = torneios.map(t => String(entry?.porTorneio.get(t.id) || 0));
        const totalTorneios = torneios.reduce((sum, t) => sum + (entry?.porTorneio.get(t.id) || 0), 0);
        return [e.nome, ...valores, String(totalTorneios)];
      }),
      styles: {
        fontSize: 8,
        cellPadding: 3,
        lineColor: [220, 220, 220],
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
        fillColor: [250, 250, 252],
      },
      bodyStyles: {
        textColor: [50, 50, 50],
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index > 0) {
          data.cell.styles.halign = 'right';
        }
      },
    });
  }

  addFooter(doc, dataAtual);

  const fileName = `pontuacao-geral-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
