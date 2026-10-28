/* =========================================================
   NUVEM.JS — Login Google e sincronização com o Firestore.

   IDEIA PRINCIPAL
   O resto do app continua trabalhando com App.dados.db na memória
   (campeonatos, times, jogos), igual ao modo local. Este arquivo:
     1) BAIXA: escuta o Firestore em tempo real e atualiza App.dados.db;
     2) SOBE: quando o app chama App.dados.salvar(), compara a memória
        com o que já está no servidor e grava só o que mudou.

   OFFLINE: o Firestore guarda as gravações no aparelho (IndexedDB)
   e envia sozinho quando a internet voltar — inclusive se a página
   for fechada e aberta de novo. Por isso a súmula funciona sem rede.

   SEGURANÇA: quem decide o que pode é o firestore.rules (no servidor).
   As verificações daqui só servem para esconder botões.

   Estrutura no Firestore:
     campeonatos/{c}                → campeonato (visibilidade, admins...)
     campeonatos/{c}/times/{t}      → time sem dados pessoais
     campeonatos/{c}/privado/{t}    → responsável, telefone, nascimentos
     campeonatos/{c}/jogos/{j}      → jogo + súmula
     campeonatos/{c}/historico/{h}  → quem alterou o quê e quando
   ========================================================= */

var App = globalThis.App = globalThis.App || {};

