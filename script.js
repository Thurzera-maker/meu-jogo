'use strict';

/* ==================== Constantes ==================== */

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

// Tempo para ler a última mensagem antes da tela de fim
const ESPERA_FIM_MS = 1500;
// Pausa na tela de fim, para quem ainda está tocando não reiniciar sem ver a pontuação
const TRAVA_FIM_MS = 800;

// Pista: 1 unidade do mundo é a metade da largura da pista
const VELOCIDADE_MAXIMA = 40;
const VELOCIDADE_MAXIMA_KMH = 320;
const ALTURA_CAMERA = 0.35;
const PERIODO_FAIXAS = 1.5;
const DISTANCIA_VISIVEL = 70;
const Z_MAIS_PERTO = 0.8;
const TOTAL_LEDS = 15;
const TEMPO_CORTINA_MS = 180;

// Como o carro se comporta em cada momento (resposta = rapidez da mudança)
const MODOS_CENA = {
  menu: { velocidade: 7, resposta: 1.5, rpm: 0.3, rivais: 0 },
  grid: { velocidade: 0, resposta: 6, rpm: 0.12, rivais: 0 },
  arrancada: { velocidade: VELOCIDADE_MAXIMA, resposta: 0.9, rpm: 1, rivais: 14 },
  lento: { velocidade: 15, resposta: 0.6, rpm: 0.55, rivais: 30 },
  queimou: { velocidade: 0, resposta: 3, rpm: 0, rivais: 0 },
};

const RIVAIS_INICIAIS = [
  { x: -0.42, posicao: 5, cor: '#17b8a6' },
  { x: 0.42, posicao: 8.5, cor: '#ff8a1f' },
  { x: -0.42, posicao: 12, cor: '#8d5cff' },
  { x: 0.42, posicao: 15.5, cor: '#f4f5f7' },
];

/* ==================== Elementos da página ==================== */

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

const elementoCena = document.getElementById('cena');
const cortina = document.getElementById('cortina');
const canvasPista = document.getElementById('pista');
const contexto = canvasPista.getContext('2d', { alpha: false });
const fundoPista = document.createElement('canvas');
const painelMarcha = document.getElementById('painel-marcha');
const painelVelocidade = document.getElementById('painel-velocidade');
const grupoLeds = document.getElementById('leds');
const movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ==================== Estado do jogo ==================== */

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

// Medidas da câmera, recalculadas quando a tela muda de tamanho
const camera = { largura: 0, altura: 0, horizonte: 0, escala: 0, passoLinha: 2, zLinhas: [], zLonge: 0 };

// O carro e o que se move em volta dele
const cena = {
  modo: 'menu',
  velocidade: 7,
  distancia: 0,
  rpm: 0.3,
  rpmAlvo: 0.3,
  mostrarRivais: false,
  rivais: [],
  fumaca: [],
  linhas: [],
  tremor: 0,
  ultimoQuadro: 0,
};

let timerCortina = null;
let ledsAcesos = -1;
let marchaMostrada = 'N';
let velocidadeMostrada = -1;

/* ==================== Navegação ==================== */

// Troca de tela: tira .ativa da atual e coloca na nova (o CSS faz a transição)
function mostrarTela(nome) {
  telas[telaAtual].classList.remove('ativa');
  telas[nome].classList.add('ativa');
  telaAtual = nome;
  document.body.dataset.tela = nome;
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
  definirModoCena('menu');
  pontuacaoFinal.textContent = pontos;
  resumoFinal.textContent = `Melhor tempo: ${textoMelhorTempo()} · Rodadas concluídas: ${rodada - 1}`;
  fimLiberado = false;
  mostrarTela('fim');
  timerLargada = setTimeout(() => {
    fimLiberado = true;
  }, TRAVA_FIM_MS);
}

/* ==================== Regras ==================== */

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

/* ==================== Largada ==================== */

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
  voltarAoGrid();
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
  elementoCena.dataset.estado = 'luzes';
  // O piloto acelera o motor parado a cada luz
  cena.rpmAlvo = 0.2 + (luzesAcesas / luzes.length) * 0.5;

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
function perderVida(texto, detalhe, feedback) {
  vidas -= 1;
  atualizarHud();

  if (vidas > 0) {
    finalizarLargada(texto, `${detalhe} · -1 vida`, feedback);
    return;
  }

  pararLargada();
  estadoLargada = 'travado';
  mostrarMensagem(texto, 'Sem vidas!', feedback);
  timerLargada = setTimeout(mostrarFimDeJogo, ESPERA_FIM_MS);
}

