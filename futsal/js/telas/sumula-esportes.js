/* =========================================================
   SÚMULAS POR ESPORTE (interclasse)
   Vôlei, basquete, handebol, tênis de mesa, xadrez e "outro".
   (O futsal continua usando a súmula de sumula.js, sem mudança.)

   IDEIA PRINCIPAL
   A súmula guarda só a LISTA DE LANCES, em ordem:
     sumula.lances = [{ id, tipo, lado: 'casa'|'fora', jogadorId, ... }]
   Placar, sets, quem saca, rodízio, faltas, exclusões... são sempre
   RECALCULADOS do zero a partir dessa lista (função recalcular de
   cada esporte). Por isso editar ou excluir um lance é simples e
   o resultado fica sempre coerente.
   O placar calculado é copiado para sumula.placar, que é o que a
   classificação, o pódio e o mata-mata leem (veja regras.js).

   Formato da súmula (todos os esportes):
     { esporte, lances: [], eventos: [], penaltis: [], placar: {casa, fora, sets?},
       cronometro: { acumuladoMs, iniciadoEm }, periodo, fimTempoNormal,
       arbitro1, arbitro2, mesario, anotador, cronometrista, observacoes,
       encerradaEm, xadrez? }
   ("eventos" e "penaltis" ficam vazios: são da súmula de futsal.)
   ========================================================= */

var App = globalThis.App = globalThis.App || {};
App.esportes = App.esportes || {};

const outroLado = (lado) => (lado === 'casa' ? 'fora' : 'casa');

/* =========================================================
   BASE COMUM
   ========================================================= */
