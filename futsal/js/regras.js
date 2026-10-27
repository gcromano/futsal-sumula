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

  /** Placar do jogo { casa, fora } contando gols e gols contra. */
  placar(jogo) {
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
      if (!j) return 'A definir';
      const irmaos = D.db.jogos.filter((x) => x.categoriaId === j.categoriaId && x.rodadaNome === j.rodadaNome);
      const n = irmaos.sort((a, b) => a.ordem - b.ordem).indexOf(j) + 1;
      const pre = origem.tipo === 'vencedor' ? 'Venc.' : 'Perd.';
      return `${pre} ${j.rodadaNome}${irmaos.length > 1 ? ' ' + n : ''}`;
    }
    return 'A definir';
  },

  /**
   * Atualiza os times do mata-mata conforme os resultados.
   * Só mexe em jogos que ainda não começaram.
   */
  atualizarMataMata(catId) {
    const D = App.dados;
    const jogos = D.db.jogos.filter((j) => j.categoriaId === catId && j.fase === 'mata').sort((a, b) => a.ordem - b.ordem);
    for (const j of jogos) {
      if (j.status !== 'agendado') continue;
      j.casaId = this.resolverOrigem(j.origemCasa, catId);
      j.foraId = j.bye ? null : this.resolverOrigem(j.origemFora, catId);
    }
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
    if (grupoId) {
      const g = (cat.grupos || []).find((x) => x.id === grupoId);
      times = g ? g.timeIds.map((id) => D.time(id)).filter(Boolean) : [];
    }
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
      for (const ev of j.sumula.eventos) {
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

  /** Jogador com idade fora da categoria? Devolve texto do alerta ou ''. */
  alertaIdade(jogador, cat) {
    if (!jogador.nascimento || !cat || !cat.config.anoMinimo) return '';
    const ano = Number(jogador.nascimento.slice(0, 4));
    if (ano < cat.config.anoMinimo) {
      return `Nascido em ${ano}: acima da idade da ${cat.nome} (nascidos a partir de ${cat.config.anoMinimo})`;
    }
    return '';
  },
};