function queimarLargada() {
  definirModoCena('queimou');
  // O carro dá um pulo para a frente e trava
  cena.velocidade = 6;
  soltarFumaca(10);
  perderVida('QUEIMOU A LARGADA!', 'Saiu antes da hora', 'queimou');
}

// Reação dentro do limite: soma pontos e passa para a próxima rodada
function registrarReacao(tempoMs) {
  const limiteMs = limiteDaRodada();
  const ganho = pontosDaReacao(tempoMs, limiteMs);

  if (ganho === 0) {
    definirModoCena('lento');
    perderVida(`${tempoMs} ms`, `Lento demais! Limite: ${limiteMs} ms`, 'lento');
    return;
  }

  definirModoCena('arrancada');
  soltarFumaca(26);
  pontos += ganho;
  if (melhorTempo === null || tempoMs < melhorTempo) melhorTempo = tempoMs;
  rodada += 1;
  atualizarHud();
  finalizarLargada(`${tempoMs} ms`, `+${ganho} pontos`, 'certo');
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

/* ==================== Cena: estado do carro ==================== */

function definirModoCena(modo) {
  cena.modo = modo;
  cena.rpmAlvo = MODOS_CENA[modo].rpm;
  elementoCena.dataset.estado = modo;
}

// Coloca o carro e os rivais de volta nas posições de largada
function posicionarNoGrid() {
  cena.distancia = 0;
  cena.velocidade = 0;
  cena.fumaca = [];
  cena.mostrarRivais = true;
  cena.rivais = RIVAIS_INICIAIS.map((rival) => ({ ...rival, velocidade: 0 }));
}

// Se o carro andou, a tela escurece um instante para ele voltar à largada
function voltarAoGrid() {
  definirModoCena('grid');
  clearTimeout(timerCortina);
  cortina.animate(
    [{ opacity: 0 }, { opacity: 1, offset: 0.4 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }],
    { duration: TEMPO_CORTINA_MS * 2.5 },
  );
  timerCortina = setTimeout(posicionarNoGrid, TEMPO_CORTINA_MS);
}

function soltarFumaca(quantidade) {
  for (let i = 0; i < quantidade; i += 1) {
    const lado = i % 2 === 0 ? -1 : 1;
    cena.fumaca.push({
      x: camera.largura / 2 + lado * camera.largura * (0.32 + Math.random() * 0.14),
      y: camera.altura * (0.66 + Math.random() * 0.08),
      vx: lado * camera.largura * (0.1 + Math.random() * 0.35),
      vy: -camera.altura * (0.03 + Math.random() * 0.12),
      raio: camera.largura * (0.03 + Math.random() * 0.05),
      vida: 1,
    });
  }
}

function aproximar(atual, alvo, resposta, dt) {
  return atual + (alvo - atual) * (1 - Math.exp(-resposta * dt));
}

// Avança a física do carro, dos rivais e da fumaça
function atualizarCena(dt) {
  const modo = MODOS_CENA[cena.modo];

  cena.velocidade = aproximar(cena.velocidade, modo.velocidade, modo.resposta, dt);
  cena.distancia += cena.velocidade * dt;
  cena.rpm = aproximar(cena.rpm, cena.rpmAlvo, 7, dt);

  cena.rivais.forEach((rival) => {
    rival.velocidade = aproximar(rival.velocidade, modo.rivais, 0.7, dt);
    rival.posicao += rival.velocidade * dt;
  });

  cena.fumaca.forEach((puff) => {
    puff.x += puff.vx * dt;
    puff.y += puff.vy * dt;
    puff.raio *= 1 + 1.4 * dt;
    puff.vida -= dt * 0.9;
  });
  cena.fumaca = cena.fumaca.filter((puff) => puff.vida > 0);

  const forca = { arrancada: 5, lento: 2.5 }[cena.modo] || 0;
  cena.tremor = movimentoReduzido ? 0 : forca * (cena.velocidade / VELOCIDADE_MAXIMA + 0.25);
}

/* ==================== Cena: painel do volante ==================== */

function criarLeds() {
  for (let i = 0; i < TOTAL_LEDS; i += 1) {
    const led = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    led.setAttribute('cx', 332 + i * 24);
    led.setAttribute('cy', 341);
    led.setAttribute('r', 9);
    led.setAttribute('class', 'led');
    grupoLeds.appendChild(led);
  }
}

function classeDoLed(indice) {
  if (indice < 5) return 'ligado-verde';
  return indice < 10 ? 'ligado-vermelho' : 'ligado-azul';
}

// Atualiza LEDs, marcha e velocidade só quando o valor muda
function atualizarPainel() {
  const kmh = Math.round((cena.velocidade / VELOCIDADE_MAXIMA) * VELOCIDADE_MAXIMA_KMH);
  const emMovimento = cena.modo === 'arrancada' || cena.modo === 'lento';
  const marcha = Math.min(8, 1 + Math.floor(kmh / 42));
  // Nas trocas de marcha o giro cai e volta a subir
  const giro = emMovimento ? 0.55 + 0.45 * ((kmh % 42) / 42) : cena.rpm;
  const acesos = Math.round(giro * TOTAL_LEDS);

  if (acesos !== ledsAcesos) {
    ledsAcesos = acesos;
    grupoLeds.childNodes.forEach((led, indice) => {
      led.setAttribute('class', indice < acesos ? `led ${classeDoLed(indice)}` : 'led');
    });
  }

  let textoMarcha = emMovimento ? String(marcha) : 'N';
  if (cena.modo === 'queimou') textoMarcha = '!';
  if (textoMarcha !== marchaMostrada) {
    marchaMostrada = textoMarcha;
    painelMarcha.textContent = textoMarcha;
  }

  if (kmh !== velocidadeMostrada) {
    velocidadeMostrada = kmh;
    painelVelocidade.textContent = `${kmh} KM/H`;
  }
}

/* ==================== Cena: desenho da pista ==================== */

// Sorteio repetível: o fundo fica igual quando a tela muda de tamanho
function criarSorteio(semente) {
  let valor = semente;
  return () => {
    valor = (valor * 16807) % 2147483647;
    return valor / 2147483647;
  };
}

function misturarCor(corA, corB, peso) {
  const canal = (i) => Math.round(corA[i] + (corB[i] - corA[i]) * peso);
  return `rgb(${canal(0)},${canal(1)},${canal(2)})`;
}

// Céu, sol e arquibancadas distantes: só mudam com o tamanho da tela
function desenharFundo() {
  const { largura: L, altura: A, horizonte: H } = camera;
  const sorteio = criarSorteio(2024);
  fundoPista.width = L;
  fundoPista.height = A;
  const c = fundoPista.getContext('2d');

  const ceu = c.createLinearGradient(0, 0, 0, H);
  ceu.addColorStop(0, '#0b1030');
  ceu.addColorStop(0.5, '#3a2470');
  ceu.addColorStop(0.82, '#c94f73');
  ceu.addColorStop(1, '#ffb066');
  c.fillStyle = ceu;
  c.fillRect(0, 0, L, H + 2);

  const solX = L * 0.68;
  const solRaio = Math.max(L, A) * 0.34;
  const brilho = c.createRadialGradient(solX, H, 0, solX, H, solRaio);
  brilho.addColorStop(0, 'rgba(255,232,170,0.95)');
  brilho.addColorStop(0.16, 'rgba(255,190,120,0.55)');
  brilho.addColorStop(1, 'rgba(255,150,120,0)');
  c.fillStyle = brilho;
  c.fillRect(0, 0, L, H + 2);

  c.fillStyle = '#2a1b4d';
  c.beginPath();
  c.moveTo(0, H);
  for (let x = 0; x <= L; x += L / 40) {
    const onda = Math.sin(x / L * 7 + 1) * 0.5 + Math.sin(x / L * 17) * 0.25 + 1;
    c.lineTo(x, H - onda * A * 0.03);
  }
  c.lineTo(L, H);
  c.fill();

  // Prédios e arquibancadas ao longe, com luzinhas acesas
  let x = 0;
  while (x < L) {
    const largura = L * (0.03 + sorteio() * 0.06);
    const altura = A * (0.012 + sorteio() * 0.045);
    c.fillStyle = '#1b1438';
    c.fillRect(x, H - altura, largura, altura + 2);
    c.fillStyle = 'rgba(255,214,150,0.75)';
    for (let i = 0; i < 6; i += 1) {
      const tamanho = Math.max(1, L * 0.002);
      c.fillRect(x + sorteio() * largura, H - sorteio() * altura, tamanho, tamanho);
    }
    x += largura + L * 0.004;
  }

  c.fillStyle = '#0d2a20';
  c.fillRect(0, H, L, A - H);
}

// Mede a tela e prepara a tabela de distância de cada linha da pista
function ajustarCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const largura = Math.max(1, Math.round(window.innerWidth * dpr));
  const altura = Math.max(1, Math.round(window.innerHeight * dpr));

  canvasPista.width = largura;
  canvasPista.height = altura;
  camera.largura = largura;
  camera.altura = altura;
  // Tela deitada: horizonte mais baixo, para os rivais aparecerem abaixo do pórtico
  camera.horizonte = Math.round(altura * (altura > largura ? 0.44 : 0.5));
  camera.passoLinha = dpr > 1 ? 2 : 1;

  const descida = altura - camera.horizonte;
  camera.escala = descida / ALTURA_CAMERA;
  camera.zLonge = Math.sqrt(PERIODO_FAIXAS * descida);
  camera.zLinhas = [];
  for (let dy = 1; dy <= descida; dy += camera.passoLinha) {
    camera.zLinhas.push(descida / dy);
  }

  desenharFundo();
}

