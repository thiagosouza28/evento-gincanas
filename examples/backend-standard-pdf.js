const express = require('express');
const { generateStandardPDF } = require('../src/lib/pdfGenerator');

const app = express();

app.get('/api/relatorio', async (_req, res) => {
  const doc = await generateStandardPDF(
    {
      title: 'Relatório de Equipes',
      subtitle: 'Evento 2026',
      blocks: [
        { type: 'text', text: 'Resumo geral de participantes.' },
        {
          type: 'table',
          head: ['Nº', 'Nome', 'CPF', 'Função'],
          body: [
            [1, 'Maria Souza', '000.000.000-00', 'Capitã'],
            [2, 'João Lima', '111.111.111-11', 'Membro'],
          ],
        },
      ],
    },
    'team',
    '#22c55e'
  );

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="relatorio.pdf"');
  res.send(pdfBuffer);
});

app.listen(3000, () => {
  console.log('Servidor iniciado em http://localhost:3000');
});
