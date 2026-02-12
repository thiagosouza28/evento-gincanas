import { generateStandardPDF } from '../src/lib/pdfGenerator';

export async function downloadRelatorioPdf() {
  await generateStandardPDF(
    {
      title: 'Relatório de Participantes',
      subtitle: 'Evento 2026',
      fileName: 'relatorio-participantes.pdf',
      blocks: [
        { type: 'text', text: 'Lista organizada de participantes por equipe.' },
        {
          type: 'table',
          head: ['Nº', 'Nome', 'CPF', 'Função'],
          body: [
            [1, 'Ana Pereira', '000.000.000-00', 'Capitã'],
            [2, 'Carlos Silva', '111.111.111-11', 'Membro'],
          ],
        },
      ],
    },
    'team',
    '#3b82f6'
  );
}