// Converte uma posição do mundo para a tela
function projetar(x, y, z) {
  const escala = camera.escala / z;
  return {
    x: camera.largura / 2 + x * escala,
    y: camera.horizonte + (ALTURA_CAMERA - y) * escala,
  };
}

function desenharPoligono(pontosTela, cor) {
  contexto.fillStyle = cor;
  contexto.beginPath();
  pontosTela.forEach((ponto, indice) => {
    if (indice === 0) contexto.moveTo(ponto.x, ponto.y);
    else contexto.lineTo(ponto.x, ponto.y);
  });
  contexto.closePath();
  contexto.fill();
}

// Retângulo deitado no chão, usado nas marcas da pista
function desenharNoChao(x1, x2, z1, z2, cor) {
  const perto = Math.max(z1, Z_MAIS_PERTO);
  if (z2 <= perto) return;
  desenharPoligono([projetar(x1, 0, perto), projetar(x2, 0, perto), projetar(x2, 0, z2), projetar(x1, 0, z2)], cor);
}

// Parede em pé ao lado da pista
function desenharParede(x, altura, z1, z2, cor) {
  const perto = Math.max(z1, Z_MAIS_PERTO);
  if (z2 <= perto) return;
  desenharPoligono([projetar(x, 0, perto), projetar(x, altura, perto), projetar(x, altura, z2), projetar(x, 0, z2)], cor);
}

