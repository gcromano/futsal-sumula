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
  VERSAO: 1,
  db: null,

  /** Banco vazio. */
  novoBanco() {
    return { versao: this.VERSAO, campeonatos: [], times: [], jogos: [] };
  },

  /** Lê do navegador (ou cria um banco vazio na primeira vez). */
  carregar() {
    try {
      const texto = globalThis.localStorage && localStorage.getItem(this.CHAVE);
      this.db = texto ? JSON.parse(texto) : this.novoBanco();
    } catch (e) {
      console.error('Erro ao ler dados salvos', e);
      this.db = this.novoBanco();
    }
    return this.db;
  },

  /** Grava no navegador. Chame sempre depois de mudar algo. */
  salvar() {
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
    const num = parseInt((/(\d+)/.exec(nomeCategoria || '') || [])[1], 10);
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

  /* ---------- Backup ---------- */

  /** Texto JSON com todos os dados (para baixar). */
  exportar() {
    return JSON.stringify({ app: 'futsal-sumula', exportadoEm: new Date().toISOString(), ...this.db }, null, 2);
  },

  /** Recebe o texto de um backup, confere e substitui os dados atuais. */
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
    this.db = {
      versao: obj.versao || this.VERSAO,
      campeonatos: obj.campeonatos,
      times: obj.times,
      jogos: obj.jogos,
    };
    this.salvar();
  },
};
