/**
 * Desafio: Dominó, uma partida para 2 jogadores.
 *
 * Toda a regra de negócio do jogo está neste arquivo, junto com os casos de
 * teste. Os testes simulam a partida: distribuição das peças, quem começa,
 * encaixe nas pontas, compra no monte, passe, batida, jogo trancado e contagem
 * de pontos.
 *
 * Regras adotadas (dominó "duplo seis", 28 peças):
 *   - Cada jogador recebe 7 peças; as 14 restantes formam o monte.
 *   - Começa quem tiver a maior carroça (6-6, depois 5-5 ...); essa peça abre a mesa.
 *     Sem carroça nas mãos, começa quem tiver a peça de maior soma.
 *   - Na sua vez, o jogador encaixa uma peça numa das pontas (esquerda ou direita).
 *   - Quem não tem peça que encaixe compra do monte até conseguir jogar.
 *     Com o monte vazio, passa a vez.
 *   - Bate quem ficar sem peças: ganha os pontos que sobraram na mão do adversário.
 *   - Se os dois passam seguidos, o jogo está trancado: vence quem tiver menos
 *     pontos na mão e ganha os pontos do adversário. Pontos iguais = empate.
 */

// ---------------------------------------------------------------------------
// Regras do jogo
// ---------------------------------------------------------------------------

const MAIOR_NUMERO = 6;
const PECAS_POR_JOGADOR = 7;