// Chama a função para cada objeto repetido, do mais longe para o mais perto
function paraCadaObjeto(periodo, funcao) {
  const ultimo = Math.floor((cena.distancia + DISTANCIA_VISIVEL) / periodo);
  const primeiro = Math.floor(cena.distancia / periodo) - 1;
  for (let indice = ultimo; indice >= primeiro; indice -= 1) {
    funcao(indice * periodo - cena.distancia, indice);
  }
}

// Asfalto, grama e zebras, uma linha horizontal por vez
function desenharAsfalto() {
  const { largura: L, horizonte: H, escala, zLinhas, zLonge, passoLinha: passo } = camera;
  const centro = L / 2;
  // Em alta velocidade as faixas se misturam, como no borrão de movimento
  const borrao = Math.min(1, cena.velocidade / VELOCIDADE_MAXIMA) * 0.75;
  const zebraA = misturarCor([225, 32, 32], [235, 150, 150], borrao);
  const zebraB = misturarCor([240, 240, 245], [235, 150, 150], borrao);
  const gramaA = misturarCor([14, 62, 42], [13, 54, 38], borrao);
  const gramaB = misturarCor([12, 46, 33], [13, 54, 38], borrao);
  const asfaltoA = misturarCor([46, 48, 58], [42, 44, 53], borrao);
  const asfaltoB = misturarCor([38, 40, 49], [42, 44, 53], borrao);
  const zebraLonge = 'rgb(235,150,150)';

  for (let i = 0; i < zLinhas.length; i += 1) {
    const z = zLinhas[i];
    const y = H + 1 + i * passo;
    const metade = escala / z;
    const longe = z > zLonge;
    const faixa = Math.floor((z + cena.distancia) / PERIODO_FAIXAS) % 2 === 0;
    const zebra = metade * 0.09;

    contexto.fillStyle = faixa ? gramaA : gramaB;
    contexto.fillRect(0, y, L, passo + 1);
    contexto.fillStyle = faixa ? asfaltoA : asfaltoB;
    contexto.fillRect(centro - metade, y, metade * 2, passo + 1);

    // Marcas de borracha onde os carros passam
    contexto.fillStyle = 'rgba(0,0,0,0.22)';
    contexto.fillRect(centro - metade * 0.62, y, metade * 0.34, passo + 1);
    contexto.fillRect(centro + metade * 0.28, y, metade * 0.34, passo + 1);

    let corZebra = faixa ? zebraA : zebraB;
    if (longe) corZebra = zebraLonge;
    contexto.fillStyle = corZebra;
    contexto.fillRect(centro - metade - zebra, y, zebra, passo + 1);
    contexto.fillRect(centro + metade, y, zebra, passo + 1);
  }
}

