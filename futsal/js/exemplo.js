/* =========================================================
   EXEMPLO.JS — Cria um campeonato fictício para testar.

   - Sub-9: pontos corridos, 4 times (2 rodadas já jogadas)
   - Sub-11: 2 grupos + mata-mata, 6 times (grupos jogados,
     uma semifinal decidida nos pênaltis)

   Usa um gerador de números "pseudo-aleatórios" com semente
   fixa, para o exemplo sair sempre igual.
   ========================================================= */

var App = globalThis.App = globalThis.App || {};

App.exemplo = {
  /** Gerador simples com semente (sempre gera a mesma sequência). */
  criarAleatorio(semente) {
    let x = semente;
    return () => {
      x = (x * 1664525 + 1013904223) % 4294967296;
      return x / 4294967296;
    };
  },

  NOMES: ['Lucas', 'Gabriel', 'Miguel', 'Arthur', 'Heitor', 'Davi', 'Bernardo', 'Theo', 'Pedro', 'Rafael',
    'Enzo', 'Lorenzo', 'Matheus', 'Samuel', 'Benício', 'Joaquim', 'Bento', 'Caio', 'Vitor', 'Nicolas',
    'Felipe', 'Gustavo', 'Murilo', 'João', 'Henrique', 'Otávio', 'Bruno', 'Ian', 'Léo', 'Daniel'],
  SOBRENOMES: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Rodrigues', 'Almeida', 'Nascimento',
    'Ferreira', 'Araújo', 'Ribeiro', 'Gomes', 'Martins', 'Carvalho', 'Rocha', 'Barbosa', 'Moura', 'Teixeira'],

  carregar() {
    const D = App.dados;
    const U = App.util;
    const rnd = this.criarAleatorio(2026);
    const pegar = (lista) => lista[Math.floor(rnd() * lista.length)];

    // novoCampeonato: privado e com você como admin (no modo online)
    const camp = D.novoCampeonato({
      nome: 'Copa Primavera de Futsal Infantil (exemplo)',
      local: 'Ginásio Municipal Vila Nova',
      dataInicio: '2026-10-03',
      dataFim: '2026-11-28',
    });
    const sub9 = { id: U.id(), nome: 'Sub-9', config: D.configPadrao('Sub-9', 2026), grupos: [] };
    const sub11 = { id: U.id(), nome: 'Sub-11', config: D.configPadrao('Sub-11', 2026), grupos: [] };
    sub11.config.formato = 'grupos';
    sub11.config.numGrupos = 2;
    sub11.config.classificadosPorGrupo = 2;
    sub11.config.terceiroLugar = true;
    camp.categorias.push(sub9, sub11);
    D.db.campeonatos.push(camp);

    // ---------- Times ----------
    const criarTime = (cat, nome, cor, anoBase) => {
      const time = {
        id: U.id(), campeonatoId: camp.id, categoriaId: cat.id, nome, cor, escudo: '',
        tecnico: `${pegar(this.NOMES)} ${pegar(this.SOBRENOMES)}`,
        responsavel: `${pegar(['Ana', 'Carla', 'Fernanda', 'Juliana', 'Patrícia', 'Roberto', 'Marcos'])} ${pegar(this.SOBRENOMES)}`,
        telefone: `(11) 9${Math.floor(1000 + rnd() * 8999)}-${Math.floor(1000 + rnd() * 8999)}`,
        sorteio: rnd(),
        jogadores: [],
      };
      const numeros = [1, 12, 2, 3, 4, 5, 7, 8, 9, 10, 11];
      for (let i = 0; i < 10; i++) {
        const ano = anoBase + (rnd() < 0.5 ? 0 : 1);
        const mes = String(1 + Math.floor(rnd() * 12)).padStart(2, '0');
        const dia = String(1 + Math.floor(rnd() * 28)).padStart(2, '0');
        time.jogadores.push({
          id: U.id(),
          numero: numeros[i],
          nome: `${pegar(this.NOMES)} ${pegar(this.SOBRENOMES)}`,
          nascimento: `${ano}-${mes}-${dia}`,
          posicao: i < 2 ? 'goleiro' : 'linha',
        });
      }
      D.db.times.push(time);
      return time;
    };

    const t9 = [
      criarTime(sub9, 'Leões da Vila', '#f2b705', 2018),
      criarTime(sub9, 'Tubarões FC', '#1f6fd1', 2018),
      criarTime(sub9, 'Furacão Mirim', '#d93a2b', 2018),
      criarTime(sub9, 'Estrela do Norte', '#6b3fa0', 2018),
    ];
    // Um jogador mais velho para mostrar o alerta de idade
    t9[2].jogadores[5].nascimento = '2016-04-10';
    t9[2].jogadores[5].nome = 'Rodrigo Mendes';

    criarTime(sub11, 'Águias Douradas', '#e08e0b', 2016);
    criarTime(sub11, 'Real Juventude', '#0f7a3d', 2016);
    criarTime(sub11, 'Panteras Negras', '#222222', 2016);
    criarTime(sub11, 'Atlético Bairro Alto', '#c2185b', 2016);
    criarTime(sub11, 'Unidos da Quadra', '#00838f', 2016);
    criarTime(sub11, 'Raio Azul', '#3949ab', 2016);

    // ---------- Tabelas ----------
    App.tabela.gerar(sub9.id, { sortear: false });
    App.tabela.gerar(sub11.id, { sortear: false });

    // Datas: uma rodada por sábado
    const sabado = (n) => {
      const d = new Date('2026-10-03T12:00:00');
      d.setDate(d.getDate() + 7 * n);
      return d.toISOString().slice(0, 10);
    };
    const datar = (cat, horaInicial) => {
      const jogos = D.jogosDaCategoria(cat.id);
      let contador = {};
      for (const j of jogos) {
        const semana = j.fase === 'mata' ? 3 + (j.rodadaNome === 'Final' || j.terceiro ? 1 : 0) : j.rodada - 1;
        contador[semana] = (contador[semana] || 0);
        const minutos = horaInicial * 60 + contador[semana] * 50;
        j.data = sabado(semana);
        j.hora = `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
        j.quadra = contador[semana] % 2 === 0 ? 'Quadra 1' : 'Quadra 2';
        contador[semana]++;
      }
    };
    datar(sub9, 8);
    datar(sub11, 10);

    // ---------- Súmulas preenchidas ----------
    const jogar = (jogo, golsCasa, golsFora, extras = [], penaltis = null) => {
      const cfg = D.categoria(jogo.categoriaId).cat.config;
      const s = App.regras.novaSumula(jogo);
      s.arbitro1 = 'Carlos Menezes';
      s.arbitro2 = 'Paulo Henrique';
      s.mesario = 'Sônia Prado';
      s.anotador = 'Diego Alves';
      s.cronometrista = 'Renata Lopes';
      const ev = (tipo, timeId, jogadorId, extra = {}) => s.eventos.push(Object.assign({
        id: U.id(), tipo, timeId, jogadorId, assistenciaId: null,
        periodo: 1 + Math.floor(rnd() * cfg.numPeriodos),
        minuto: 1 + Math.floor(rnd() * cfg.duracaoPeriodo),
      }, extra));
      const linha = (time) => time.jogadores.filter((p) => p.posicao === 'linha');

      for (const [timeId, gols] of [[jogo.casaId, golsCasa], [jogo.foraId, golsFora]]) {
        const time = D.time(timeId);
        for (let g = 0; g < gols; g++) {
          const autor = pegar(linha(time));
          const outros = linha(time).filter((p) => p.id !== autor.id);
          ev('gol', timeId, autor.id, { assistenciaId: rnd() < 0.5 ? pegar(outros).id : null });
        }
        const faltas = 2 + Math.floor(rnd() * 5);
        for (let f = 0; f < faltas; f++) ev('falta', timeId, pegar(linha(time)).id);
        if (rnd() < 0.5) ev('tempo', timeId, null);
      }
      extras.forEach((x) => ev(x.tipo, x.timeId, x.jogadorId));
      if (penaltis) s.penaltis = penaltis.map(([timeId, jogadorId, convertido]) => ({ id: U.id(), timeId, jogadorId, convertido }));
      s.eventos.sort((a, b) => a.periodo - b.periodo || a.minuto - b.minuto);
      s.periodo = cfg.numPeriodos;
      s.fimTempoNormal = true;
      s.encerradaEm = new Date(jogo.data + 'T' + (jogo.hora || '10:00') + ':00').toISOString();
      if (golsCasa + golsFora > 4) s.observacoes = 'Jogo disputado, sem incidentes.';
      jogo.sumula = s;
      jogo.status = 'encerrado';
    };

    // Sub-9: rodadas 1 e 2 jogadas, com cartões para mostrar suspensões
    const j9 = D.jogosDaCategoria(sub9.id);
    const jogador = (time, i) => time.jogadores[i].id;
    const doTime = (jogo, time) => jogo.casaId === time.id || jogo.foraId === time.id;
    const rod1 = j9.filter((j) => j.rodada === 1);
    const rod2 = j9.filter((j) => j.rodada === 2);
    // Rodada 1: vermelho para o camisa 10 dos Leões → suspenso na rodada 2
    const leoes1 = rod1.find((j) => doTime(j, t9[0]));
    const adversario = D.time(leoes1.casaId === t9[0].id ? leoes1.foraId : leoes1.casaId);
    jogar(leoes1, 3, 1, [
      { tipo: 'vermelho', timeId: t9[0].id, jogadorId: jogador(t9[0], 9) },
      { tipo: 'amarelo', timeId: adversario.id, jogadorId: jogador(adversario, 4) },
    ]);
    rod1.filter((j) => j !== leoes1).forEach((j) => jogar(j, 2, 2, [
      { tipo: 'amarelo', timeId: t9[3].id, jogadorId: jogador(t9[3], 3) },
    ].filter((x) => doTime(j, t9[3]))));
    // Rodada 2: camisa 3 da Estrela leva o 2º amarelo (fica pendurado) e um jogador do Furacão é expulso
    rod2.forEach((j, i) => jogar(j, i === 0 ? 1 : 4, i === 0 ? 0 : 2, [
      { tipo: 'amarelo', timeId: t9[3].id, jogadorId: jogador(t9[3], 3) },
      { tipo: 'amarelo', timeId: t9[1].id, jogadorId: jogador(t9[1], 6) },
      { tipo: 'vermelho', timeId: t9[2].id, jogadorId: jogador(t9[2], 7) }, // suspenso na rodada 3
    ].filter((x) => doTime(j, D.time(x.timeId)))));

    // Sub-11: todos os jogos de grupo jogados
    const j11 = D.jogosDaCategoria(sub11.id);
    const placares = [[2, 1], [0, 0], [3, 2], [1, 4], [2, 2], [5, 1]];
    j11.filter((j) => j.fase === 'grupo').forEach((j, i) => {
      const [c, f] = placares[i % placares.length];
      jogar(j, c, f);
    });
    App.regras.atualizarMataMata(sub11.id);

    // Uma semifinal empatada e decidida nos pênaltis
    const semi = D.jogosDaCategoria(sub11.id).find((j) => j.rodadaNome === 'Semifinal' && j.casaId && j.foraId);
    if (semi) {
      const casa = D.time(semi.casaId);
      const fora = D.time(semi.foraId);
      jogar(semi, 1, 1, [], [
        [casa.id, casa.jogadores[9].id, true], [fora.id, fora.jogadores[9].id, true],
        [casa.id, casa.jogadores[8].id, true], [fora.id, fora.jogadores[8].id, false],
        [casa.id, casa.jogadores[7].id, true], [fora.id, fora.jogadores[7].id, true],
      ]);
      App.regras.atualizarMataMata(sub11.id);
    }

    D.salvar();
    return camp;
  },

  /**
   * INTERCLASSE DE EXEMPLO (privado; você é o admin no modo online).
   * 6 turmas e 4 modalidades, uma de cada jeito:
   *  ⚽ Futsal   — gols, súmula completa, mata-mata com 3º lugar (pódio pronto p/ confirmar)
   *  🏐 Vôlei    — sets (melhor de 3), pontos corridos (pódio já confirmado)
   *  🏀 Basquete — gols sem empate, mata-mata SEM 3º lugar (final hoje; 2 bronzes)
   *  ♟️ Xadrez   — vitória/empate/derrota, pontos corridos (metade jogada, resto hoje)
   */
  carregarInterclasse() {
    const D = App.dados;
    const I = App.inter;
    const hoje = I.hoje();
    const diasAtras = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const camp = I.novo({ nome: 'Interclasse de exemplo', local: 'Quadra da escola', dataInicio: diasAtras(3), dataFim: hoje });
    I.adicionarTurmas(camp, ['1º Ano A', '1º Ano B', '2º Ano A', '2º Ano B', '3º Ano A', '3º Ano B']);
    const T = camp.turmas.map((t) => t.id);

    const resultado = (jogo, placar) => {
      jogo.placarRapido = Object.assign({ penCasa: null, penFora: null }, placar);
      jogo.status = 'encerrado';
      App.regras.atualizarMataMata(jogo.categoriaId);
    };
    const datar = (cat, data, horaIni) => {
      D.jogosDaCategoria(cat.id).filter((j) => !j.bye).forEach((j, i) => {
        j.data = data;
        const m = horaIni * 60 + i * 40;
        j.hora = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        j.quadra = 'Quadra ' + (1 + (i % 2));
      });
    };

    // ⚽ Futsal: 4 turmas, mata-mata com disputa de 3º
    const futsal = I.adicionarModalidade(camp, { nome: 'Futsal', emoji: '⚽', esporte: 'futsal', formato: 'mata', terceiroLugar: true, turmaIds: T.slice(0, 4) });
    App.tabela.gerar(futsal.id, { sortear: false });
    datar(futsal, diasAtras(2), 9);
    const semisF = D.jogosDaCategoria(futsal.id).filter((j) => j.rodadaNome === 'Semifinal');
    resultado(semisF[0], { casa: 3, fora: 1 });
    resultado(semisF[1], { casa: 2, fora: 2, penCasa: 4, penFora: 3 });
    resultado(D.jogosDaCategoria(futsal.id).find((j) => j.rodadaNome === 'Disputa de 3º lugar'), { casa: 1, fora: 0 });
    resultado(D.jogosDaCategoria(futsal.id).find((j) => j.rodadaNome === 'Final'), { casa: 2, fora: 3 });

    // 🏐 Vôlei: sets, pontos corridos, 4 turmas — tudo jogado e pódio confirmado
    const volei = I.adicionarModalidade(camp, { nome: 'Vôlei Feminino', emoji: '🏐', esporte: 'volei', melhorDe: 3, formato: 'pontos', turmaIds: T.slice(2, 6) });
    App.tabela.gerar(volei.id, { sortear: false });
    datar(volei, diasAtras(1), 14);
    const placaresVolei = [[[25, 20], [25, 18]], [[22, 25], [25, 23], [15, 12]], [[25, 15], [20, 25], [10, 15]], [[25, 21], [25, 19]], [[18, 25], [25, 22], [15, 13]], [[25, 23], [25, 17]]];
    D.jogosDaCategoria(volei.id).forEach((j, i) => {
      const sets = placaresVolei[i];
      resultado(j, { casa: sets.filter(([a, b]) => a > b).length, fora: sets.filter(([a, b]) => b > a).length, sets: sets.map(([a, b]) => ({ casa: a, fora: b })) });
    });
    I.definirPodio(volei, App.regras.podioSugerido(volei.id), false);

    // 🏀 Basquete: sem empate, mata-mata SEM 3º lugar — semis jogadas, final hoje
    const basquete = I.adicionarModalidade(camp, { nome: 'Basquete', emoji: '🏀', esporte: 'basquete', formato: 'mata', terceiroLugar: false, turmaIds: [T[0], T[1], T[4], T[5]] });
    App.tabela.gerar(basquete.id, { sortear: false });
    datar(basquete, diasAtras(1), 9);
    D.jogosDaCategoria(basquete.id).filter((j) => j.rodadaNome === 'Semifinal').forEach((j, i) => resultado(j, i ? { casa: 18, fora: 22 } : { casa: 31, fora: 27 }));
    const finalB = D.jogosDaCategoria(basquete.id).find((j) => j.rodadaNome === 'Final');
    finalB.data = hoje; finalB.hora = '16:00'; finalB.quadra = 'Quadra 1';

    // ♟️ Xadrez: V/E/D, pontos corridos com as 6 turmas — metade jogada, resto hoje
    const xadrez = I.adicionarModalidade(camp, { nome: 'Xadrez', emoji: '♟️', esporte: 'xadrez', formato: 'pontos', turmaIds: T });
    App.tabela.gerar(xadrez.id, { sortear: false });
    const jx = D.jogosDaCategoria(xadrez.id);
    jx.forEach((j, i) => {
      if (i < 9) {
        j.data = diasAtras(1); j.hora = `${String(8 + Math.floor(i / 3)).padStart(2, '0')}:${String((i % 3) * 20).padStart(2, '0')}`;
        const r = ['casa', 'fora', 'empate'][i % 3];
        resultado(j, { casa: r === 'casa' ? 1 : 0, fora: r === 'fora' ? 1 : 0, resultado: r });
      } else {
        j.data = hoje; j.hora = `${String(10 + Math.floor((i - 9) / 3)).padStart(2, '0')}:${String(((i - 9) % 3) * 20).padStart(2, '0')}`; j.quadra = 'Sala de xadrez';
      }
    });

    D.salvar();
    return camp;
  },
};
