/* =========================================================
   TELAS DO INTERCLASSE
   #/inter/ID/medalhas     → quadro de medalhas
   #/inter/ID/modalidades  → modalidades (cada uma abre como campeonato)
   #/inter/ID/hoje         → jogos de hoje (todas as modalidades)
   #/inter/ID/turmas       → turmas (cadastro, colar lista)
   #/inter/ID/config       → nome, visibilidade, admins, medalhas, histórico
   #/turma/ID/TURMA        → página da turma
   Dentro de uma modalidade (#/camp/ID/MOD/...) também usamos:
   abaPodio, abaParticipantes e abaConfigModalidade.
   ========================================================= */

var App = globalThis.App = globalThis.App || {};
App.telas = App.telas || {};

App.telas.interclasse = {
  ABAS: [
    ['medalhas', '🏅 Medalhas'],
    ['modalidades', 'Modalidades'],
    ['hoje', 'Jogos de hoje'],
    ['turmas', 'Turmas'],
    ['config', 'Config.'],
  ],

  MEDALHA: { ouro: '🥇', prata: '🥈', bronze: '🥉' },

  /** Abas dentro de uma modalidade (estatísticas/suspensos só com súmula de futsal). */
  abasModalidade(cat) {
    const abas = [['jogos', 'Jogos'], ['classificacao', 'Classificação'], ['podio', '🏅 Pódio'], ['turmas', 'Turmas']];
    if (cat.config.sumulaCompleta) abas.push(['estatisticas', 'Estatísticas'], ['suspensos', 'Suspensos']);
    abas.push(['config', 'Config.']);
    return abas;
  },

  /** Placar de sets ou V/E/D para mostrar no cartão do jogo (null = placar normal). */
  placarEspecial(j) {
    const D = App.dados;
    const { camp, cat } = D.categoria(j.categoriaId);
    if (!D.ehInterclasse(camp) || !j.placarRapido) return null;
    const tipo = App.regras.tipoPlacar(cat);
    const r = j.placarRapido;
    if (tipo === 'sets') {
      return `${r.casa} × ${r.fora}<small>${(r.sets || []).map((s) => `${s.casa}-${s.fora}`).join(' · ')}</small>`;
    }
    if (tipo === 'resultado') {
      if (r.resultado === 'empate' || (r.casa === r.fora)) return 'E × E<small>empate</small>';
      return r.casa > r.fora ? 'V × D<small>vitória</small>' : 'D × V<small>vitória</small>';
    }
    return null;
  },

  /** Nome de uma turma (ou '—'). */
  nomeTurma(camp, turmaId) {
    const t = (camp.turmas || []).find((x) => x.id === turmaId);
    return t ? t.nome : '—';
  },

  bolinhaTurma(t) {
    return `<span class="escudo" style="width:22px;height:22px;background:${t.cor || '#888'};color:${App.util.corTexto(t.cor || '#888')};font-size:.7rem">${App.util.esc((t.nome || '?').charAt(0))}</span>`;
  },

  /* =======================================================
     PÁGINA DO INTERCLASSE
     ======================================================= */
  render(campId, aba) {
    const D = App.dados;
    const U = App.util;
    const camp = D.campeonato(campId);
    if (!camp) { App.ir('#/'); return; }
    if (!D.ehInterclasse(camp)) { App.ir(`#/camp/${camp.id}`); return; }
    const pode = App.podeEditar(camp);
    App.leitura(!pode);
    aba = this.ABAS.some(([id]) => id === aba) ? aba : 'medalhas';
    if (aba === 'config' && !pode) aba = 'medalhas';
    App.titulo(camp.nome, '#/');

    const datas = [U.dataBR(camp.dataInicio), U.dataBR(camp.dataFim)].filter(Boolean).join(' a ');
    const selo = App.nuvem.ativo
      ? ` <span class="etiqueta ${camp.visibilidade === 'publico' ? 'azul' : ''}">${camp.visibilidade === 'publico' ? '🌐 Público' : '🔒 Privado'}</span>` : '';
    App.main().innerHTML = `
      <div class="linha-entre" style="margin-bottom:10px">
        <div class="cresce suave">🏅 Interclasse${camp.local ? ' · ' + U.esc(camp.local) : ''}${datas ? ' · ' + datas : ''}${selo}</div>
      </div>
      <nav class="abas">
        ${this.ABAS.filter(([id]) => pode || id !== 'config').map(([id, nome]) => `<a class="aba ${aba === id ? 'ativo' : ''}" href="#/inter/${camp.id}/${id}">${nome}</a>`).join('')}
      </nav>
      <div id="conteudo-aba"></div>`;
    const area = document.getElementById('conteudo-aba');
    ({
      medalhas: () => this.abaMedalhas(area, camp),
      modalidades: () => this.abaModalidades(area, camp),
      hoje: () => this.abaHoje(area, camp),
      turmas: () => this.abaTurmas(area, camp),
      config: () => this.abaConfig(area, camp),
    })[aba]();
  },

  /* ---------- Quadro de medalhas ---------- */
  htmlQuadro(camp, paraImprimir) {
    const U = App.util;
    const { lista, pts, criterio } = App.regras.quadroMedalhas(camp);
    const comMedalha = lista.filter((l) => l.total > 0);
    if (!comMedalha.length) return '<p class="vazio">Nenhuma medalha ainda. Os pódios aparecem aqui quando forem confirmados em cada modalidade.</p>';
    return `<div class="tabela-rolagem"><table class="${paraImprimir ? '' : 'tabela'}">
      <thead><tr><th>#</th><th class="esq">Turma</th><th>🥇</th><th>🥈</th><th>🥉</th><th>Total</th>${criterio === 'pontos' ? '<th>Pontos</th>' : ''}</tr></thead>
      <tbody>${comMedalha.map((l) => `<tr>
        <td><b>${l.pos}º</b></td>
        <td class="${paraImprimir ? '' : 'time-celula'}">${paraImprimir ? U.esc(l.turma.nome) : `<a href="#/turma/${camp.id}/${l.turma.id}" class="time-mini">${this.bolinhaTurma(l.turma)} ${U.esc(l.turma.nome)}</a>`}</td>
        <td>${l.o}</td><td>${l.p}</td><td>${l.b}</td><td><b>${l.total}</b></td>${criterio === 'pontos' ? `<td><b>${l.pontos}</b></td>` : ''}
      </tr>`).join('')}</tbody></table></div>
      <p class="suave">${criterio === 'pontos'
        ? `Classificação por pontos: ouro ${pts.ouro}, prata ${pts.prata}, bronze ${pts.bronze}.`
        : 'Ordem olímpica: mais ouros; empate decide por pratas e depois bronzes.'}</p>`;
  },

  abaMedalhas(area, camp) {
    const U = App.util;
    const sit = camp.categorias.map((c) => ({ c, s: App.inter.situacao(c) }));
    const feitas = sit.filter((x) => x.s === 'podio').length;
    const aguardando = sit.filter((x) => x.s === 'aguardando');
    const andamento = sit.filter((x) => x.s === 'andamento' || x.s === 'sem-jogos');
    area.innerHTML = `
      <div class="cartao">
        <div class="linha-entre"><h2 style="margin:0">Quadro de medalhas</h2>
          <a class="btn btn-pequeno" href="#/imprimir/medalhas/${camp.id}">🖨️ Imprimir</a></div>
        <p class="suave"><b>${feitas} de ${camp.categorias.length}</b> modalidade(s) com pódio definido.</p>
        ${this.htmlQuadro(camp)}
      </div>
      ${aguardando.length ? `<div class="aviso-faixa amarela so-admin">🏁 Terminaram e falta confirmar o pódio:
        ${aguardando.map((x) => `<a href="#/camp/${camp.id}/${x.c.id}/podio">${U.esc(x.c.emoji || '')} ${U.esc(x.c.nome)}</a>`).join(' · ')}</div>` : ''}
      ${andamento.length ? `<div class="cartao"><h3>⏳ Em andamento</h3><p class="suave">${andamento.map((x) => `<a href="#/camp/${camp.id}/${x.c.id}/jogos">${U.esc(x.c.emoji || '')} ${U.esc(x.c.nome)}</a>`).join(' · ')}</p></div>` : ''}`;
  },

  /* ---------- Modalidades ---------- */
  abaModalidades(area, camp) {
    const D = App.dados;
    const U = App.util;
    const ROTULO = { podio: ['verde', '🏅 Pódio definido'], aguardando: ['amarela', '🏁 Falta confirmar pódio'], andamento: ['azul', '⏳ Em andamento'], 'sem-jogos': ['', 'Sem tabela ainda'] };
    area.innerHTML = (camp.categorias.length ? camp.categorias.map((c) => {
      const jogos = D.jogosDaCategoria(c.id).filter((j) => !j.bye);
      const feitos = jogos.filter((j) => j.status === 'encerrado').length;
      const [cor, texto] = ROTULO[App.inter.situacao(c)];
      const p = c.podio && c.podio.confirmado ? c.podio : null;
      return `<a class="cartao cartao-link" href="#/camp/${camp.id}/${c.id}/jogos">
        <div class="linha-entre"><h2 style="margin:0">${U.esc(c.emoji || '🏅')} ${U.esc(c.nome)}</h2><span class="etiqueta ${cor}">${texto}</span></div>
        <p class="suave" style="margin:6px 0 0">${U.esc(D.TIPOS_PLACAR[App.regras.tipoPlacar(c)])} · ${(c.turmaIds || []).length} turma(s) · ${feitos}/${jogos.length} jogos</p>
        ${p ? `<p style="margin:6px 0 0">🥇 ${U.esc(this.nomeTurma(camp, p.ouro))}${p.prata ? ` · 🥈 ${U.esc(this.nomeTurma(camp, p.prata))}` : ''}${(p.bronze || []).map((b) => ` · 🥉 ${U.esc(this.nomeTurma(camp, b))}`).join('')}</p>` : ''}
      </a>`;
    }).join('') : `<div class="cartao vazio">Nenhuma modalidade ainda.${App.podeEditar(camp) ? '<br>Cadastre as turmas e toque no <b>+</b> para criar a primeira (ex.: ⚽ Futsal, 🏐 Vôlei).' : ''}</div>`)
      + '<button class="fab so-admin" id="fab-modalidade" aria-label="Nova modalidade">+</button>';
    document.getElementById('fab-modalidade').onclick = () => this.formModalidade(camp);
  },

  /** Nova modalidade: nome, emoji, tipo de placar, formato, pontos e turmas. */
  formModalidade(camp) {
    const D = App.dados;
    const U = App.util;
    if (!(camp.turmas || []).length) { U.toast('Cadastre as turmas primeiro (aba Turmas).', 'aviso', 4000); App.ir(`#/inter/${camp.id}/turmas`); return; }
    const opt = (v, t, sel) => `<option value="${v}" ${String(v) === String(sel) ? 'selected' : ''}>${U.esc(t)}</option>`;
    U.modal({
      titulo: 'Nova modalidade',
      html: `
        <form id="form-mod">
          <label class="campo"><span>Sugestões</span>
            <select id="sugestao"><option value="">— escolher (opcional) —</option>
              ${D.MODALIDADES_SUGERIDAS.map((m, i) => `<option value="${i}">${m.emoji} ${U.esc(m.nome)}</option>`).join('')}</select></label>
          <div class="campos-2" style="grid-template-columns:90px 1fr">
            <label class="campo"><span>Emoji</span><input name="emoji" value="🏅" maxlength="4" style="font-size:1.4rem;text-align:center"></label>
            <label class="campo"><span>Nome *</span><input name="nome" placeholder="Ex.: Vôlei Feminino"></label>
          </div>
          <label class="campo"><span>Tipo de placar</span>
            <select name="tipoPlacar">${Object.entries(D.TIPOS_PLACAR).map(([k, v]) => opt(k, v, 'gols')).join('')}</select></label>
          <label class="check" id="c-empate"><input type="checkbox" name="permiteEmpate" checked> Permite empate (desmarque no basquete)</label>
          <label class="check" id="c-sumula"><input type="checkbox" name="sumulaCompleta"> Súmula completa de futsal (gols, faltas, cartões, cronômetro)</label>
          <label class="campo oculto" id="c-sets"><span>Sets</span>
            <select name="melhorDe">${opt(3, 'Melhor de 3', 3)}${opt(5, 'Melhor de 5', 3)}</select></label>
          <label class="campo"><span>Formato</span>
            <select name="formato" id="m-formato">${Object.entries(D.NOMES_FORMATO).map(([k, v]) => opt(k, v, 'mata')).join('')}</select></label>
          <div class="campos-2" id="c-grupos">
            <label class="campo"><span>Nº de grupos</span><input type="number" name="numGrupos" min="1" max="8" value="2"></label>
            <label class="campo"><span>Classificados por grupo</span><input type="number" name="classificadosPorGrupo" min="1" max="8" value="2"></label>
          </div>
          <label class="check" id="c-terceiro"><input type="checkbox" name="terceiroLugar" checked> Disputa de 3º lugar (sem ela, os dois semifinalistas levam bronze)</label>
          <label class="check" id="c-ida"><input type="checkbox" name="idaEVolta"> Turno e returno</label>
          <div class="campos-3">
            <label class="campo"><span>Pts vitória</span><input type="number" name="pontosVitoria" value="3"></label>
            <label class="campo"><span>Pts empate</span><input type="number" name="pontosEmpate" value="1"></label>
            <label class="campo"><span>Pts derrota</span><input type="number" name="pontosDerrota" value="0"></label>
          </div>
          <p style="margin:6px 0"><b>Turmas que participam</b> <button type="button" class="btn btn-pequeno" id="m-todas">Marcar/desmarcar todas</button></p>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:4px">
            ${camp.turmas.map((t) => `<label class="check" style="margin:0"><input type="checkbox" name="t-${t.id}" checked> ${U.esc(t.nome)}</label>`).join('')}
          </div>
        </form>`,
      aoAbrir: () => {
        const f = document.getElementById('form-mod');
        const atualizar = () => {
          const tipo = f.tipoPlacar.value;
          document.getElementById('c-sets').classList.toggle('oculto', tipo !== 'sets');
          document.getElementById('c-sumula').classList.toggle('oculto', tipo !== 'gols');
          document.getElementById('c-empate').classList.toggle('oculto', tipo === 'sets');
          document.getElementById('c-grupos').classList.toggle('oculto', f.formato.value !== 'grupos');
          document.getElementById('c-terceiro').classList.toggle('oculto', f.formato.value === 'pontos');
          document.getElementById('c-ida').classList.toggle('oculto', f.formato.value === 'mata');
        };
        f.onchange = atualizar;
        document.getElementById('sugestao').onchange = (e) => {
          const m = D.MODALIDADES_SUGERIDAS[e.target.value];
          if (!m) return;
          f.nome.value = m.nome;
          f.emoji.value = m.emoji;
          f.tipoPlacar.value = m.tipoPlacar;
          f.permiteEmpate.checked = m.permiteEmpate !== false;
          f.sumulaCompleta.checked = !!m.sumulaCompleta;
          atualizar();
        };
        document.getElementById('m-todas').onclick = () => {
          const caixas = [...f.querySelectorAll('input[name^="t-"]')];
          const marcar = caixas.some((c) => !c.checked);
          caixas.forEach((c) => { c.checked = marcar; });
        };
        atualizar();
      },
      botoes: [
        { texto: 'Cancelar' },
        {
          texto: 'Criar modalidade', classe: 'btn-primario',
          acao: () => {
            const d = U.lerForm(document.getElementById('form-mod'));
            if (!d.nome) { U.toast('Dê um nome à modalidade.', 'erro'); return false; }
            const turmaIds = camp.turmas.filter((t) => d['t-' + t.id]).map((t) => t.id);
            if (turmaIds.length < 2) { U.toast('Escolha pelo menos 2 turmas.', 'erro'); return false; }
            const cat = App.inter.adicionarModalidade(camp, {
              nome: d.nome, emoji: d.emoji, tipoPlacar: d.tipoPlacar, permiteEmpate: d.permiteEmpate,
              sumulaCompleta: d.sumulaCompleta, melhorDe: Number(d.melhorDe), formato: d.formato,
              numGrupos: d.numGrupos, classificadosPorGrupo: d.classificadosPorGrupo, terceiroLugar: d.terceiroLugar,
              idaEVolta: d.idaEVolta, pontosVitoria: d.pontosVitoria, pontosEmpate: d.pontosEmpate, pontosDerrota: d.pontosDerrota,
              turmaIds,
            });
            U.toast('Modalidade criada! Agora monte a tabela de jogos.', 'ok', 3500);
            App.ir(`#/camp/${camp.id}/${cat.id}/jogos`);
          },
        },
      ],
    });
  },

  /* ---------- Jogos de hoje ---------- */
  abaHoje(area, camp) {
    const D = App.dados;
    const U = App.util;
    const data = this.dataEscolhida || App.inter.hoje();
    const jogos = App.inter.jogosDoDia(camp, data);
    const comJogos = [...new Set(D.db.jogos.filter((j) => j.campeonatoId === camp.id && j.data).map((j) => j.data))].sort();
    area.innerHTML = `
      <div class="cartao">
        <div class="linha">
          <label class="campo cresce" style="margin:0"><span>Dia</span><input type="date" id="dia" value="${data}"></label>
          <button class="btn" id="btn-hoje" style="margin-top:20px">Hoje</button>
        </div>
        ${comJogos.length ? `<p class="suave" style="margin:8px 0 0">Dias com jogos: ${comJogos.map((d) => `<a href="javascript:void 0" data-dia="${d}">${U.dataCurta(d)}</a>`).join(' · ')}</p>` : ''}
      </div>
      ${jogos.length ? jogos.map((j) => {
        const { cat } = D.categoria(j.categoriaId);
        return `<p class="suave" style="margin:10px 4px 2px"><b>${j.hora || '--:--'}</b> · ${U.esc(cat.emoji || '')} ${U.esc(cat.nome)}</p>${App.telas.campeonato.cartaoJogo(j, null)}`;
      }).join('') : `<div class="cartao vazio">Nenhum jogo em ${U.dataBR(data)}.</div>`}`;
    const mudar = (d) => { this.dataEscolhida = d; App.render(); };
    document.getElementById('dia').onchange = (e) => mudar(e.target.value);
    document.getElementById('btn-hoje').onclick = () => mudar(App.inter.hoje());
    area.querySelectorAll('[data-dia]').forEach((a) => { a.onclick = () => mudar(a.dataset.dia); });
    App.telas.campeonato.ligarCartoes(area);
  },

  /* ---------- Turmas ---------- */
  abaTurmas(area, camp) {
    const U = App.util;
    const { lista } = App.regras.quadroMedalhas(camp);
    const porId = Object.fromEntries(lista.map((l) => [l.turma.id, l]));
    area.innerHTML = `
      <div class="grupo-botoes so-admin">
        <button class="btn btn-primario" id="btn-add-turma">+ Turma</button>
        <button class="btn" id="btn-colar-turmas">📋 Colar lista de turmas</button>
      </div>
      <div class="cartao">${(camp.turmas || []).length ? `<ul class="lista">${camp.turmas.map((t) => {
        const l = porId[t.id];
        return `<li><a class="item" href="#/turma/${camp.id}/${t.id}">${this.bolinhaTurma(t)}
          <span class="cresce"><b>${U.esc(t.nome)}</b><br><span class="suave">${l && l.total ? `🥇${l.o} 🥈${l.p} 🥉${l.b}` : 'sem medalhas'} · ${camp.categorias.filter((c) => (c.turmaIds || []).includes(t.id)).length} modalidade(s)</span></span></a>
          <button class="btn btn-pequeno btn-icone so-admin" data-editar-turma="${t.id}" aria-label="Editar">✏️</button></li>`;
      }).join('')}</ul>` : '<p class="vazio">Nenhuma turma ainda. Cadastre uma por uma ou cole a lista.</p>'}</div>`;

    document.getElementById('btn-add-turma').onclick = () => this.formTurma(camp);
    document.getElementById('btn-colar-turmas').onclick = () => this.colarTurmas(camp);
    area.querySelectorAll('[data-editar-turma]').forEach((b) => { b.onclick = () => this.formTurma(camp, b.dataset.editarTurma); });
  },

  formTurma(camp, turmaId) {
    const U = App.util;
    const t = turmaId ? camp.turmas.find((x) => x.id === turmaId) : null;
    U.modal({
      titulo: t ? 'Editar turma' : 'Nova turma',
      html: `<form id="form-turma">
        <label class="campo"><span>Nome *</span><input name="nome" value="${U.esc(t ? t.nome : '')}" placeholder="Ex.: 3º Ano A"></label>
        <label class="campo"><span>Cor (opcional)</span><input type="color" name="cor" value="${U.esc(t ? t.cor : App.inter.CORES[(camp.turmas || []).length % App.inter.CORES.length])}"></label>
      </form>`,
      aoAbrir: () => document.querySelector('#form-turma [name=nome]').focus(),
      botoes: [
        ...(t ? [{
          texto: '🗑️ Remover', classe: 'btn-perigo',
          acao: () => {
            setTimeout(async () => {
              if (!(await U.confirmar(`Remover a turma ${t.nome}?`, 'Remover', 'btn-perigo'))) return;
              try { App.inter.removerTurma(camp, t.id); App.render(); } catch (e) { U.toast(e.message, 'erro', 5000); }
            }, 0);
          },
        }] : []),
        { texto: 'Cancelar' },
        {
          texto: 'Salvar', classe: 'btn-primario',
          acao: () => {
            const d = U.lerForm(document.getElementById('form-turma'));
            if (!d.nome) { U.toast('Digite o nome da turma.', 'erro'); return false; }
            const repetida = (camp.turmas || []).find((x) => x.id !== turmaId && App.tabela.normalizar(x.nome) === App.tabela.normalizar(d.nome));
            if (repetida) { U.toast('Já existe uma turma com esse nome.', 'erro'); return false; }
            if (t) App.inter.editarTurma(camp, t.id, { nome: d.nome, cor: d.cor });
            else {
              App.inter.adicionarTurmas(camp, [d.nome]);
              camp.turmas[camp.turmas.length - 1].cor = d.cor;
              App.dados.salvar();
            }
            App.render();
          },
        },
      ],
    });
  },

  colarTurmas(camp) {
    const U = App.util;
    U.modal({
      titulo: '📋 Colar lista de turmas',
      html: `<p class="suave" style="margin-top:0">Uma turma por linha. Ex.:<br><code>1º Ano A</code><br><code>1º Ano B</code></p>
        <textarea id="txt-turmas" rows="8" placeholder="1º Ano A&#10;1º Ano B&#10;2º Ano A"></textarea>`,
      aoAbrir: () => document.getElementById('txt-turmas').focus(),
      botoes: [
        { texto: 'Cancelar' },
        {
          texto: 'Conferir →', classe: 'btn-primario',
          acao: () => {
            const { novas, repetidas } = App.inter.lerTurmas(camp, document.getElementById('txt-turmas').value);
            setTimeout(() => U.modal({
              titulo: `Conferir (${novas.length} turma${novas.length === 1 ? '' : 's'})`,
              html: `${repetidas.length ? `<div class="aviso-faixa amarela">Já existem ou estão repetidas (ficam de fora): ${repetidas.map(U.esc).join(', ')}</div>` : ''}
                ${novas.length ? `<ul class="lista">${novas.map((n) => `<li>${U.esc(n)}</li>`).join('')}</ul>` : '<p class="vazio">Nenhuma turma nova.</p>'}`,
              botoes: [
                { texto: 'Cancelar' },
                ...(novas.length ? [{ texto: `Criar ${novas.length}`, classe: 'btn-primario', acao: () => { App.inter.adicionarTurmas(camp, novas); U.toast('Turmas criadas!', 'ok'); App.render(); } }] : []),
              ],
            }), 0);
          },
        },
      ],
    });
  },

  /* ---------- Configurações do interclasse ---------- */
  abaConfig(area, camp) {
    const U = App.util;
    const D = App.dados;
    const med = camp.medalhas || {};
    const pts = Object.assign({ ouro: 3, prata: 2, bronze: 1 }, med.pontos || {});
    area.innerHTML = App.telas.campeonato.htmlConfigCampeonato(camp) + `
      <form id="form-medalhas" class="cartao">
        <h2>🏅 Quadro de medalhas</h2>
        <label class="check"><input type="radio" name="criterio" value="olimpico" ${med.criterio !== 'pontos' ? 'checked' : ''} style="width:22px"> Ordem olímpica (mais ouros, depois pratas, depois bronzes)</label>
        <label class="check"><input type="radio" name="criterio" value="pontos" ${med.criterio === 'pontos' ? 'checked' : ''} style="width:22px"> Por pontos</label>
        <div class="campos-3">
          <label class="campo"><span>🥇 Ouro</span><input type="number" name="ouro" min="0" value="${pts.ouro}"></label>
          <label class="campo"><span>🥈 Prata</span><input type="number" name="prata" min="0" value="${pts.prata}"></label>
          <label class="campo"><span>🥉 Bronze</span><input type="number" name="bronze" min="0" value="${pts.bronze}"></label>
        </div>
        <button class="btn btn-primario" type="submit">💾 Salvar critério</button>
      </form>
      <div class="cartao"><h2>Zona de perigo</h2>
        <button class="btn btn-perigo" id="btn-apagar-inter">Apagar interclasse inteiro</button></div>`;
    App.telas.campeonato.ligarConfigCampeonato(camp);
    document.getElementById('btn-cfg-camp').onclick = () => this.formInterclasse(camp);
    document.getElementById('form-medalhas').onsubmit = (e) => {
      e.preventDefault();
      const f = e.target;
      camp.medalhas = {
        criterio: f.criterio.value === 'pontos' ? 'pontos' : 'olimpico',
        pontos: { ouro: Number(f.ouro.value) || 0, prata: Number(f.prata.value) || 0, bronze: Number(f.bronze.value) || 0 },
      };
      D.salvar();
      U.toast('Critério salvo!', 'ok');
      App.render();
    };
    document.getElementById('btn-apagar-inter').onclick = async () => {
      if (!(await U.confirmar(`Apagar o interclasse ${camp.nome} inteiro (todas as modalidades, jogos e medalhas)? Não dá para desfazer.`, 'Apagar tudo', 'btn-perigo'))) return;
      D.apagarCampeonato(camp.id);
      App.ir('#/');
    };
  },

  /** Criar/editar o interclasse. Na criação dá para colar as turmas. */
  formInterclasse(camp) {
    const U = App.util;
    const D = App.dados;
    const N = App.nuvem;
    const c = camp || { nome: '', local: '', dataInicio: '', dataFim: '', visibilidade: 'privado' };
    U.modal({
      titulo: camp ? 'Editar interclasse' : 'Novo interclasse',
      html: `<form id="form-inter">
        <label class="campo"><span>Nome *</span><input name="nome" value="${U.esc(c.nome)}" placeholder="Ex.: Interclasse 2026"></label>
        <label class="campo"><span>Local</span><input name="local" value="${U.esc(c.local || '')}" placeholder="Ex.: Colégio Espírito Santo"></label>
        <div class="campos-2">
          <label class="campo"><span>Início</span><input type="date" name="dataInicio" value="${U.esc(c.dataInicio || '')}"></label>
          <label class="campo"><span>Fim</span><input type="date" name="dataFim" value="${U.esc(c.dataFim || '')}"></label>
        </div>
        ${N.ativo ? `<label class="campo"><span>Quem pode ver</span><select name="visibilidade">
          <option value="privado" ${c.visibilidade !== 'publico' ? 'selected' : ''}>🔒 Privado — só os admins</option>
          <option value="publico" ${c.visibilidade === 'publico' ? 'selected' : ''}>🌐 Público — qualquer pessoa vê jogos e medalhas</option></select></label>` : ''}
        ${camp ? '' : `<label class="campo"><span>Turmas (uma por linha, pode deixar para depois)</span>
          <textarea name="turmas" rows="6" placeholder="1º Ano A&#10;1º Ano B&#10;2º Ano A"></textarea></label>`}
      </form>`,
      botoes: [
        { texto: 'Cancelar' },
        {
          texto: 'Salvar', classe: 'btn-primario',
          acao: () => {
            const d = U.lerForm(document.getElementById('form-inter'));
            if (!d.nome) { U.toast('Dê um nome ao interclasse.', 'erro'); return false; }
            const campos = { nome: d.nome, local: d.local, dataInicio: d.dataInicio, dataFim: d.dataFim };
            if (N.ativo) campos.visibilidade = d.visibilidade === 'publico' ? 'publico' : 'privado';
            if (camp) { Object.assign(camp, campos); D.salvar(); App.render(); return; }
            const novo = App.inter.novo(campos);
            const { novas } = App.inter.lerTurmas(novo, d.turmas || '');
            if (novas.length) App.inter.adicionarTurmas(novo, novas); else D.salvar();
            App.ir(`#/inter/${novo.id}/${novas.length ? 'modalidades' : 'turmas'}`);
          },
        },
      ],
    });
  },

  /* =======================================================
     DENTRO DA MODALIDADE
     ======================================================= */

  /** Aba Pódio: sugestão automática, confirmação e ajuste manual. */
  abaPodio(area, camp, cat) {
    const U = App.util;
    const sugerido = App.regras.podioSugerido(cat.id);
    const atual = cat.podio && cat.podio.confirmado ? cat.podio : null;
    const nome = (id) => U.esc(this.nomeTurma(camp, id));
    const linhasPodio = (p) => `
      <p style="font-size:1.15rem;margin:4px 0">🥇 <b>${nome(p.ouro)}</b></p>
      ${p.prata ? `<p style="font-size:1.1rem;margin:4px 0">🥈 ${nome(p.prata)}</p>` : ''}
      ${(p.bronze || []).map((b) => `<p style="font-size:1.05rem;margin:4px 0">🥉 ${nome(b)}</p>`).join('')}`;
    const participantes = camp.turmas.filter((t) => (cat.turmaIds || []).includes(t.id));
    const sel = (nomeCampo, valor) => `<select name="${nomeCampo}"><option value="">—</option>${participantes.map((t) => `<option value="${t.id}" ${valor === t.id ? 'selected' : ''}>${U.esc(t.nome)}</option>`).join('')}</select>`;
    const base = atual || sugerido || {};
    const bronzes = base.bronze || [];

    area.innerHTML = `
      ${atual ? `<div class="cartao"><h2>🏅 Pódio confirmado${atual.manual ? ' <span class="etiqueta amarela">ajustado pela organização</span>' : ''}</h2>${linhasPodio(atual)}
        <div class="grupo-botoes so-admin"><button class="btn btn-pequeno" id="btn-limpar-podio">Desfazer pódio</button></div></div>` : ''}
      ${!atual && sugerido ? `<div class="cartao"><h2>🏁 Pódio calculado</h2>
        <p class="suave">Todos os jogos terminaram. Pela ${App.dados.jogosDaCategoria(cat.id).some((j) => j.fase === 'mata') ? 'final e disputa de 3º' : 'classificação final'}, o pódio fica:</p>
        ${linhasPodio(sugerido)}
        <div class="grupo-botoes so-admin"><button class="btn btn-primario" id="btn-confirmar-podio">✅ Confirmar este pódio</button></div></div>` : ''}
      ${!atual && !sugerido ? `<div class="cartao vazio">⏳ A modalidade ainda está em andamento. O pódio aparece aqui quando todos os jogos terminarem.</div>` : ''}
      <form id="form-podio" class="cartao so-admin">
        <h2>✍️ Ajustar o pódio na mão</h2>
        <p class="suave">Para W.O., desistência ou decisão da organização. Sem disputa de 3º lugar, use os dois bronzes.</p>
        <label class="campo"><span>🥇 Ouro</span>${sel('ouro', base.ouro)}</label>
        <label class="campo"><span>🥈 Prata</span>${sel('prata', base.prata)}</label>
        <div class="campos-2">
          <label class="campo"><span>🥉 Bronze</span>${sel('bronze1', bronzes[0])}</label>
          <label class="campo"><span>🥉 Bronze (2º, opcional)</span>${sel('bronze2', bronzes[1])}</label>
        </div>
        <button class="btn" type="submit">💾 Salvar pódio ajustado</button>
      </form>`;

    const ligar = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    ligar('btn-confirmar-podio', () => { App.inter.definirPodio(cat, sugerido, false); U.toast('Pódio confirmado! Já conta no quadro de medalhas.', 'ok', 3500); App.render(); });
    ligar('btn-limpar-podio', async () => {
      if (!(await U.confirmar('Desfazer o pódio desta modalidade? As medalhas saem do quadro.', 'Desfazer', 'btn-perigo'))) return;
      App.inter.limparPodio(cat);
      App.render();
    });
    document.getElementById('form-podio').onsubmit = (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        App.inter.definirPodio(cat, { ouro: f.ouro.value, prata: f.prata.value, bronze: [f.bronze1.value, f.bronze2.value] }, true);
        U.toast('Pódio salvo!', 'ok');
        App.render();
      } catch (err) {
        U.toast(err.message, 'erro', 4000);
      }
    };
  },

  /** Aba Turmas da modalidade: quem participa. */
  abaParticipantes(area, camp, cat) {
    const U = App.util;
    const D = App.dados;
    const pode = App.podeEditar(camp);
    const times = D.timesDaCategoria(cat.id);
    area.innerHTML = `
      <div class="cartao"><h2>Turmas nesta modalidade (${times.length})</h2>
        <ul class="lista">${times.map((t) => `<li><a class="item" href="#/time/${t.id}">${U.escudo(t)} <span class="cresce"><b>${U.esc(t.nome)}</b>${cat.config.sumulaCompleta ? `<br><span class="suave">${t.jogadores.length} jogador(es) no elenco</span>` : ''}</span><span class="suave">›</span></a></li>`).join('') || '<li class="vazio">Nenhuma.</li>'}</ul>
        ${cat.config.sumulaCompleta ? '<p class="suave">Na súmula de futsal, os gols e cartões vão para os jogadores: toque na turma para cadastrar o elenco.</p>' : ''}
      </div>
      ${pode ? `<form id="form-part" class="cartao so-admin"><h2>Escolher turmas</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:4px">
          ${camp.turmas.map((t) => `<label class="check" style="margin:0"><input type="checkbox" name="t-${t.id}" ${(cat.turmaIds || []).includes(t.id) ? 'checked' : ''}> ${U.esc(t.nome)}</label>`).join('')}
        </div>
        <p class="suave">Turma que já tem jogo nesta modalidade não pode sair.</p>
        <button class="btn btn-primario" type="submit">💾 Salvar participantes</button></form>` : ''}`;
    const f = document.getElementById('form-part');
    if (f) f.onsubmit = (e) => {
      e.preventDefault();
      const ids = camp.turmas.filter((t) => f['t-' + t.id].checked).map((t) => t.id);
      const presos = App.inter.definirParticipantes(camp, cat, ids);
      U.toast(presos.length ? `Salvo. Não saíram (já têm jogos): ${presos.map((id) => this.nomeTurma(camp, id)).join(', ')}` : 'Participantes salvos!', presos.length ? 'aviso' : 'ok', 4500);
      App.render();
    };
  },

  /** Aba Config. da modalidade. */
  abaConfigModalidade(area, camp, cat) {
    const U = App.util;
    const D = App.dados;
    const c = cat.config;
    const tipo = App.regras.tipoPlacar(cat);
    const opt = (v, t, sel) => `<option value="${v}" ${String(v) === String(sel) ? 'selected' : ''}>${U.esc(t)}</option>`;
    let ordem = c.desempate.slice();
    const possiveis = ['pontos', 'vitorias', ...(tipo === 'resultado' ? [] : ['saldo', 'golsPro']), ...(tipo === 'sets' ? ['saldoPontos'] : []), 'confronto', ...(c.sumulaCompleta ? ['cartoes'] : []), 'sorteio'];
    possiveis.forEach((k) => { if (!ordem.includes(k)) ordem.push(k); });
    ordem = ordem.filter((k) => possiveis.includes(k));
    const ativos = new Set(c.desempate);
    const nomeCrit = (k) => (tipo === 'sets' ? { saldo: 'Saldo de sets', golsPro: 'Sets vencidos' }[k] : null) || D.NOMES_DESEMPATE[k];
    const temJogos = D.jogosDaCategoria(cat.id).length > 0;

    area.innerHTML = `
      <form id="form-cfg-mod">
        <div class="cartao"><h2>Modalidade</h2>
          <div class="campos-2" style="grid-template-columns:90px 1fr">
            <label class="campo"><span>Emoji</span><input name="emoji" value="${U.esc(cat.emoji || '🏅')}" maxlength="4" style="font-size:1.4rem;text-align:center"></label>
            <label class="campo"><span>Nome</span><input name="nome" value="${U.esc(cat.nome)}"></label>
          </div>
          <p><b>Tipo de placar:</b> ${U.esc(D.TIPOS_PLACAR[tipo])}</p>
          ${tipo !== 'sets' ? `<label class="check"><input type="checkbox" name="permiteEmpate" ${c.permiteEmpate !== false ? 'checked' : ''}> Permite empate</label>` : ''}
          ${tipo === 'sets' ? `<label class="campo"><span>Sets</span><select name="melhorDe">${opt(3, 'Melhor de 3', c.melhorDe)}${opt(5, 'Melhor de 5', c.melhorDe)}</select></label>` : ''}
          ${tipo === 'gols' ? `<label class="check"><input type="checkbox" name="sumulaCompleta" ${c.sumulaCompleta ? 'checked' : ''}> Súmula completa de futsal (gols, faltas, cartões, cronômetro)</label>` : ''}
        </div>
        <div class="cartao"><h2>Formato</h2>
          <label class="campo"><span>Formato</span><select name="formato" id="cm-formato">${Object.entries(D.NOMES_FORMATO).map(([k, v]) => opt(k, v, c.formato)).join('')}</select></label>
          <label class="check"><input type="checkbox" name="idaEVolta" ${c.idaEVolta ? 'checked' : ''}> Turno e returno</label>
          <div class="campos-2" id="cm-grupos">
            <label class="campo"><span>Nº de grupos</span><input type="number" min="1" max="8" name="numGrupos" value="${c.numGrupos}"></label>
            <label class="campo"><span>Classificados por grupo</span><input type="number" min="1" max="8" name="classificadosPorGrupo" value="${c.classificadosPorGrupo}"></label>
          </div>
          <label class="check"><input type="checkbox" name="terceiroLugar" ${c.terceiroLugar ? 'checked' : ''}> Disputa de 3º lugar</label>
          ${temJogos ? '<p class="suave">Mudou o formato? Depois de salvar, use “Gerar automaticamente” na aba Jogos.</p>' : ''}
        </div>
        ${c.sumulaCompleta ? `<div class="cartao"><h2>Tempo de jogo e disciplina</h2><div class="campos-2">
          <label class="campo"><span>Minutos por período</span><input type="number" min="1" name="duracaoPeriodo" value="${c.duracaoPeriodo}"></label>
          <label class="campo"><span>Nº de períodos</span><input type="number" min="1" max="4" name="numPeriodos" value="${c.numPeriodos}"></label>
          <label class="campo"><span>Amarelos para suspensão</span><input type="number" min="1" name="limiteAmarelos" value="${c.limiteAmarelos}"></label>
          <label class="campo"><span>Limite de faltas</span><input type="number" min="1" name="limiteFaltas" value="${c.limiteFaltas}"></label></div></div>` : ''}
        <div class="cartao"><h2>Pontuação</h2><div class="campos-3">
          <label class="campo"><span>Vitória</span><input type="number" name="pontosVitoria" value="${c.pontosVitoria}"></label>
          <label class="campo"><span>Empate</span><input type="number" name="pontosEmpate" value="${c.pontosEmpate}"></label>
          <label class="campo"><span>Derrota</span><input type="number" name="pontosDerrota" value="${c.pontosDerrota}"></label></div></div>
        <div class="cartao"><h2>Critérios de desempate</h2>
          <p class="suave">Use as setas para mudar a ordem. Desmarque para não usar.</p>
          <ul class="lista" id="cm-desempate"></ul></div>
        <div class="grupo-botoes"><button type="submit" class="btn btn-primario">💾 Salvar</button></div>
      </form>
      <div class="cartao"><h2>Zona de perigo</h2>
        <button class="btn btn-perigo" id="btn-apagar-mod">Apagar modalidade ${U.esc(cat.nome)}</button>
        <p class="suave"><a href="#/inter/${camp.id}/config">Configurações do interclasse (admins, visibilidade, medalhas) →</a></p></div>`;

    const f = document.getElementById('form-cfg-mod');
    const atualizar = () => document.getElementById('cm-grupos').classList.toggle('oculto', f.formato.value !== 'grupos');
    f.formato.onchange = atualizar;
    atualizar();
    const lista = document.getElementById('cm-desempate');
    const desenhar = () => {
      lista.innerHTML = ordem.map((k, i) => `<li>
        <input type="checkbox" data-crit="${k}" ${ativos.has(k) ? 'checked' : ''}>
        <span class="cresce"><b>${i + 1}.</b> ${U.esc(nomeCrit(k))}</span>
        <button type="button" class="btn btn-pequeno btn-icone" data-sobe="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="btn btn-pequeno btn-icone" data-desce="${i}" ${i === ordem.length - 1 ? 'disabled' : ''}>↓</button></li>`).join('');
    };
    desenhar();
    lista.onclick = (e) => {
      const s = e.target.closest('[data-sobe]');
      const d = e.target.closest('[data-desce]');
      if (s) { const i = +s.dataset.sobe; [ordem[i - 1], ordem[i]] = [ordem[i], ordem[i - 1]]; desenhar(); }
      if (d) { const i = +d.dataset.desce; [ordem[i + 1], ordem[i]] = [ordem[i], ordem[i + 1]]; desenhar(); }
    };
    lista.onchange = (e) => { const k = e.target.dataset.crit; if (k) { if (e.target.checked) ativos.add(k); else ativos.delete(k); } };

    f.onsubmit = (e) => {
      e.preventDefault();
      const d = U.lerForm(f);
      cat.nome = d.nome || cat.nome;
      cat.emoji = d.emoji || cat.emoji;
      ['numGrupos', 'classificadosPorGrupo', 'duracaoPeriodo', 'numPeriodos', 'limiteAmarelos', 'limiteFaltas', 'pontosVitoria', 'pontosEmpate', 'pontosDerrota']
        .forEach((k) => { if (d[k] !== undefined && d[k] !== null && !isNaN(d[k])) c[k] = d[k]; });
      c.formato = d.formato;
      c.idaEVolta = d.idaEVolta;
      c.terceiroLugar = d.terceiroLugar;
      if ('permiteEmpate' in d) c.permiteEmpate = d.permiteEmpate;
      if ('melhorDe' in d) c.melhorDe = Number(d.melhorDe) === 5 ? 5 : 3;
      if ('sumulaCompleta' in d) c.sumulaCompleta = d.sumulaCompleta;
      c.desempate = ordem.filter((k) => ativos.has(k));
      if (!c.desempate.length) c.desempate = ['pontos'];
      D.salvar();
      U.toast('Modalidade salva!', 'ok');
      App.render();
    };
    document.getElementById('btn-apagar-mod').onclick = async () => {
      if (!(await U.confirmar(`Apagar a modalidade ${cat.nome}, com jogos e pódio? Não dá para desfazer.`, 'Apagar', 'btn-perigo'))) return;
      D.apagarCategoria(cat.id);
      App.ir(`#/inter/${camp.id}/modalidades`);
    };
  },

  /* =======================================================
     PÁGINA DA TURMA
     ======================================================= */
  renderTurma(campId, turmaId) {
    const D = App.dados;
    const U = App.util;
    const camp = D.campeonato(campId);
    const turma = camp && (camp.turmas || []).find((t) => t.id === turmaId);
    if (!turma) { App.ir(camp ? `#/inter/${campId}/turmas` : '#/'); return; }
    App.leitura(!App.podeEditar(camp));
    App.titulo(turma.nome, `#/inter/${camp.id}/turmas`);
    const linha = App.regras.quadroMedalhas(camp).lista.find((l) => l.turma.id === turma.id) || { o: 0, p: 0, b: 0, modalidades: [] };
    const jogos = App.inter.jogosDaTurma(camp, turma.id).sort(D.compararJogos);
    const modalidades = camp.categorias.filter((c) => (c.turmaIds || []).includes(turma.id));
    const ICONE = { ouro: '🥇', prata: '🥈', bronze: '🥉' };
    App.main().innerHTML = `
      <div class="cartao"><div class="linha">${this.bolinhaTurma(turma)}<h2 style="margin:0">${U.esc(turma.nome)}</h2></div>
        <p style="font-size:1.3rem;margin:10px 0 0">🥇 ${linha.o} &nbsp; 🥈 ${linha.p} &nbsp; 🥉 ${linha.b}</p>
        ${linha.modalidades.length ? `<ul class="lista">${linha.modalidades.map((m) => `<li>${ICONE[m.medalha]} <a href="#/camp/${camp.id}/${m.cat.id}/podio">${U.esc(m.cat.emoji || '')} ${U.esc(m.cat.nome)}</a></li>`).join('')}</ul>` : '<p class="suave">Ainda sem medalhas.</p>'}
        <p class="suave">Participa de: ${modalidades.map((c) => `<a href="#/camp/${camp.id}/${c.id}/jogos">${U.esc(c.emoji || '')} ${U.esc(c.nome)}</a>`).join(' · ') || 'nenhuma modalidade ainda'}</p>
      </div>
      <div class="cartao"><h2>Jogos (${jogos.length})</h2>
        ${jogos.length ? jogos.map((j) => {
          const { cat } = D.categoria(j.categoriaId);
          return `<p class="suave" style="margin:10px 4px 2px">${U.esc(cat.emoji || '')} ${U.esc(cat.nome)}</p>${App.telas.campeonato.cartaoJogo(j, null)}`;
        }).join('') : '<p class="vazio">Sem jogos ainda.</p>'}
      </div>`;
    App.telas.campeonato.ligarCartoes(App.main());
  },
};