// Linha de largada xadrez e as vagas do grid, em posição fixa na pista
function desenharMarcasDoGrid() {
  const d = cena.distancia;
  if (d > 30) return;

  for (let coluna = 0; coluna < 16; coluna += 1) {
    for (let fileira = 0; fileira < 2; fileira += 1) {
      const cor = (coluna + fileira) % 2 === 0 ? '#f4f5f7' : '#101217';
      const x = -1 + coluna / 8;
      const z = 3.6 + fileira * 0.3 - d;
      desenharNoChao(x, x + 0.125, z, z + 0.3, cor);
    }
  }

  RIVAIS_INICIAIS.forEach((rival) => {
    const z = rival.posicao - 0.55 - d;
    desenharNoChao(rival.x - 0.34, rival.x + 0.34, z, z + 0.09, '#f4f5f7');
    desenharNoChao(rival.x - 0.34, rival.x - 0.3, z, z + 0.7, '#f4f5f7');
    desenharNoChao(rival.x + 0.3, rival.x + 0.34, z, z + 0.7, '#f4f5f7');
  });
}

// Arquibancadas, postes de luz e barreiras que passam pelos lados
function desenharObjetosDaPista() {
  paraCadaObjeto(36, (z) => {
    [-1, 1].forEach((lado) => {
      const x = lado * 2.35;
      desenharParede(x, 1.7, z, z + 22, '#141626');
      desenharParede(x, 1.5, z, z + 22, '#3f2a5c');
      desenharParede(x, 1.15, z, z + 22, '#7a3b5e');
      desenharParede(x, 0.8, z, z + 22, '#3a5a86');
      desenharParede(x, 0.45, z, z + 22, '#22243a');
    });
  });

  paraCadaObjeto(9, (z) => {
    if (z < Z_MAIS_PERTO) return;
    [-1, 1].forEach((lado) => {
      const base = projetar(lado * 1.62, 0, z);
      const topo = projetar(lado * 1.62, 2, z);
      const espessura = Math.max(1, (camera.escala / z) * 0.03);
      contexto.fillStyle = '#10121a';
      contexto.fillRect(base.x - espessura / 2, topo.y, espessura, base.y - topo.y);
      contexto.fillStyle = '#fff3cf';
      contexto.fillRect(topo.x - espessura * 3, topo.y, espessura * 6, espessura * 1.6);
    });
  });

  paraCadaObjeto(3, (z, indice) => {
    const cor = indice % 2 === 0 ? '#b9bdc9' : '#1c3563';
    desenharParede(-1.32, 0.24, z, z + 3, cor);
    desenharParede(1.32, 0.24, z, z + 3, cor);
  });
}

// Carro rival visto de trás, sem semelhança com carros reais
function desenharRival(rival) {
  const z = rival.posicao - cena.distancia;
  if (z < Z_MAIS_PERTO || z > DISTANCIA_VISIVEL) return;

  const base = projetar(rival.x, 0, z);
  const w = (camera.escala / z) * 0.56;
  const h = w * 0.5;
  const parte = (x, y, largura, altura, cor) => {
    contexto.fillStyle = cor;
    contexto.fillRect(base.x + x * w, base.y - y * h, largura * w, altura * h);
  };

  parte(-0.5, 0.56, 0.2, 0.56, '#07080b');
  parte(0.3, 0.56, 0.2, 0.56, '#07080b');
  parte(-0.3, 0.42, 0.6, 0.3, rival.cor);
  parte(-0.1, 0.84, 0.2, 0.45, rival.cor);
  parte(-0.14, 0.95, 0.28, 0.14, '#101217');
  parte(-0.36, 1.02, 0.72, 0.1, rival.cor);
  parte(-0.38, 1.1, 0.05, 0.42, '#101217');
  parte(0.33, 1.1, 0.05, 0.42, '#101217');
  parte(-0.04, 0.22, 0.08, 0.1, '#ff2b2b');
}

