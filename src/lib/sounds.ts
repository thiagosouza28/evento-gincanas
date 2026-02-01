// Utilitário de sons usando Web Audio API
// Sons sintéticos sem necessidade de arquivos externos

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

// Som de suspense/drumroll durante a animação
export function playDrumroll(duration: number = 1500): () => void {
  const ctx = getAudioContext();
  const startTime = ctx.currentTime;
  const endTime = startTime + duration / 1000;
  
  // Criar oscilador com tremolo para efeito de suspense
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  const lfoGain = ctx.createGain();
  const lfo = ctx.createOscillator();
  
  // LFO para tremolo
  lfo.frequency.value = 8; // 8Hz tremolo
  lfo.connect(lfoGain);
  lfoGain.gain.value = 0.1;
  lfoGain.connect(gainNode.gain);
  
  // Oscilador principal - som crescente de suspense
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(150, startTime);
  oscillator.frequency.linearRampToValueAtTime(400, endTime);
  
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.1);
  gainNode.gain.linearRampToValueAtTime(0.25, endTime - 0.1);
  gainNode.gain.linearRampToValueAtTime(0, endTime);
  
  lfo.start(startTime);
  oscillator.start(startTime);
  oscillator.stop(endTime);
  lfo.stop(endTime);
  
  // Retorna função para parar o som
  return () => {
    try {
      oscillator.stop();
      lfo.stop();
    } catch {
      // Ignora se já parou
    }
  };
}

// Som de revelação/sucesso
export function playReveal(): void {
  const ctx = getAudioContext();
  const startTime = ctx.currentTime;
  
  // Sequência de notas ascendentes para efeito de vitória
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  const noteDuration = 0.12;
  
  notes.forEach((freq, index) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.value = freq;
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    const noteStart = startTime + index * noteDuration;
    const noteEnd = noteStart + noteDuration * 1.5;
    
    gainNode.gain.setValueAtTime(0, noteStart);
    gainNode.gain.linearRampToValueAtTime(0.25, noteStart + 0.02);
    gainNode.gain.linearRampToValueAtTime(0, noteEnd);
    
    oscillator.start(noteStart);
    oscillator.stop(noteEnd);
  });
  
  // Adiciona um "shimmer" brilhante no final
  const shimmer = ctx.createOscillator();
  const shimmerGain = ctx.createGain();
  
  shimmer.type = 'sine';
  shimmer.frequency.value = 2093; // C7
  
  shimmer.connect(shimmerGain);
  shimmerGain.connect(ctx.destination);
  
  const shimmerStart = startTime + notes.length * noteDuration;
  shimmerGain.gain.setValueAtTime(0, shimmerStart);
  shimmerGain.gain.linearRampToValueAtTime(0.15, shimmerStart + 0.05);
  shimmerGain.gain.linearRampToValueAtTime(0, shimmerStart + 0.4);
  
  shimmer.start(shimmerStart);
  shimmer.stop(shimmerStart + 0.4);
}

// Som de clique/seleção
export function playClick(): void {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  oscillator.type = 'sine';
  oscillator.frequency.value = 800;
  
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  const startTime = ctx.currentTime;
  gainNode.gain.setValueAtTime(0.2, startTime);
  gainNode.gain.linearRampToValueAtTime(0, startTime + 0.05);
  
  oscillator.start(startTime);
  oscillator.stop(startTime + 0.05);
}

// Som de erro/inválido
export function playError(): void {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  oscillator.type = 'sawtooth';
  oscillator.frequency.value = 200;
  
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  const startTime = ctx.currentTime;
  gainNode.gain.setValueAtTime(0.15, startTime);
  gainNode.gain.linearRampToValueAtTime(0, startTime + 0.15);
  
  oscillator.frequency.setValueAtTime(200, startTime);
  oscillator.frequency.linearRampToValueAtTime(100, startTime + 0.15);
  
  oscillator.start(startTime);
  oscillator.stop(startTime + 0.15);
}
