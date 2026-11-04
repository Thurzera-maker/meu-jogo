'use strict';

// Quanto tempo a abertura fica na tela antes de passar sozinha
const TEMPO_ABERTURA_MS = 2500;

// Tempos da largada
const ESPERA_PREPARO_MS = 1000;
const INTERVALO_LUZ_MS = 700;
const ESPERA_MINIMA_MS = 1000;
const ESPERA_MAXIMA_MS = 4000;
// Pausa depois do resultado, para um toque repetido não pular a mensagem
const TRAVA_RESULTADO_MS = 700;

// Regras de pontuação e dificuldade
const VIDAS_INICIAIS = 3;
const PONTOS_BASE = 1000;
const LIMITE_INICIAL_MS = 600;
const LIMITE_MINIMO_MS = 250;
const REDUCAO_LIMITE_MS = 25;

// Tempo para ler a última queimada antes da tela de fim
const ESPERA_FIM_MS = 1500;
// Pausa na tela de fim, para quem ainda está tocando não reiniciar sem ver a pontuação
const TRAVA_FIM_MS = 800;

// As quatro telas do jogo, buscadas uma vez só no HTML
const telas = {
  abertura: document.getElementById('tela-abertura'),
  inicial: document.getElementById('tela-inicial'),
  jogo: document.getElementById('tela-jogo'),
  fim: document.getElementById('tela-fim'),
};

const areaJogo = document.getElementById('area-jogo');
const luzes = document.querySelectorAll('.luz');
const mensagemLargada = document.getElementById('mensagem-largada');
const detalheLargada = document.getElementById('detalhe-largada');
const dicaLargada = document.getElementById('dica-largada');
const hudPontos = document.getElementById('hud-pontos');
const hudVidas = document.getElementById('hud-vidas');
const hudMelhor = document.getElementById('hud-melhor');
const pontuacaoFinal = document.getElementById('pontuacao-final');
const resumoFinal = document.getElementById('resumo-final');

let telaAtual = 'abertura';
let timerAbertura = null;

// Fases da largada: parado, preparando, luzes, apagado, travado, resultado
let estadoLargada = 'parado';
let timerLargada = null;
let luzesAcesas = 0;
let momentoApagou = 0;

// Dados da partida atual
let pontos = 0;
let vidas = VIDAS_INICIAIS;
let rodada = 1;
let melhorTempo = null;
let fimLiberado = false;

// Troca de tela: tira .ativa da atual e coloca na nova (o CSS faz a transição)
function mostrarTela(nome) {
  telas[telaAtual].classList.remove('ativa');
  telas[nome].classList.add('ativa');
  telaAtual = nome;
}

// Sai da abertura, seja pelo tempo ou por um toque do jogador
function sairDaAbertura() {
  if (telaAtual !== 'abertura') return;
  clearTimeout(timerAbertura);
  mostrarTela('inicial');
}

// Zera a partida e começa a primeira largada
function iniciarJogo() {
  pontos = 0;
  vidas = VIDAS_INICIAIS;
  rodada = 1;
  melhorTempo = null;
  atualizarHud();
  mostrarTela('jogo');
  prepararLargada();
}

// Na tela de fim, só recomeça depois da trava
function jogarDeNovo() {
  if (fimLiberado) iniciarJogo();
}

function textoMelhorTempo() {
  return melhorTempo === null ? '-- ms' : `${melhorTempo} ms`;
}

function atualizarHud() {
  hudPontos.textContent = pontos;
  hudVidas.textContent = '♥'.repeat(vidas) + '♡'.repeat(VIDAS_INICIAIS - vidas);
  hudMelhor.textContent = textoMelhorTempo();
}

function mostrarFimDeJogo() {
  pararLargada();
  pontuacaoFinal.textContent = pontos;
  resumoFinal.textContent = `Melhor tempo: ${textoMelhorTempo()} · Rodadas concluídas: ${rodada - 1}`;
  fimLiberado = false;
  mostrarTela('fim');
  timerLargada = setTimeout(() => {
    fimLiberado = true;
  }, TRAVA_FIM_MS);
}

// O limite cai a cada rodada até chegar no mínimo
function limiteDaRodada() {
  return Math.max(LIMITE_MINIMO_MS, LIMITE_INICIAL_MS - (rodada - 1) * REDUCAO_LIMITE_MS);
}

// Quanto menor o tempo, mais pontos; acima do limite não pontua
function pontosDaReacao(tempoMs, limiteMs) {
  return tempoMs <= limiteMs ? PONTOS_BASE - tempoMs : 0;
}

function textoRodada() {
  return `Rodada ${rodada} · limite ${limiteDaRodada()} ms`;
}

// Escreve o texto na tela; o CSS usa o feedback para escolher as cores
function mostrarMensagem(texto, detalhe = '', feedback = '') {
  mensagemLargada.textContent = texto;
  detalheLargada.textContent = detalhe;
  dicaLargada.textContent = '';
  areaJogo.dataset.feedback = feedback;
}

function apagarTodasAsLuzes() {
  luzes.forEach((luz) => luz.classList.remove('acesa'));
  luzesAcesas = 0;
}

// Cancela o que estiver agendado na largada
function pararLargada() {
  clearTimeout(timerLargada);
  estadoLargada = 'parado';
}

