

# 🏆 Sistema de Gincanas - PWA Offline-First

Uma aplicação web progressiva instalável para gerenciamento de eventos presenciais com sorteio balanceado de equipes, pontuação e ranking em tempo real.

---

## 🎯 Visão Geral

Sistema offline-first em tema escuro, otimizado para visualização em telões, com:
- Instalação como app no desktop/mobile
- Funcionamento 100% offline
- Sincronização automática quando online
- Interface em Português (Brasil)

---

## 📱 Telas Principais

### 1. Dashboard
- Visão geral do evento atual
- Status de conexão (online/offline)
- Acesso rápido às principais funções
- Contador de inscritos sincronizados

### 2. Configurações de API
- Campos para baseURL e token/apiKey
- Botão de sincronização manual
- Status da última sincronização
- Indicador de conexão

### 3. Tela de Sorteio (Alta Performance)
- Campo único para digitar número do inscrito
- Exibição instantânea dos dados (nome, idade, igreja, distrito)
- Botão de sorteio que distribui automaticamente entre as 8 equipes
- Animação de destaque mostrando a equipe sorteada
- Bloqueio visual para inscritos já sorteados
- Dados carregados em memória para resposta instantânea

### 4. Gestão de Equipes
- Lista das 8 equipes com nome, líder e vice-líder
- Cadastro e edição de equipes
- Contador de participantes por equipe
- Visualização dos membros de cada equipe

### 5. Gincanas
- Cadastro de gincanas (nome, data, descrição)
- Lista de gincanas realizadas
- Seleção da gincana ativa

### 6. Pontuação
- Seleção da gincana
- Cards das 8 equipes
- Adicionar/descontar pontos por equipe
- Campo de observação opcional
- Histórico de lançamentos

### 7. Pódio / Modo Telão
- Ranking automático por pontuação total
- Destaque visual especial para 1º, 2º e 3º lugar
- Animações celebratórias
- Modo tela cheia para projeção
- Tema escuro otimizado para visibilidade

---

## ⚡ Funcionalidades Técnicas

### Offline-First com IndexedDB
- Cache local de todos os inscritos
- Fila de sincronização para operações offline
- Sincronização automática ao recuperar conexão

### Sorteio Balanceado
- Algoritmo que identifica equipes com menos participantes
- Seleção aleatória entre equipes empatadas
- Garantia de que cada inscrito só é sorteado uma vez

### PWA Instalável
- Manifest para instalação no desktop/mobile
- Service Worker para funcionamento offline
- Ícones e splash screens

### Sincronização
- Lovable Cloud como backend
- Envio de dados locais (equipes, sorteios, pontuações)
- Resolução de conflitos por timestamp
- Inscritos são somente leitura (nunca enviados de volta)

---

## 🎨 Design

- **Tema escuro** otimizado para telões
- Cores vibrantes para destaques (equipes, pódio)
- Tipografia grande e legível
- Animações suaves nas transições
- Feedback visual imediato nas ações

---

## 📊 Dados Mock Iniciais

Incluirei dados de exemplo para:
- 50 inscritos fictícios
- 8 equipes pré-configuradas
- 2 gincanas de exemplo
- Pontuações de demonstração

Posteriormente você poderá configurar a API real para substituir o mock.