/** Gerador pseudoaleatório com semente (mulberry32), para partidas reproduzíveis. */
function criarAleatorio(semente) {
  let a = semente >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function criarPecas() {
  const pecas = [];
  for (let a = 0; a <= MAIOR_NUMERO; a++) for (let b = a; b <= MAIOR_NUMERO; b++) pecas.push([a, b]);
  return pecas;
}

function chave([a, b]) {
  return `${Math.min(a, b)}-${Math.max(a, b)}`;
}

function ehCarroca([a, b]) {
  return a === b;
}

function pontos(pecas) {
  return pecas.reduce((soma, [a, b]) => soma + a + b, 0);
}

function validarPeca(peca) {
  const valida =
    Array.isArray(peca) &&
    peca.length === 2 &&
    peca.every((n) => Number.isInteger(n) && n >= 0 && n <= MAIOR_NUMERO);
  if (!valida) throw new Error(`Peça inválida: ${JSON.stringify(peca)}`);
}

function embaralhar(lista, aleatorio) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

class Domino {
  /**
   * Partida nova: informe só `nomes` e, se quiser, `aleatorio`.
   * Cenário montado (para testes): informe `maos` e, se quiser, `monte`, `mesa` e `vez`.
   */
  constructor({ nomes = ['Jogador 1', 'Jogador 2'], aleatorio = Math.random, maos = null, monte = null, mesa = null, vez = 0 } = {}) {
    let maosIniciais;
    let monteInicial;
    let mesaInicial = [];

    if (maos) {
      mesaInicial = (mesa || []).map((p) => [...p]);
      maosIniciais = maos.map((mao) => mao.map((p) => [...p]));
      const usadas = new Set([...maosIniciais.flat(), ...mesaInicial].map(chave));
      monteInicial = monte ? monte.map((p) => [...p]) : criarPecas().filter((p) => !usadas.has(chave(p)));
    } else {
      const embaralhadas = embaralhar(criarPecas(), aleatorio);
      maosIniciais = [embaralhadas.slice(0, PECAS_POR_JOGADOR), embaralhadas.slice(PECAS_POR_JOGADOR, 2 * PECAS_POR_JOGADOR)];
      monteInicial = embaralhadas.slice(2 * PECAS_POR_JOGADOR);
    }

    if (nomes.length !== 2 || maosIniciais.length !== 2) throw new Error('A partida é para 2 jogadores');
    this._validarConjunto([...maosIniciais.flat(), ...monteInicial, ...mesaInicial]);
    this._validarMesa(mesaInicial);

    this.jogadores = nomes.map((nome, i) => ({ nome, mao: maosIniciais[i] }));
    this.monte = monteInicial;
    this.mesa = mesaInicial;
    this.passesSeguidos = 0;
    this.estado = 'jogando'; // 'jogando' | 'fim'
    this.resultado = null;

    if (this.mesa.length === 0) {
      if (maosIniciais.some((m) => m.length !== PECAS_POR_JOGADOR)) {
        throw new Error(`No início cada jogador tem ${PECAS_POR_JOGADOR} peças`);
      }
      const { jogador, peca } = this._quemComeca();
      this.vez = jogador;
      this.pecaInicial = peca;
    } else {
      if (vez !== 0 && vez !== 1) throw new Error('Vez inválida: use 0 ou 1');
      this.vez = vez;
      this.pecaInicial = null;
    }
  }

  get jogadorDaVez() {
    return this.jogadores[this.vez];
  }

  get pontas() {
    if (this.mesa.length === 0) return null;
    return { esquerda: this.mesa[0][0], direita: this.mesa[this.mesa.length - 1][1] };
  }

  /** Jogadas possíveis do jogador da vez: [{ peca, lado }]. */
  jogadasPossiveis() {
    const mao = this.jogadorDaVez.mao;
    if (this.mesa.length === 0) {
      return mao.filter((p) => chave(p) === chave(this.pecaInicial)).map((peca) => ({ peca, lado: 'direita' }));
    }
    const { esquerda, direita } = this.pontas;
    const jogadas = [];
    for (const peca of mao) {
      if (peca.includes(esquerda)) jogadas.push({ peca, lado: 'esquerda' });
      if (peca.includes(direita)) jogadas.push({ peca, lado: 'direita' });
    }
    return jogadas;
  }

  /** Coloca uma peça da mão do jogador da vez numa das pontas. */
  jogar(peca, lado) {
    this._validarEmAndamento();
    validarPeca(peca);
    const jogador = this.jogadorDaVez;
    const indice = jogador.mao.findIndex((p) => chave(p) === chave(peca));
    if (indice === -1) throw new Error(`A peça ${chave(peca)} não está na mão de ${jogador.nome}`);
    if (lado !== undefined && lado !== 'esquerda' && lado !== 'direita') throw new Error('Lado deve ser "esquerda" ou "direita"');

    if (this.mesa.length === 0) {
      if (chave(peca) !== chave(this.pecaInicial)) {
        throw new Error(`A primeira peça deve ser ${chave(this.pecaInicial)}`);
      }
      this.mesa.push([...peca]);
    } else {
      const { esquerda, direita } = this.pontas;
      const [a, b] = peca;
      if (lado === undefined) lado = peca.includes(direita) ? 'direita' : 'esquerda';
      const ponta = lado === 'direita' ? direita : esquerda;
      if (!peca.includes(ponta)) throw new Error(`A peça ${chave(peca)} não encaixa na ponta ${lado} (${ponta})`);
      if (lado === 'direita') this.mesa.push(a === ponta ? [a, b] : [b, a]);
      else this.mesa.unshift(b === ponta ? [a, b] : [b, a]);
    }

    jogador.mao.splice(indice, 1);
    this.passesSeguidos = 0;
    if (jogador.mao.length === 0) {
      this._encerrar('batida', this.vez);
      return;
    }
    this.vez = 1 - this.vez;
  }

  /** Compra uma peça do monte. Só é permitido a quem não tem peça que encaixe. */
  comprar() {
    this._validarEmAndamento();
    if (this.jogadasPossiveis().length > 0) throw new Error('Você tem peça para jogar; não pode comprar');
    if (this.monte.length === 0) throw new Error('O monte acabou; passe a vez');
    const peca = this.monte.shift();
    this.jogadorDaVez.mao.push(peca);
    return peca;
  }

  /** Passa a vez. Só é permitido sem peça que encaixe e com o monte vazio. */
  passar() {
    this._validarEmAndamento();
    if (this.jogadasPossiveis().length > 0) throw new Error('Você tem peça para jogar; não pode passar');
    if (this.monte.length > 0) throw new Error('Compre do monte antes de passar');
    this.passesSeguidos++;
    if (this.passesSeguidos >= 2) {
      this._encerrar('trancado');
      return;
    }
    this.vez = 1 - this.vez;
  }

  /** Mesa em texto, da esquerda para a direita: [6|6][6|4] ... */
  visualizarMesa() {
    return this.mesa.map(([a, b]) => `[${a}|${b}]`).join('');
  }

  _encerrar(motivo, quemBateu) {
    this.estado = 'fim';
    const [p0, p1] = this.jogadores.map((j) => pontos(j.mao));
    if (motivo === 'batida') {
      this.resultado = { motivo, vencedor: this.jogadores[quemBateu].nome, pontos: [p0, p1][1 - quemBateu] };
    } else if (p0 === p1) {
      this.resultado = { motivo, vencedor: null, pontos: 0 };
    } else {
      const venc = p0 < p1 ? 0 : 1;
      this.resultado = { motivo, vencedor: this.jogadores[venc].nome, pontos: [p0, p1][1 - venc] };
    }
  }

  _validarEmAndamento() {
    if (this.estado !== 'jogando') throw new Error('A partida já terminou');
  }

  _validarConjunto(pecas) {
    pecas.forEach(validarPeca);
    const chaves = pecas.map(chave);
    const repetida = chaves.find((k, i) => chaves.indexOf(k) !== i);
    if (repetida) throw new Error(`Peça repetida: ${repetida}`);
    if (chaves.length !== 28) throw new Error('O jogo precisa das 28 peças, nem mais nem menos');
  }

  _validarMesa(mesa) {
    for (let i = 1; i < mesa.length; i++) {
      if (mesa[i - 1][1] !== mesa[i][0]) throw new Error(`As peças da mesa não se encaixam na posição ${i}`);
    }
  }

  _quemComeca() {
    for (let n = MAIOR_NUMERO; n >= 0; n--) {
      const jogador = this.jogadores.findIndex((j) => j.mao.some((p) => chave(p) === chave([n, n])));
      if (jogador !== -1) return { jogador, peca: [n, n] };
    }
    let melhor = null;
    this.jogadores.forEach((j, jogador) => {
      for (const peca of j.mao) {
        const valor = (peca[0] + peca[1]) * 10 + Math.max(...peca);
        if (!melhor || valor > melhor.valor) melhor = { jogador, peca, valor };
      }
    });
    return { jogador: melhor.jogador, peca: melhor.peca };
  }
}

// ---------------------------------------------------------------------------
// Cenários usados nos testes
// ---------------------------------------------------------------------------

const MAO_ANA = [[6, 6], [6, 5], [5, 5], [1, 2], [0, 0], [3, 4], [2, 2]];
const MAO_BRUNO = [[6, 4], [4, 4], [5, 3], [1, 1], [0, 1], [2, 3], [6, 0]];

function partidaFixa() {
  return new Domino({ nomes: ['Ana', 'Bruno'], maos: [MAO_ANA, MAO_BRUNO] });
}

/** Mesa em que as 7 peças com 6 já saíram e as duas pontas são 6: ninguém mais consegue jogar. */
const MESA_TRANCADA = [[6, 0], [0, 1], [1, 6], [6, 6], [6, 2], [2, 3], [3, 6], [6, 4], [4, 5], [5, 6]];

function totalDePecas(jogo) {
  return jogo.jogadores[0].mao.length + jogo.jogadores[1].mao.length + jogo.monte.length + jogo.mesa.length;
}

// ---------------------------------------------------------------------------
// Casos de teste
// ---------------------------------------------------------------------------

describe('Peças', () => {
  test('o jogo tem 28 peças diferentes, de 0-0 a 6-6', () => {
    const pecas = criarPecas();
    expect(pecas).toHaveLength(28);
    expect(new Set(pecas.map(chave)).size).toBe(28);
    expect(pecas[0]).toEqual([0, 0]);
    expect(pecas[27]).toEqual([6, 6]);
  });

  test('são 7 carroças e a soma de todos os pontos é 168', () => {
    expect(criarPecas().filter(ehCarroca)).toHaveLength(7);
    expect(pontos(criarPecas())).toBe(168);
  });

  test('1-6 e 6-1 são a mesma peça', () => {
    expect(chave([1, 6])).toBe(chave([6, 1]));
  });
});

describe('Distribuição', () => {
  test('cada jogador recebe 7 peças e o monte fica com 14', () => {
    const jogo = new Domino({ aleatorio: criarAleatorio(1) });
    expect(jogo.jogadores[0].mao).toHaveLength(7);
    expect(jogo.jogadores[1].mao).toHaveLength(7);
    expect(jogo.monte).toHaveLength(14);
    expect(jogo.mesa).toHaveLength(0);
  });

  test('nenhuma peça se repete entre as mãos e o monte', () => {
    const jogo = new Domino({ aleatorio: criarAleatorio(2) });
    const todas = [...jogo.jogadores[0].mao, ...jogo.jogadores[1].mao, ...jogo.monte].map(chave);
    expect(new Set(todas).size).toBe(28);
  });

  test('a mesma semente distribui as mesmas peças', () => {
    const a = new Domino({ aleatorio: criarAleatorio(9) });
    const b = new Domino({ aleatorio: criarAleatorio(9) });
    expect(a.jogadores[0].mao).toEqual(b.jogadores[0].mao);
    expect(a.monte).toEqual(b.monte);
  });

  test('cenário com peça repetida, inválida ou faltando é recusado', () => {
    expect(() => new Domino({ maos: [[...MAO_ANA.slice(0, 6), [6, 4]], MAO_BRUNO] })).toThrow('Peça repetida: 4-6');
    expect(() => new Domino({ maos: [[...MAO_ANA.slice(0, 6), [7, 1]], MAO_BRUNO] })).toThrow('Peça inválida');
    expect(() => new Domino({ maos: [MAO_ANA, MAO_BRUNO], monte: [[1, 3]] })).toThrow('28 peças');
  });

  test('no início cada mão precisa ter exatamente 7 peças', () => {
    expect(() => new Domino({ maos: [MAO_ANA.slice(0, 6), MAO_BRUNO] })).toThrow('7 peças');
  });
});

describe('Quem começa', () => {
  test('começa quem tem a maior carroça, e ela abre a mesa', () => {
    const jogo = partidaFixa();
    expect(jogo.jogadorDaVez.nome).toBe('Ana');
    expect(jogo.pecaInicial).toEqual([6, 6]);
    expect(jogo.jogadasPossiveis()).toEqual([{ peca: [6, 6], lado: 'direita' }]);
  });

  test('sem o 6-6 nas mãos, vale a próxima carroça', () => {
    const ana = [[1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [2, 3], [2, 4]];
    const bruno = [[5, 5], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6]];
    const jogo = new Domino({ nomes: ['Ana', 'Bruno'], maos: [ana, bruno] });
    expect(jogo.jogadorDaVez.nome).toBe('Bruno');
    expect(jogo.pecaInicial).toEqual([5, 5]);
  });

  test('sem nenhuma carroça nas mãos, começa quem tem a peça de maior soma', () => {
    const j1 = [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 2]];
    const j2 = [[1, 3], [1, 4], [1, 5], [1, 6], [2, 3], [2, 4], [5, 6]];
    const jogo = new Domino({ maos: [j1, j2] });
    expect(jogo.vez).toBe(1);
    expect(jogo.pecaInicial).toEqual([5, 6]);
  });

  test('com empate na maior soma, começa a peça com o maior número', () => {
    const j1 = [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [4, 5]];
    const j2 = [[1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [2, 3], [3, 6]];
    const jogo = new Domino({ maos: [j1, j2] });
    expect(jogo.vez).toBe(1);
    expect(jogo.pecaInicial).toEqual([3, 6]);
  });

  test('a primeira jogada tem de ser a peça de abertura', () => {
    const jogo = partidaFixa();
    expect(() => jogo.jogar([6, 5])).toThrow('A primeira peça deve ser 6-6');
    jogo.jogar([6, 6]);
    expect(jogo.visualizarMesa()).toBe('[6|6]');
    expect(jogo.jogadorDaVez.nome).toBe('Bruno');
  });
});

describe('Jogadas', () => {
  test('a peça encaixa na ponta e é virada para casar o número', () => {
    const jogo = partidaFixa();
    jogo.jogar([6, 6]); // Ana
    jogo.jogar([4, 6], 'direita'); // Bruno: entra como [6|4]
    expect(jogo.visualizarMesa()).toBe('[6|6][6|4]');
    jogo.jogar([5, 6], 'esquerda'); // Ana: entra como [5|6]
    expect(jogo.visualizarMesa()).toBe('[5|6][6|6][6|4]');
    expect(jogo.pontas).toEqual({ esquerda: 5, direita: 4 });
  });

  test('peça que não encaixa na ponta escolhida é recusada', () => {
    const jogo = partidaFixa();
    jogo.jogar([6, 6]);
    jogo.jogar([6, 4], 'direita');
    expect(() => jogo.jogar([1, 2], 'direita')).toThrow('não encaixa na ponta direita (4)');
    expect(() => jogo.jogar([3, 4], 'esquerda')).toThrow('não encaixa na ponta esquerda (6)');
    expect(jogo.jogadorDaVez.nome).toBe('Ana');
  });

  test('sem informar o lado, a peça vai para a ponta onde encaixa', () => {
    const jogo = partidaFixa();
    jogo.jogar([6, 6]);
    jogo.jogar([6, 4]);
    jogo.jogar([3, 4]); // só encaixa na direita (4)
    expect(jogo.visualizarMesa()).toBe('[6|6][6|4][4|3]');
  });

  test('lado diferente de esquerda ou direita é recusado também na primeira jogada', () => {
    const jogo = partidaFixa();
    expect(() => jogo.jogar([6, 6], 'meio')).toThrow('Lado deve ser "esquerda" ou "direita"');
    expect(jogo.mesa).toHaveLength(0);
    expect(jogo.jogadorDaVez.nome).toBe('Ana');
  });

  test('ninguém joga peça que não está na própria mão', () => {
    const jogo = partidaFixa();
    jogo.jogar([6, 6]);
    expect(() => jogo.jogar([6, 5])).toThrow('não está na mão de Bruno');
  });

  test('a vez alterna entre os jogadores e a peça sai da mão', () => {
    const jogo = partidaFixa();
    jogo.jogar([6, 6]);
    expect(jogo.jogadores[0].mao).toHaveLength(6);
    expect(jogo.vez).toBe(1);
    jogo.jogar([6, 0]);
    expect(jogo.jogadores[1].mao).toHaveLength(6);
    expect(jogo.vez).toBe(0);
  });

  test('a lista de jogadas possíveis mostra cada encaixe', () => {
    const jogo = partidaFixa();
    jogo.jogar([6, 6]);
    jogo.jogar([6, 4], 'direita'); // pontas 6 e 4
    expect(jogo.jogadasPossiveis()).toEqual([
      { peca: [6, 5], lado: 'esquerda' },
      { peca: [3, 4], lado: 'direita' },
    ]);
  });
});

describe('Compra e passe', () => {
  const ANA = [[6, 6], [0, 0], [0, 1], [1, 1], [0, 2], [1, 2], [2, 2]];
  const BRUNO = [[5, 5], [4, 4], [3, 3], [3, 4], [3, 5], [4, 5], [0, 3]];

  test('quem não tem peça que encaixe compra até conseguir jogar', () => {
    const jogo = new Domino({ nomes: ['Ana', 'Bruno'], maos: [ANA, BRUNO] });
    jogo.jogar([6, 6]);
    expect(jogo.jogadasPossiveis()).toEqual([]);
    expect(jogo.comprar()).toEqual([0, 4]);
    expect(jogo.comprar()).toEqual([0, 5]);
    expect(jogo.comprar()).toEqual([0, 6]);
    expect(jogo.jogadasPossiveis().length).toBeGreaterThan(0);
    expect(() => jogo.comprar()).toThrow('não pode comprar');
    expect(jogo.jogadores[1].mao).toHaveLength(10);
    expect(jogo.monte).toHaveLength(11);
    jogo.jogar([0, 6]);
    expect(jogo.visualizarMesa()).toBe('[6|6][6|0]');
  });

  test('quem tem peça que encaixe não pode comprar nem passar', () => {
    const jogo = partidaFixa();
    expect(() => jogo.comprar()).toThrow('não pode comprar');
    expect(() => jogo.passar()).toThrow('não pode passar');
  });

  test('não pode passar enquanto houver peça no monte', () => {
    const jogo = new Domino({ nomes: ['Ana', 'Bruno'], maos: [ANA, BRUNO] });
    jogo.jogar([6, 6]);
    expect(() => jogo.passar()).toThrow('Compre do monte antes de passar');
  });

  test('com o monte vazio e sem jogada, o jogador passa a vez', () => {
    const resto = criarPecas().filter((p) => !MESA_TRANCADA.some((m) => chave(m) === chave(p)));
    const ana = [[0, 2], [5, 5]];
    const bruno = resto.filter((p) => !ana.some((a) => chave(a) === chave(p)));
    // monte vazio: todas as peças estão na mesa ou nas mãos, e as peças com 6 já estão todas na mesa
    const jogo = new Domino({ nomes: ['Ana', 'Bruno'], maos: [ana, bruno], monte: [], mesa: MESA_TRANCADA, vez: 0 });
    expect(() => jogo.comprar()).toThrow('O monte acabou');
    jogo.passar();
    expect(jogo.jogadorDaVez.nome).toBe('Bruno');
    expect(jogo.estado).toBe('jogando');
  });
});

describe('Fim da partida', () => {
  test('quem fica sem peças bate e ganha os pontos da mão do adversário', () => {
    const jogo = new Domino({
      nomes: ['Ana', 'Bruno'],
      maos: [[[6, 1]], [[0, 0], [5, 5], [2, 3]]],
      mesa: [[6, 6]],
      vez: 0,
    });
    expect(jogo.monte).toHaveLength(23);
    jogo.jogar([6, 1]);
    expect(jogo.estado).toBe('fim');
    expect(jogo.resultado).toEqual({ motivo: 'batida', vencedor: 'Ana', pontos: 15 });
  });

  test('jogo trancado: vence quem tem menos pontos e leva os pontos do outro', () => {
    const resto = criarPecas().filter((p) => !MESA_TRANCADA.some((m) => chave(m) === chave(p)));
    const ana = [[0, 0], [0, 2], [1, 1]]; // 4 pontos
    const bruno = resto.filter((p) => !ana.some((a) => chave(a) === chave(p)));
    const jogo = new Domino({ nomes: ['Ana', 'Bruno'], maos: [ana, bruno], monte: [], mesa: MESA_TRANCADA, vez: 0 });
    expect(jogo.pontas).toEqual({ esquerda: 6, direita: 6 });
    jogo.passar(); // Ana
    jogo.passar(); // Bruno
    expect(jogo.estado).toBe('fim');
    expect(jogo.resultado).toEqual({ motivo: 'trancado', vencedor: 'Ana', pontos: 86 });
  });

  test('jogo trancado: o segundo jogador também pode vencer', () => {
    const resto = criarPecas().filter((p) => !MESA_TRANCADA.some((m) => chave(m) === chave(p)));
    const bruno = [[0, 0], [0, 2], [1, 1]];
    const ana = resto.filter((p) => !bruno.some((b) => chave(b) === chave(p)));
    const jogo = new Domino({ nomes: ['Ana', 'Bruno'], maos: [ana, bruno], monte: [], mesa: MESA_TRANCADA, vez: 0 });
    jogo.passar();
    jogo.passar();
    expect(jogo.resultado).toEqual({ motivo: 'trancado', vencedor: 'Bruno', pontos: 86 });
  });

  test('jogo trancado com pontos iguais termina empatado', () => {
    const resto = criarPecas().filter((p) => !MESA_TRANCADA.some((m) => chave(m) === chave(p)));
    const ana = [[5, 5], [4, 4], [3, 5], [3, 4], [2, 5], [1, 4]]; // 45 pontos
    const bruno = resto.filter((p) => !ana.some((a) => chave(a) === chave(p)));
    expect(pontos(bruno)).toBe(45);
    const jogo = new Domino({ nomes: ['Ana', 'Bruno'], maos: [ana, bruno], monte: [], mesa: MESA_TRANCADA, vez: 1 });
    jogo.passar();
    jogo.passar();
    expect(jogo.resultado).toEqual({ motivo: 'trancado', vencedor: null, pontos: 0 });
  });

  test('uma jogada entre dois passes zera a contagem de passes', () => {
    // Ana não tem jogada; Bruno tem. Monte vazio.
    const mesa = [[6, 6]];
    const ana = [[0, 0]];
    const outras = criarPecas().filter((p) => !['6-6', '0-0'].includes(chave(p)));
    const jogo = new Domino({ nomes: ['Ana', 'Bruno'], maos: [ana, outras], monte: [], mesa, vez: 0 });
    jogo.passar(); // Ana
    jogo.jogar([6, 5]); // Bruno
    expect(jogo.passesSeguidos).toBe(0);
    jogo.passar(); // Ana continua sem jogada
    expect(jogo.estado).toBe('jogando');
  });

  test('mesa montada com peças que não se encaixam é recusada', () => {
    expect(() => new Domino({ maos: [[[1, 1]], [[2, 2]]], mesa: [[6, 6], [5, 4]] })).toThrow('não se encaixam');
  });

  test('depois do fim nenhuma ação é aceita', () => {
    const jogo = new Domino({ nomes: ['Ana', 'Bruno'], maos: [[[6, 1]], [[0, 0]]], mesa: [[6, 6]], vez: 0 });
    jogo.jogar([6, 1]);
    expect(() => jogo.jogar([0, 0])).toThrow('A partida já terminou');
    expect(() => jogo.comprar()).toThrow('A partida já terminou');
    expect(() => jogo.passar()).toThrow('A partida já terminou');
  });
});

describe('Partida simulada', () => {
  /** Jogador simples: joga a primeira peça que encaixa; se não houver, compra; se não puder, passa. */
  function jogarAteOFim(jogo) {
    let acoes = 0;
    while (jogo.estado === 'jogando') {
      const [jogada] = jogo.jogadasPossiveis();
      if (jogada) jogo.jogar(jogada.peca, jogada.lado);
      else if (jogo.monte.length > 0) jogo.comprar();
      else jogo.passar();
      expect(totalDePecas(jogo)).toBe(28);
      acoes++;
      if (acoes > 200) throw new Error('A partida não terminou');
    }
    return acoes;
  }

  test.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 2026])('partida sorteada vai até o fim com resultado válido (semente %i)', (semente) => {
    const jogo = new Domino({ nomes: ['Ana', 'Bruno'], aleatorio: criarAleatorio(semente) });
    jogarAteOFim(jogo);
    const { motivo, vencedor, pontos: ganhos } = jogo.resultado;
    expect(['batida', 'trancado']).toContain(motivo);
    if (motivo === 'batida') {
      const quem = jogo.jogadores.find((j) => j.nome === vencedor);
      const outro = jogo.jogadores.find((j) => j.nome !== vencedor);
      expect(quem.mao).toHaveLength(0);
      expect(ganhos).toBe(pontos(outro.mao));
    } else {
      expect(jogo.monte).toHaveLength(0);
    }
    // a mesa continua sendo uma corrente de peças encaixadas
    for (let i = 1; i < jogo.mesa.length; i++) expect(jogo.mesa[i - 1][1]).toBe(jogo.mesa[i][0]);
  });
});
