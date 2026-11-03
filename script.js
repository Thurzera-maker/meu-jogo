'use strict';

// Quanto tempo a abertura fica na tela antes de passar sozinha
const TEMPO_ABERTURA_MS = 2500;

// Tempos da largada
const ESPERA_PREPARO_MS = 1000;
const INTERVALO_LUZ_MS = 700;
const ESPERA_MINIMA_MS = 800;
const ESPERA_MAXIMA_MS = 3000;
// Pausa depois do resultado, para um toque repetido não pular a mensagem
const TRAVA_RESULTADO_MS = 700;

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

let telaAtual = 'abertura';
let timerAbertura = null;

// Fases da largada: parado, preparando, luzes, apagado, travado, resultado
let estadoLargada = 'parado';
let timerLargada = null;
let luzesAcesas = 0;
let momentoApagou = 0;

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

function iniciarJogo() {
  mostrarTela('jogo');
  prepararLargada();
}

function encerrarJogo() {
  pararLargada();
  mostrarTela('fim');
}

// Escreve o texto na tela; o CSS usa o feedback para escolher as cores
function mostrarMensagem(texto, detalhe = '', feedback = '') {
  mensagemLargada.textContent = texto;
  detalheLargada.textContent = detalhe;
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
  mostrarMensagem('Prepare-se...');
  timerLargada = setTimeout(acenderProximaLuz, ESPERA_PREPARO_MS);
}

// Acende uma luz e agenda o próximo passo
function acenderProximaLuz() {
  estadoLargada = 'luzes';
  mostrarMensagem('Espere apagar...');
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
  mostrarMensagem('VAI!', '', 'vai');
}

// Mostra o resultado e só libera a próxima largada depois da trava
function finalizarLargada(texto, feedback) {
  pararLargada();
  estadoLargada = 'travado';
  mostrarMensagem(texto, '', feedback);
  timerLargada = setTimeout(() => {
    estadoLargada = 'resultado';
    detalheLargada.textContent = 'Toque para a próxima largada';
  }, TRAVA_RESULTADO_MS);
}

function queimarLargada() {
  finalizarLargada('QUEIMOU A LARGADA!', 'queimou');
}

function registrarReacao(tempoMs) {
  finalizarLargada(`${tempoMs} ms`, 'certo');
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
  if (evento.button !== 0 || evento.target.closest('button')) return;
  aoReagir(evento);
}

// ESPAÇO faz a ação principal de cada tela
function aoApertarTecla(evento) {
  if (evento.code !== 'Space') return;
  evento.preventDefault();
  // Segurar a tecla não pode pular telas nem contar como reação
  if (evento.repeat) return;

  if (telaAtual === 'abertura') sairDaAbertura();
  else if (telaAtual === 'inicial' || telaAtual === 'fim') iniciarJogo();
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
  document.getElementById('botao-terminar').addEventListener('click', encerrarJogo);
  document.getElementById('botao-jogar-novamente').addEventListener('click', iniciarJogo);
  areaJogo.addEventListener('pointerdown', aoTocarArea);
  document.addEventListener('keydown', aoApertarTecla);
  document.addEventListener('visibilitychange', aoMudarVisibilidade);

  timerAbertura = setTimeout(sairDaAbertura, TEMPO_ABERTURA_MS);
}

iniciarAplicacao();
