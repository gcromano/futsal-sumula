/* =========================================================
   SÚMULA AO VIVO
   Placar, cronômetro, eventos, faltas acumuladas, pedidos
   de tempo, pênaltis, linha do tempo e encerramento.

   O cronômetro guarda { acumuladoMs, iniciadoEm }:
   - acumuladoMs = tempo já corrido antes da última pausa
   - iniciadoEm  = horário (Date.now) em que foi iniciado; null = pausado
   Assim, mesmo se o celular recarregar a página, o tempo continua certo.
   ========================================================= */

var App = globalThis.App = globalThis.App || {};
App.telas = App.telas || {};

App.telas.sumula = {
  jogo: null,
  intervalo: null,

  /** Ícone e nome de cada tipo de evento. */
  TIPOS: {
    gol: { icone: '⚽', nome: 'Gol' },
    golContra: { icone: '🔄', nome: 'Gol contra' },
    falta: { icone: '✋', nome: 'Falta' },
    amarelo: { icone: '<span class="cartao-ico am"></span>', nome: 'Cartão amarelo' },
    vermelho: { icone: '<span class="cartao-ico vm"></span>', nome: 'Cartão vermelho' },
    tempo: { icone: '⏱️', nome: 'Pedido de tempo' },
  },

  /* ---------- Atalhos ---------- */
  get s() { return this.jogo.sumula; },
  cfg() { return App.dados.categoria(this.jogo.categoriaId).cat.config; },
  duracaoMs() { return this.cfg().duracaoPeriodo * 60000; },
  encerrada() { return this.jogo.status === 'encerrado'; },
  ehMataMata() { return this.jogo.fase === 'mata'; },

  /** Tempo corrido no período (ms). */
  decorrido() {
    const c = this.s.cronometro;
    return c.acumuladoMs + (c.iniciadoEm ? Date.now() - c.iniciadoEm : 0);
  },

  /** Minuto atual para lançar eventos (1º minuto = 1). */
  minutoAtual() {
    const ms = this.decorrido();
    if (ms === 0) return 0;
    return Math.min(this.cfg().duracaoPeriodo, Math.floor(ms / 60000) + 1);
  },

  salvar() {
    App.dados.salvar();
  },

  /** Marca o jogo como "em andamento" na primeira ação. */
  marcarAndamento() {
    if (this.jogo.status === 'agendado') this.jogo.status = 'andamento';
  },

  nomeJogador(id) {
    if (!id) return 'Não identificado';
    const { jogador } = App.dados.jogador(id);
    return jogador ? `${jogador.nome} (${jogador.numero})` : 'Jogador removido';
  },

  /* =======================================================
     DESENHO DA TELA
     ======================================================= */
  render(jogoId) {
    const D = App.dados;
    const U = App.util;
    const R = App.regras;
    const jogo = D.jogo(jogoId);
    if (!jogo) { App.ir('#/'); return; }
    this.jogo = jogo;
    const { camp, cat } = D.categoria(jogo.categoriaId);
    App.titulo('Súmula · ' + cat.nome, `#/camp/${camp.id}/${cat.id}/jogos`);

    const casa = D.time(jogo.casaId);
    const fora = D.time(jogo.foraId);
    if (jogo.bye || !casa || !fora) {
      App.main().innerHTML = `<div class="cartao vazio">Este jogo ainda não tem os dois times definidos.<br>
        <span class="suave">${U.esc(R.textoOrigem(jogo.origemCasa, cat.id))} × ${U.esc(R.textoOrigem(jogo.origemFora, cat.id))}</span></div>`;
      return;
    }

    if (!jogo.sumula) { jogo.sumula = R.novaSumula(jogo); this.salvar(); }
    const s = jogo.sumula;
    // Se os times mudaram (mata-mata), sugere o goleiro do time novo
    for (const t of [casa, fora]) {
      if (!(t.id in s.goleiros)) {
        const g = t.jogadores.find((pl) => pl.posicao === 'goleiro');
        s.goleiros[t.id] = g ? g.id : null;
      }
    }
    const cfg = cat.config;
    const p = R.placar(jogo);
    const encerrada = this.encerrada();
    const rodando = !!s.cronometro.iniciadoEm;
    const suspensos = R.suspensosNoJogo(jogo);

    // Contadores de faltas e tempos no período atual
    const contadores = (time) => {
      const f = R.faltasNoPeriodo(jogo, time.id, s.periodo);
      const t = R.temposNoPeriodo(jogo, time.id, s.periodo);
      return `<div class="placar-extra">
        <span class="contador ${f >= cfg.limiteFaltas ? 'alerta' : ''}" title="Faltas no período">✋ ${f}/${cfg.limiteFaltas}</span>
        <span class="contador ${t >= 1 ? 'usado' : ''}" title="Pedido de tempo no período">⏱️ ${t}/1</span>
      </div>`;
    };

    const pen = R.temPenaltis(jogo) ? R.placarPenaltis(jogo) : null;
    const textoPeriodo = encerrada ? 'Encerrado' : s.fimTempoNormal ? 'Fim do tempo normal' : `${s.periodo}º período`;
    const info = [jogo.rodadaNome, jogo.data && U.dataBR(jogo.data), jogo.hora, jogo.quadra].filter(Boolean).join(' · ');

    // Colunas de botões de eventos (uma por time)
    const coluna = (time) => `
      <div class="eventos-col">
        <div class="cab" style="background:${time.cor};color:${U.corTexto(time.cor)}">${U.esc(time.nome)}</div>
        <button class="btn btn-evento btn-gol" data-ev="gol" data-time="${time.id}">⚽ GOL</button>
        <div class="duplo">
          <button class="btn btn-evento" data-ev="falta" data-time="${time.id}">✋ Falta</button>
          <button class="btn btn-evento" data-ev="tempo" data-time="${time.id}">⏱️ Tempo</button>
        </div>
        <div class="duplo">
          <button class="btn btn-evento btn-amarelo" data-ev="amarelo" data-time="${time.id}"><span class="cartao-ico am"></span></button>
          <button class="btn btn-evento btn-vermelho" data-ev="vermelho" data-time="${time.id}"><span class="cartao-ico vm"></span></button>
        </div>
        <button class="btn btn-pequeno" data-ev="golContra" data-time="${time.id}">🔄 Gol contra</button>
      </div>`;

    // Mostrar pênaltis? Só no mata-mata, após o tempo normal, com empate (ou se já houver cobranças)
    const mostrarPenaltis = this.ehMataMata() && (s.penaltis.length || (s.fimTempoNormal && p.casa === p.fora));

    App.main().innerHTML = `
      <p class="suave centro" style="margin:0 0 8px">${U.esc(info)}</p>

      ${encerrada ? `
        <div class="aviso-faixa verde">✅ Súmula encerrada${s.encerradaEm ? ' em ' + new Date(s.encerradaEm).toLocaleString('pt-BR') : ''}. Ela está travada.
          <div class="grupo-botoes">
            <a class="btn btn-pequeno" href="#/imprimir/sumula/${jogo.id}">🖨️ Súmula oficial</a>
            <button class="btn btn-pequeno" id="btn-reabrir">🔓 Reabrir</button>
          </div>
        </div>` : ''}

      ${suspensos.length ? `<div class="aviso-faixa vermelha">🚫 Suspensos neste jogo: ${suspensos.map((x) => U.esc(this.nomeJogador(x.jogadorId))).join(', ')}</div>` : ''}

      <div class="placar">
        <div class="placar-linha">
          <div class="placar-time">
            ${U.escudo(casa)}
            <span class="nome">${U.esc(casa.nome)}</span>
            <div class="placar-gols">${p.casa}</div>
            ${contadores(casa)}
          </div>
          <div class="placar-centro">
            <div class="placar-periodo">${textoPeriodo}</div>
            <div class="cronometro" id="cronometro">${U.mmss(this.decorrido())}</div>
            <div class="placar-periodo">de ${String(cfg.duracaoPeriodo).padStart(2, '0')}:00</div>
            ${pen ? `<div class="placar-penaltis">Pênaltis ${pen.casa} × ${pen.fora}</div>` : ''}
          </div>
          <div class="placar-time">
            ${U.escudo(fora)}
            <span class="nome">${U.esc(fora.nome)}</span>
            <div class="placar-gols">${p.fora}</div>
            ${contadores(fora)}
          </div>
        </div>
        ${!encerrada && !s.fimTempoNormal ? `
        <div class="controles-cronometro">
          <button class="btn ${rodando ? 'btn-aviso' : 'btn-primario'}" id="btn-cronometro">${rodando ? '⏸ Pausar' : (this.decorrido() ? '▶ Continuar' : '▶ Iniciar')}</button>
          <button class="btn" id="btn-fim-periodo">⏹ Encerrar ${s.periodo}º período</button>
        </div>` : ''}
      </div>

      ${!encerrada ? `<div class="eventos-times">${coluna(casa)}${coluna(fora)}</div>` : ''}

      ${mostrarPenaltis ? this.htmlPenaltis(casa, fora) : ''}

      <div class="cartao">
        <h2>Linha do tempo</h2>
        ${this.htmlLinhaTempo()}
      </div>

      <div class="cartao">
        <h2>Dados do jogo</h2>
        <form id="form-dados">
          <div class="campos-2">
            <label class="campo"><span>Árbitro 1</span><input name="arbitro1" value="${U.esc(s.arbitro1)}" ${encerrada ? 'disabled' : ''}></label>
            <label class="campo"><span>Árbitro 2</span><input name="arbitro2" value="${U.esc(s.arbitro2)}" ${encerrada ? 'disabled' : ''}></label>
            <label class="campo"><span>Mesário</span><input name="mesario" value="${U.esc(s.mesario)}" ${encerrada ? 'disabled' : ''}></label>
            <label class="campo"><span>Anotador</span><input name="anotador" value="${U.esc(s.anotador)}" ${encerrada ? 'disabled' : ''}></label>
          </div>
          <label class="campo"><span>Cronometrista</span><input name="cronometrista" value="${U.esc(s.cronometrista)}" ${encerrada ? 'disabled' : ''}></label>
          <div class="campos-2">
            ${[casa, fora].map((t) => `
              <label class="campo"><span>Goleiro titular · ${U.esc(t.nome)}</span>
                <select data-goleiro="${t.id}" ${encerrada ? 'disabled' : ''}>
                  <option value="">—</option>
                  ${t.jogadores.map((pl) => `<option value="${pl.id}" ${s.goleiros[t.id] === pl.id ? 'selected' : ''}>${pl.numero} · ${U.esc(pl.nome)}${pl.posicao === 'goleiro' ? ' (GOL)' : ''}</option>`).join('')}
                </select></label>`).join('')}
          </div>
        </form>
      </div>

      <div class="cartao">
        <h2>Observações do árbitro</h2>
        <textarea id="obs" placeholder="Ocorrências, relatos, atrasos..." ${encerrada ? 'disabled' : ''}>${U.esc(s.observacoes)}</textarea>
        ${!encerrada ? `<div class="grupo-botoes"><button class="btn btn-perigo btn-bloco" id="btn-encerrar">🏁 Encerrar jogo e travar súmula</button></div>` : ''}
      </div>

      <div class="grupo-botoes"><a class="btn" href="#/imprimir/sumula/${jogo.id}">🖨️ Ver súmula oficial / PDF</a></div>
    `;

    this.ligarEventos();
    this.iniciarRelogio();
  },

  /** HTML da linha do tempo (mais recente em cima). */
  htmlLinhaTempo() {
    const U = App.util;
    const D = App.dados;
    const s = this.s;
    if (!s.eventos.length) return '<p class="vazio">Nenhum evento ainda.</p>';
    const lista = s.eventos.map((e, i) => ({ e, i }))
      .sort((a, b) => b.e.periodo - a.e.periodo || b.e.minuto - a.e.minuto || b.i - a.i);
    return `<ul class="linha-tempo">${lista.map(({ e }) => {
      const tipo = this.TIPOS[e.tipo];
      const time = D.time(e.timeId);
      let texto = `<b>${tipo.nome}</b>`;
      if (e.tipo !== 'tempo') texto += ` · ${U.esc(this.nomeJogador(e.jogadorId))}`;
      if (e.tipo === 'gol' && e.assistenciaId) texto += `<br><span class="suave">Assistência: ${U.esc(this.nomeJogador(e.assistenciaId))}</span>`;
      if (e.tipo === 'golContra') texto += ` <span class="suave">(gol para o adversário)</span>`;
      return `<li>
        <span class="minuto">${e.minuto}'<br><small>${e.periodo}ºP</small></span>
        <span class="icone">${tipo.icone}</span>
        <span class="cresce">${texto}<br><span class="suave">${U.esc(time ? time.nome : '')}</span></span>
        ${this.encerrada() ? '' : `
          <button class="btn btn-pequeno btn-icone" data-editar-ev="${e.id}" aria-label="Editar">✏️</button>
          <button class="btn btn-pequeno btn-icone" data-apagar-ev="${e.id}" aria-label="Excluir">🗑️</button>`}
      </li>`;
    }).join('')}</ul>`;
  },

  /** HTML da disputa de pênaltis. */
  htmlPenaltis(casa, fora) {
    const U = App.util;
    const s = this.s;
    const pen = App.regras.placarPenaltis(this.jogo);
    const enc = this.encerrada();
    return `
      <div class="cartao">
        <h2>🥅 Disputa de pênaltis · ${pen.casa} × ${pen.fora}</h2>
        ${!enc ? `<div class="eventos-times">
          ${[casa, fora].map((t) => `<div class="eventos-col">
            <div class="cab" style="background:${t.cor};color:${U.corTexto(t.cor)}">${U.esc(t.nome)}</div>
            <div class="duplo">
              <button class="btn btn-primario" data-pen="1" data-time="${t.id}">✅ Gol</button>
              <button class="btn btn-perigo" data-pen="0" data-time="${t.id}">❌ Perdeu</button>
            </div>
          </div>`).join('')}
        </div>` : ''}
        ${s.penaltis.length ? `<ul class="linha-tempo">${s.penaltis.map((c, i) => `
          <li><span class="minuto">${i + 1}ª</span><span class="icone">${c.convertido ? '✅' : '❌'}</span>
          <span class="cresce">${U.esc(this.nomeJogador(c.jogadorId))}<br><span class="suave">${U.esc((App.dados.time(c.timeId) || {}).nome || '')}</span></span>
          ${enc ? '' : `<button class="btn btn-pequeno btn-icone" data-apagar-pen="${c.id}" aria-label="Excluir">🗑️</button>`}</li>`).join('')}</ul>`
          : '<p class="suave">Registre cada cobrança na ordem em que acontecer.</p>'}
      </div>`;
  },

  /* =======================================================
     LIGAÇÕES DOS BOTÕES
     ======================================================= */
  ligarEventos() {
    const U = App.util;
    const s = this.s;
    const main = App.main();

    const btnCron = document.getElementById('btn-cronometro');
    if (btnCron) btnCron.onclick = () => this.alternarCronometro();
    const btnFim = document.getElementById('btn-fim-periodo');
    if (btnFim) btnFim.onclick = () => this.encerrarPeriodo();
    const btnEnc = document.getElementById('btn-encerrar');
    if (btnEnc) btnEnc.onclick = () => this.encerrarJogo();
    const btnReabrir = document.getElementById('btn-reabrir');
    if (btnReabrir) btnReabrir.onclick = () => this.reabrir();

    // Botões de evento, edição e exclusão (delegação de clique)
    main.querySelectorAll('[data-ev]').forEach((b) => {
      b.onclick = () => this.novoEvento(b.dataset.ev, b.dataset.time);
    });
    main.querySelectorAll('[data-editar-ev]').forEach((b) => {
      b.onclick = () => this.editarEvento(b.dataset.editarEv);
    });
    main.querySelectorAll('[data-apagar-ev]').forEach((b) => {
      b.onclick = () => this.apagarEvento(b.dataset.apagarEv);
    });
    main.querySelectorAll('[data-pen]').forEach((b) => {
      b.onclick = () => this.novoPenalti(b.dataset.time, b.dataset.pen === '1');
    });
    main.querySelectorAll('[data-apagar-pen]').forEach((b) => {
      b.onclick = async () => {
        if (!(await U.confirmar('Excluir esta cobrança?', 'Excluir', 'btn-perigo'))) return;
        s.penaltis = s.penaltis.filter((c) => c.id !== b.dataset.apagarPen);
        this.salvar();
        this.render(this.jogo.id);
      };
    });

    // Dados do jogo: salva a cada mudança
    const form = document.getElementById('form-dados');
    form.oninput = (e) => {
      if (e.target.name) { s[e.target.name] = e.target.value; this.salvar(); }
    };
    form.onchange = (e) => {
      if (e.target.dataset.goleiro) { s.goleiros[e.target.dataset.goleiro] = e.target.value || null; this.salvar(); }
    };
    document.getElementById('obs').oninput = (e) => { s.observacoes = e.target.value; this.salvar(); };
  },

  /* =======================================================
     CRONÔMETRO
     ======================================================= */
  iniciarRelogio() {
    clearInterval(this.intervalo);
    this.intervalo = setInterval(() => this.tique(), 250);
    App.aoSair = () => clearInterval(this.intervalo);
  },

  /** Roda 4x por segundo: atualiza o relógio e para no fim do período. */
  tique() {
    const el = document.getElementById('cronometro');
    if (!el || !this.jogo || !this.jogo.sumula) return;
    const ms = this.decorrido();
    const dur = this.duracaoMs();
    if (this.s.cronometro.iniciadoEm && ms >= dur) {
      // Acabou o tempo do período: pausa sozinho
      this.s.cronometro.acumuladoMs = dur;
      this.s.cronometro.iniciadoEm = null;
      this.salvar();
      App.util.vibrar([300, 120, 300, 120, 600]);
      App.util.toast(`⏰ Fim do tempo do ${this.s.periodo}º período! Toque em “Encerrar período”.`, 'aviso', 5000);
      this.render(this.jogo.id);
      return;
    }
    el.textContent = App.util.mmss(ms);
    el.classList.toggle('fim', ms >= dur);
  },

  alternarCronometro() {
    const c = this.s.cronometro;
    if (c.iniciadoEm) {
      c.acumuladoMs = this.decorrido();
      c.iniciadoEm = null;
    } else {
      if (c.acumuladoMs >= this.duracaoMs()) {
        App.util.toast('O tempo deste período acabou. Encerre o período.', 'aviso');
        return;
      }
      c.iniciadoEm = Date.now();
      this.marcarAndamento();
    }
    App.util.vibrar(40);
    this.salvar();
    this.render(this.jogo.id);
  },

  async encerrarPeriodo() {
    const U = App.util;
    const s = this.s;
    const cfg = this.cfg();
    const ultimo = s.periodo >= cfg.numPeriodos;
    const falta = this.duracaoMs() - this.decorrido();
    let msg = ultimo ? 'Encerrar o último período (fim do tempo normal)?' : `Encerrar o ${s.periodo}º período? As faltas acumuladas zeram no próximo.`;
    if (falta > 1000) msg += ` Ainda faltam ${U.mmss(falta)} no cronômetro.`;
    if (!(await U.confirmar(msg, 'Encerrar período'))) return;

    s.cronometro = { acumuladoMs: 0, iniciadoEm: null };
    this.marcarAndamento();
    if (ultimo) {
      s.fimTempoNormal = true;
      const p = App.regras.placar(this.jogo);
      if (this.ehMataMata() && p.casa === p.fora) U.toast('Empate no mata-mata: registre a disputa de pênaltis.', 'aviso', 5000);
      else U.toast('Fim do tempo normal. Revise e encerre o jogo.', 'ok');
    } else {
      s.periodo++;
      U.toast(`Início do ${s.periodo}º período. Faltas zeradas.`, 'ok');
    }
    this.salvar();
    this.render(this.jogo.id);
  },

  /* =======================================================
     EVENTOS
     ======================================================= */

  /** Grade de botões com as camisas do time (bloqueia expulsos e suspensos). */
  gradeJogadores(time, opcoes = {}) {
    const U = App.util;
    const expulsos = App.regras.expulsos(this.jogo);
    const suspensos = new Set(App.regras.suspensosNoJogo(this.jogo).map((x) => x.jogadorId));
    const botoes = time.jogadores.map((p) => {
      let motivo = '';
      if (expulsos.has(p.id) && !opcoes.permitirExpulsos) motivo = 'EXPULSO';
      if (suspensos.has(p.id)) motivo = 'SUSPENSO';
      if (opcoes.excluir === p.id) return '';
      return `<button type="button" class="btn-jogador ${opcoes.selecionado === p.id ? 'selecionado' : ''}" data-jog="${p.id}" ${motivo ? 'disabled' : ''}>
        <b>${U.esc(p.numero)}</b><small>${U.esc(p.nome.split(' ')[0])}</small>${motivo ? `<span class="motivo">${motivo}</span>` : ''}
      </button>`;
    }).join('');
    const semJogador = opcoes.textoSem ? `<button type="button" class="btn-jogador" data-jog=""><b>—</b><small>${U.esc(opcoes.textoSem)}</small></button>` : '';
    return `<div class="grade-jogadores">${botoes}${semJogador}</div>`;
  },

  /** Abre o modal para lançar um evento do time. */
  novoEvento(tipo, timeId) {
    const U = App.util;
    const D = App.dados;
    const R = App.regras;
    const s = this.s;
    const time = D.time(timeId);
    const adversario = D.time(timeId === this.jogo.casaId ? this.jogo.foraId : this.jogo.casaId);

    if (s.fimTempoNormal && tipo !== 'falta' && tipo !== 'amarelo' && tipo !== 'vermelho') {
      U.toast('O tempo normal acabou. Para pênaltis use o quadro da disputa.', 'aviso');
      return;
    }

    // Pedido de tempo: não precisa escolher jogador
    if (tipo === 'tempo') {
      if (R.temposNoPeriodo(this.jogo, timeId, s.periodo) >= 1) {
        U.vibrar([100, 60, 100]);
        U.toast(`${time.nome} já pediu tempo neste período (máximo 1).`, 'erro', 3500);
        return;
      }
      this.adicionarEvento({ tipo: 'tempo', timeId, jogadorId: null, minuto: this.minutoAtual() });
      U.toast(`⏱️ Pedido de tempo: ${time.nome}`, 'ok');
      return;
    }

    if (!time.jogadores.length) {
      U.toast('Este time não tem jogadores cadastrados. Lançando sem jogador.', 'aviso');
    }

    const info = this.TIPOS[tipo];
    const subtitulo = {
      gol: 'Quem fez o gol?',
      golContra: `Jogador do ${time.nome} que fez gol contra (o gol vai para ${adversario.nome})`,
      falta: 'Quem cometeu a falta?',
      amarelo: 'Quem recebeu o amarelo?',
      vermelho: 'Quem foi expulso?',
    }[tipo];

    U.modal({
      titulo: `${info.nome} · ${time.nome}`,
      html: `
        <div class="campos-2">
          <label class="campo"><span>Minuto</span><input type="number" id="ev-minuto" min="0" max="99" inputmode="numeric" value="${this.minutoAtual()}"></label>
          <label class="campo"><span>Período</span><input type="number" id="ev-periodo" min="1" max="9" inputmode="numeric" value="${s.periodo}"></label>
        </div>
        <p style="margin:0 0 8px"><b>${U.esc(subtitulo)}</b></p>
        ${this.gradeJogadores(time, { textoSem: 'Não identificado' })}`,
      botoes: [{ texto: 'Cancelar' }],
      aoAbrir: (modal) => {
        modal.el.querySelector('.grade-jogadores').onclick = (e) => {
          const b = e.target.closest('[data-jog]');
          if (!b || b.disabled) return;
          const base = {
            tipo, timeId,
            jogadorId: b.dataset.jog || null,
            minuto: Number(document.getElementById('ev-minuto').value) || 0,
            periodo: Number(document.getElementById('ev-periodo').value) || s.periodo,
          };
          modal.fechar();
          if (tipo === 'gol' && base.jogadorId) this.escolherAssistencia(time, base);
          else this.confirmarEvento(base);
        };
      },
    });
  },

  /** Segundo passo do gol: assistência (opcional). */
  escolherAssistencia(time, base) {
    const U = App.util;
    U.modal({
      titulo: 'Assistência (opcional)',
      html: `<p style="margin:0 0 8px">Gol de <b>${U.esc(this.nomeJogador(base.jogadorId))}</b>. Quem deu o passe?</p>
        ${this.gradeJogadores(time, { excluir: base.jogadorId, textoSem: 'Sem assistência' })}`,
      botoes: [{ texto: 'Pular (sem assistência)', classe: 'btn-primario', acao: () => this.confirmarEvento(base) }],
      aoAbrir: (modal) => {
        modal.el.querySelector('.grade-jogadores').onclick = (e) => {
          const b = e.target.closest('[data-jog]');
          if (!b || b.disabled) return;
          modal.fechar();
          this.confirmarEvento({ ...base, assistenciaId: b.dataset.jog || null });
        };
      },
    });
  },

  /** Grava o evento e mostra os avisos (faltas, expulsão). */
  confirmarEvento(ev) {
    ev.periodo = ev.periodo || this.s.periodo;
    const U = App.util;
    const R = App.regras;
    const cfg = this.cfg();
    const time = App.dados.time(ev.timeId);
    const jaExpulsos = R.expulsos(this.jogo);
    this.adicionarEvento(ev);

    if (ev.tipo === 'gol' || ev.tipo === 'golContra') {
      U.vibrar([60, 40, 60]);
      U.toast(ev.tipo === 'gol' ? `⚽ GOL do ${time.nome}!` : '🔄 Gol contra registrado', 'ok');
    }
    if (ev.tipo === 'falta') {
      const n = R.faltasNoPeriodo(this.jogo, ev.timeId, ev.periodo);
      if (n === cfg.limiteFaltas) {
        U.vibrar([200, 100, 200]);
        U.modal({
          titulo: `⚠️ ${n}ª falta do ${time.nome}`,
          html: `<div class="aviso-faixa vermelha" style="font-size:1.1rem">A PRÓXIMA falta do ${U.esc(time.nome)} neste período será <b>tiro livre direto sem barreira</b>.</div>`,
          botoes: [{ texto: 'Entendi', classe: 'btn-primario' }],
        });
      } else if (n > cfg.limiteFaltas) {
        U.vibrar([200, 100, 200]);
        U.toast(`${n}ª falta: TIRO LIVRE DIRETO SEM BARREIRA`, 'erro', 4500);
      } else {
        U.toast(`Falta ${n} do ${time.nome} no período`);
      }
    }
    if (ev.jogadorId && (ev.tipo === 'vermelho' || ev.tipo === 'amarelo')) {
      const agora = R.expulsos(this.jogo);
      if (agora.has(ev.jogadorId) && !jaExpulsos.has(ev.jogadorId)) {
        U.vibrar([300]);
        U.toast(ev.tipo === 'amarelo' ? `2º amarelo: ${this.nomeJogador(ev.jogadorId)} EXPULSO` : `🟥 ${this.nomeJogador(ev.jogadorId)} EXPULSO`, 'erro', 4000);
      } else if (ev.tipo === 'amarelo') {
        U.toast(`🟨 Amarelo para ${this.nomeJogador(ev.jogadorId)}`, 'aviso');
      }
    }
  },

  adicionarEvento(ev) {
    this.s.eventos.push(Object.assign({ id: App.util.id(), periodo: this.s.periodo, assistenciaId: null }, ev));
    this.marcarAndamento();
    this.salvar();
    this.render(this.jogo.id);
  },

  /** Editar minuto, período, jogador e assistência de um evento. */
  editarEvento(evId) {
    const U = App.util;
    const D = App.dados;
    const ev = this.s.eventos.find((e) => e.id === evId);
    if (!ev) return;
    const time = D.time(ev.timeId);
    const opcoes = (sel, semTexto) => `<option value="">${semTexto}</option>` +
      time.jogadores.map((p) => `<option value="${p.id}" ${sel === p.id ? 'selected' : ''}>${p.numero} · ${U.esc(p.nome)}</option>`).join('');

    U.modal({
      titulo: `Editar: ${this.TIPOS[ev.tipo].nome}`,
      html: `
        <form id="form-ev">
          <div class="campos-2">
            <label class="campo"><span>Minuto</span><input type="number" name="minuto" min="0" value="${ev.minuto}"></label>
            <label class="campo"><span>Período</span><input type="number" name="periodo" min="1" value="${ev.periodo}"></label>
          </div>
          ${ev.tipo !== 'tempo' ? `<label class="campo"><span>Jogador (${U.esc(time.nome)})</span><select name="jogadorId">${opcoes(ev.jogadorId, 'Não identificado')}</select></label>` : ''}
          ${ev.tipo === 'gol' ? `<label class="campo"><span>Assistência</span><select name="assistenciaId">${opcoes(ev.assistenciaId, 'Sem assistência')}</select></label>` : ''}
        </form>`,
      botoes: [
        { texto: 'Cancelar' },
        {
          texto: 'Salvar', classe: 'btn-primario',
          acao: () => {
            const d = U.lerForm(document.getElementById('form-ev'));
            ev.minuto = d.minuto ?? ev.minuto;
            ev.periodo = d.periodo ?? ev.periodo;
            if ('jogadorId' in d) ev.jogadorId = d.jogadorId || null;
            if ('assistenciaId' in d) ev.assistenciaId = d.assistenciaId || null;
            this.salvar();
            this.render(this.jogo.id);
          },
        },
      ],
    });
  },

  async apagarEvento(evId) {
    const ev = this.s.eventos.find((e) => e.id === evId);
    if (!ev) return;
    const ok = await App.util.confirmar(`Excluir “${this.TIPOS[ev.tipo].nome}” do minuto ${ev.minuto}'?`, 'Excluir', 'btn-perigo');
    if (!ok) return;
    this.s.eventos = this.s.eventos.filter((e) => e.id !== evId);
    this.salvar();
    this.render(this.jogo.id);
  },

  /* =======================================================
     PÊNALTIS
     ======================================================= */
  novoPenalti(timeId, convertido) {
    const U = App.util;
    const time = App.dados.time(timeId);
    U.modal({
      titulo: `${convertido ? '✅ Gol' : '❌ Perdeu'} · ${time.nome}`,
      html: `<p style="margin:0 0 8px"><b>Quem cobrou?</b></p>${this.gradeJogadores(time, { textoSem: 'Não identificado' })}`,
      botoes: [{ texto: 'Cancelar' }],
      aoAbrir: (modal) => {
        modal.el.querySelector('.grade-jogadores').onclick = (e) => {
          const b = e.target.closest('[data-jog]');
          if (!b || b.disabled) return;
          modal.fechar();
          this.s.penaltis.push({ id: U.id(), timeId, jogadorId: b.dataset.jog || null, convertido });
          this.salvar();
          this.render(this.jogo.id);
        };
      },
    });
  },

  /* =======================================================
     ENCERRAR / REABRIR
     ======================================================= */
  async encerrarJogo() {
    const U = App.util;
    const R = App.regras;
    const jogo = this.jogo;
    const s = this.s;
    const p = R.placar(jogo);

    if (this.ehMataMata() && p.casa === p.fora) {
      const pen = R.placarPenaltis(jogo);
      if (pen.casa === pen.fora) {
        if (!s.fimTempoNormal) {
          U.toast('Jogo empatado no mata-mata. Encerre o último período e registre os pênaltis.', 'erro', 5000);
        } else {
          U.toast('Empate no mata-mata: registre os pênaltis até ter um vencedor.', 'erro', 5000);
        }
        return;
      }
    }

    let msg = `Encerrar o jogo com placar ${p.casa} × ${p.fora}? A súmula será travada e a classificação atualizada.`;
    if (!s.fimTempoNormal) msg = `Atenção: o tempo normal ainda não terminou (${s.periodo}º período). ` + msg;
    if (!(await U.confirmar(msg, 'Encerrar jogo', 'btn-perigo'))) return;

    if (s.cronometro.iniciadoEm) {
      s.cronometro.acumuladoMs = this.decorrido();
      s.cronometro.iniciadoEm = null;
    }
    s.fimTempoNormal = true;
    s.encerradaEm = new Date().toISOString();
    jogo.status = 'encerrado';
    R.atualizarMataMata(jogo.categoriaId);
    this.salvar();
    U.toast('🏁 Jogo encerrado! Classificação e estatísticas atualizadas.', 'ok', 3500);
    this.render(jogo.id);
  },

  async reabrir() {
    const U = App.util;
    const ok = await U.confirmar('Reabrir a súmula para correções? A classificação volta a considerar o jogo só quando você encerrar de novo.', 'Reabrir');
    if (!ok) return;
    this.jogo.status = 'andamento';
    this.s.encerradaEm = null;
    App.regras.atualizarMataMata(this.jogo.categoriaId);
    this.salvar();
    this.render(this.jogo.id);
  },
};