function desenharRivais() {
  if (!cena.mostrarRivais) return;
  [...cena.rivais].sort((a, b) => b.posicao - a.posicao).forEach(desenharRival);
}

// Riscos saindo do centro da tela, mais longos quanto maior a velocidade
function desenharLinhasDeVelocidade() {
  const intensidade = (cena.velocidade - 12) / (VELOCIDADE_MAXIMA - 12);
  if (intensidade <= 0) return;

  const centroX = camera.largura / 2;
  const centroY = camera.horizonte;
  const raioMaximo = Math.hypot(camera.largura, camera.altura) * 0.75;

  contexto.lineCap = 'round';
  contexto.lineWidth = Math.max(1.5, camera.largura * 0.003);
  contexto.strokeStyle = `rgba(255,255,255,${0.42 * intensidade})`;
  contexto.beginPath();
  cena.linhas.forEach((linha) => {
    linha.raio += (cena.velocidade * 0.0009 + 0.008) * (1 + linha.raio * 3);
    if (linha.raio > 1) {
      linha.raio = 0.18;
      linha.angulo = Math.random() * Math.PI * 2;
    }
    const inicio = linha.raio * raioMaximo;
    const fim = inicio + raioMaximo * 0.2 * intensidade * (0.4 + linha.raio);
    const cosseno = Math.cos(linha.angulo);
    const seno = Math.sin(linha.angulo);
    contexto.moveTo(centroX + cosseno * inicio, centroY + seno * inicio);
    contexto.lineTo(centroX + cosseno * fim, centroY + seno * fim);
  });
  contexto.stroke();
}

function desenharFumaca() {
  cena.fumaca.forEach((puff) => {
    contexto.fillStyle = `rgba(215,218,226,${puff.vida * 0.34})`;
    contexto.beginPath();
    contexto.arc(puff.x, puff.y, puff.raio, 0, Math.PI * 2);
    contexto.fill();
  });
}

function desenharCena() {
  const { largura: L, altura: A } = camera;
  const zoom = 1.02 + (cena.velocidade / VELOCIDADE_MAXIMA) * 0.07;
  const tremorX = (Math.random() - 0.5) * cena.tremor * 2;
  const tremorY = (Math.random() - 0.5) * cena.tremor * 2;

  contexto.setTransform(zoom, 0, 0, zoom, L / 2 * (1 - zoom) + tremorX, camera.horizonte * (1 - zoom) + tremorY);
  contexto.drawImage(fundoPista, 0, 0);
  desenharAsfalto();
  desenharMarcasDoGrid();
  desenharObjetosDaPista();
  desenharRivais();
  desenharLinhasDeVelocidade();
  desenharFumaca();
}

// Laço de animação: roda uma vez por quadro enquanto a página está visível
function animarCena(agora) {
  const dt = Math.min(0.05, (agora - cena.ultimoQuadro) / 1000);
  cena.ultimoQuadro = agora;

  if (telaAtual !== 'abertura') {
    atualizarCena(dt);
    desenharCena();
    atualizarPainel();
  }
  requestAnimationFrame(animarCena);
}

/* ==================== Entradas do jogador ==================== */

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

/* ==================== Início ==================== */

// Liga os botões e teclas às funções, prepara a cena e começa a abertura
function iniciarAplicacao() {
  telas.abertura.addEventListener('click', sairDaAbertura);
  document.getElementById('botao-jogar').addEventListener('click', iniciarJogo);
  document.getElementById('botao-jogar-novamente').addEventListener('click', jogarDeNovo);
  areaJogo.addEventListener('pointerdown', aoTocarArea);
  document.addEventListener('keydown', aoApertarTecla);
  document.addEventListener('visibilitychange', aoMudarVisibilidade);
  window.addEventListener('resize', ajustarCanvas);

  criarLeds();
  cena.linhas = Array.from({ length: 46 }, () => ({
    raio: 0.18 + Math.random() * 0.8,
    angulo: Math.random() * Math.PI * 2,
  }));
  ajustarCanvas();
  requestAnimationFrame(animarCena);

  timerAbertura = setTimeout(sairDaAbertura, TEMPO_ABERTURA_MS);
}

iniciarAplicacao();
