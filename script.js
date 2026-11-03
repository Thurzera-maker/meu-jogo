'use strict';

// Quanto tempo a abertura fica na tela antes de passar sozinha
const TEMPO_ABERTURA_MS = 2500;

// As quatro telas do jogo, buscadas uma vez só no HTML
const telas = {
  abertura: document.getElementById('tela-abertura'),
  inicial: document.getElementById('tela-inicial'),
  jogo: document.getElementById('tela-jogo'),
  fim: document.getElementById('tela-fim'),
};

let telaAtual = 'abertura';
let timerAbertura = null;

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
}

function encerrarJogo() {
  mostrarTela('fim');
}

// ESPAÇO faz a ação principal de cada tela
function aoApertarTecla(evento) {
  if (evento.code !== 'Space') return;
  evento.preventDefault();
  // Segurar a tecla não pode pular várias telas de uma vez
  if (evento.repeat) return;

  if (telaAtual === 'abertura') sairDaAbertura();
  else if (telaAtual === 'inicial' || telaAtual === 'fim') iniciarJogo();
}

// Liga os botões e teclas às funções e começa a abertura
function iniciarAplicacao() {
  telas.abertura.addEventListener('click', sairDaAbertura);
  document.getElementById('botao-jogar').addEventListener('click', iniciarJogo);
  document.getElementById('botao-terminar').addEventListener('click', encerrarJogo);
  document.getElementById('botao-jogar-novamente').addEventListener('click', iniciarJogo);
  document.addEventListener('keydown', aoApertarTecla);

  timerAbertura = setTimeout(sairDaAbertura, TEMPO_ABERTURA_MS);
}

iniciarAplicacao();
