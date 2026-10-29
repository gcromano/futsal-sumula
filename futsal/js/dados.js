/* =========================================================
   DADOS.JS — Onde os dados ficam guardados.

   Tudo é salvo no localStorage do navegador, como um único
   objeto JSON. Formato ("banco"):

   {
     versao: 1,
     campeonatos: [ { id, nome, local, dataInicio, dataFim,
                      categorias: [ { id, nome, config, grupos } ] } ],
     times:       [ { id, campeonatoId, categoriaId, nome, cor, escudo,
                      tecnico, responsavel, telefone, sorteio,
                      jogadores: [ { id, numero, nome, nascimento, posicao } ] } ],
     jogos:       [ { id, campeonatoId, categoriaId, fase, grupoId, rodada,
                      rodadaNome, ordem, casaId, foraId, origemCasa, origemFora,
                      data, hora, quadra, status, sumula } ]
   }
   ========================================================= */

var App = globalThis.App = globalThis.App || {};

App.dados = {
  CHAVE: 'futsal-sumula-v1',
  VERSAO: 2,
  db: null,

  /** Banco vazio. */
  novoBanco() {
    return { versao: this.VERSAO, campeonatos: [], times: [], jogos: [] };
  },

  /** Modo online ligado? (Firebase configurado) */
  online() {
    return !!(App.nuvem && App.nuvem.ativo);
  },

  /**
   * Lê do navegador (ou cria um banco vazio na primeira vez).
   * No modo online começa vazio: quem preenche é o nuvem.js.
   */
  carregar() {
    if (this.online()) { this.db = this.novoBanco(); return this.db; }
    try {
      const texto = globalThis.localStorage && localStorage.getItem(this.CHAVE);
      this.db = texto ? this.migrar(JSON.parse(texto)) : this.novoBanco();
    } catch (e) {
      console.error('Erro ao ler dados salvos', e);
      this.db = this.novoBanco();
    }
    return this.db;
  },

  /**
   * Atualiza dados salvos por versões antigas do app.
   * v1 → v2: a "ordem" do mata-mata passou a usar o nome da fase
   * (para jogos gerados e manuais ficarem na sequência certa).
   */
  migrar(db) {
    if ((db.versao || 1) < 2) {
      for (const j of db.jogos || []) {
        if (j.fase === 'mata') j.ordem = App.tabela.blocoFase(j.rodadaNome) * 1000 + ((j.ordem || 0) % 1000);
      }
      db.versao = 2;
    }
    return db;
  },

  /**
   * Dados que ficaram salvos só neste aparelho (modo local / versão antiga).
   * Usado para oferecer "Enviar para a nuvem". Devolve null se não houver.
   */
  dadosLocais() {
    try {
      const texto = globalThis.localStorage && localStorage.getItem(this.CHAVE);
      if (!texto) return null;
      const db = this.migrar(JSON.parse(texto));
      return db.campeonatos && db.campeonatos.length ? db : null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Apaga os dados salvos só neste aparelho (localStorage).
   * NÃO mexe em this.db nem chama salvar(): os dados da nuvem ficam intactos.
   */
  apagarDadosLocais() {
    if (globalThis.localStorage) localStorage.removeItem(this.CHAVE);
  },

  /** Depois de enviar para a nuvem, guarda os dados locais com outro nome (não apaga). */
  arquivarDadosLocais() {
    const texto = localStorage.getItem(this.CHAVE);
    if (!texto) return;
    localStorage.setItem(`${this.CHAVE}-enviado-${new Date().toISOString().slice(0, 10)}`, texto);
    localStorage.removeItem(this.CHAVE);
  },

  /**
   * Grava. Chame sempre depois de mudar algo.
   * - Modo online: o nuvem.js descobre o que mudou e envia (ou guarda até ter internet).
   * - Modo local: salva tudo no localStorage.
   */
  salvar() {
    if (this.online()) { App.nuvem.agendarSalvar(); return; }
    if (!globalThis.localStorage) return;
    try {
      localStorage.setItem(this.CHAVE, JSON.stringify(this.db));
    } catch (e) {
      console.error(e);
      App.util.toast('Não foi possível salvar (memória cheia?). Faça um backup.', 'erro', 5000);
    }
  },

  /* ---------- Configuração padrão de uma categoria ---------- */

  /**
   * Cria a configuração padrão. Se o nome tiver número (ex.: "Sub-11"),
   * sugere o ano mínimo de nascimento: ano do campeonato − (11 − 1).
   * Ex.: Sub-11 em 2026 → nascidos em 2016 ou depois.
   */
  configPadrao(nomeCategoria, anoCampeonato) {
    // Só categorias por idade ("Sub-11") sugerem ano de nascimento.
    // Categorias por ano escolar ("2º ano") não.
    const num = parseInt((/sub\s*-?\s*(\d+)/i.exec(nomeCategoria || '') || [])[1], 10);
    const ano = anoCampeonato || new Date().getFullYear();
    return {
      formato: 'pontos',          // 'pontos' | 'grupos' | 'mata'
      idaEVolta: false,           // pontos corridos com returno?
      numGrupos: 2,               // só no formato 'grupos'
      classificadosPorGrupo: 2,   // só no formato 'grupos'
      terceiroLugar: false,       // mata-mata com disputa de 3º lugar?
      duracaoPeriodo: num && num <= 9 ? 15 : 20, // minutos
      numPeriodos: 2,
      pontosVitoria: 3,
      pontosEmpate: 1,
      pontosDerrota: 0,
      desempate: ['pontos', 'vitorias', 'saldo', 'golsPro', 'confronto', 'cartoes', 'sorteio'],
      limiteAmarelos: 3,
      limiteFaltas: 5,
      anoMinimo: num ? ano - (num - 1) : null, // ano de nascimento mínimo
    };
  },

  /** Nomes bonitos dos critérios de desempate. */
  NOMES_DESEMPATE: {
    pontos: 'Pontos',
    vitorias: 'Vitórias',
    saldo: 'Saldo de gols',
    golsPro: 'Gols pró',
    confronto: 'Confronto direto',
    cartoes: 'Menos cartões',
    sorteio: 'Sorteio',
    saldoPontos: 'Saldo de pontos (sets)', // só aparece em modalidades por sets
  },

  /* ---------- INTERCLASSE ---------- */

  /**
   * Tipos de placar das modalidades do interclasse.
   * (Campeonatos de futsal comuns não têm "tipoPlacar": valem como 'gols'.)
   */
  TIPOS_PLACAR: {
    gols: 'Gols / pontos (placar simples)',
    sets: 'Sets (vôlei)',
    resultado: 'Vitória / empate / derrota (sem placar)',
  },

  /**
   * ESPORTES do interclasse. O esporte define o tipo de placar, a súmula
   * e as regras padrão (oficiais). Tudo que muda em jogo de escola pode
   * ser alterado na aba Config. da modalidade.
   */
  ESPORTES: {
    futsal: {
      nome: 'Futsal', emoji: '⚽', tipoPlacar: 'gols',
      regras: { duracaoPeriodo: 20, numPeriodos: 2, limiteFaltas: 5, limiteAmarelos: 3 },
    },
    volei: {
      nome: 'Vôlei', emoji: '🏐', tipoPlacar: 'sets',
      regras: { melhorDe: 3, pontosSet: 25, pontosSetDecisivo: 15, rodizio: false, libero: false, limiteSubstituicoes: 6, temposPorSet: 2 },
    },
    basquete: {
      nome: 'Basquete', emoji: '🏀', tipoPlacar: 'gols', permiteEmpate: false,
      regras: { duracaoPeriodo: 10, numPeriodos: 4, prorrogacao: 5, faltasDesqualifica: 5, bonusEquipe: 5, temposPrimeiraMetade: 2, temposSegundaMetade: 3, temposProrrogacao: 1 },
    },
    handebol: {
      nome: 'Handebol', emoji: '🤾', tipoPlacar: 'gols',
      regras: { duracaoPeriodo: 30, numPeriodos: 2, exclusaoMinutos: 2, exclusoesDesqualifica: 3, temposJogo: 3, temposPorTempo: 2 },
    },
    tenisdemesa: {
      nome: 'Tênis de mesa', emoji: '🏓', tipoPlacar: 'sets',
      regras: { melhorDe: 3, pontosSet: 11, pontosSetDecisivo: 11, duplas: false },
    },
    xadrez: {
      nome: 'Xadrez', emoji: '♟️', tipoPlacar: 'resultado',
      regras: {},
    },
    outro: {
      nome: 'Outro', emoji: '🏅', tipoPlacar: 'gols',
      regras: { usaCronometro: false, duracaoPeriodo: 20, numPeriodos: 2 },
    },
  },

  /** Sugestões para o formulário de nova modalidade. */
  MODALIDADES_SUGERIDAS: [
    { nome: 'Futsal', emoji: '⚽', esporte: 'futsal' },
    { nome: 'Vôlei', emoji: '🏐', esporte: 'volei' },
    { nome: 'Basquete', emoji: '🏀', esporte: 'basquete' },
    { nome: 'Handebol', emoji: '🤾', esporte: 'handebol' },
    { nome: 'Tênis de mesa', emoji: '🏓', esporte: 'tenisdemesa' },
    { nome: 'Xadrez', emoji: '♟️', esporte: 'xadrez' },
    { nome: 'Queimada', emoji: '🔴', esporte: 'outro' },
  ],

  /**
   * Esporte de uma modalidade. Modalidades criadas antes de existir o
   * campo "esporte" têm o esporte deduzido do tipo de placar.
   */
  esporteDe(cat) {
    const c = (cat && cat.config) || {};
    if (c.esporte && this.ESPORTES[c.esporte]) return c.esporte;
    if (c.tipoPlacar === 'sets') return 'volei';
    if (c.tipoPlacar === 'resultado') return 'xadrez';
    return c.sumulaCompleta ? 'futsal' : 'outro';
  },

  /**
   * Configuração de uma modalidade do interclasse.
   * Parte da configuração de campeonato (configPadrao) + as regras do esporte.
   */
  configModalidade(dados = {}) {
    const esporte = this.ESPORTES[dados.esporte] ? dados.esporte : ({ sets: 'volei', resultado: 'xadrez' }[dados.tipoPlacar] || (dados.sumulaCompleta ? 'futsal' : 'outro'));
    const E = this.ESPORTES[esporte];
    const tipo = E.tipoPlacar;
    const cfg = Object.assign(this.configPadrao(''), E.regras, {
      esporte,
      tipoPlacar: tipo,                                  // 'gols' | 'sets' | 'resultado'
      permiteEmpate: tipo === 'sets' ? false : (E.permiteEmpate === false ? false : dados.permiteEmpate !== false),
      sumulaCompleta: esporte === 'futsal',              // súmula atual de futsal (gols, cartões, suspensões)
      anoMinimo: null,
    });
    if (dados.melhorDe) cfg.melhorDe = dados.melhorDe === 5 ? 5 : 3;
    if (tipo === 'sets') cfg.desempate = ['pontos', 'vitorias', 'saldo', 'saldoPontos', 'confronto', 'sorteio'];
    if (tipo === 'resultado') cfg.desempate = ['pontos', 'vitorias', 'confronto', 'sorteio'];
    if (!cfg.sumulaCompleta) cfg.desempate = cfg.desempate.filter((c) => c !== 'cartoes');
    return cfg;
  },

  /** Um campeonato é interclasse? */
  ehInterclasse(camp) {
    return !!(camp && camp.tipo === 'interclasse');
  },

  NOMES_FORMATO: {
    pontos: 'Pontos corridos',
    grupos: 'Grupos + mata-mata',
    mata: 'Só mata-mata',
  },

  /* ---------- Buscas rápidas ---------- */

  campeonato(id) {
    return this.db.campeonatos.find((c) => c.id === id) || null;
  },

  /** Acha uma categoria pelo id (em qualquer campeonato). Devolve { camp, cat }. */
  categoria(catId) {
    for (const camp of this.db.campeonatos) {
      const cat = camp.categorias.find((c) => c.id === catId);
      if (cat) return { camp, cat };
    }
    return { camp: null, cat: null };
  },

  time(id) {
    return this.db.times.find((t) => t.id === id) || null;
  },

  jogo(id) {
    return this.db.jogos.find((j) => j.id === id) || null;
  },

  /** Acha um jogador e o time dele. Devolve { time, jogador }. */
  jogador(jogadorId) {
    for (const time of this.db.times) {
      const jogador = time.jogadores.find((p) => p.id === jogadorId);
      if (jogador) return { time, jogador };
    }
    return { time: null, jogador: null };
  },

  timesDaCategoria(catId) {
    return this.db.times
      .filter((t) => t.categoriaId === catId)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  },

  /** Jogos da categoria em ordem cronológica (data/hora; se não tiver, ordem de criação). */
  jogosDaCategoria(catId) {
    return this.db.jogos.filter((j) => j.categoriaId === catId).sort(App.dados.compararJogos);
  },

  /**
   * Ordem dos jogos: primeiro pela "ordem" da tabela (rodada/fase),
   * e dentro da mesma rodada por data e hora.
   * Assim um jogo da rodada 3 nunca vem antes da rodada 2, o que é
   * importante para calcular as suspensões.
   */
  compararJogos(a, b) {
    const ra = Math.floor((a.ordem || 0) / 1000);
    const rb = Math.floor((b.ordem || 0) / 1000);
    if (ra !== rb) return ra - rb;
    const da = (a.data || '9999-99-99') + (a.hora || '99:99');
    const dbb = (b.data || '9999-99-99') + (b.hora || '99:99');
    if (da !== dbb) return da < dbb ? -1 : 1;
    return (a.ordem || 0) - (b.ordem || 0);
  },

  /* ---------- Apagar com tudo que depende ---------- */

  apagarCampeonato(id) {
    this.db.campeonatos = this.db.campeonatos.filter((c) => c.id !== id);
    this.db.times = this.db.times.filter((t) => t.campeonatoId !== id);
    this.db.jogos = this.db.jogos.filter((j) => j.campeonatoId !== id);
    this.salvar();
  },

  apagarCategoria(catId) {
    const { camp } = this.categoria(catId);
    if (!camp) return;
    camp.categorias = camp.categorias.filter((c) => c.id !== catId);
    this.db.times = this.db.times.filter((t) => t.categoriaId !== catId);
    this.db.jogos = this.db.jogos.filter((j) => j.categoriaId !== catId);
    this.salvar();
  },

  apagarTime(timeId) {
    this.db.times = this.db.times.filter((t) => t.id !== timeId);
    this.salvar();
  },

  /**
   * Cria um campeonato novo com os campos padrão.
   * Padrão: PRIVADO, e quem cria vira admin.
   */
  novoCampeonato(dados) {
    const eu = App.nuvem && App.nuvem.usuario ? App.nuvem.usuario.email.toLowerCase() : '';
    return Object.assign({
      id: App.util.id(),
      nome: '', local: '', dataInicio: '', dataFim: '',
      categorias: [],
      visibilidade: 'privado',   // 'privado' | 'publico'
      alertaIdade: true,         // avisar idade fora da categoria?
      admins: eu ? [eu] : [],
      criadoPor: eu,
    }, dados);
  },

  /* ---------- Backup ---------- */

  /**
   * Texto JSON para baixar.
   * No modo online vão só os campeonatos em que você é admin
   * (com os dados privados), sem os carimbos de data.
   */
  exportar() {
    let { campeonatos, times, jogos } = this.db;
    if (this.online()) {
      const meus = new Set(campeonatos.filter((c) => App.nuvem.ehAdmin(c)).map((c) => c.id));
      campeonatos = campeonatos.filter((c) => meus.has(c.id));
      times = times.filter((t) => meus.has(t.campeonatoId));
      jogos = jogos.filter((j) => meus.has(j.campeonatoId));
    }
    const semCarimbo = (k, v) => (['alteradoPor', 'alteradoEm', 'criadoEm'].includes(k) ? undefined : v);
    return JSON.stringify({ app: 'futsal-sumula', versao: this.VERSAO, exportadoEm: new Date().toISOString(), campeonatos, times, jogos }, semCarimbo, 2);
  },

  /**
   * Recebe o texto de um backup e confere.
   * - Modo local: substitui os dados do aparelho.
   * - Modo online: cria/atualiza na nuvem os campeonatos do arquivo
   *   (você vira admin dos novos). Devolve os nomes importados.
   */
  importar(texto) {
    let obj;
    try {
      obj = JSON.parse(texto);
    } catch (e) {
      throw new Error('O arquivo não é um JSON válido.');
    }
    if (!obj || !Array.isArray(obj.campeonatos) || !Array.isArray(obj.times) || !Array.isArray(obj.jogos)) {
      throw new Error('Este arquivo não parece ser um backup deste app.');
    }
    const dados = this.migrar({
      versao: obj.versao || 1,
      campeonatos: obj.campeonatos,
      times: obj.times,
      jogos: obj.jogos,
    });
    if (this.online()) return App.nuvem.importar(dados);
    this.db = dados;
    this.salvar();
    return dados.campeonatos.map((c) => c.nome);
  },
};