App.nuvem = {
  ativo: false,          // Firebase configurado?
  usuario: null,         // { email, nome, foto } ou null (visitante)
  carregando: false,     // esperando a primeira resposta do servidor
  fs: null,              // Firestore
  auth: null,            // Authentication

  // Espelho do que está no servidor: caminho → JSON "canônico" (sem carimbos).
  // Serve para descobrir o que mudou e gravar só isso.
  ultimoSalvo: new Map(),
  timesPublicos: new Map(),  // timeId → documento público do time
  privados: new Map(),       // timeId → documento privado (contatos/nascimentos)
  idsPublicos: new Set(),    // campeonatos vindos da consulta "públicos"
  idsAdmin: new Set(),       // campeonatos vindos da consulta "sou admin"
  campsAdmin: new Set(),     // campeonatos em que sou admin (para saber o que posso apagar)
  ouvintes: [],              // funções para parar de escutar (consultas gerais)
  ouvintesCamp: new Map(),   // campId → { chave, parar: [] }
  filhosProntos: new Set(),  // "campId/sub" que já receberam a 1ª resposta do servidor
  pendentes: 0,              // lotes enviados que o servidor ainda não confirmou

  /** Campos de carimbo, que o servidor preenche e não entram na comparação. */
  CARIMBOS: ['alteradoPor', 'alteradoEm', 'criadoPor', 'criadoEm'],

  /** Teste local: http://localhost:8123/?emulador usa o emulador do Firebase. */
  usandoEmulador() {
    return ['localhost', '127.0.0.1'].includes(location.hostname) && location.search.includes('emulador');
  },

  /* =======================================================
     INÍCIO E LOGIN
     ======================================================= */
  iniciar() {
    let config = App.firebaseConfig;
    if (this.usandoEmulador()) {
      config = { apiKey: 'demo-chave', authDomain: 'demo-futsal.firebaseapp.com', projectId: 'demo-futsal', appId: 'demo' };
    }
    // No computador de desenvolvimento, ?local força o modo local (não toca no Firebase real)
    const forcarLocal = ['localhost', '127.0.0.1'].includes(location.hostname) && /[?&]local\b/.test(location.search);
    if (!config || !globalThis.firebase || forcarLocal) { this.ativo = false; return; }

    // Login no MESMO endereço do app quando ele está no Firebase Hosting
    // (futsal-sumula.web.app). Sem isso, Safari/iPhone e navegadores que isolam
    // os dados de cada site perdem o login no meio do caminho ("missing initial state").
    // ⚠️ Só liga depois de autorizar https://futsal-sumula.web.app/__/auth/handler
    // no Google Cloud (veja GUIA-FIREBASE.md); senão o Google dá "redirect_uri_mismatch".
    if (App.loginNoMesmoEndereco && /\.(web\.app|firebaseapp\.com)$/.test(location.hostname)) {
      config = Object.assign({}, config, { authDomain: location.hostname });
    }

    this.ativo = true;
    this.carregando = true;
    firebase.initializeApp(config);
    this.auth = firebase.auth();
    this.fs = firebase.firestore();
    if (this.usandoEmulador()) {
      this.fs.useEmulator('127.0.0.1', 8080);
      this.auth.useEmulator('http://127.0.0.1:9099', { disableWarnings: true });
    }
    // ignoreUndefinedProperties: campos "undefined" são simplesmente ignorados
    this.fs.settings({ ignoreUndefinedProperties: true, merge: true });
    // Cache no aparelho: abre offline e guarda gravações até a internet voltar
    this.fs.enablePersistence({ synchronizeTabs: true })
      .catch((e) => console.warn('Cache offline indisponível neste navegador:', e.code));

    this.auth.getRedirectResult().catch((e) => this.erroLogin(e));
    this.auth.onAuthStateChanged((u) => {
      this.usuario = u && u.email ? { email: u.email, nome: u.displayName || u.email, foto: u.photoURL } : null;
      this.assinar();
      App.render();
      App.atualizarStatus();
    });
    window.addEventListener('online', () => App.atualizarStatus());
    window.addEventListener('offline', () => App.atualizarStatus());
  },

  /** Abre o login do Google (janela; se o navegador bloquear, troca de página). */
  async entrar() {
    const provedor = new firebase.auth.GoogleAuthProvider();
    provedor.setCustomParameters({ prompt: 'select_account' });
    try {
      await this.auth.signInWithPopup(provedor);
    } catch (e) {
      const usarRedirecionamento = ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'];
      if (usarRedirecionamento.includes(e.code)) return this.auth.signInWithRedirect(provedor);
      this.erroLogin(e);
    }
  },

  sair() {
    return this.auth.signOut();
  },

  erroLogin(e) {
    if (!e || ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(e.code)) return;
    const msgs = {
      'auth/unauthorized-domain': 'Este endereço não está autorizado no Firebase. Veja o GUIA-FIREBASE.md, passo “Domínios autorizados”.',
      'auth/network-request-failed': 'Sem internet para entrar. Tente de novo quando a conexão voltar.',
      'auth/operation-not-allowed': 'O login com Google não está ativado no Firebase (veja o guia).',
    };
    App.util.toast(msgs[e.code] || 'Não foi possível entrar: ' + (e.message || e.code), 'erro', 6000);
  },

  /* =======================================================
     PERMISSÕES (só para a tela — a segurança real está nas regras)
     ======================================================= */
  ehAdmin(camp) {
    if (!this.usuario || !camp) return false;
    const eu = this.usuario.email.toLowerCase();
    return (camp.admins || []).some((e) => String(e).toLowerCase() === eu);
  },

  podeEditar(camp) {
    return !this.ativo || this.ehAdmin(camp);
  },

  /* =======================================================
     BAIXAR: escutar o servidor
     ======================================================= */

  /** Começa (ou recomeça, ao entrar/sair) a escutar os campeonatos visíveis. */
  assinar() {
    this.pararTudo();
    App.dados.db = App.dados.novoBanco();
    this.ultimoSalvo.clear();
    this.timesPublicos.clear();
    this.privados.clear();
    this.idsPublicos.clear();
    this.idsAdmin.clear();
    this.campsAdmin.clear();
    this.filhosProntos.clear();
    this.carregando = true;

    const col = this.fs.collection('campeonatos');
    const esperando = new Set(['publicos']);
    const pronto = (nome) => {
      esperando.delete(nome);
      if (!esperando.size && this.carregando) { this.carregando = false; this.pedirRender(true); }
    };

    // 1) Campeonatos públicos (todo mundo vê)
    this.ouvintes.push(col.where('visibilidade', '==', 'publico').onSnapshot(
      (snap) => { this.receberCampeonatos(snap, this.idsPublicos); pronto('publicos'); },
      (e) => { this.erroLeitura(e); pronto('publicos'); }));

    // 2) Campeonatos em que sou admin (públicos ou privados)
    if (this.usuario) {
      esperando.add('meus');
      this.ouvintes.push(col.where('admins', 'array-contains', this.usuario.email).onSnapshot(
        (snap) => { this.receberCampeonatos(snap, this.idsAdmin); pronto('meus'); },
        (e) => { this.erroLeitura(e); pronto('meus'); }));
    }
  },

  pararTudo() {
    this.ouvintes.forEach((parar) => parar());
    this.ouvintes = [];
    this.ouvintesCamp.forEach((o) => o.parar.forEach((parar) => parar()));
    this.ouvintesCamp.clear();
  },

  erroLeitura(e) {
    console.error(e);
    App.util.toast('Erro ao ler dados do servidor: ' + (e.code || e.message), 'erro', 5000);
  },

  /** Recebe a lista de campeonatos de uma das consultas. */
  receberCampeonatos(snap, conjunto) {
    const D = App.dados;
    conjunto.clear();
    let mudou = false;
    for (const doc of snap.docs) {
      conjunto.add(doc.id);
      if (this.aplicar(`campeonatos/${doc.id}`, doc, D.db.campeonatos)) mudou = true;
    }
    // Saiu das duas consultas (apagado, virou privado, me tiraram de admin): some daqui
    for (const camp of D.db.campeonatos.slice()) {
      if (!this.idsPublicos.has(camp.id) && !this.idsAdmin.has(camp.id) && this.ultimoSalvo.has(`campeonatos/${camp.id}`)) {
        this.removerCampeonatoLocal(camp.id);
        mudou = true;
      }
    }
    // Liga (ou ajusta) a escuta de times/jogos de cada campeonato
    this.campsAdmin = new Set(D.db.campeonatos.filter((c) => this.ehAdmin(c)).map((c) => c.id));
    D.db.campeonatos.forEach((c) => this.escutarFilhos(c));
    if (mudou) this.pedirRender();
  },

  /** Escuta times, jogos (e, se admin, os dados privados) de um campeonato. */
  escutarFilhos(camp) {
    if (!this.ultimoSalvo.has(`campeonatos/${camp.id}`)) return; // ainda não existe no servidor
    const admin = this.ehAdmin(camp);
    const chave = admin ? 'admin' : 'leitura';
    const atual = this.ouvintesCamp.get(camp.id);
    if (atual && atual.chave === chave) return;
    if (atual) atual.parar.forEach((parar) => parar());

    const base = this.fs.collection('campeonatos').doc(camp.id);
    const ouvir = (sub) => base.collection(sub).onSnapshot(
      (snap) => this.receberFilhos(camp.id, sub, snap),
      // permission-denied aqui é normal quando o campeonato some ou perdemos o acesso
      (e) => { if (e.code !== 'permission-denied') this.erroLeitura(e); });
    const parar = [ouvir('times'), ouvir('jogos')];
    if (admin) parar.push(ouvir('privado'));
    this.ouvintesCamp.set(camp.id, { chave, parar });
  },

  receberFilhos(campId, sub, snap) {
    const D = App.dados;
    let mudou = false;
    this.filhosProntos.add(`${campId}/${sub}`);
    for (const mud of snap.docChanges()) {
      const id = mud.doc.id;
      const caminho = `campeonatos/${campId}/${sub}/${id}`;
      if (mud.type === 'removed') {
        this.ultimoSalvo.delete(caminho);
        if (sub === 'times') { this.timesPublicos.delete(id); D.db.times = D.db.times.filter((t) => t.id !== id); }
        if (sub === 'jogos') D.db.jogos = D.db.jogos.filter((j) => j.id !== id);
        if (sub === 'privado') { this.privados.delete(id); this.montarTime(id); }
        mudou = true;
        continue;
      }
      if (sub === 'jogos') {
        if (this.aplicar(caminho, mud.doc, D.db.jogos)) mudou = true;
      } else {
        const dados = mud.doc.data({ serverTimestamps: 'estimate' });
        const igual = this.ultimoSalvo.get(caminho) === this.canonico(this.semCarimbo(dados));
        this.ultimoSalvo.set(caminho, this.canonico(this.semCarimbo(dados)));
        (sub === 'times' ? this.timesPublicos : this.privados).set(id, dados);
        this.montarTime(id);
        if (!igual) mudou = true;
      }
    }
    if (mudou) this.pedirRender();
  },

  /**
   * Coloca um documento recebido na lista da memória (sem trocar o objeto
   * de lugar, para as telas abertas continuarem apontando para ele).
   * Devolve true se o conteúdo mudou.
   */
  aplicar(caminho, doc, lista) {
    const dados = doc.data({ serverTimestamps: 'estimate' });
    const canon = this.canonico(this.semCarimbo(dados));
    const igual = this.ultimoSalvo.get(caminho) === canon;
    this.ultimoSalvo.set(caminho, canon);
    this.substituir(lista, Object.assign({ id: doc.id }, dados));
    return !igual;
  },

  /** Junta o documento público e o privado de um time num só objeto. */
  montarTime(id) {
    const pub = this.timesPublicos.get(id);
    if (!pub) return;
    const priv = this.privados.get(id) || {};
    const nasc = priv.nascimentos || {};
    const time = Object.assign({ id }, pub, {
      responsavel: priv.responsavel || '',
      telefone: priv.telefone || '',
      jogadores: (pub.jogadores || []).map((p) => Object.assign({}, p, { nascimento: nasc[p.id] || '' })),
    });
    this.substituir(App.dados.db.times, time);
  },

  /** Troca o conteúdo do objeto com o mesmo id (ou adiciona). */
  substituir(lista, novo) {
    const alvo = lista.find((x) => x.id === novo.id);
    if (!alvo) { lista.push(novo); return; }
    Object.keys(alvo).forEach((k) => delete alvo[k]);
    Object.assign(alvo, novo);
  },

  removerCampeonatoLocal(campId) {
    const D = App.dados;
    D.db.campeonatos = D.db.campeonatos.filter((c) => c.id !== campId);
    D.db.times = D.db.times.filter((t) => t.campeonatoId !== campId);
    D.db.jogos = D.db.jogos.filter((j) => j.campeonatoId !== campId);
    for (const k of [...this.ultimoSalvo.keys()]) if (k.split('/')[1] === campId) this.ultimoSalvo.delete(k);
    const o = this.ouvintesCamp.get(campId);
    if (o) { o.parar.forEach((parar) => parar()); this.ouvintesCamp.delete(campId); }
    ['times', 'jogos', 'privado'].forEach((sub) => this.filhosProntos.delete(`${campId}/${sub}`));
  },

  /**
   * Redesenha a tela depois de mudanças vindas do servidor.
   * Espera se houver uma janela aberta ou alguém digitando,
   * para não apagar o que a pessoa está preenchendo.
   */
  pedirRender(agora) {
    clearTimeout(this._timerRender);
    this._timerRender = setTimeout(() => {
      const ativo = document.activeElement;
      const ocupado = document.querySelector('.modal-fundo') || (ativo && /^(INPUT|TEXTAREA|SELECT)$/.test(ativo.tagName));
      if (ocupado) { this.pedirRender(); return; }
      App.render();
    }, agora ? 0 : 250);
  },

  /* =======================================================
     SUBIR: gravar o que mudou
     ======================================================= */

  /** Junta várias chamadas de salvar() do mesmo momento numa gravação só. */
  agendarSalvar() {
    if (this._agendado) return;
    this._agendado = true;
    Promise.resolve().then(() => { this._agendado = false; this.salvarAgora(); });
  },

  /** Monta os documentos de um campeonato do jeito que vão para o servidor. */
  documentosDoCampeonato(camp) {
    const D = App.dados;
    const docs = new Map();
    const c = camp.id;
    docs.set(`campeonatos/${c}`, this.limpar(camp));
    // Os dados privados só entram depois de chegarem do servidor (ou se o
    // campeonato é novo). Assim nunca gravamos contatos "vazios" por cima
    // dos verdadeiros enquanto a página ainda está carregando.
    const incluirPrivado = !this.ultimoSalvo.has(`campeonatos/${c}`) || this.filhosProntos.has(`${c}/privado`);
    for (const time of D.db.times.filter((t) => t.campeonatoId === c)) {
      const pub = this.limpar(time);
      delete pub.responsavel;
      delete pub.telefone;
      pub.jogadores = (pub.jogadores || []).map((p) => { const q = Object.assign({}, p); delete q.nascimento; return q; });
      docs.set(`campeonatos/${c}/times/${time.id}`, pub);
      if (!incluirPrivado) continue;
      const nascimentos = {};
      (time.jogadores || []).forEach((p) => { if (p.nascimento) nascimentos[p.id] = p.nascimento; });
      docs.set(`campeonatos/${c}/privado/${time.id}`, {
        campeonatoId: c, responsavel: time.responsavel || '', telefone: time.telefone || '', nascimentos,
      });
    }
    for (const jogo of D.db.jogos.filter((j) => j.campeonatoId === c)) {
      docs.set(`campeonatos/${c}/jogos/${jogo.id}`, this.limpar(jogo));
    }
    return docs;
  },

  /** Compara com o servidor e grava só o que mudou. */
  salvarAgora() {
    if (!this.ativo || !this.usuario) return null;
    const D = App.dados;
    const eu = this.usuario.email;
    const meus = D.db.campeonatos.filter((c) => this.ehAdmin(c));
    const idsMeus = new Set(meus.map((c) => c.id));
    const idsNaMemoria = new Set(D.db.campeonatos.map((c) => c.id));

    const atuais = new Map();
    meus.forEach((c) => this.documentosDoCampeonato(c).forEach((v, k) => atuais.set(k, v)));

    const gravar = [];
    for (const [caminho, dados] of atuais) {
      const canon = this.canonico(dados);
      if (this.ultimoSalvo.get(caminho) !== canon) gravar.push({ caminho, dados, canon, novo: !this.ultimoSalvo.has(caminho) });
    }
    const apagar = [];
    for (const caminho of this.ultimoSalvo.keys()) {
      if (atuais.has(caminho)) continue;
      const campId = caminho.split('/')[1];
      // Apaga se é de um campeonato meu, ou de um campeonato meu que eu apaguei
      if (idsMeus.has(campId) || (!idsNaMemoria.has(campId) && this.campsAdmin.has(campId))) apagar.push(caminho);
    }
    if (!gravar.length && !apagar.length) return null;

    const fv = firebase.firestore.FieldValue;
    const carimbo = () => ({ alteradoPor: eu, alteradoEm: fv.serverTimestamp() });
    const nivel = (c) => c.split('/').length; // 2 = campeonato; 4 = time/jogo/privado
    const ops1 = []; // campeonatos (criar/alterar) — vão primeiro
    const ops2 = []; // times, jogos, privados e histórico
    const ops3 = []; // apagar campeonatos — vão por último
    const resumoPorCamp = new Map();
    const anotar = (caminho, texto) => {
      const c = caminho.split('/')[1];
      if (!resumoPorCamp.has(c)) resumoPorCamp.set(c, []);
      resumoPorCamp.get(c).push(texto);
    };

    for (const g of gravar) {
      const ref = this.fs.doc(g.caminho);
      if (nivel(g.caminho) === 2) {
        if (g.novo) {
          ops1.push((b) => b.set(ref, Object.assign({}, g.dados, carimbo(), { criadoPor: eu, criadoEm: fv.serverTimestamp() })));
        } else {
          // merge: mantém criadoPor/criadoEm que já estão no servidor
          ops1.push((b) => b.set(ref, Object.assign({}, g.dados, carimbo()), { merge: true }));
        }
      } else {
        ops2.push((b) => b.set(ref, Object.assign({}, g.dados, carimbo())));
      }
      anotar(g.caminho, this.descrever(g.caminho, g.novo ? 'criado' : 'alterado'));
    }
    for (const caminho of apagar) {
      const ref = this.fs.doc(caminho);
      if (nivel(caminho) === 2) ops3.push((b) => b.delete(ref));
      else { ops2.push((b) => b.delete(ref)); anotar(caminho, this.descrever(caminho, 'excluído')); }
    }
    // Histórico: uma linha por campeonato alterado (que ainda existe)
    for (const [c, itens] of resumoPorCamp) {
      if (!idsNaMemoria.has(c)) continue;
      const unicos = [...new Set(itens.filter(Boolean))];
      const resumo = unicos.join('; ').slice(0, 990);
      const ref = this.fs.collection(`campeonatos/${c}/historico`).doc();
      ops2.push((b) => b.set(ref, { quem: eu, quando: fv.serverTimestamp(), resumo }));
    }

    // Campeonatos que apaguei: para de escutar antes de apagar
    for (const c of this.campsAdmin) {
      if (idsNaMemoria.has(c)) continue;
      const o = this.ouvintesCamp.get(c);
      if (o) { o.parar.forEach((parar) => parar()); this.ouvintesCamp.delete(c); }
    }

    // Atualiza o espelho já (se der erro, recarregamos do servidor)
    gravar.forEach((g) => this.ultimoSalvo.set(g.caminho, g.canon));
    apagar.forEach((c) => this.ultimoSalvo.delete(c));
    this.campsAdmin = new Set([...idsMeus]);

    // Envia em lotes, na ordem (o Firestore respeita a ordem, mesmo offline)
    const promessas = [];
    for (const ops of [ops1, ops2, ops3]) {
      for (let i = 0; i < ops.length; i += 400) {
        const lote = this.fs.batch();
        ops.slice(i, i + 400).forEach((op) => op(lote));
        promessas.push(this.enviar(lote));
      }
    }
    this.ultimaGravacao = Promise.all(promessas);
    // Liga a escuta de campeonatos recém-criados
    meus.forEach((c) => this.escutarFilhos(c));
    return this.ultimaGravacao;
  },

  enviar(lote) {
    this.pendentes++;
    App.atualizarStatus();
    return lote.commit()
      .catch((e) => {
        console.error(e);
        App.util.toast(e.code === 'permission-denied'
          ? 'O servidor recusou a alteração (sem permissão neste campeonato). Recarregando os dados.'
          : 'Erro ao salvar: ' + (e.code || e.message), 'erro', 6000);
        this.assinar(); // volta ao que está no servidor
        throw e;
      })
      .finally(() => { this.pendentes--; App.atualizarStatus(); });
  },

  /** Texto curto para o histórico, ex.: "jogo 5 (Brasil x Japão) alterado". */
  descrever(caminho, acao) {
    const D = App.dados;
    const partes = caminho.split('/');
    if (partes.length === 2) return `campeonato ${acao}`;
    const [, , sub, id] = partes;
    if (sub === 'privado') return acao === 'excluído' ? '' : `contatos de ${(D.time(id) || {}).nome || 'time'} ${acao}`;
    if (sub === 'times') return `time ${(D.time(id) || {}).nome || id} ${acao}`;
    if (sub === 'jogos') {
      const j = D.jogo(id);
      if (!j) return `jogo ${acao}`;
      const nome = (t) => (D.time(t) || {}).nome || '?';
      const extra = j.status === 'encerrado' ? ` ${App.regras.placar(j).casa}x${App.regras.placar(j).fora}` : '';
      return `jogo ${App.regras.numeroJogo(j)} (${nome(j.casaId)} x ${nome(j.foraId)}${extra}) ${acao}`;
    }
    return `${sub} ${acao}`;
  },

  /** Últimas alterações de um campeonato (só admins conseguem ler). */
  async historico(campId) {
    const snap = await this.fs.collection(`campeonatos/${campId}/historico`).orderBy('quando', 'desc').limit(40).get();
    return snap.docs.map((d) => d.data({ serverTimestamps: 'estimate' }));
  },

  /* =======================================================
     IMPORTAR (backup, migração do aparelho, Copa CES)
     ======================================================= */

  /**
   * Coloca os campeonatos de um backup na nuvem.
   * - Campeonato novo: é criado e EU viro admin.
   * - Já existe e sou admin: é substituído pelo do arquivo.
   * - Já existe e não sou admin: erro (as regras também bloqueiam).
   */
  importar(obj) {
    const D = App.dados;
    if (!this.usuario) throw new Error('Entre com sua conta Google para importar.');
    const eu = this.usuario.email.toLowerCase();
    const nomes = [];
    for (const original of obj.campeonatos) {
      const existente = D.campeonato(original.id);
      if (existente && !this.ehAdmin(existente)) throw new Error(`Você não é admin do campeonato “${original.nome}”.`);
      const camp = this.semCarimbo(JSON.parse(JSON.stringify(original)));
      camp.admins = [...new Set([...(camp.admins || []), ...(existente ? existente.admins : []), eu].map((e) => String(e).toLowerCase()))];
      camp.visibilidade = camp.visibilidade === 'publico' ? 'publico' : 'privado';
      if (camp.alertaIdade === undefined) camp.alertaIdade = true;
      if (existente) {
        D.db.times = D.db.times.filter((t) => t.campeonatoId !== camp.id);
        D.db.jogos = D.db.jogos.filter((j) => j.campeonatoId !== camp.id);
        this.substituir(D.db.campeonatos, Object.assign(camp, { criadoPor: existente.criadoPor, criadoEm: existente.criadoEm }));
      } else {
        camp.criadoPor = eu;
        D.db.campeonatos.push(camp);
      }
      obj.times.filter((t) => t.campeonatoId === camp.id).forEach((t) => D.db.times.push(this.semCarimbo(t)));
      obj.jogos.filter((j) => j.campeonatoId === camp.id).forEach((j) => D.db.jogos.push(this.semCarimbo(j)));
      nomes.push(camp.nome);
    }
    this.salvarAgora();
    return nomes;
  },

  /* =======================================================
     AJUDANTES
     ======================================================= */

  /** Cópia sem id, sem carimbos, sem campos internos (_algo) e sem "undefined". */
  limpar(obj) {
    const copia = JSON.parse(JSON.stringify(obj, (k, v) => (k.startsWith('_') ? undefined : v)));
    delete copia.id;
    this.CARIMBOS.forEach((k) => delete copia[k]);
    return copia;
  },

  semCarimbo(obj) {
    const copia = Object.assign({}, obj);
    this.CARIMBOS.forEach((k) => delete copia[k]);
    return copia;
  },

  /** JSON com as chaves sempre na mesma ordem (para comparar conteúdos). */
  canonico(valor) {
    if (Array.isArray(valor)) return '[' + valor.map((v) => this.canonico(v)).join(',') + ']';
    if (valor && typeof valor === 'object') {
      if (typeof valor.toMillis === 'function') return JSON.stringify(valor.toMillis());
      return '{' + Object.keys(valor).filter((k) => valor[k] !== undefined).sort()
        .map((k) => JSON.stringify(k) + ':' + this.canonico(valor[k])).join(',') + '}';
    }
    return JSON.stringify(valor === undefined ? null : valor);
  },
};