// Sorteia quanto tempo as 5 luzes ficam acesas antes de apagar
function sortearEspera() {
  return ESPERA_MINIMA_MS + Math.random() * (ESPERA_MAXIMA_MS - ESPERA_MINIMA_MS);
}

// Começa uma largada nova com todas as luzes desligadas
function prepararLargada() {
  pararLargada();
  apagarTodasAsLuzes();
  estadoLargada = 'preparando';
  mostrarMensagem('Prepare-se...', textoRodada());
  timerLargada = setTimeout(acenderProximaLuz, ESPERA_PREPARO_MS);
}

// Acende uma luz e agenda o próximo passo
function acenderProximaLuz() {
  estadoLargada = 'luzes';
  mostrarMensagem('Espere apagar...', textoRodada());
  luzes[luzesAcesas].classList.add('acesa');
  luzesAcesas += 1;

  if (luzesAcesas < luzes.length) {
    timerLargada = setTimeout(acenderProximaLuz, INTERVALO_LUZ_MS);
  } else {
    timerLargada = setTimeout(apagarLuzesDaLargada, sortearEspera());
  }
}

// O momento da largada: a partir daqui o relógio do jogador está correndo
function apagarLuzesDaLargada() {
  apagarTodasAsLuzes();
  estadoLargada = 'apagado';
  momentoApagou = performance.now();
  mostrarMensagem('VAI!', textoRodada(), 'vai');
}

// Mostra o resultado e só libera a próxima largada depois da trava
function finalizarLargada(texto, detalhe, feedback) {
  pararLargada();
  estadoLargada = 'travado';
  mostrarMensagem(texto, detalhe, feedback);
  timerLargada = setTimeout(() => {
    estadoLargada = 'resultado';
    dicaLargada.textContent = 'Toque para a próxima largada';
  }, TRAVA_RESULTADO_MS);
}

// Tira uma vida; a rodada não avança, então o limite continua o mesmo
function queimarLargada() {
  vidas -= 1;
  atualizarHud();

  if (vidas > 0) {
    finalizarLargada('QUEIMOU A LARGADA!', '-1 vida', 'queimou');
    return;
  }

  pararLargada();
  estadoLargada = 'travado';
  mostrarMensagem('QUEIMOU A LARGADA!', 'Sem vidas!', 'queimou');
  timerLargada = setTimeout(mostrarFimDeJogo, ESPERA_FIM_MS);
}

// Soma os pontos, guarda o melhor tempo e passa para a próxima rodada
function registrarReacao(tempoMs) {
  const limiteMs = limiteDaRodada();
  const ganho = pontosDaReacao(tempoMs, limiteMs);

  pontos += ganho;
  if (melhorTempo === null || tempoMs < melhorTempo) melhorTempo = tempoMs;
  rodada += 1;
  atualizarHud();

  if (ganho > 0) finalizarLargada(`${tempoMs} ms`, `+${ganho} pontos`, 'certo');
  else finalizarLargada(`${tempoMs} ms`, `Lento demais: limite era ${limiteMs} ms`, 'lento');
}

// Decide o que o toque, clique ou ESPAÇO significa na fase atual
function aoReagir(evento) {
  if (estadoLargada === 'luzes') {
    queimarLargada();
  } else if (estadoLargada === 'apagado') {
    // timeStamp é a hora do toque, mesmo que o navegador demore a avisar o jogo
    const tempoMs = Math.round(evento.timeStamp - momentoApagou);
    // Tempo zero ou negativo: o toque veio antes das luzes apagarem
    if (tempoMs <= 0) queimarLargada();
    else registrarReacao(tempoMs);
  } else if (estadoLargada === 'resultado') {
    prepararLargada();
  }
}

// pointerdown dispara ao encostar na tela, sem esperar o dedo levantar
function aoTocarArea(evento) {
  if (evento.button !== 0) return;
  aoReagir(evento);
}

// ESPAÇO faz a ação principal de cada tela
function aoApertarTecla(evento) {
  if (evento.code !== 'Space') return;
  evento.preventDefault();
  // Segurar a tecla não pode pular telas nem contar como reação
  if (evento.repeat) return;

  if (telaAtual === 'abertura') sairDaAbertura();
  else if (telaAtual === 'inicial') iniciarJogo();
  else if (telaAtual === 'fim') jogarDeNovo();
  else aoReagir(evento);
}

// Timers atrasam com a aba escondida, então a largada recomeça ao voltar
function aoMudarVisibilidade() {
  if (document.hidden) {
    if (['preparando', 'luzes', 'apagado'].includes(estadoLargada)) pararLargada();
  } else if (telaAtual === 'jogo' && estadoLargada === 'parado') {
    prepararLargada();
  }
}

// Liga os botões e teclas às funções e começa a abertura
function iniciarAplicacao() {
  telas.abertura.addEventListener('click', sairDaAbertura);
  document.getElementById('botao-jogar').addEventListener('click', iniciarJogo);
  document.getElementById('botao-jogar-novamente').addEventListener('click', jogarDeNovo);
  areaJogo.addEventListener('pointerdown', aoTocarArea);
  document.addEventListener('keydown', aoApertarTecla);
  document.addEventListener('visibilitychange', aoMudarVisibilidade);

  timerAbertura = setTimeout(sairDaAbertura, TEMPO_ABERTURA_MS);
}

iniciarAplicacao();
