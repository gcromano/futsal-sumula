/* =========================================================
   REGRAS.JS — O "cérebro" do campeonato.

   Aqui nada é salvo: tudo é CALCULADO a partir das súmulas.
   Assim, se você editar ou reabrir uma súmula, a classificação,
   as estatísticas e as suspensões se ajustam sozinhas.

   Eventos da súmula (sumula.eventos):
     { id, tipo, timeId, jogadorId, assistenciaId, periodo, minuto }
     tipo: 'gol' | 'golContra' | 'falta' | 'amarelo' | 'vermelho' | 'tempo'
     timeId = time do jogador que fez o evento.
     (No gol contra, o gol conta para o OUTRO time.)
   ========================================================= */

var App = globalThis.App = globalThis.App || {};

App.regras = {
  /* ---------- Súmula ---------- */

  /** Cria uma súmula vazia para o jogo. */
  novaSumula(jogo) {
    const D = App.dados;
    const goleiros = {};
    for (const timeId of [jogo.casaId, jogo.foraId]) {
      const time = D.time(timeId);
      const gol = time && time.jogadores.find((p) => p.posicao === 'goleiro');
      goleiros[timeId] = gol ? gol.id : null;
    }
    return {
      arbitro1: '', arbitro2: '', mesario: '', anotador: '', cronometrista: '',
      goleiros,                       // goleiro titular de cada time (para "menos vazado")
      periodo: 1,                     // período atual
      cronometro: { acumuladoMs: 0, iniciadoEm: null },
      fimTempoNormal: false,          // true depois de encerrar o último período
      eventos: [],
      penaltis: [],                   // { id, timeId, jogadorId, convertido }
      observacoes: '',
      encerradaEm: null,
    };
  },

  /**
   * RESULTADO RÁPIDO: o admin pode lançar só o placar final, sem súmula.
   * Fica em jogo.placarRapido = { casa, fora, penCasa, penFora }
   * (penCasa/penFora = null quando não teve pênaltis).
   */
  temPlacarRapido(jogo) {
    return !!(jogo && jogo.placarRapido);
  },

  /** Placar do jogo { casa, fora } contando gols e gols contra (ou o resultado rápido). */
  placar(jogo) {
    if (jogo.placarRapido) return { casa: Number(jogo.placarRapido.casa) || 0, fora: Number(jogo.placarRapido.fora) || 0 };
    // Súmulas por esporte do interclasse (vôlei, basquete...) guardam o próprio placar.
    // (A súmula de futsal não tem "esporte": segue o cálculo pelos eventos, abaixo.)
    if (jogo.sumula && jogo.sumula.esporte && jogo.sumula.placar) {
      return { casa: Number(jogo.sumula.placar.casa) || 0, fora: Number(jogo.sumula.placar.fora) || 0 };
    }
    const p = { casa: 0, fora: 0 };
    if (!jogo.sumula) return p;
    for (const ev of jogo.sumula.eventos) {
      if (ev.tipo === 'gol') {
        if (ev.timeId === jogo.casaId) p.casa++; else p.fora++;
      } else if (ev.tipo === 'golContra') {
        if (ev.timeId === jogo.casaId) p.fora++; else p.casa++;
      }
    }
    return p;
  },

  /** Placar da disputa de pênaltis { casa, fora } (só cobranças convertidas). */
  placarPenaltis(jogo) {
    const r = jogo.placarRapido;
    if (r) return { casa: Number(r.penCasa) || 0, fora: Number(r.penFora) || 0 };
    const p = { casa: 0, fora: 0 };
    if (!jogo.sumula) return p;
    for (const c of jogo.sumula.penaltis) {
      if (!c.convertido) continue;
      if (c.timeId === jogo.casaId) p.casa++; else p.fora++;
    }
    return p;
  },

  /** Teve disputa de pênaltis registrada? */
  temPenaltis(jogo) {
    const r = jogo.placarRapido;
    if (r) return r.penCasa !== null && r.penCasa !== undefined && r.penCasa !== '';
    return !!(jogo.sumula && jogo.sumula.penaltis.length);
  },

  /** Quem venceu (id do time) — só para jogos encerrados. null = empate/indefinido. */
  vencedor(jogo) {
    if (jogo.bye) return jogo.casaId || null;
    if (jogo.status !== 'encerrado') return null;
    const p = this.placar(jogo);
    if (p.casa > p.fora) return jogo.casaId;
    if (p.fora > p.casa) return jogo.foraId;
    const pen = this.placarPenaltis(jogo);
    if (pen.casa > pen.fora) return jogo.casaId;
    if (pen.fora > pen.casa) return jogo.foraId;
    return null;
  },

  perdedor(jogo) {
    if (jogo.bye) return null;
    const v = this.vencedor(jogo);
    if (!v) return null;
    return v === jogo.casaId ? jogo.foraId : jogo.casaId;
  },

  /** Jogadores expulsos neste jogo (cartão vermelho ou 2 amarelos). Devolve um Set de ids. */
  expulsos(jogo) {
    const set = new Set();
    if (!jogo.sumula) return set;
    const amarelos = {};
    for (const ev of jogo.sumula.eventos) {
      if (!ev.jogadorId) continue;
      if (ev.tipo === 'vermelho') set.add(ev.jogadorId);
      if (ev.tipo === 'amarelo') {
        amarelos[ev.jogadorId] = (amarelos[ev.jogadorId] || 0) + 1;
        if (amarelos[ev.jogadorId] >= 2) set.add(ev.jogadorId);
      }
    }
    return set;
  },

  /** Quantas faltas o time tem no período. */
  faltasNoPeriodo(jogo, timeId, periodo) {
    if (!jogo.sumula) return 0;
    return jogo.sumula.eventos.filter((e) => e.tipo === 'falta' && e.timeId === timeId && e.periodo === periodo).length;
  },

  /** Quantos pedidos de tempo o time fez no período. */
  temposNoPeriodo(jogo, timeId, periodo) {
    if (!jogo.sumula) return 0;
    return jogo.sumula.eventos.filter((e) => e.tipo === 'tempo' && e.timeId === timeId && e.periodo === periodo).length;
  },

  /* ---------- Mata-mata: quem avança ---------- */

  /** Descobre o time de uma "origem" (vencedor de um jogo, 1º do grupo etc.). */
  resolverOrigem(origem, catId) {
    if (!origem) return null;
    const D = App.dados;
    if (origem.tipo === 'time') return origem.timeId;
    if (origem.tipo === 'vencedor' || origem.tipo === 'perdedor') {
      const j = D.jogo(origem.jogoId);
      if (!j) return null;
      return origem.tipo === 'vencedor' ? this.vencedor(j) : this.perdedor(j);
    }
    if (origem.tipo === 'grupo') {
      // Só define quando TODOS os jogos do grupo terminaram
      const jogosGrupo = D.db.jogos.filter((j) => j.grupoId === origem.grupoId);
      if (!jogosGrupo.length || jogosGrupo.some((j) => j.status !== 'encerrado')) return null;
      const tabela = this.classificacao(catId, origem.grupoId);
      return tabela[origem.posicao - 1] ? tabela[origem.posicao - 1].timeId : null;
    }
    return null;
  },

  /** Texto de uma origem ainda indefinida, ex.: "1º Grupo A" ou "Venc. Semifinal 1". */
  textoOrigem(origem, catId) {
    if (!origem) return 'A definir';
    const D = App.dados;
    if (origem.tipo === 'grupo') {
      const { cat } = D.categoria(catId);
      const g = cat && (cat.grupos || []).find((x) => x.id === origem.grupoId);
      return `${origem.posicao}º ${g ? g.nome : 'grupo'}`;
    }
    if (origem.tipo === 'vencedor' || origem.tipo === 'perdedor') {
      const j = D.jogo(origem.jogoId);
      if (!j) return 'A definir (jogo excluído)';
      return `${origem.tipo === 'vencedor' ? 'Venc.' : 'Perd.'} jogo ${this.numeroJogo(j)}`;
    }
    return 'A definir';
  },

  /**
   * Número do jogo na tabela da categoria ("Jogo 7"), na ordem atual.
   * Jogos "passa direto" (bye) não contam.
   */
  numeroJogo(jogo) {
    if (jogo.numero) return jogo.numero; // número oficial digitado (ex.: tabela da escola)
    const lista = App.dados.jogosDaCategoria(jogo.categoriaId).filter((j) => !j.bye);
    return lista.indexOf(jogo) + 1;
  },

  /**
   * Preenche os times que dependem de resultados ("Vencedor do jogo 5",
   * "1º do Grupo A"...). Vale para jogos gerados E montados na mão.
   * Só mexe em jogos que ainda não começaram e só no lado que tem origem.
   */
  atualizarMataMata(catId) {
    const D = App.dados;
    const jogos = D.jogosDaCategoria(catId);
    // Duas passadas: assim uma final que depende de semis que dependem
    // de quartas é resolvida mesmo se a ordem estiver bagunçada.
    for (let passada = 0; passada < 2; passada++) {
      for (const j of jogos) {
        if (j.status !== 'agendado') continue;
        if (j.origemCasa) j.casaId = this.resolverOrigem(j.origemCasa, catId);
        if (j.origemFora) j.foraId = this.resolverOrigem(j.origemFora, catId);
        if (j.bye) j.foraId = null;
      }
    }
  },

  /**
   * Times de um grupo: os que foram colocados nele + os que jogam
   * jogos marcados com esse grupo (útil na tabela montada na mão).
   */
  timesDoGrupo(cat, grupoId) {
    const g = (cat.grupos || []).find((x) => x.id === grupoId);
    const ids = new Set(g ? g.timeIds : []);
    App.dados.db.jogos.forEach((j) => {
      if (j.grupoId !== grupoId) return;
      if (j.casaId) ids.add(j.casaId);
      if (j.foraId) ids.add(j.foraId);
    });
    return [...ids].map((id) => App.dados.time(id)).filter(Boolean);
  },

  /* ---------- Classificação ---------- */

  /** Linha zerada da tabela de classificação. */
  linhaVazia(time) {
    return {
      timeId: time.id, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0, pts: 0,
      amarelos: 0, vermelhos: 0, cartoes: 0, sorteio: time.sorteio || 0,
    };
  },

  /**
   * Tabela de classificação da categoria (ou de um grupo).
   * Usa só jogos ENCERRADOS de pontos corridos ou fase de grupos.
   */
  classificacao(catId, grupoId = null) {
    const D = App.dados;
    const { cat } = D.categoria(catId);
    if (!cat) return [];
    const cfg = cat.config;

    let times = D.timesDaCategoria(catId);
    if (grupoId) times = this.timesDoGrupo(cat, grupoId);
    const linhas = {};
    times.forEach((t) => { linhas[t.id] = this.linhaVazia(t); });

    const jogos = D.db.jogos.filter((j) =>
      j.categoriaId === catId && j.status === 'encerrado' && j.fase !== 'mata' &&
      (grupoId ? j.grupoId === grupoId : true));

    for (const j of jogos) {
      const c = linhas[j.casaId];
      const f = linhas[j.foraId];
      if (!c || !f) continue;
      const p = this.placar(j);
      c.j++; f.j++;
      c.gp += p.casa; c.gc += p.fora;
      f.gp += p.fora; f.gc += p.casa;
      if (p.casa > p.fora) { c.v++; f.d++; c.pts += cfg.pontosVitoria; f.pts += cfg.pontosDerrota; }
      else if (p.casa < p.fora) { f.v++; c.d++; f.pts += cfg.pontosVitoria; c.pts += cfg.pontosDerrota; }
      else { c.e++; f.e++; c.pts += cfg.pontosEmpate; f.pts += cfg.pontosEmpate; }
      for (const ev of (j.sumula ? j.sumula.eventos : [])) {
        const l = linhas[ev.timeId];
        if (!l) continue;
        if (ev.tipo === 'amarelo') l.amarelos++;
        if (ev.tipo === 'vermelho') l.vermelhos++;
      }
    }

    const lista = Object.values(linhas);
    lista.forEach((l) => {
      l.sg = l.gp - l.gc;
      l.cartoes = l.amarelos + l.vermelhos * 3; // vermelho "pesa" 3 amarelos
    });

    // Modalidade por SETS: gp/gc = sets ganhos/perdidos; pp/pc = pontos dentro dos sets
    if (this.tipoPlacar(cat) === 'sets') {
      lista.forEach((l) => { l.pp = 0; l.pc = 0; });
      for (const j of jogos) {
        // sets = [{ casa: 25, fora: 20 }, ...]
        const sets = (j.placarRapido && j.placarRapido.sets) || (j.sumula && j.sumula.esporte && j.sumula.placar && j.sumula.placar.sets) || [];
        for (const { casa: a, fora: b } of sets) {
          if (linhas[j.casaId]) { linhas[j.casaId].pp += a; linhas[j.casaId].pc += b; }
          if (linhas[j.foraId]) { linhas[j.foraId].pp += b; linhas[j.foraId].pc += a; }
        }
      }
      lista.forEach((l) => { l.sp = l.pp - l.pc; });
    }

    const ordenada = this.ordenar(lista, cfg.desempate, { jogos, cfg });
    ordenada.forEach((l, i) => { l.pos = i + 1; });
    return ordenada;
  },

  /**
   * Ordena aplicando os critérios de desempate EM ORDEM.
   * Para cada critério: separa os empatados e desempata
   * só entre eles com o próximo critério (por isso é recursivo).
   * Isso faz o "confronto direto" funcionar até com 3 times empatados.
   */
  ordenar(linhas, criterios, ctx) {
    if (linhas.length <= 1 || !criterios.length) return linhas;
    const [criterio, ...resto] = criterios;
    const valores = new Map(linhas.map((l) => [l, this.valorCriterio(l, criterio, linhas, ctx)]));
    const ordenadas = linhas.slice().sort((a, b) => valores.get(b) - valores.get(a));

    // Junta em blocos de valores iguais e desempata cada bloco
    const resultado = [];
    let bloco = [];
    for (const l of ordenadas) {
      if (bloco.length && valores.get(bloco[0]) !== valores.get(l)) {
        resultado.push(...this.ordenar(bloco, resto, ctx));
        bloco = [];
      }
      bloco.push(l);
    }
    resultado.push(...this.ordenar(bloco, resto, ctx));
    return resultado;
  },

  /** Valor de um critério (quanto MAIOR, melhor). */
  valorCriterio(linha, criterio, empatados, ctx) {
    switch (criterio) {
      case 'pontos': return linha.pts;
      case 'vitorias': return linha.v;
      case 'saldo': return linha.sg;
      case 'golsPro': return linha.gp;
      case 'cartoes': return -linha.cartoes; // menos cartões é melhor
      case 'sorteio': return linha.sorteio;
      case 'saldoPontos': return linha.sp || 0; // sets: saldo de pontos
      case 'confronto': {
        // Pontos ganhos só nos jogos entre os times empatados
        const ids = new Set(empatados.map((l) => l.timeId));
        let pts = 0;
        for (const j of ctx.jogos) {
          if (!ids.has(j.casaId) || !ids.has(j.foraId)) continue;
          if (j.casaId !== linha.timeId && j.foraId !== linha.timeId) continue;
          const p = this.placar(j);
          const meus = j.casaId === linha.timeId ? p.casa : p.fora;
          const deles = j.casaId === linha.timeId ? p.fora : p.casa;
          if (meus > deles) pts += ctx.cfg.pontosVitoria;
          else if (meus === deles) pts += ctx.cfg.pontosEmpate;
          else pts += ctx.cfg.pontosDerrota;
        }
        return pts;
      }
      default: return 0;
    }
  },

  /* ---------- Suspensões ---------- */

  /**
   * Calcula as suspensões percorrendo os jogos em ordem.
   * Regras:
   *  - Vermelho (ou 2 amarelos no mesmo jogo) → suspenso no próximo jogo do time.
   *  - Ao chegar no limite de amarelos acumulados (padrão 3) → suspenso no
   *    próximo jogo e o contador zera.
   *
   * Devolve:
   *  porJogo:   { jogoId: [ { jogadorId, timeId, motivo } ] }  → quem está suspenso em cada jogo
   *  pendentes: { jogadorId: [motivo] } → suspensões ainda sem jogo para cumprir
   *  amarelos:  { jogadorId: n }        → amarelos acumulados no momento
   */
  suspensoes(catId) {
    const D = App.dados;
    const { cat } = D.categoria(catId);
    const limite = (cat && cat.config.limiteAmarelos) || 3;
    const pendentes = {};
    const amarelos = {};
    const porJogo = {};

    for (const jogo of D.jogosDaCategoria(catId)) {
      if (jogo.bye || !jogo.casaId || !jogo.foraId) continue;

      // 1) Quem tem suspensão pendente cumpre neste jogo
      porJogo[jogo.id] = [];
      for (const timeId of [jogo.casaId, jogo.foraId]) {
        const time = D.time(timeId);
        if (!time) continue;
        for (const p of time.jogadores) {
          if (pendentes[p.id] && pendentes[p.id].length) {
            porJogo[jogo.id].push({ jogadorId: p.id, timeId, motivo: pendentes[p.id].shift() });
          }
        }
      }

      // 2) Os cartões deste jogo (só se já terminou) geram novas suspensões
      if (jogo.status !== 'encerrado' || !jogo.sumula) continue;
      const amarelosNoJogo = {};
      const vermelhoNoJogo = new Set();
      for (const ev of jogo.sumula.eventos) {
        if (!ev.jogadorId) continue;
        if (ev.tipo === 'amarelo') amarelosNoJogo[ev.jogadorId] = (amarelosNoJogo[ev.jogadorId] || 0) + 1;
        if (ev.tipo === 'vermelho') vermelhoNoJogo.add(ev.jogadorId);
      }
      const nomeJogo = jogo.rodadaNome || 'jogo';
      for (const id of vermelhoNoJogo) {
        (pendentes[id] = pendentes[id] || []).push(`Cartão vermelho (${nomeJogo})`);
      }
      for (const [id, qtd] of Object.entries(amarelosNoJogo)) {
        if (qtd >= 2) {
          // 2 amarelos no mesmo jogo = expulsão (conta como vermelho, não acumula)
          if (!vermelhoNoJogo.has(id)) (pendentes[id] = pendentes[id] || []).push(`2 amarelos = expulsão (${nomeJogo})`);
          continue;
        }
        amarelos[id] = (amarelos[id] || 0) + qtd;
        if (amarelos[id] >= limite) {
          (pendentes[id] = pendentes[id] || []).push(`${limite} cartões amarelos`);
          amarelos[id] = 0; // zera depois de gerar a suspensão
        }
      }
    }

    Object.keys(pendentes).forEach((k) => { if (!pendentes[k].length) delete pendentes[k]; });
    return { porJogo, pendentes, amarelos };
  },

  /**
   * Jogadores que estão suspensos AGORA: vão cumprir no próximo jogo
   * marcado ou ainda esperam um jogo definido. Devolve um Set de ids.
   */
  suspensosAtuais(catId, susp) {
    susp = susp || this.suspensoes(catId);
    const set = new Set(Object.keys(susp.pendentes));
    for (const j of App.dados.jogosDaCategoria(catId)) {
      if (j.status === 'encerrado') continue;
      (susp.porJogo[j.id] || []).forEach((x) => set.add(x.jogadorId));
    }
    return set;
  },

  /** Lista de suspensos de um jogo (array de { jogadorId, timeId, motivo }). */
  suspensosNoJogo(jogo) {
    return this.suspensoes(jogo.categoriaId).porJogo[jogo.id] || [];
  },

  /* ---------- Estatísticas ---------- */

  /** Estatísticas da categoria (só jogos encerrados). */
  estatisticas(catId) {
    const D = App.dados;
    const jogadores = {};  // jogadorId → { gols, assist, amarelos, vermelhos, golsContra }
    const times = {};      // timeId → { amarelos, vermelhos, faltas }
    const goleiros = {};   // jogadorId → { jogos, sofridos }

    const jog = (id) => (jogadores[id] = jogadores[id] || { gols: 0, assist: 0, amarelos: 0, vermelhos: 0, golsContra: 0 });
    D.timesDaCategoria(catId).forEach((t) => { times[t.id] = { amarelos: 0, vermelhos: 0, faltas: 0 }; });

    for (const j of D.db.jogos) {
      if (j.categoriaId !== catId || j.status !== 'encerrado' || !j.sumula || j.bye) continue;
      for (const ev of j.sumula.eventos) {
        const t = times[ev.timeId];
        if (ev.tipo === 'gol' && ev.jogadorId) jog(ev.jogadorId).gols++;
        if (ev.tipo === 'gol' && ev.assistenciaId) jog(ev.assistenciaId).assist++;
        if (ev.tipo === 'golContra' && ev.jogadorId) jog(ev.jogadorId).golsContra++;
        if (ev.tipo === 'amarelo') { if (ev.jogadorId) jog(ev.jogadorId).amarelos++; if (t) t.amarelos++; }
        if (ev.tipo === 'vermelho') { if (ev.jogadorId) jog(ev.jogadorId).vermelhos++; if (t) t.vermelhos++; }
        if (ev.tipo === 'falta' && t) t.faltas++;
      }
      // Goleiro titular de cada lado leva os gols sofridos pelo time
      const p = this.placar(j);
      const gols = { [j.casaId]: p.fora, [j.foraId]: p.casa };
      for (const timeId of [j.casaId, j.foraId]) {
        const gid = j.sumula.goleiros && j.sumula.goleiros[timeId];
        if (!gid) continue;
        goleiros[gid] = goleiros[gid] || { jogos: 0, sofridos: 0 };
        goleiros[gid].jogos++;
        goleiros[gid].sofridos += gols[timeId];
      }
    }

    const comTime = (id, extra) => {
      const { time, jogador } = D.jogador(id);
      return jogador ? Object.assign({ jogadorId: id, jogador, time }, extra) : null;
    };
    const lista = Object.entries(jogadores).map(([id, s]) => comTime(id, s)).filter(Boolean);

    return {
      artilharia: lista.filter((x) => x.gols > 0).sort((a, b) => b.gols - a.gols || a.jogador.nome.localeCompare(b.jogador.nome)),
      assistencias: lista.filter((x) => x.assist > 0).sort((a, b) => b.assist - a.assist || a.jogador.nome.localeCompare(b.jogador.nome)),
      goleiros: Object.entries(goleiros)
        .map(([id, s]) => comTime(id, Object.assign({ media: s.sofridos / s.jogos }, s)))
        .filter(Boolean)
        .sort((a, b) => a.media - b.media || b.jogos - a.jogos),
      disciplina: Object.entries(times)
        .map(([id, s]) => Object.assign({ time: D.time(id), pontos: s.amarelos + s.vermelhos * 3 }, s))
        .filter((x) => x.time)
        .sort((a, b) => a.pontos - b.pontos || a.faltas - b.faltas),
      porJogador: jogadores,
    };
  },

  /** Resumo de um time em TODOS os jogos encerrados (inclui mata-mata). */
  resumoTime(timeId) {
    const D = App.dados;
    const r = { j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 };
    for (const j of D.db.jogos) {
      if (j.status !== 'encerrado' || j.bye || (j.casaId !== timeId && j.foraId !== timeId)) continue;
      const p = this.placar(j);
      const meus = j.casaId === timeId ? p.casa : p.fora;
      const deles = j.casaId === timeId ? p.fora : p.casa;
      r.j++; r.gp += meus; r.gc += deles;
      if (meus > deles) r.v++; else if (meus < deles) r.d++; else r.e++;
    }
    r.sg = r.gp - r.gc;
    return r;
  },

  /**
   * O que mostrar na classificação, olhando os JOGOS que existem
   * (e não só o formato configurado). Assim funciona igual para
   * tabela gerada, montada na mão ou misturada.
   *   geral: tabela única (jogos de classificação sem grupo)
   *   grupos: grupos que têm times
   *   mata: tem jogos de mata-mata?
   */
  estruturaClassificacao(cat) {
    const jogos = App.dados.jogosDaCategoria(cat.id);
    const grupos = (cat.grupos || []).filter((g) => this.timesDoGrupo(cat, g.id).length);
    const mata = jogos.some((j) => j.fase === 'mata');
    const liga = jogos.some((j) => j.fase === 'liga');
    // Sem jogos ainda: segue o formato configurado
    const geral = liga || (!jogos.length && cat.config.formato === 'pontos') || (!grupos.length && !mata);
    return { geral, grupos, mata };
  },

  /* =======================================================
     INTERCLASSE: tipo de placar, pódio e quadro de medalhas
     ======================================================= */

  /** Tipo de placar da categoria/modalidade: 'gols' (padrão), 'sets' ou 'resultado'. */
  tipoPlacar(cat) {
    return (cat && cat.config && cat.config.tipoPlacar) || 'gols';
  },

  /** Modalidade terminou? (tem jogos e todos com dois times estão encerrados) */
  modalidadeConcluida(catId) {
    const jogos = App.dados.jogosDaCategoria(catId).filter((j) => !j.bye);
    return jogos.length > 0 && jogos.every((j) => j.status === 'encerrado');
  },

  /** Turma de um time da modalidade (time.turmaId) */
  turmaDoTime(timeId) {
    const t = App.dados.time(timeId);
    return t ? t.turmaId || null : null;
  },

  /**
   * Pódio calculado pelo app (em turmaIds): { ouro, prata, bronze: [] }.
   * - Com mata-mata: final (ouro/prata) + disputa de 3º (bronze) ou,
   *   sem disputa de 3º, os dois perdedores das semifinais (dois bronzes).
   * - Sem mata-mata: 1º, 2º e 3º da classificação.
   * Devolve null se ainda não dá para saber.
   */
  podioSugerido(catId) {
    const D = App.dados;
    const { cat } = D.categoria(catId);
    if (!cat || !this.modalidadeConcluida(catId)) return null;
    const jogos = D.jogosDaCategoria(catId);
    const turma = (timeId) => this.turmaDoTime(timeId);
    const final = jogos.find((j) => j.fase === 'mata' && j.rodadaNome === 'Final');
    if (final) {
      const ouro = turma(this.vencedor(final));
      const prata = turma(this.perdedor(final));
      const terceiro = jogos.find((j) => j.fase === 'mata' && (j.terceiro || j.rodadaNome === 'Disputa de 3º lugar'));
      let bronze = [];
      if (terceiro) bronze = [turma(this.vencedor(terceiro))];
      else bronze = jogos.filter((j) => j.fase === 'mata' && j.rodadaNome === 'Semifinal' && !j.bye).map((j) => turma(this.perdedor(j)));
      return { ouro, prata, bronze: bronze.filter(Boolean) };
    }
    const tabela = this.classificacao(catId);
    return { ouro: tabela[0] && turma(tabela[0].timeId), prata: tabela[1] && turma(tabela[1].timeId), bronze: tabela[2] ? [turma(tabela[2].timeId)] : [] };
  },

  /**
   * Quadro de medalhas do interclasse (só pódios CONFIRMADOS pelo admin).
   * criterio 'olimpico': ouro > prata > bronze; 'pontos': ouro/prata/bronze valem pontos.
   */
  quadroMedalhas(camp) {
    const med = camp.medalhas || {};
    const pts = Object.assign({ ouro: 3, prata: 2, bronze: 1 }, med.pontos || {});
    const linhas = {};
    (camp.turmas || []).forEach((t) => { linhas[t.id] = { turma: t, o: 0, p: 0, b: 0, modalidades: [] }; });
    const somar = (turmaId, tipo, cat) => {
      const l = linhas[turmaId];
      if (!l) return;
      l[tipo]++;
      l.modalidades.push({ cat, medalha: { o: 'ouro', p: 'prata', b: 'bronze' }[tipo] });
    };
    for (const cat of camp.categorias) {
      const p = cat.podio;
      if (!p || !p.confirmado) continue;
      somar(p.ouro, 'o', cat);
      somar(p.prata, 'p', cat);
      (p.bronze || []).forEach((b) => somar(b, 'b', cat));
    }
    const lista = Object.values(linhas).map((l) => Object.assign(l, { total: l.o + l.p + l.b, pontos: l.o * pts.ouro + l.p * pts.prata + l.b * pts.bronze }));
    const nome = (a, b) => a.turma.nome.localeCompare(b.turma.nome, 'pt-BR');
    lista.sort(med.criterio === 'pontos'
      ? (a, b) => b.pontos - a.pontos || b.o - a.o || b.p - a.p || nome(a, b)
      : (a, b) => b.o - a.o || b.p - a.p || b.b - a.b || nome(a, b));
    // Posição: empatados (mesmos números) dividem a posição
    lista.forEach((l, i) => {
      const ant = lista[i - 1];
      const igual = ant && (med.criterio === 'pontos' ? ant.pontos === l.pontos && ant.o === l.o && ant.p === l.p : ant.o === l.o && ant.p === l.p && ant.b === l.b);
      l.pos = igual ? ant.pos : i + 1;
    });
    return { lista, pts, criterio: med.criterio === 'pontos' ? 'pontos' : 'olimpico' };
  },

  /** Jogador com idade fora da categoria? Devolve texto do alerta ou ''. */
  alertaIdade(jogador, cat) {
    if (!jogador.nascimento || !cat || !cat.config.anoMinimo) return '';
    // Campeonato com o alerta desligado (ex.: categorias por ano escolar)
    const { camp } = App.dados.categoria(cat.id);
    if (camp && camp.alertaIdade === false) return '';
    const ano = Number(jogador.nascimento.slice(0, 4));
    if (ano < cat.config.anoMinimo) {
      return `Nascido em ${ano}: acima da idade da ${cat.nome} (nascidos a partir de ${cat.config.anoMinimo})`;
    }
    return '';
  },
};