App.sumulaEsporte = {
  jogo: null,
  intervalo: null,

  /** Módulo do esporte desta modalidade. */
  modulo(cat) {
    return App.esportes[App.dados.esporteDe(cat)];
  },

  /** Esta modalidade usa uma súmula deste arquivo? (interclasse e esporte ≠ futsal) */
  atende(camp, cat) {
    return App.dados.ehInterclasse(camp) && App.dados.esporteDe(cat) !== 'futsal';
  },

  nova(cat) {
    return {
      esporte: App.dados.esporteDe(cat),
      lances: [], eventos: [], penaltis: [], goleiros: {},
      placar: { casa: 0, fora: 0 },
      cronometro: { acumuladoMs: 0, iniciadoEm: null },
      periodo: 1, fimTempoNormal: false,
      arbitro1: '', arbitro2: '', mesario: '', anotador: '', cronometrista: '',
      observacoes: '', encerradaEm: null,
    };
  },

  /** Monta o "contexto": tudo que as telas dos esportes precisam. */
  contexto(jogo) {
    const D = App.dados;
    const { camp, cat } = D.categoria(jogo.categoriaId);
    const cfg = cat.config;
    const mod = this.modulo(cat);
    const s = jogo.sumula;
    const est = mod.recalcular(s, cfg, jogo);
    s.placar = est.placar; // o que a classificação lê
    const pode = App.podeEditar(camp);
    return {
      jogo, s, cat, cfg, camp, mod, est, pode,
      casa: D.time(jogo.casaId), fora: D.time(jogo.foraId),
      travada: jogo.status === 'encerrado' || !pode,
      time(lado) { return lado === 'casa' ? this.casa : this.fora; },
    };
  },

  /* ---------- Cronômetro (esportes com tempo) ---------- */
  decorrido(s) {
    const c = s.cronometro;
    return c.acumuladoMs + (c.iniciadoEm ? Date.now() - c.iniciadoEm : 0);
  },
  duracaoMs(ctx) {
    return (ctx.mod.duracaoMin ? ctx.mod.duracaoMin(ctx.s.periodo, ctx.cfg) : ctx.cfg.duracaoPeriodo) * 60000;
  },
  minutoAtual(ctx) {
    if (!ctx.mod.usaCronometro(ctx.cfg)) return null;
    const ms = this.decorrido(ctx.s);
    return ms === 0 ? 0 : Math.min(Math.round(this.duracaoMs(ctx) / 60000), Math.floor(ms / 60000) + 1);
  },
  nomePeriodo(ctx, n = ctx.s.periodo) {
    return ctx.mod.nomePeriodo ? ctx.mod.nomePeriodo(n, ctx.cfg) : `${n}º tempo`;
  },

  /* ---------- Gravar ---------- */
  salvar() {
    App.dados.salvar();
  },

  marcarAndamento(jogo) {
    if (jogo.status === 'agendado') jogo.status = 'andamento';
  },

  /** Acrescenta um lance (com período/minuto/tempo de jogo) e redesenha. */
  adicionar(lance) {
    const jogo = this.jogo;
    // uma atualização da nuvem pode ter trocado o jogo antes do 1º lance
    if (!jogo.sumula) jogo.sumula = this.nova(App.dados.categoria(jogo.categoriaId).cat);
    const s = jogo.sumula;
    s.lances = s.lances || [];
    const ctx = this.contexto(jogo);
    const base = { id: App.util.id(), periodo: s.periodo };
    if (ctx.mod.usaCronometro(ctx.cfg)) { base.minuto = this.minutoAtual(ctx); base.ms = this.decorrido(s); }
    s.lances.push(Object.assign(base, lance));
    this.marcarAndamento(jogo);
    this.contexto(jogo); // recalcula e atualiza sumula.placar
    this.salvar();
    this.redesenhar();
  },

  redesenhar() {
    App.telas.sumula.render(this.jogo.id);
  },

  /**
   * Janela para escolher um jogador do time.
   * bloqueados: Map(jogadorId → motivo). semJogador: texto do botão "sem jogador" (ou null).
   * Devolve uma Promise com o id, '' (sem jogador) ou null (cancelou).
   */
  escolherJogador(time, { titulo, bloqueados = new Map(), semJogador = 'Não identificado', somente = null } = {}) {
    const U = App.util;
    const lista = (time.jogadores || []).filter((p) => !somente || somente.includes(p.id));
    return new Promise((resolver) => {
      let escolhido = null;
      U.modal({
        titulo: titulo || time.nome,
        html: `${lista.length ? '' : `<p class="suave">A turma ainda não tem elenco cadastrado (página da turma → Elenco).</p>`}
          <div class="grade-jogadores">
          ${lista.map((p) => {
            const motivo = bloqueados.get(p.id);
            return `<button type="button" class="btn-jogador" data-jog="${p.id}" ${motivo ? 'disabled' : ''}>
              <b>${U.esc(p.numero)}</b><small>${U.esc(String(p.nome).split(' ')[0])}</small>${motivo ? `<span class="motivo">${U.esc(motivo)}</span>` : ''}</button>`;
          }).join('')}
          ${semJogador ? `<button type="button" class="btn-jogador" data-jog=""><b>—</b><small>${U.esc(semJogador)}</small></button>` : ''}
          </div>`,
        botoes: [{ texto: 'Cancelar', acao: () => resolver(null) }],
        aoAbrir: (m) => {
          m.el.querySelector('.grade-jogadores').onclick = (e) => {
            const b = e.target.closest('[data-jog]');
            if (!b || b.disabled) return;
            escolhido = b.dataset.jog;
            m.fechar();
            resolver(escolhido);
          };
        },
      });
    });
  },

  /** Janela com botões de opção. Devolve o valor escolhido ou null. */
  escolherOpcao(titulo, opcoes, htmlExtra = '') {
    const U = App.util;
    return new Promise((resolver) => {
      U.modal({
        titulo,
        html: `${htmlExtra}<div style="display:grid;gap:8px">${opcoes.map((o, i) => `<button type="button" class="btn btn-bloco ${o.classe || ''}" data-op="${i}" ${o.desativado ? 'disabled' : ''} style="min-height:52px">${U.esc(o.texto)}</button>`).join('')}</div>`,
        botoes: [{ texto: 'Cancelar', acao: () => resolver(null) }],
        aoAbrir: (m) => {
          m.el.querySelectorAll('[data-op]').forEach((b) => {
            b.onclick = () => { m.fechar(); resolver(opcoes[Number(b.dataset.op)].valor); };
          });
        },
      });
    });
  },

  /* =======================================================
     DESENHO DA TELA
     ======================================================= */
  render(jogo) {
    const D = App.dados;
    const U = App.util;
    this.jogo = jogo;
    const { cat } = D.categoria(jogo.categoriaId);
    if (!jogo.sumula) jogo.sumula = this.nova(cat); // fica só na memória até o 1º lance
    const s = jogo.sumula;
    s.lances = s.lances || [];
    const ctx = this.contexto(jogo);
    const { mod, cfg, casa, fora, travada } = ctx;
    const fechada = jogo.status === 'encerrado';
    const relogio = mod.usaCronometro(cfg);
    const rodando = !!s.cronometro.iniciadoEm;
    const info = [`Jogo ${App.regras.numeroJogo(jogo)}`, jogo.rodadaNome, jogo.data && U.dataBR(jogo.data), jogo.hora, jogo.quadra].filter(Boolean).join(' · ');
    const avisos = travada ? [] : (mod.avisos ? mod.avisos(ctx) : []);

    App.main().innerHTML = `
      <p class="suave centro" style="margin:0 0 8px">${U.esc(cat.emoji || '')} ${U.esc(cat.nome)} · ${U.esc(info)}</p>
      ${fechada ? `<div class="aviso-faixa verde">✅ Súmula encerrada${s.encerradaEm ? ' em ' + new Date(s.encerradaEm).toLocaleString('pt-BR') : ''}. Ela está travada.
        <div class="grupo-botoes"><a class="btn btn-pequeno" href="#/imprimir/sumula/${jogo.id}">🖨️ Súmula oficial</a>
        <button class="btn btn-pequeno so-admin" id="se-reabrir">🔓 Reabrir</button></div></div>` : ''}
      ${avisos.map((a) => `<div class="aviso-faixa ${a.cor || 'amarela'}">${a.texto}</div>`).join('')}

      <div class="placar">
        ${mod.htmlPlacar(ctx)}
        ${relogio ? `
        <div class="centro" style="margin-top:8px">
          <div class="placar-periodo">${fechada ? 'Encerrado' : s.fimTempoNormal ? 'Fim do tempo de jogo' : U.esc(this.nomePeriodo(ctx))}</div>
          <div class="cronometro" id="cronometro">${U.mmss(this.decorrido(s))}</div>
          <div class="placar-periodo">de ${U.mmss(this.duracaoMs(ctx))}</div>
        </div>
        ${!travada && !s.fimTempoNormal ? `<div class="controles-cronometro">
          <button class="btn ${rodando ? 'btn-aviso' : 'btn-primario'}" id="se-relogio">${rodando ? '⏸ Pausar' : (this.decorrido(s) ? '▶ Continuar' : '▶ Iniciar')}</button>
          <button class="btn" id="se-fim-periodo">⏹ Encerrar ${U.esc(this.nomePeriodo(ctx))}</button>
        </div>` : ''}` : ''}
      </div>

      ${travada ? '' : mod.htmlControles(ctx)}

      <div class="cartao"><h2>Linha do tempo</h2>${this.htmlLinhaTempo(ctx)}</div>

      <div class="cartao"><h2>Arbitragem e mesa</h2>
        <form id="se-dados"><div class="campos-2">
          ${[['arbitro1', 'Árbitro 1'], ['arbitro2', 'Árbitro 2'], ['mesario', 'Mesário'], ['anotador', 'Anotador']].map(([k, r]) => `
            <label class="campo"><span>${r}</span><input name="${k}" value="${U.esc(s[k] || '')}" ${travada ? 'disabled' : ''}></label>`).join('')}
        </div></form></div>

      <div class="cartao so-admin"><h2>Observações do árbitro</h2>
        <textarea id="se-obs" placeholder="Ocorrências, W.O., protestos..." ${travada ? 'disabled' : ''}>${U.esc(s.observacoes || '')}</textarea>
        ${travada ? '' : `<div class="grupo-botoes"><button class="btn btn-perigo btn-bloco" id="se-encerrar">🏁 Encerrar jogo e travar súmula</button></div>
        <p class="suave centro" style="margin:8px 0 0">Não vai usar a súmula?</p>
        <div class="grupo-botoes"><button class="btn btn-bloco" id="se-rapido">⚡ Lançar só o resultado</button></div>`}
      </div>
      <div class="grupo-botoes"><a class="btn" href="#/imprimir/sumula/${jogo.id}">🖨️ Ver súmula oficial / PDF</a></div>`;

    this.ligar(ctx);
    clearInterval(this.intervalo);
    if (relogio) {
      this.intervalo = setInterval(() => this.tique(), 250);
      App.aoSair = () => clearInterval(this.intervalo);
    }
  },

  htmlLinhaTempo(ctx) {
    const U = App.util;
    const { s, mod, travada } = ctx;
    if (!s.lances.length) return '<p class="vazio">Nenhum lance ainda.</p>';
    const lista = s.lances.map((l, i) => ({ l, i })).reverse();
    return `<ul class="linha-tempo">${lista.map(({ l }) => {
      const time = l.lado ? ctx.time(l.lado) : null;
      return `<li>
        <span class="minuto" style="flex-basis:70px">${U.esc(mod.rotulo ? mod.rotulo(l, ctx) : '')}</span>
        <span class="cresce">${mod.descrever(l, ctx)}${time ? `<br><span class="suave">${U.esc(time.nome)}</span>` : ''}</span>
        ${travada ? '' : `<button class="btn btn-pequeno btn-icone" data-se-editar="${l.id}" aria-label="Editar">✏️</button>
        <button class="btn btn-pequeno btn-icone" data-se-apagar="${l.id}" aria-label="Excluir">🗑️</button>`}
      </li>`;
    }).join('')}</ul>`;
  },

  ligar(ctx) {
    const U = App.util;
    const { s, jogo } = ctx;
    const main = App.main();
    const ligar = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    ligar('se-relogio', () => this.alternarRelogio(ctx));
    ligar('se-fim-periodo', () => this.encerrarPeriodo(ctx));
    ligar('se-encerrar', () => this.encerrar(ctx));
    ligar('se-reabrir', () => this.reabrir(ctx));
    ligar('se-rapido', () => App.telas.jogos.resultadoRapido(jogo));
    main.querySelectorAll('[data-se-apagar]').forEach((b) => { b.onclick = () => this.apagarLance(b.dataset.seApagar); });
    main.querySelectorAll('[data-se-editar]').forEach((b) => { b.onclick = () => this.editarLance(b.dataset.seEditar); });
    const form = document.getElementById('se-dados');
    if (form) form.oninput = (e) => { if (e.target.name) { s[e.target.name] = e.target.value; this.salvar(); } };
    const obs = document.getElementById('se-obs');
    if (obs) obs.oninput = (e) => { s.observacoes = e.target.value; this.salvar(); };
    if (!ctx.travada) ctx.mod.ligar(ctx, this);
  },

  /* ---------- Cronômetro ---------- */
  tique() {
    const el = document.getElementById('cronometro');
    if (!el || !this.jogo || !this.jogo.sumula) return;
    const s = this.jogo.sumula;
    const ctx = this.contextoLeve();
    const ms = this.decorrido(s);
    const dur = this.duracaoMs(ctx);
    if (ctx.pode && s.cronometro.iniciadoEm && ms >= dur) {
      s.cronometro.acumuladoMs = dur;
      s.cronometro.iniciadoEm = null;
      this.salvar();
      App.util.vibrar([300, 120, 300, 120, 600]);
      App.util.toast(`⏰ Fim do tempo: ${this.nomePeriodo(ctx)}. Toque em “Encerrar”.`, 'aviso', 5000);
      this.redesenhar();
      return;
    }
    el.textContent = App.util.mmss(Math.min(ms, dur));
    el.classList.toggle('fim', ms >= dur);
    if (ctx.mod.aoTique) ctx.mod.aoTique(ctx, this);
  },

  /** Contexto sem recalcular (para o relógio, 4x por segundo). */
  contextoLeve() {
    const { camp, cat } = App.dados.categoria(this.jogo.categoriaId);
    return { jogo: this.jogo, s: this.jogo.sumula, cat, cfg: cat.config, camp, mod: this.modulo(cat), pode: App.podeEditar(camp) };
  },

  alternarRelogio(ctx) {
    const c = ctx.s.cronometro;
    if (c.iniciadoEm) {
      c.acumuladoMs = this.decorrido(ctx.s);
      c.iniciadoEm = null;
    } else {
      if (c.acumuladoMs >= this.duracaoMs(ctx)) { App.util.toast('O tempo deste período acabou. Encerre o período.', 'aviso'); return; }
      c.iniciadoEm = Date.now();
      this.marcarAndamento(ctx.jogo);
    }
    App.util.vibrar(40);
    this.salvar();
    this.redesenhar();
  },

  async encerrarPeriodo(ctx) {
    const U = App.util;
    const { s, mod, cfg } = ctx;
    const total = mod.totalPeriodos(cfg);
    const falta = this.duracaoMs(ctx) - this.decorrido(s);
    const ultimo = s.periodo >= total;
    const prorrogar = ultimo && mod.precisaProrrogacao && mod.precisaProrrogacao(ctx);
    let msg = `Encerrar ${this.nomePeriodo(ctx)}?`;
    if (prorrogar) msg += ' O jogo está empatado: começa a prorrogação.';
    else if (ultimo) msg += ' É o fim do tempo de jogo.';
    if (falta > 1000) msg += ` Ainda faltam ${U.mmss(falta)} no cronômetro.`;
    if (!(await U.confirmar(msg, 'Encerrar'))) return;
    s.cronometro = { acumuladoMs: 0, iniciadoEm: null };
    this.marcarAndamento(ctx.jogo);
    if (ultimo && !prorrogar) {
      s.fimTempoNormal = true;
      U.toast('Fim do tempo de jogo. Revise e encerre a súmula.', 'ok');
    } else {
      s.periodo++;
      U.toast(`Começa: ${this.nomePeriodo(ctx, s.periodo)}.`, 'ok');
    }
    this.salvar();
    this.redesenhar();
  },

  /* ---------- Editar / excluir lance ---------- */
  editarLance(id) {
    const U = App.util;
    const jogo = this.jogo;
    const ctx = this.contexto(jogo);
    const l = jogo.sumula.lances.find((x) => x.id === id);
    if (!l) return;
    const time = l.lado ? ctx.time(l.lado) : null;
    const comJogador = 'jogadorId' in l && time;
    const opcoes = (sel) => `<option value="">— sem jogador —</option>` + (time ? time.jogadores : [])
      .map((p) => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${U.esc(p.numero)} · ${U.esc(p.nome)}</option>`).join('');
    U.modal({
      titulo: 'Editar lance',
      html: `<p>${ctx.mod.descrever(l, ctx)}</p><form id="se-form-lance">
        ${'minuto' in l ? `<label class="campo"><span>Minuto</span><input type="number" name="minuto" min="0" value="${U.esc(l.minuto)}"></label>` : ''}
        ${comJogador ? `<label class="campo"><span>Jogador</span><select name="jogadorId">${opcoes(l.jogadorId)}</select></label>` : ''}
        ${'texto' in l ? `<label class="campo"><span>Texto</span><input name="texto" value="${U.esc(l.texto)}"></label>` : ''}
        ${l.lado && ctx.mod.podeTrocarLado ? `<label class="check"><input type="checkbox" name="trocar"> Era do outro time (${U.esc(ctx.time(outroLado(l.lado)).nome)})</label>` : ''}
      </form>
      <p class="suave">Para corrigir outra coisa, exclua o lance e lance de novo.</p>`,
      botoes: [
        { texto: 'Cancelar' },
        {
          texto: 'Salvar', classe: 'btn-primario',
          acao: () => {
            const d = U.lerForm(document.getElementById('se-form-lance'));
            if ('minuto' in d && d.minuto !== null) l.minuto = d.minuto;
            if ('jogadorId' in d) l.jogadorId = d.jogadorId || null;
            if ('texto' in d) l.texto = d.texto;
            if (d.trocar) { l.lado = outroLado(l.lado); if ('jogadorId' in l) l.jogadorId = null; }
            this.contexto(jogo);
            this.salvar();
            this.redesenhar();
          },
        },
      ],
    });
  },

  async apagarLance(id) {
    const jogo = this.jogo;
    const ctx = this.contexto(jogo);
    const l = jogo.sumula.lances.find((x) => x.id === id);
    if (!l) return;
    const texto = ctx.mod.descrever(l, ctx).replace(/<[^>]+>/g, '');
    if (!(await App.util.confirmar(`Excluir “${texto}”? O placar é recalculado.`, 'Excluir', 'btn-perigo'))) return;
    jogo.sumula.lances = jogo.sumula.lances.filter((x) => x.id !== id);
    this.contexto(jogo);
    this.salvar();
    this.redesenhar();
  },

  /* ---------- Encerrar / reabrir ---------- */
  async encerrar(ctx) {
    const U = App.util;
    const { jogo, s, mod, est, casa, fora } = ctx;
    const erro = mod.podeEncerrar(ctx);
    if (erro) { U.toast(erro, 'erro', 6000); return; }
    const p = est.placar;
    if (!(await U.confirmar(`Encerrar o jogo: ${casa.nome} ${mod.textoPlacar ? mod.textoPlacar(ctx) : `${p.casa} × ${p.fora}`} ${fora.nome}? A súmula será travada e a classificação atualizada.`, 'Encerrar jogo', 'btn-perigo'))) return;
    if (s.cronometro.iniciadoEm) { s.cronometro.acumuladoMs = this.decorrido(s); s.cronometro.iniciadoEm = null; }
    s.fimTempoNormal = true;
    s.encerradaEm = new Date().toISOString();
    jogo.status = 'encerrado';
    App.regras.atualizarMataMata(jogo.categoriaId);
    this.salvar();
    U.toast('🏁 Jogo encerrado! Classificação atualizada.', 'ok', 3500);
    this.redesenhar();
  },

  async reabrir(ctx) {
    if (!(await App.util.confirmar('Reabrir a súmula para correções?', 'Reabrir'))) return;
    ctx.jogo.status = 'andamento';
    ctx.s.encerradaEm = null;
    App.regras.atualizarMataMata(ctx.jogo.categoriaId);
    this.salvar();
    this.redesenhar();
  },

  /** Empate não permitido (mata-mata ou modalidade sem empate)? Devolve a mensagem de erro. */
  erroEmpate(ctx) {
    const { est, jogo, cfg } = ctx;
    if (est.placar.casa !== est.placar.fora) return null;
    if (jogo.fase === 'mata') return 'Empate no mata-mata: decida o vencedor (use ⚡ Lançar só o resultado, com o desempate).';
    if (cfg.permiteEmpate === false) return 'Esta modalidade não termina empatada.';
    return null;
  },

  /* =======================================================
     IMPRESSÃO (súmula oficial do esporte)
     ======================================================= */
  htmlImpressao(jogo) {
    const U = App.util;
    const ctx = this.contexto(jogo);
    const { camp, cat, s, mod, casa, fora, est } = ctx;
    const p = est.placar;
    const nomeEsporte = App.dados.ESPORTES[App.dados.esporteDe(cat)].nome;
    const lances = s.lances.map((l, i) => `<tr><td class="n">${i + 1}</td><td class="n">${U.esc(mod.rotulo ? mod.rotulo(l, ctx) : '')}</td>
      <td>${l.lado ? U.esc(ctx.time(l.lado).nome) : '—'}</td><td>${mod.descrever(l, ctx)}</td></tr>`).join('');
    return `
      ${App.telas.relatorios.cabecalho(camp, cat, `SÚMULA DE ${nomeEsporte.toUpperCase()}`)}
      <table>
        <tr><th>Fase</th><td>${U.esc(jogo.rodadaNome)} · Jogo ${App.regras.numeroJogo(jogo)}</td><th>Data</th><td>${U.dataBR(jogo.data) || '—'} ${U.esc(jogo.hora || '')}</td></tr>
        <tr><th>Local</th><td>${U.esc(camp.local || '—')}</td><th>Quadra</th><td>${U.esc(jogo.quadra || '—')}</td></tr>
      </table>
      <div class="placar-folha"><div>${U.nomeTime(casa)}</div>
        <div class="gols">${jogo.status === 'agendado' ? '&nbsp;×&nbsp;' : U.esc(mod.textoPlacar ? mod.textoPlacar(ctx) : `${p.casa} × ${p.fora}`)}</div>
        <div>${U.nomeTime(fora)}</div></div>
      ${jogo.status !== 'encerrado' ? '<p class="sub"><b>(JOGO NÃO ENCERRADO)</b></p>' : ''}
      <h2>Arbitragem e mesa</h2>
      <table><tr><th>Árbitro 1</th><td>${U.esc(s.arbitro1 || '—')}</td><th>Árbitro 2</th><td>${U.esc(s.arbitro2 || '—')}</td></tr>
        <tr><th>Mesário</th><td>${U.esc(s.mesario || '—')}</td><th>Anotador</th><td>${U.esc(s.anotador || '—')}</td></tr></table>
      ${mod.htmlImpressao ? mod.htmlImpressao(ctx) : ''}
      <h2>Lances</h2>
      <table><thead><tr><th class="n">#</th><th class="n">Quando</th><th>Turma</th><th>Lance</th></tr></thead>
        <tbody>${lances || '<tr><td colspan="4">Nenhum lance registrado</td></tr>'}</tbody></table>
      ${App.podeEditar(camp) ? `<h2>Observações do árbitro</h2><div class="obs">${U.esc(s.observacoes || 'Sem observações.')}</div>` : ''}
      <div class="assinaturas"><div>Árbitro 1</div><div>Árbitro 2</div><div>Responsável ${U.esc(casa.nome)}</div><div>Responsável ${U.esc(fora.nome)}</div></div>`;
  },

  /** Tabela de jogadores para a impressão: colunas = [{ titulo, valor(jogadorId) }]. */
  tabelaJogadores(time, colunas) {
    const U = App.util;
    const linhas = (time.jogadores || []).map((p) => `<tr><td class="n">${U.esc(p.numero)}</td><td>${U.esc(p.nome)}</td>${colunas.map((c) => `<td class="n">${c.valor(p.id) || ''}</td>`).join('')}</tr>`).join('');
    return `<div><h2>${U.nomeTime(time)}</h2><table><thead><tr><th class="n">Nº</th><th>Atleta</th>${colunas.map((c) => `<th class="n">${c.titulo}</th>`).join('')}</tr></thead>
      <tbody>${linhas || `<tr><td colspan="${2 + colunas.length}">Sem elenco cadastrado</td></tr>`}</tbody></table></div>`;
  },

  /** Nome curto de um jogador ("10 · Pedro"). */
  nomeJogador(id) {
    if (!id) return 'sem jogador';
    const { jogador } = App.dados.jogador(id);
    return jogador ? `${jogador.numero} · ${jogador.nome}` : 'jogador removido';
  },
};

/* =========================================================
   MOTOR DE SETS (vôlei e tênis de mesa)
   Percorre os lances e calcula sets, placar do set e quem saca.
   regraSaque: 'sideout' (vôlei: saca quem ganhou o ponto)
               'tenis'   (troca a cada 2 pontos; a cada 1 no 10×10)
   ========================================================= */
function motorSets(s, cfg, regraSaque, rodizio) {
  const melhorDe = cfg.melhorDe === 5 ? 5 : 3;
  const precisa = Math.ceil(melhorDe / 2);
  const est = {
    melhorDe, precisa, sets: [], numero: 1, set: { casa: 0, fora: 0 }, ganhos: { casa: 0, fora: 0 },
    sacador: 'casa', primeiroSacador: 'casa', sacadorDefinido: false, encerrado: false,
    rotacao: { casa: null, fora: null }, subs: { casa: 0, fora: 0 }, tempos: { casa: 0, fora: 0 },
    fora: new Set(), sancoes: [], libero: { casa: null, fora: null }, jogadoresTM: { casa: [], fora: [] },
    marcas: {}, fimDeSet: null, trocaLado: false, ultimoLance: null,
  };
  const alvo = () => (est.numero === melhorDe ? cfg.pontosSetDecisivo || cfg.pontosSet : cfg.pontosSet);
  const sacadorTenis = () => {
    const n = est.set.casa + est.set.fora;
    const k = n < 20 ? Math.floor(n / 2) : 10 + (n - 20);
    return k % 2 === 0 ? est.primeiroSacador : outroLado(est.primeiroSacador);
  };
  const pontuar = (lado) => {
    est.set[lado]++;
    est.fimDeSet = null;
    est.trocaLado = false;
    if (regraSaque === 'sideout') {
      if (lado !== est.sacador) {
        est.sacador = lado;
        const rot = est.rotacao[lado];
        if (rodizio && rot) est.rotacao[lado] = [...rot.slice(1), rot[0]]; // gira: II → I
      }
    } else {
      est.sacador = sacadorTenis();
    }
    // Set decisivo do vôlei: troca de lado quando alguém chega a 8
    if (regraSaque === 'sideout' && est.numero === melhorDe && est.set[lado] === 8 && est.set[outroLado(lado)] < 8) est.trocaLado = true;
    const a = alvo();
    if (est.set[lado] >= a && est.set[lado] - est.set[outroLado(lado)] >= 2) {
      est.sets.push({ casa: est.set.casa, fora: est.set.fora });
      est.ganhos[lado]++;
      est.fimDeSet = { numero: est.numero, ...est.set };
      if (est.ganhos[lado] === precisa) { est.encerrado = true; return; }
      // Próximo set: zera e alterna quem saca primeiro
      est.numero++;
      est.set = { casa: 0, fora: 0 };
      est.subs = { casa: 0, fora: 0 };
      est.tempos = { casa: 0, fora: 0 };
      est.primeiroSacador = outroLado(est.primeiroSacador);
      est.sacador = est.primeiroSacador;
      est.sacadorDefinido = false;
      est.rotacao = { casa: null, fora: null };
    }
  };
  for (const l of s.lances || []) {
    est.ultimoLance = l;
    if (l.tipo === 'saque') {
      if (est.set.casa + est.set.fora === 0) { est.sacador = l.lado; est.primeiroSacador = l.lado; est.sacadorDefinido = true; }
    } else if (l.tipo === 'escalacao') {
      est.rotacao[l.lado] = (l.posicoes || []).slice();
    } else if (l.tipo === 'ponto') {
      if (!est.encerrado) pontuar(l.lado);
    } else if (l.tipo === 'substituicao') {
      est.subs[l.lado]++;
      const rot = est.rotacao[l.lado];
      if (rot) { const i = rot.indexOf(l.sai); if (i >= 0) rot[i] = l.entra; }
    } else if (l.tipo === 'tempo') {
      est.tempos[l.lado]++;
    } else if (l.tipo === 'sancao') {
      est.sancoes.push(l);
      if (l.sancao === 'expulsao' || l.sancao === 'desqualificacao') { if (l.jogadorId) est.fora.add(l.jogadorId); }
      if (l.sancao === 'penalidade' && !est.encerrado) pontuar(outroLado(l.lado)); // ponto para o adversário
    } else if (l.tipo === 'libero') {
      est.libero[l.lado] = l.jogadorId;
    } else if (l.tipo === 'jogadores') {
      est.jogadoresTM[l.lado] = l.ids || [];
    }
    est.marcas[l.id] = `Set ${est.fimDeSet && l.tipo !== 'saque' && (l.tipo === 'ponto' || l.tipo === 'sancao') ? est.fimDeSet.numero : est.numero} · ${est.fimDeSet && (l.tipo === 'ponto' || l.tipo === 'sancao') ? `${est.fimDeSet.casa}-${est.fimDeSet.fora}` : `${est.set.casa}-${est.set.fora}`}`;
  }
  est.placar = { casa: est.ganhos.casa, fora: est.ganhos.fora, sets: est.sets.slice() };
  return est;
}

/** HTML do placar de sets (vôlei e tênis de mesa). */
function htmlPlacarSets(ctx) {
  const U = App.util;
  const { est, casa, fora } = ctx;
  const lado = (t, l) => `<div class="placar-time">
      ${U.escudo(t)}<span class="nome">${U.esc(t.nome)}</span>
      <div class="placar-gols">${est.encerrado ? est.ganhos[l] : est.set[l]}</div>
      <div class="placar-extra"><span class="contador">Sets ${est.ganhos[l]}</span>${!est.encerrado && est.sacador === l ? '<span class="contador saque">🏐 saque</span>' : ''}</div>
    </div>`;
  return `<div class="placar-linha">${lado(casa, 'casa')}
    <div class="placar-centro"><div class="placar-periodo">${est.encerrado ? 'Fim de jogo' : `${est.numero}º set${est.numero === est.melhorDe ? ' (decisivo)' : ''}`}</div>
      <div class="placar-periodo">melhor de ${est.melhorDe} · set até ${est.numero === est.melhorDe ? (ctx.cfg.pontosSetDecisivo || ctx.cfg.pontosSet) : ctx.cfg.pontosSet}</div>
      ${est.sets.length ? `<div class="placar-penaltis">${est.sets.map((x) => `${x.casa}-${x.fora}`).join(' · ')}</div>` : ''}
    </div>${lado(fora, 'fora')}</div>`;
}

/* =========================================================
   VÔLEI
   ========================================================= */
App.esportes.volei = {
  usaCronometro: () => false,
  totalPeriodos: () => 1,
  podeTrocarLado: true,

  recalcular(s, cfg) {
    return motorSets(s, cfg, 'sideout', !!cfg.rodizio);
  },

  textoPlacar(ctx) {
    const e = ctx.est;
    return `${e.ganhos.casa} × ${e.ganhos.fora} (${e.sets.map((x) => `${x.casa}-${x.fora}`).join(', ') || '—'})`;
  },

  rotulo(l, ctx) { return ctx.est.marcas[l.id] || ''; },

  descrever(l) {
    const N = App.sumulaEsporte.nomeJogador;
    const SANCAO = { advertencia: '🟨 Advertência', penalidade: '🟥 Penalidade (ponto do adversário)', expulsao: '🟥🟨 Expulsão', desqualificacao: '⛔ Desqualificação' };
    switch (l.tipo) {
      case 'ponto': return '🏐 <b>Ponto</b>';
      case 'saque': return '🎯 Começa sacando';
      case 'escalacao': return `📋 Escalação (I–VI): ${(l.posicoes || []).map((id) => App.util.esc(N(id).split(' · ')[0])).join(', ')}`;
      case 'substituicao': return `🔄 Substituição: sai ${App.util.esc(N(l.sai))}, entra ${App.util.esc(N(l.entra))}`;
      case 'tempo': return '⏱️ Pedido de tempo';
      case 'sancao': return `${SANCAO[l.sancao] || 'Sanção'}${l.jogadorId ? ' · ' + App.util.esc(N(l.jogadorId)) : ' · equipe'}`;
      case 'libero': return `🟦 Líbero: ${App.util.esc(N(l.jogadorId))}`;
      default: return App.util.esc(l.tipo);
    }
  },

  avisos(ctx) {
    const e = ctx.est;
    const a = [];
    if (e.encerrado) a.push({ cor: 'verde', texto: `🏁 Fim de jogo: ${e.ganhos.casa} × ${e.ganhos.fora} em sets. Confira e encerre a súmula.` });
    else if (e.fimDeSet) a.push({ cor: 'verde', texto: `🏁 Fim do ${e.fimDeSet.numero}º set: ${e.fimDeSet.casa} × ${e.fimDeSet.fora}. ${ctx.cfg.rodizio ? 'Lance a escalação do próximo set.' : ''}` });
    if (e.trocaLado) a.push({ cor: 'amarela', texto: '🔁 <b>Troca de lado!</b> Set decisivo chegou a 8 pontos.' });
    if (ctx.cfg.rodizio && !e.encerrado) {
      ['casa', 'fora'].forEach((l) => { if (!e.rotacao[l]) a.push({ texto: `📋 Falta a escalação inicial do ${ctx.time(l).nome} neste set (rodízio ligado).` }); });
    }
    return a;
  },

  htmlPlacar: htmlPlacarSets,

  htmlControles(ctx) {
    const U = App.util;
    const { est, cfg } = ctx;
    if (est.encerrado) return '';
    const inicioSet = est.set.casa + est.set.fora === 0;
    const grade = (l) => {
      const rot = est.rotacao[l];
      if (!cfg.rodizio) return '';
      if (!rot) return `<button class="btn btn-pequeno btn-bloco" data-vo-escalar="${l}">📋 Escalação (I–VI)</button>`;
      const pos = ['I', 'II', 'III', 'IV', 'V', 'VI'];
      // desenho da quadra: IV III II em cima, V VI I embaixo
      const ordem = [3, 2, 1, 4, 5, 0];
      return `<div class="rodizio">${ordem.map((i) => `<div class="${i === 0 && est.sacador === l ? 'sacando' : ''}"><small>${pos[i]}</small><b>${U.esc((App.dados.jogador(rot[i]).jogador || {}).numero ?? '?')}</b></div>`).join('')}</div>`;
    };
    const col = (l) => {
      const t = ctx.time(l);
      return `<div class="eventos-col">
        <div class="cab" style="background:${t.cor};color:${U.corTexto(t.cor)}">${U.nomeTime(t)}</div>
        <button class="btn btn-evento btn-gol" data-vo-ponto="${l}" style="min-height:84px;font-size:1.3rem">+1 Ponto</button>
        ${grade(l)}
        <div class="duplo">
          <button class="btn btn-evento" data-vo-tempo="${l}" ${est.tempos[l] >= cfg.temposPorSet ? 'disabled' : ''}>⏱️ Tempo ${est.tempos[l]}/${cfg.temposPorSet}</button>
          <button class="btn btn-evento" data-vo-sub="${l}" ${est.subs[l] >= cfg.limiteSubstituicoes ? 'disabled' : ''}>🔄 Subst. ${est.subs[l]}/${cfg.limiteSubstituicoes}</button>
        </div>
        <div class="duplo">
          <button class="btn btn-pequeno" data-vo-sancao="${l}">🟨 Sanção</button>
          ${cfg.libero ? `<button class="btn btn-pequeno" data-vo-libero="${l}">🟦 Líbero</button>` : `<span></span>`}
        </div>
      </div>`;
    };
    return `
      ${inicioSet ? `<div class="grupo-botoes"><button class="btn btn-bloco" id="vo-saque">🎯 Quem saca primeiro neste set: <b>${U.esc(ctx.time(est.sacador).nome)}</b> (tocar para trocar)</button></div>` : ''}
      <div class="eventos-times">${col('casa')}${col('fora')}</div>`;
  },

  ligar(ctx, B) {
    const main = App.main();
    const { est, cfg } = ctx;
    const ja = (sel, fn) => main.querySelectorAll(sel).forEach((b) => { b.onclick = () => fn(b); });
    ja('[data-vo-ponto]', (b) => {
      if (cfg.rodizio && (!est.rotacao.casa || !est.rotacao.fora)) { App.util.toast('Rodízio ligado: lance a escalação dos dois times antes do 1º ponto do set.', 'aviso', 4000); return; }
      App.util.vibrar(30);
      B.adicionar({ tipo: 'ponto', lado: b.dataset.voPonto });
    });
    const saque = document.getElementById('vo-saque');
    if (saque) saque.onclick = () => B.adicionar({ tipo: 'saque', lado: outroLado(est.sacador) });
    ja('[data-vo-tempo]', (b) => B.adicionar({ tipo: 'tempo', lado: b.dataset.voTempo }));
    ja('[data-vo-sub]', async (b) => {
      const l = b.dataset.voSub;
      const t = ctx.time(l);
      const rot = est.rotacao[l];
      const sai = await B.escolherJogador(t, { titulo: `🔄 ${t.nome}: quem SAI?`, somente: rot, semJogador: null });
      if (!sai) return;
      const entra = await B.escolherJogador(t, { titulo: `🔄 ${t.nome}: quem ENTRA?`, bloqueados: new Map([...(rot || [sai])].map((id) => [id, 'em quadra']).concat([...est.fora].map((id) => [id, 'fora']))), semJogador: null });
      if (!entra) return;
      B.adicionar({ tipo: 'substituicao', lado: l, sai, entra });
    });
    ja('[data-vo-sancao]', async (b) => {
      const l = b.dataset.voSancao;
      const t = ctx.time(l);
      const sancao = await B.escolherOpcao(`Sanção · ${t.nome}`, [
        { valor: 'advertencia', texto: '🟨 Advertência' },
        { valor: 'penalidade', texto: '🟥 Penalidade (ponto para o adversário)' },
        { valor: 'expulsao', texto: '🟥🟨 Expulsão' },
        { valor: 'desqualificacao', texto: '⛔ Desqualificação' },
      ]);
      if (!sancao) return;
      const jogadorId = await B.escolherJogador(t, { titulo: 'Quem recebeu?', semJogador: 'Equipe / técnico' });
      if (jogadorId === null) return;
      B.adicionar({ tipo: 'sancao', lado: l, sancao, jogadorId: jogadorId || null });
    });
    ja('[data-vo-libero]', async (b) => {
      const l = b.dataset.voLibero;
      const jogadorId = await B.escolherJogador(ctx.time(l), { titulo: '🟦 Quem é o líbero?', semJogador: null });
      if (jogadorId) B.adicionar({ tipo: 'libero', lado: l, jogadorId });
    });
    ja('[data-vo-escalar]', (b) => this.escalar(ctx, B, b.dataset.voEscalar));
  },

  /** Escalação inicial do set: 6 jogadores nas posições I a VI. */
  escalar(ctx, B, l) {
    const U = App.util;
    const t = ctx.time(l);
    const fora = ctx.est.fora;
    if ((t.jogadores || []).length < 6) { U.toast('A turma precisa de pelo menos 6 jogadores no elenco (página da turma).', 'erro', 4500); return; }
    const opcoes = (i) => `<option value="">—</option>${t.jogadores.filter((p) => !fora.has(p.id)).map((p) => `<option value="${p.id}">${U.esc(p.numero)} · ${U.esc(p.nome)}</option>`).join('')}`;
    U.modal({
      titulo: `📋 Escalação · ${t.nome} · ${ctx.est.numero}º set`,
      html: `<p class="suave" style="margin-top:0">Posição I = quem saca. O rodízio gira sozinho quando o time recupera o saque.</p>
        <form id="vo-esc"><div class="campos-2">${['I', 'II', 'III', 'IV', 'V', 'VI'].map((p, i) => `<label class="campo"><span>Posição ${p}</span><select name="p${i}">${opcoes(i)}</select></label>`).join('')}</div></form>`,
      botoes: [
        { texto: 'Cancelar' },
        {
          texto: 'Salvar escalação', classe: 'btn-primario',
          acao: () => {
            const f = document.getElementById('vo-esc');
            const posicoes = [0, 1, 2, 3, 4, 5].map((i) => f['p' + i].value);
            if (posicoes.some((x) => !x) || new Set(posicoes).size !== 6) { U.toast('Escolha 6 jogadores diferentes.', 'erro'); return false; }
            B.adicionar({ tipo: 'escalacao', lado: l, posicoes });
          },
        },
      ],
    });
  },

  podeEncerrar(ctx) {
    return ctx.est.encerrado ? null : `O jogo ainda não terminou (vence quem ganhar ${ctx.est.precisa} sets). Para encerrar antes (W.O., chuva...), use ⚡ Lançar só o resultado.`;
  },

  htmlImpressao(ctx) {
    const U = App.util;
    const { est, casa, fora } = ctx;
    const B = App.sumulaEsporte;
    const sancoes = (id) => est.sancoes.filter((x) => x.jogadorId === id).map((x) => ({ advertencia: 'A', penalidade: 'P', expulsao: 'E', desqualificacao: 'D' }[x.sancao])).join(' ');
    return `<h2>Sets</h2><table><thead><tr><th>Set</th><th class="n">${U.esc(casa.nome)}</th><th class="n">${U.esc(fora.nome)}</th></tr></thead>
      <tbody>${est.sets.map((x, i) => `<tr><td>${i + 1}º</td><td class="n">${x.casa}</td><td class="n">${x.fora}</td></tr>`).join('') || '<tr><td colspan="3">—</td></tr>'}</tbody></table>
      <div class="colunas">${B.tabelaJogadores(casa, [{ titulo: 'Sanções', valor: sancoes }])}${B.tabelaJogadores(fora, [{ titulo: 'Sanções', valor: sancoes }])}</div>
      <p>Sanções: A = advertência · P = penalidade · E = expulsão · D = desqualificação</p>`;
  },
};

/* =========================================================
   TÊNIS DE MESA
   ========================================================= */
App.esportes.tenisdemesa = {
  usaCronometro: () => false,
  totalPeriodos: () => 1,
  podeTrocarLado: true,

  recalcular(s, cfg) {
    return motorSets(s, cfg, 'tenis', false);
  },
  textoPlacar: App.esportes.volei.textoPlacar,
  rotulo(l, ctx) { return ctx.est.marcas[l.id] || ''; },

  descrever(l) {
    const N = App.sumulaEsporte.nomeJogador;
    if (l.tipo === 'ponto') return '🏓 <b>Ponto</b>';
    if (l.tipo === 'saque') return '🎯 Começa sacando';
    if (l.tipo === 'jogadores') return `👤 Jogando: ${(l.ids || []).map((id) => App.util.esc(N(id))).join(' e ')}`;
    return App.util.esc(l.tipo);
  },

  avisos(ctx) {
    const e = ctx.est;
    const a = [];
    if (e.encerrado) a.push({ cor: 'verde', texto: `🏁 Fim de jogo: ${e.ganhos.casa} × ${e.ganhos.fora} em sets. Confira e encerre a súmula.` });
    else if (e.fimDeSet) a.push({ cor: 'verde', texto: `🏁 Fim do ${e.fimDeSet.numero}º set: ${e.fimDeSet.casa} × ${e.fimDeSet.fora}.` });
    if (!e.encerrado && e.set.casa >= 10 && e.set.fora >= 10) a.push({ texto: '⚖️ 10 × 10: o saque troca a cada ponto.' });
    return a;
  },

  htmlPlacar(ctx) {
    return htmlPlacarSets(ctx).replace(/🏐 saque/g, '🏓 saque');
  },

  htmlControles(ctx) {
    const U = App.util;
    const { est, cfg } = ctx;
    if (est.encerrado) return '';
    const inicioSet = est.set.casa + est.set.fora === 0;
    const col = (l) => {
      const t = ctx.time(l);
      const quem = est.jogadoresTM[l];
      return `<div class="eventos-col">
        <div class="cab" style="background:${t.cor};color:${U.corTexto(t.cor)}">${U.nomeTime(t)}</div>
        <button class="btn btn-evento btn-gol" data-tm-ponto="${l}" style="min-height:96px;font-size:1.3rem">+1 Ponto</button>
        <button class="btn btn-pequeno" data-tm-jog="${l}">👤 ${quem.length ? U.esc(quem.map((id) => App.sumulaEsporte.nomeJogador(id)).join(' / ')) : (cfg.duplas ? 'Escolher dupla' : 'Escolher jogador')}</button>
      </div>`;
    };
    return `${inicioSet ? `<div class="grupo-botoes"><button class="btn btn-bloco" id="tm-saque">🎯 Quem saca primeiro neste set: <b>${U.esc(ctx.time(est.sacador).nome)}</b> (tocar para trocar)</button></div>` : ''}
      <div class="eventos-times">${col('casa')}${col('fora')}</div>`;
  },

  ligar(ctx, B) {
    const main = App.main();
    main.querySelectorAll('[data-tm-ponto]').forEach((b) => { b.onclick = () => { App.util.vibrar(30); B.adicionar({ tipo: 'ponto', lado: b.dataset.tmPonto }); }; });
    const saque = document.getElementById('tm-saque');
    if (saque) saque.onclick = () => B.adicionar({ tipo: 'saque', lado: outroLado(ctx.est.sacador) });
    main.querySelectorAll('[data-tm-jog]').forEach((b) => {
      b.onclick = async () => {
        const l = b.dataset.tmJog;
        const t = ctx.time(l);
        const um = await B.escolherJogador(t, { titulo: ctx.cfg.duplas ? `${t.nome}: 1º da dupla` : `${t.nome}: quem joga?`, semJogador: null });
        if (!um) return;
        const ids = [um];
        if (ctx.cfg.duplas) {
          const dois = await B.escolherJogador(t, { titulo: `${t.nome}: 2º da dupla`, bloqueados: new Map([[um, 'já escolhido']]), semJogador: null });
          if (!dois) return;
          ids.push(dois);
        }
        B.adicionar({ tipo: 'jogadores', lado: l, ids });
      };
    });
  },

  podeEncerrar: App.esportes.volei.podeEncerrar,

  htmlImpressao(ctx) {
    const U = App.util;
    const { est, casa, fora } = ctx;
    const N = App.sumulaEsporte.nomeJogador;
    return `<h2>Jogadores</h2><table><tr><th>${U.esc(casa.nome)}</th><td>${U.esc(est.jogadoresTM.casa.map(N).join(' / ') || '—')}</td></tr>
      <tr><th>${U.esc(fora.nome)}</th><td>${U.esc(est.jogadoresTM.fora.map(N).join(' / ') || '—')}</td></tr></table>
      <h2>Sets</h2><table><thead><tr><th>Set</th><th class="n">${U.esc(casa.nome)}</th><th class="n">${U.esc(fora.nome)}</th></tr></thead>
      <tbody>${est.sets.map((x, i) => `<tr><td>${i + 1}º</td><td class="n">${x.casa}</td><td class="n">${x.fora}</td></tr>`).join('') || '<tr><td colspan="3">—</td></tr>'}</tbody></table>`;
  },
};

/* =========================================================
   BASQUETE
   ========================================================= */
App.esportes.basquete = {
  usaCronometro: () => true,
  totalPeriodos: (cfg) => cfg.numPeriodos || 4,
  duracaoMin(n, cfg) { return n <= (cfg.numPeriodos || 4) ? cfg.duracaoPeriodo : (cfg.prorrogacao || 5); },
  nomePeriodo(n, cfg) {
    const total = cfg.numPeriodos || 4;
    if (n > total) return `Prorrogação ${n - total > 1 ? n - total : ''}`.trim();
    return total === 4 ? `${n}º quarto` : `${n}º tempo`;
  },
  precisaProrrogacao(ctx) { return ctx.est.placar.casa === ctx.est.placar.fora; },

  /** Metade do jogo (para o limite de tempos): 1, 2 ou 'P2'... */
  metade(n, cfg) {
    const total = cfg.numPeriodos || 4;
    if (n > total) return 'P' + n;
    return n <= total / 2 ? 1 : 2;
  },
  limiteTempos(n, cfg) {
    const m = this.metade(n, cfg);
    if (m === 1) return cfg.temposPrimeiraMetade;
    if (m === 2) return cfg.temposSegundaMetade;
    return cfg.temposProrrogacao;
  },

  recalcular(s, cfg) {
    const est = {
      placar: { casa: 0, fora: 0 }, pontos: {}, faltas: {}, graves: {}, desq: new Set(),
      faltasEquipe: {}, tempos: {}, seta: null,
    };
    for (const l of s.lances || []) {
      if (l.tipo === 'pontos') {
        est.placar[l.lado] += l.valor;
        if (l.jogadorId) est.pontos[l.jogadorId] = (est.pontos[l.jogadorId] || 0) + l.valor;
      } else if (l.tipo === 'falta') {
        const chave = `${l.lado}-${l.periodo}`;
        est.faltasEquipe[chave] = (est.faltasEquipe[chave] || 0) + 1;
        if (l.jogadorId) {
          est.faltas[l.jogadorId] = (est.faltas[l.jogadorId] || 0) + 1;
          if (l.falta !== 'pessoal') est.graves[l.jogadorId] = (est.graves[l.jogadorId] || 0) + 1;
          if (est.faltas[l.jogadorId] >= cfg.faltasDesqualifica || est.graves[l.jogadorId] >= 2 || l.falta === 'desqualificante') est.desq.add(l.jogadorId);
        }
      } else if (l.tipo === 'tempo') {
        const chave = `${l.lado}-${this.metade(l.periodo, cfg)}`;
        est.tempos[chave] = (est.tempos[chave] || 0) + 1;
      } else if (l.tipo === 'seta') {
        est.seta = l.lado;
      }
    }
    return est;
  },

  rotulo(l, ctx) { return `${l.minuto ?? ''}' ${this.nomePeriodo(l.periodo, ctx.cfg).replace('º quarto', 'ºQ').replace('º tempo', 'ºT').replace('Prorrogação', 'Pr')}`; },

  descrever(l) {
    const N = App.sumulaEsporte.nomeJogador;
    const U = App.util;
    const FALTA = { pessoal: 'Falta pessoal', tecnica: 'Falta técnica', antidesportiva: 'Falta antidesportiva', desqualificante: 'Falta desqualificante' };
    if (l.tipo === 'pontos') return `🏀 <b>+${l.valor}</b> ${l.valor === 1 ? '(lance livre)' : ''} · ${U.esc(N(l.jogadorId))}`;
    if (l.tipo === 'falta') return `✋ ${FALTA[l.falta] || 'Falta'} · ${U.esc(N(l.jogadorId))}`;
    if (l.tipo === 'tempo') return '⏱️ Pedido de tempo';
    if (l.tipo === 'seta') return '↔️ Seta de posse alternada virou';
    return U.esc(l.tipo);
  },

  avisos(ctx) {
    const { est, s, cfg } = ctx;
    const a = [];
    ['casa', 'fora'].forEach((l) => {
      const n = est.faltasEquipe[`${l}-${s.periodo}`] || 0;
      if (n >= cfg.bonusEquipe) a.push({ cor: 'vermelha', texto: `🎯 <b>BÔNUS</b>: ${App.util.esc(ctx.time(l).nome)} tem ${n} faltas no período — toda falta agora dá lances livres para ${App.util.esc(ctx.time(outroLado(l)).nome)}.` });
    });
    est.desq.forEach((id) => a.push({ cor: 'vermelha', texto: `⛔ ${App.util.esc(App.sumulaEsporte.nomeJogador(id))} está desqualificado (fora do jogo).` }));
    if (s.fimTempoNormal && est.placar.casa === est.placar.fora) a.push({ cor: 'vermelha', texto: 'Basquete não termina empatado: reabra o período com prorrogação.' });
    return a;
  },

  htmlPlacar(ctx) {
    const U = App.util;
    const { est, s, cfg } = ctx;
    const lado = (l) => {
      const t = ctx.time(l);
      const fe = est.faltasEquipe[`${l}-${s.periodo}`] || 0;
      const tp = est.tempos[`${l}-${this.metade(s.periodo, cfg)}`] || 0;
      return `<div class="placar-time">${U.escudo(t)}<span class="nome">${U.esc(t.nome)}</span>
        <div class="placar-gols">${est.placar[l]}</div>
        <div class="placar-extra"><span class="contador ${fe >= cfg.bonusEquipe ? 'alerta' : ''}">✋ ${fe} faltas</span><span class="contador ${tp >= this.limiteTempos(s.periodo, cfg) ? 'usado' : ''}">⏱️ ${tp}/${this.limiteTempos(s.periodo, cfg)}</span></div></div>`;
    };
    return `<div class="placar-linha">${lado('casa')}<div class="placar-centro">
      <div class="placar-periodo">Posse alternada</div><div style="font-size:1.8rem">${est.seta ? (est.seta === 'casa' ? '⬅️' : '➡️') : '↔️'}</div></div>${lado('fora')}</div>`;
  },

  htmlControles(ctx) {
    const U = App.util;
    const { est, s, cfg } = ctx;
    if (s.fimTempoNormal) return '';
    const col = (l) => {
      const t = ctx.time(l);
      const tp = est.tempos[`${l}-${this.metade(s.periodo, cfg)}`] || 0;
      return `<div class="eventos-col">
        <div class="cab" style="background:${t.cor};color:${U.corTexto(t.cor)}">${U.nomeTime(t)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
          ${[1, 2, 3].map((v) => `<button class="btn btn-evento btn-gol" data-bq-pts="${l}" data-valor="${v}" style="min-height:64px;font-size:1.3rem">+${v}</button>`).join('')}
        </div>
        <div class="duplo">
          <button class="btn btn-evento" data-bq-falta="${l}">✋ Falta</button>
          <button class="btn btn-evento" data-bq-tempo="${l}" ${tp >= this.limiteTempos(s.periodo, cfg) ? 'disabled' : ''}>⏱️ Tempo</button>
        </div>
      </div>`;
    };
    return `<div class="eventos-times">${col('casa')}${col('fora')}</div>
      <div class="grupo-botoes"><button class="btn btn-bloco" id="bq-seta">↔️ Virar seta de posse (agora: ${est.seta ? U.esc(ctx.time(est.seta).nome) : 'não definida'})</button></div>`;
  },

  ligar(ctx, B) {
    const main = App.main();
    const { est } = ctx;
    const bloq = () => new Map([...est.desq].map((id) => [id, 'DESQUALIF.']));
    main.querySelectorAll('[data-bq-pts]').forEach((b) => {
      b.onclick = async () => {
        const l = b.dataset.bqPts;
        const valor = Number(b.dataset.valor);
        const jogadorId = await B.escolherJogador(ctx.time(l), { titulo: `🏀 +${valor} · quem fez?`, bloqueados: bloq() });
        if (jogadorId === null) return;
        App.util.vibrar(30);
        B.adicionar({ tipo: 'pontos', lado: l, valor, jogadorId: jogadorId || null });
      };
    });
    main.querySelectorAll('[data-bq-falta]').forEach((b) => {
      b.onclick = async () => {
        const l = b.dataset.bqFalta;
        const falta = await B.escolherOpcao(`✋ Falta · ${ctx.time(l).nome}`, [
          { valor: 'pessoal', texto: 'Falta pessoal' }, { valor: 'tecnica', texto: 'Falta técnica' },
          { valor: 'antidesportiva', texto: 'Falta antidesportiva' }, { valor: 'desqualificante', texto: 'Falta desqualificante' },
        ]);
        if (!falta) return;
        const jogadorId = await B.escolherJogador(ctx.time(l), { titulo: 'Quem cometeu?', bloqueados: bloq(), semJogador: 'Técnico / banco' });
        if (jogadorId === null) return;
        B.adicionar({ tipo: 'falta', lado: l, falta, jogadorId: jogadorId || null });
        const n = jogadorId ? (this.recalcular(B.jogo.sumula, ctx.cfg).faltas[jogadorId] || 0) : 0;
        if (n === ctx.cfg.faltasDesqualifica - 1) App.util.toast(`⚠️ ${B.nomeJogador(jogadorId)} está com ${n} faltas (mais uma e está fora).`, 'aviso', 4000);
        if (n >= ctx.cfg.faltasDesqualifica) App.util.toast(`⛔ ${B.nomeJogador(jogadorId)}: ${n}ª falta — DESQUALIFICADO.`, 'erro', 5000);
      };
    });
    main.querySelectorAll('[data-bq-tempo]').forEach((b) => { b.onclick = () => B.adicionar({ tipo: 'tempo', lado: b.dataset.bqTempo }); });
    const seta = document.getElementById('bq-seta');
    if (seta) seta.onclick = () => B.adicionar({ tipo: 'seta', lado: est.seta ? outroLado(est.seta) : 'casa' });
  },

  podeEncerrar(ctx) {
    if (!ctx.s.fimTempoNormal) return 'Encerre o último período antes (cronômetro → “Encerrar”). Para encerrar sem jogar até o fim, use ⚡ Lançar só o resultado.';
    if (ctx.est.placar.casa === ctx.est.placar.fora) return 'Basquete não termina empatado: precisa de prorrogação.';
    return null;
  },

  htmlImpressao(ctx) {
    const { est, casa, fora, cfg, s } = ctx;
    const B = App.sumulaEsporte;
    const cols = [{ titulo: 'Pts', valor: (id) => est.pontos[id] }, { titulo: 'Faltas', valor: (id) => est.faltas[id] }, { titulo: 'Obs', valor: (id) => (est.desq.has(id) ? 'DESQ' : '') }];
    const per = [];
    for (let n = 1; n <= Math.max(s.periodo, this.totalPeriodos(cfg)); n++) per.push(n);
    return `<div class="colunas">${B.tabelaJogadores(casa, cols)}${B.tabelaJogadores(fora, cols)}</div>
      <h2>Faltas de equipe por período</h2><table><thead><tr><th>Turma</th>${per.map((n) => `<th class="n">${this.nomePeriodo(n, cfg)}</th>`).join('')}</tr></thead>
      <tbody>${['casa', 'fora'].map((l) => `<tr><td>${App.util.esc(ctx.time(l).nome)}</td>${per.map((n) => `<td class="n">${est.faltasEquipe[`${l}-${n}`] || 0}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  },
};

/* =========================================================
   HANDEBOL
   ========================================================= */
App.esportes.handebol = {
  usaCronometro: () => true,
  totalPeriodos: (cfg) => cfg.numPeriodos || 2,
  nomePeriodo: (n) => `${n}º tempo`,

  recalcular(s, cfg) {
    const est = { placar: { casa: 0, fora: 0 }, gols: {}, sete: {}, amarelos: {}, exclusoes: {}, desq: new Set(), tempos: {}, temposJogo: { casa: 0, fora: 0 }, ativas: [] };
    for (const l of s.lances || []) {
      const marcaGol = l.tipo === 'gol' || (l.tipo === 'tiro7' && l.convertido);
      if (marcaGol) {
        est.placar[l.lado]++;
        if (l.jogadorId) est.gols[l.jogadorId] = (est.gols[l.jogadorId] || 0) + 1;
      }
      if (l.tipo === 'tiro7' && l.jogadorId) {
        const t = est.sete[l.jogadorId] = est.sete[l.jogadorId] || { c: 0, p: 0 };
        if (l.convertido) t.c++; else t.p++;
      }
      if (l.tipo === 'amarelo' && l.jogadorId) est.amarelos[l.jogadorId] = (est.amarelos[l.jogadorId] || 0) + 1;
      if (l.tipo === 'exclusao') {
        if (l.jogadorId) {
          est.exclusoes[l.jogadorId] = (est.exclusoes[l.jogadorId] || 0) + 1;
          if (est.exclusoes[l.jogadorId] >= cfg.exclusoesDesqualifica) est.desq.add(l.jogadorId);
        }
        // fim da exclusão em "tempo de jogo absoluto" (somando os tempos anteriores)
        const inicio = (l.periodo - 1) * cfg.duracaoPeriodo * 60000 + (l.ms || 0);
        est.ativas.push({ lance: l, fim: inicio + cfg.exclusaoMinutos * 60000 });
      }
      if (l.tipo === 'vermelho' && l.jogadorId) est.desq.add(l.jogadorId);
      if (l.tipo === 'tempo') {
        est.temposJogo[l.lado]++;
        est.tempos[`${l.lado}-${l.periodo}`] = (est.tempos[`${l.lado}-${l.periodo}`] || 0) + 1;
      }
    }
    return est;
  },

  /** Tempo de jogo absoluto agora (para as exclusões de 2 minutos). */
  agora(ctx) {
    return (ctx.s.periodo - 1) * ctx.cfg.duracaoPeriodo * 60000 + App.sumulaEsporte.decorrido(ctx.s);
  },

  rotulo(l) { return `${l.minuto ?? ''}' ${l.periodo}ºT`; },

  descrever(l) {
    const N = App.sumulaEsporte.nomeJogador;
    const U = App.util;
    if (l.tipo === 'gol') return `🤾 <b>Gol</b> · ${U.esc(N(l.jogadorId))}`;
    if (l.tipo === 'tiro7') return `🎯 Tiro de 7 m ${l.convertido ? '<b>convertido</b>' : 'perdido'} · ${U.esc(N(l.jogadorId))}`;
    if (l.tipo === 'amarelo') return `<span class="cartao-ico am"></span> Advertência · ${U.esc(N(l.jogadorId))}`;
    if (l.tipo === 'exclusao') return `⏳ Exclusão de 2 min · ${U.esc(N(l.jogadorId))}`;
    if (l.tipo === 'vermelho') return `<span class="cartao-ico vm"></span> Desqualificação · ${U.esc(N(l.jogadorId))}`;
    if (l.tipo === 'tempo') return '⏱️ Tempo de equipe';
    return U.esc(l.tipo);
  },

  avisos(ctx) {
    const { est } = ctx;
    const a = [];
    est.desq.forEach((id) => a.push({ cor: 'vermelha', texto: `⛔ ${App.util.esc(App.sumulaEsporte.nomeJogador(id))} desqualificado.` }));
    return a;
  },

  htmlExclusoes(ctx) {
    const U = App.util;
    const agora = this.agora(ctx);
    const ativas = ctx.est.ativas.filter((x) => x.fim > agora);
    if (!ativas.length) return '';
    return `<div class="exclusoes">${ativas.map((x) => `<span class="contador alerta" data-fim="${x.fim}">⏳ ${U.esc(ctx.time(x.lance.lado).nome)} · ${U.esc(App.sumulaEsporte.nomeJogador(x.lance.jogadorId))} volta em <b class="volta">${U.mmss(x.fim - agora)}</b></span>`).join('')}</div>`;
  },

  /** Atualiza as contagens das exclusões junto com o relógio. */
  aoTique(ctx) {
    const agora = this.agora(ctx);
    document.querySelectorAll('.exclusoes [data-fim]').forEach((el) => {
      const resta = Number(el.dataset.fim) - agora;
      if (resta <= 0) { el.remove(); App.util.vibrar(80); App.util.toast('⏳ Fim de uma exclusão: o jogador pode voltar.', 'aviso'); return; }
      el.querySelector('.volta').textContent = App.util.mmss(resta);
    });
  },

  htmlPlacar(ctx) {
    const U = App.util;
    const { est, s, cfg } = ctx;
    const lado = (l) => {
      const t = ctx.time(l);
      const tp = est.temposJogo[l];
      return `<div class="placar-time">${U.escudo(t)}<span class="nome">${U.esc(t.nome)}</span>
        <div class="placar-gols">${est.placar[l]}</div>
        <div class="placar-extra"><span class="contador ${tp >= cfg.temposJogo ? 'usado' : ''}">⏱️ ${tp}/${cfg.temposJogo}</span></div></div>`;
    };
    return `<div class="placar-linha">${lado('casa')}<div class="placar-centro"><div class="placar-periodo">${s.periodo}º tempo</div></div>${lado('fora')}</div>
      ${this.htmlExclusoes(ctx)}`;
  },

  htmlControles(ctx) {
    const U = App.util;
    const { est, s, cfg } = ctx;
    if (s.fimTempoNormal) return '';
    const col = (l) => {
      const t = ctx.time(l);
      const tempoBloq = est.temposJogo[l] >= cfg.temposJogo || (est.tempos[`${l}-${s.periodo}`] || 0) >= cfg.temposPorTempo;
      return `<div class="eventos-col">
        <div class="cab" style="background:${t.cor};color:${U.corTexto(t.cor)}">${U.nomeTime(t)}</div>
        <button class="btn btn-evento btn-gol" data-hb="gol" data-lado="${l}">🤾 GOL</button>
        <button class="btn btn-evento" data-hb="tiro7" data-lado="${l}">🎯 Tiro de 7 m</button>
        <div class="duplo">
          <button class="btn btn-evento btn-amarelo" data-hb="amarelo" data-lado="${l}"><span class="cartao-ico am"></span></button>
          <button class="btn btn-evento" data-hb="exclusao" data-lado="${l}">⏳ 2 min</button>
        </div>
        <div class="duplo">
          <button class="btn btn-evento btn-vermelho" data-hb="vermelho" data-lado="${l}"><span class="cartao-ico vm"></span></button>
          <button class="btn btn-evento" data-hb="tempo" data-lado="${l}" ${tempoBloq ? 'disabled' : ''}>⏱️ Tempo</button>
        </div>
      </div>`;
    };
    return `<div class="eventos-times">${col('casa')}${col('fora')}</div>`;
  },

  ligar(ctx, B) {
    const { est, cfg } = ctx;
    const bloq = () => new Map([...est.desq].map((id) => [id, 'DESQUALIF.']));
    App.main().querySelectorAll('[data-hb]').forEach((b) => {
      b.onclick = async () => {
        const tipo = b.dataset.hb;
        const l = b.dataset.lado;
        const t = ctx.time(l);
        if (tipo === 'tempo') { B.adicionar({ tipo: 'tempo', lado: l }); return; }
        let convertido;
        if (tipo === 'tiro7') {
          convertido = await B.escolherOpcao(`🎯 Tiro de 7 m · ${t.nome}`, [{ valor: 'sim', texto: '✅ Convertido (gol)', classe: 'btn-primario' }, { valor: 'nao', texto: '❌ Perdido / defendido' }]);
          if (!convertido) return;
        }
        const TIT = { gol: '🤾 Gol · quem fez?', tiro7: '🎯 Quem cobrou?', amarelo: 'Advertência · quem?', exclusao: '⏳ Exclusão de 2 min · quem?', vermelho: 'Desqualificação · quem?' };
        const jogadorId = await B.escolherJogador(t, { titulo: TIT[tipo], bloqueados: bloq() });
        if (jogadorId === null) return;
        const lance = { tipo, lado: l, jogadorId: jogadorId || null };
        if (tipo === 'tiro7') lance.convertido = convertido === 'sim';
        B.adicionar(lance);
        if (tipo === 'exclusao' && jogadorId) {
          const n = this.recalcular(B.jogo.sumula, cfg).exclusoes[jogadorId];
          if (n >= cfg.exclusoesDesqualifica) App.util.toast(`⛔ ${n}ª exclusão de ${B.nomeJogador(jogadorId)}: DESQUALIFICADO.`, 'erro', 5000);
        }
      };
    });
  },

  podeEncerrar(ctx) {
    if (!ctx.s.fimTempoNormal) return 'Encerre o último tempo antes (cronômetro → “Encerrar”). Para encerrar sem jogar até o fim, use ⚡ Lançar só o resultado.';
    return App.sumulaEsporte.erroEmpate(ctx);
  },

  htmlImpressao(ctx) {
    const { est, casa, fora } = ctx;
    const B = App.sumulaEsporte;
    const cols = [
      { titulo: 'Gols', valor: (id) => est.gols[id] },
      { titulo: '7 m', valor: (id) => (est.sete[id] ? `${est.sete[id].c}/${est.sete[id].c + est.sete[id].p}` : '') },
      { titulo: 'Adv.', valor: (id) => est.amarelos[id] },
      { titulo: '2 min', valor: (id) => est.exclusoes[id] },
      { titulo: 'Desq.', valor: (id) => (est.desq.has(id) ? 'D' : '') },
    ];
    return `<div class="colunas">${B.tabelaJogadores(casa, cols)}${B.tabelaJogadores(fora, cols)}</div>`;
  },
};

/* =========================================================
   XADREZ
   ========================================================= */
App.esportes.xadrez = {
  usaCronometro: () => false,
  totalPeriodos: () => 1,

  MOTIVOS: { mate: 'Xeque-mate', tempo: 'Tempo', abandono: 'Abandono', acordo: 'Acordo (empate)', afogamento: 'Afogamento', outro: 'Outro' },

  recalcular(s) {
    const x = s.xadrez || {};
    const est = { x, placar: { casa: 0, fora: 0 }, resolvido: !!x.resultado };
    if (x.resultado === 'empate') est.placar = { casa: 0, fora: 0, resultado: 'empate' };
    else if (x.resultado) {
      const vencedor = x.resultado === 'brancas' ? x.brancas : outroLado(x.brancas);
      est.placar = { casa: vencedor === 'casa' ? 1 : 0, fora: vencedor === 'fora' ? 1 : 0, resultado: vencedor };
    }
    return est;
  },

  textoPlacar(ctx) {
    const x = ctx.est.x;
    if (!x.resultado) return '—';
    if (x.resultado === 'empate') return '½ × ½';
    return ctx.est.placar.casa ? '1 × 0' : '0 × 1';
  },

  rotulo() { return ''; },

  descrever(l, ctx) {
    const U = App.util;
    if (l.tipo === 'resultado') {
      const R = { brancas: 'Brancas venceram', pretas: 'Pretas venceram', empate: 'Empate' };
      return `♟️ <b>${R[l.resultado]}</b>${l.motivo ? ' · ' + U.esc(this.MOTIVOS[l.motivo] || l.motivo) : ''}`;
    }
    return U.esc(l.tipo);
  },

  htmlPlacar(ctx) {
    const U = App.util;
    const x = ctx.est.x;
    const lado = (l) => {
      const t = ctx.time(l);
      const cor = x.brancas ? (x.brancas === l ? '⬜ brancas' : '⬛ pretas') : '';
      const res = !x.resultado ? '–' : x.resultado === 'empate' ? '½' : (ctx.est.placar[l] ? '1' : '0');
      return `<div class="placar-time">${U.escudo(t)}<span class="nome">${U.esc(t.nome)}</span><div class="placar-gols">${res}</div>
        <div class="placar-extra">${cor ? `<span class="contador">${cor}</span>` : ''}</div></div>`;
    };
    return `<div class="placar-linha">${lado('casa')}<div class="placar-centro"><div class="placar-periodo">${x.motivo ? U.esc(this.MOTIVOS[x.motivo]) : 'Xadrez'}</div></div>${lado('fora')}</div>`;
  },

  htmlControles(ctx) {
    const U = App.util;
    const { casa, fora, est, jogo, cfg } = ctx;
    const x = est.x;
    const podeEmpatar = jogo.fase !== 'mata' && cfg.permiteEmpate !== false;
    const opt = (v, t, sel) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${U.esc(t)}</option>`;
    const jog = (time, sel) => `<option value="">— jogador (opcional) —</option>${(time.jogadores || []).map((p) => opt(p.id, `${p.numero} · ${p.nome}`, sel)).join('')}`;
    return `<form id="xz" class="cartao">
      <h2>♟️ Partida</h2>
      <label class="campo"><span>Quem jogou de brancas?</span><select name="brancas">${opt('', '— escolher —', x.brancas || '')}${opt('casa', casa.nome, x.brancas)}${opt('fora', fora.nome, x.brancas)}</select></label>
      <div class="campos-2">
        <label class="campo"><span>${U.esc(casa.nome)}</span><select name="jogadorCasa">${jog(casa, x.jogadorCasa)}</select></label>
        <label class="campo"><span>${U.esc(fora.nome)}</span><select name="jogadorFora">${jog(fora, x.jogadorFora)}</select></label>
      </div>
      <label class="campo"><span>Resultado</span><select name="resultado">${opt('', '— ainda jogando —', x.resultado || '')}${opt('brancas', '⬜ Vitória das brancas', x.resultado)}${opt('pretas', '⬛ Vitória das pretas', x.resultado)}${podeEmpatar ? opt('empate', '½ Empate', x.resultado) : ''}</select></label>
      <label class="campo"><span>Motivo</span><select name="motivo">${opt('', '—', x.motivo || '')}${Object.entries(this.MOTIVOS).map(([k, v]) => opt(k, v, x.motivo)).join('')}</select></label>
      <div class="campos-2">
        <label class="campo"><span>Relógio das brancas (restante)</span><input name="tempoBrancas" value="${U.esc(x.tempoBrancas || '')}" placeholder="ex.: 03:25"></label>
        <label class="campo"><span>Relógio das pretas (restante)</span><input name="tempoPretas" value="${U.esc(x.tempoPretas || '')}" placeholder="ex.: 01:10"></label>
      </div>
      <button class="btn btn-primario btn-bloco" type="submit">💾 Registrar partida</button>
    </form>`;
  },

  ligar(ctx, B) {
    const f = document.getElementById('xz');
    if (!f) return;
    f.onsubmit = (e) => {
      e.preventDefault();
      const d = App.util.lerForm(f);
      if (d.resultado && !d.brancas) { App.util.toast('Diga qual turma jogou de brancas.', 'erro'); return; }
      const antes = ctx.s.xadrez || {};
      ctx.s.xadrez = d;
      // linha do tempo: registra quando o resultado muda
      if (d.resultado && (d.resultado !== antes.resultado || d.motivo !== antes.motivo)) {
        B.adicionar({ tipo: 'resultado', lado: null, resultado: d.resultado, motivo: d.motivo });
      } else {
        B.marcarAndamento(B.jogo);
        B.contexto(B.jogo);
        B.salvar();
        B.redesenhar();
      }
      App.util.toast('Partida registrada.', 'ok');
    };
  },

  podeEncerrar(ctx) {
    if (!ctx.est.x.resultado) return 'Registre o resultado da partida antes de encerrar.';
    if (ctx.est.x.resultado === 'empate' && (ctx.jogo.fase === 'mata' || ctx.cfg.permiteEmpate === false)) return 'Esta partida não pode terminar empatada.';
    return null;
  },

  htmlImpressao(ctx) {
    const U = App.util;
    const x = ctx.est.x;
    const N = App.sumulaEsporte.nomeJogador;
    const R = { brancas: 'Vitória das brancas', pretas: 'Vitória das pretas', empate: 'Empate' };
    const cor = (l) => (x.brancas ? (x.brancas === l ? 'Brancas' : 'Pretas') : '—');
    return `<h2>Partida</h2><table>
      <tr><th>${U.esc(ctx.casa.nome)}</th><td>${cor('casa')}</td><td>${U.esc(x.jogadorCasa ? N(x.jogadorCasa) : '—')}</td></tr>
      <tr><th>${U.esc(ctx.fora.nome)}</th><td>${cor('fora')}</td><td>${U.esc(x.jogadorFora ? N(x.jogadorFora) : '—')}</td></tr>
      <tr><th>Resultado</th><td colspan="2">${U.esc(R[x.resultado] || '—')}${x.motivo ? ' · ' + U.esc(this.MOTIVOS[x.motivo]) : ''}</td></tr>
      <tr><th>Relógio</th><td colspan="2">Brancas ${U.esc(x.tempoBrancas || '—')} · Pretas ${U.esc(x.tempoPretas || '—')}</td></tr></table>`;
  },
};

/* =========================================================
   OUTRO (esporte que não está na lista)
   ========================================================= */
App.esportes.outro = {
  usaCronometro: (cfg) => !!cfg.usaCronometro,
  totalPeriodos: (cfg) => cfg.numPeriodos || 2,
  nomePeriodo: (n) => `${n}º tempo`,
  podeTrocarLado: true,

  recalcular(s) {
    const est = { placar: { casa: 0, fora: 0 } };
    for (const l of s.lances || []) if (l.tipo === 'ponto') est.placar[l.lado] = Math.max(0, est.placar[l.lado] + (l.valor || 1));
    return est;
  },

  rotulo(l, ctx) { return this.usaCronometro(ctx.cfg) && l.minuto !== undefined ? `${l.minuto}' ${l.periodo}ºT` : ''; },

  descrever(l) {
    const U = App.util;
    if (l.tipo === 'ponto') return (l.valor || 1) > 0 ? `<b>+${l.valor || 1} ponto</b>` : `<b>${l.valor} ponto</b> (correção)`;
    if (l.tipo === 'texto') return `📝 ${U.esc(l.texto)}`;
    return U.esc(l.tipo);
  },

  htmlPlacar(ctx) {
    const U = App.util;
    const lado = (l) => `<div class="placar-time">${U.escudo(ctx.time(l))}<span class="nome">${U.esc(ctx.time(l).nome)}</span><div class="placar-gols">${ctx.est.placar[l]}</div></div>`;
    return `<div class="placar-linha">${lado('casa')}<div class="placar-centro"><div class="placar-periodo">Placar</div></div>${lado('fora')}</div>`;
  },

  htmlControles(ctx) {
    const U = App.util;
    if (ctx.s.fimTempoNormal) return '';
    const col = (l) => {
      const t = ctx.time(l);
      return `<div class="eventos-col"><div class="cab" style="background:${t.cor};color:${U.corTexto(t.cor)}">${U.nomeTime(t)}</div>
        <button class="btn btn-evento btn-gol" data-ou-ponto="${l}" data-valor="1" style="min-height:72px;font-size:1.3rem">+1</button>
        <button class="btn btn-pequeno" data-ou-ponto="${l}" data-valor="-1">−1 (corrigir)</button></div>`;
    };
    return `<div class="eventos-times">${col('casa')}${col('fora')}</div>
      <div class="grupo-botoes"><button class="btn btn-bloco" id="ou-texto">📝 Registrar evento (texto livre)</button></div>`;
  },

  ligar(ctx, B) {
    App.main().querySelectorAll('[data-ou-ponto]').forEach((b) => { b.onclick = () => B.adicionar({ tipo: 'ponto', lado: b.dataset.ouPonto, valor: Number(b.dataset.valor) }); });
    const tx = document.getElementById('ou-texto');
    if (tx) tx.onclick = () => {
      const U = App.util;
      U.modal({
        titulo: '📝 Evento',
        html: `<form id="ou-f"><label class="campo"><span>Turma</span><select name="lado"><option value="">— nenhuma —</option><option value="casa">${U.esc(ctx.casa.nome)}</option><option value="fora">${U.esc(ctx.fora.nome)}</option></select></label>
          <label class="campo"><span>O que aconteceu?</span><input name="texto" placeholder="Ex.: queimou o capitão"></label></form>`,
        aoAbrir: () => document.querySelector('#ou-f [name=texto]').focus(),
        botoes: [{ texto: 'Cancelar' }, {
          texto: 'Registrar', classe: 'btn-primario',
          acao: () => {
            const d = U.lerForm(document.getElementById('ou-f'));
            if (!d.texto) { U.toast('Escreva o evento.', 'erro'); return false; }
            B.adicionar({ tipo: 'texto', lado: d.lado || null, texto: d.texto });
          },
        }],
      });
    };
  },

  podeEncerrar(ctx) {
    if (this.usaCronometro(ctx.cfg) && !ctx.s.fimTempoNormal) return 'Encerre o último período antes (cronômetro → “Encerrar”).';
    return App.sumulaEsporte.erroEmpate(ctx);
  },
};
