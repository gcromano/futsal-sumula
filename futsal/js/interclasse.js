/* =========================================================
   INTERCLASSE.JS — Olimpíada escolar com várias modalidades.

   COMO É GUARDADO (sem mudar nada dos campeonatos que já existem)
   Um interclasse é um "campeonato" com tipo: 'interclasse':
     camp.turmas      = [{ id, nome, cor }]   ← cadastradas UMA vez
     camp.categorias  = modalidades           ← cada uma funciona como
                        uma categoria de campeonato (tabela, formatos,
                        mata-mata, classificação, desempate...)
       modalidade.emoji, modalidade.config.tipoPlacar ('gols'|'sets'|'resultado'),
       modalidade.podio = { ouro, prata, bronze: [], confirmado, manual }
     camp.medalhas    = { criterio: 'olimpico'|'pontos', pontos: {ouro,prata,bronze} }
   Em cada modalidade, cada turma participante vira um "time" normal
   (time.turmaId aponta para a turma). Por isso tudo o que já existe
   (tabela, súmula, classificação, impressão) funciona igual.

   Mesma coleção, mesmas regras de segurança, mesmos admins,
   visibilidade e histórico dos campeonatos.
   ========================================================= */

var App = globalThis.App = globalThis.App || {};

App.inter = {
  /** Cores para as turmas novas (vão se repetindo). */
  CORES: ['#1f6fd1', '#d93a2b', '#0f7a3d', '#f2b705', '#6b3fa0', '#00838f', '#c2185b', '#ef8a17', '#3949ab', '#5d4037'],

  /** Cria um interclasse novo (privado; quem cria vira admin). */
  novo(dados) {
    const D = App.dados;
    const camp = D.novoCampeonato(Object.assign({
      tipo: 'interclasse',
      alertaIdade: false,
      turmas: [],
      medalhas: { criterio: 'olimpico', pontos: { ouro: 3, prata: 2, bronze: 1 } },
    }, dados));
    D.db.campeonatos.push(camp);
    return camp;
  },

  /* ---------- Turmas ---------- */

  /** Lê uma lista colada (uma turma por linha). Devolve { novas, repetidas }. */
  lerTurmas(camp, texto) {
    const existentes = new Set((camp.turmas || []).map((t) => App.tabela.normalizar(t.nome)));
    const vistas = new Set();
    const novas = [];
    const repetidas = [];
    String(texto || '').split(/\r?\n/).forEach((bruta) => {
      // tira marcadores de lista do começo: "- ", "• ", "* ", "1) ", "2. "
      const nome = bruta.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, '').replace(/\s+/g, ' ').trim();
      if (!nome) return;
      const chave = App.tabela.normalizar(nome);
      if (existentes.has(chave) || vistas.has(chave)) { repetidas.push(nome); return; }
      vistas.add(chave);
      novas.push(nome);
    });
    return { novas, repetidas };
  },

  adicionarTurmas(camp, nomes) {
    camp.turmas = camp.turmas || [];
    nomes.forEach((nome) => {
      camp.turmas.push({ id: App.util.id(), nome, cor: this.CORES[camp.turmas.length % this.CORES.length] });
    });
    App.dados.salvar();
  },

  /** Muda nome/cor da turma e atualiza os "times" dela em todas as modalidades. */
  editarTurma(camp, turmaId, dados) {
    const t = camp.turmas.find((x) => x.id === turmaId);
    if (!t) return;
    Object.assign(t, dados);
    App.dados.db.times.filter((x) => x.campeonatoId === camp.id && x.turmaId === turmaId)
      .forEach((x) => { x.nome = t.nome; x.cor = t.cor; });
    App.dados.salvar();
  },

  /** Jogos (de qualquer modalidade) em que a turma está. */
  jogosDaTurma(camp, turmaId) {
    const D = App.dados;
    const meus = new Set(D.db.times.filter((t) => t.campeonatoId === camp.id && t.turmaId === turmaId).map((t) => t.id));
    return D.db.jogos.filter((j) => j.campeonatoId === camp.id && !j.bye && (meus.has(j.casaId) || meus.has(j.foraId)));
  },

  /** Remove a turma (só se ela não tiver jogos em nenhuma modalidade). */
  removerTurma(camp, turmaId) {
    if (this.jogosDaTurma(camp, turmaId).length) {
      throw new Error('Esta turma já tem jogos. Tire os jogos dela antes (ou mantenha a turma).');
    }
    const D = App.dados;
    D.db.times = D.db.times.filter((t) => !(t.campeonatoId === camp.id && t.turmaId === turmaId));
    camp.turmas = camp.turmas.filter((t) => t.id !== turmaId);
    camp.categorias.forEach((cat) => {
      cat.turmaIds = (cat.turmaIds || []).filter((id) => id !== turmaId);
      const p = cat.podio;
      if (p && (p.ouro === turmaId || p.prata === turmaId || (p.bronze || []).includes(turmaId))) cat.podio = null;
    });
    D.salvar();
  },

  /* ---------- Modalidades ---------- */

  /** Cria uma modalidade com as turmas participantes. */
  adicionarModalidade(camp, dados) {
    const cat = {
      id: App.util.id(),
      nome: dados.nome,
      emoji: dados.emoji || '🏅',
      config: App.dados.configModalidade(dados),
      grupos: [],
      turmaIds: [],
      podio: null,
    };
    ['formato', 'pontosVitoria', 'pontosEmpate', 'pontosDerrota', 'idaEVolta', 'numGrupos', 'classificadosPorGrupo', 'terceiroLugar']
      .forEach((k) => { if (dados[k] !== undefined && dados[k] !== null) cat.config[k] = dados[k]; });
    camp.categorias.push(cat);
    this.definirParticipantes(camp, cat, dados.turmaIds || []);
    return cat;
  },

  /**
   * Define quais turmas jogam a modalidade.
   * Cria o "time" de quem entrou; tira quem saiu (se não tiver jogos).
   * Devolve a lista de turmas que não puderam sair por já terem jogos.
   */
  definirParticipantes(camp, cat, turmaIds) {
    const D = App.dados;
    const presos = [];
    const quer = new Set(turmaIds);
    const timesAtuais = D.db.times.filter((t) => t.categoriaId === cat.id && t.turmaId);
    for (const time of timesAtuais) {
      if (quer.has(time.turmaId)) continue;
      const temJogo = D.db.jogos.some((j) => j.categoriaId === cat.id && (j.casaId === time.id || j.foraId === time.id));
      if (temJogo) { presos.push(time.turmaId); quer.add(time.turmaId); continue; }
      D.db.times = D.db.times.filter((t) => t !== time);
    }
    for (const turmaId of quer) {
      if (timesAtuais.some((t) => t.turmaId === turmaId)) continue;
      const turma = (camp.turmas || []).find((t) => t.id === turmaId);
      if (!turma) continue;
      D.db.times.push({
        id: `${cat.id}-${turmaId}`, campeonatoId: camp.id, categoriaId: cat.id, turmaId,
        nome: turma.nome, cor: turma.cor || '#1f6fd1', escudo: '', bandeira: '',
        tecnico: '', responsavel: '', telefone: '', sorteio: Math.random(), jogadores: [],
      });
    }
    cat.turmaIds = [...quer];
    D.salvar();
    return presos;
  },

  /* ---------- Pódio ---------- */

  /** Grava o pódio da modalidade (ouro, prata, bronze[]), confirmado pelo admin. */
  definirPodio(cat, podio, manual) {
    const bronze = (podio.bronze || []).filter(Boolean);
    const usados = [podio.ouro, podio.prata, ...bronze].filter(Boolean);
    if (!podio.ouro) throw new Error('Escolha pelo menos o ouro.');
    if (new Set(usados).size !== usados.length) throw new Error('A mesma turma não pode ter duas medalhas na mesma modalidade.');
    cat.podio = { ouro: podio.ouro, prata: podio.prata || null, bronze, confirmado: true, manual: !!manual };
    App.dados.salvar();
  },

  limparPodio(cat) {
    cat.podio = null;
    App.dados.salvar();
  },

  /** Situação da modalidade: 'podio' (definido), 'aguardando' (acabou, falta confirmar), 'andamento', 'sem-jogos'. */
  situacao(cat) {
    if (cat.podio && cat.podio.confirmado) return 'podio';
    const jogos = App.dados.jogosDaCategoria(cat.id).filter((j) => !j.bye);
    if (!jogos.length) return 'sem-jogos';
    return App.regras.modalidadeConcluida(cat.id) ? 'aguardando' : 'andamento';
  },

  /* ---------- Jogos de hoje ---------- */

  /** Data de hoje no formato do app (AAAA-MM-DD), no fuso do aparelho. */
  hoje() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  /** Jogos de um dia (todas as modalidades), em ordem de horário. */
  jogosDoDia(camp, data) {
    return App.dados.db.jogos
      .filter((j) => j.campeonatoId === camp.id && !j.bye && j.data === data)
      .sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99') || (a.quadra || '').localeCompare(b.quadra || ''));
  },
};
