/* =========================================================
   TABELA DE JOGOS — MONTAGEM MANUAL
   - Adicionar / editar / trocar times / excluir jogos
   - Reordenar (modo "Organizar")
   - Importação rápida colando a tabela em texto

   As regras (validar, gravar, ler o texto) ficam em tabela.js.
   Aqui é só a parte da tela.
   ========================================================= */

var App = globalThis.App = globalThis.App || {};
App.telas = App.telas || {};

App.telas.jogos = {
  /** Modo "Organizar": mostra setas ↑↓ e lixeira nos cartões. */
  organizando: false,

  /** Texto colado da última importação (para não perder ao voltar). */
  textoImportacao: '',

  /* ---------- Formulário do jogo (novo ou editar) ---------- */
  formJogo(jogo, catId) {
    const D = App.dados;
    const U = App.util;
    const R = App.regras;
    const T = App.tabela;
    catId = catId || jogo.categoriaId;
    const { cat } = D.categoria(catId);

    if (jogo && jogo.status === 'encerrado') {
      U.toast('Súmula encerrada: reabra a súmula para editar este jogo.', 'aviso', 4000);
      return;
    }

    // Valores iniciais: do jogo, ou da última rodada/fase da tabela
    const todos = D.jogosDaCategoria(catId);
    const ultimo = todos[todos.length - 1];
    const base = jogo || ultimo;
    const ini = {
      tipo: base && base.fase === 'mata' ? 'mata' : 'classificacao',
      rodadaTexto: base ? base.rodadaNome : 'Rodada 1',
      grupoId: base ? base.grupoId || '' : '',
      casa: jogo ? T.valorLado(jogo.casaId, jogo.origemCasa) : '',
      fora: jogo ? T.valorLado(jogo.foraId, jogo.origemFora) : '',
      data: base ? base.data : '',
      hora: jogo ? jogo.hora : '',
      quadra: jogo ? jogo.quadra : (base ? base.quadra : ''),
      numero: jogo && jogo.numero ? jogo.numero : '',
    };

    // Sugestões para o campo rodada/fase
    const rodadas = [...new Set(todos.filter((j) => j.fase !== 'mata').map((j) => j.rodada))].sort((a, b) => a - b);
    const proxima = (rodadas[rodadas.length - 1] || 0) + 1;
    const sugestoes = [...rodadas.map((r) => `Rodada ${r}`), `Rodada ${proxima}`, ...T.FASES_MATA];

    U.modal({
      titulo: jogo ? `Editar jogo ${R.numeroJogo(jogo) || ''}` : 'Adicionar jogo',
      html: `
        <form id="form-jogo">
          <label class="campo"><span>Tipo de jogo</span>
            <select name="tipo">
              <option value="classificacao" ${ini.tipo === 'classificacao' ? 'selected' : ''}>Classificação (vale pontos)</option>
              <option value="mata" ${ini.tipo === 'mata' ? 'selected' : ''}>Mata-mata (eliminatório)</option>
            </select></label>
          <div class="campos-2">
            <label class="campo"><span>Rodada ou fase</span>
              <input name="rodadaTexto" list="lista-fases" value="${U.esc(ini.rodadaTexto)}" placeholder="Rodada 1, Semifinal...">
              <datalist id="lista-fases">${sugestoes.map((s) => `<option value="${U.esc(s)}">`).join('')}</datalist></label>
            <label class="campo" id="campo-grupo"><span>Grupo</span>
              <select name="grupoId">
                <option value="">Sem grupo</option>
                ${(cat.grupos || []).map((g) => `<option value="${g.id}" ${ini.grupoId === g.id ? 'selected' : ''}>${U.esc(g.nome)}</option>`).join('')}
                <option value="__novo">+ Novo grupo…</option>
              </select></label>
          </div>
          <label class="campo oculto" id="campo-novo-grupo"><span>Nome do novo grupo</span><input name="novoGrupo" placeholder="Ex.: A"></label>

          <label class="campo"><span>Time A (mandante)</span><select name="casa"></select></label>
          <div class="centro" style="margin:-4px 0 8px"><button type="button" class="btn btn-pequeno" id="btn-trocar">⇅ Trocar os times</button></div>
          <label class="campo"><span>Time B (visitante)</span><select name="fora"></select></label>
          <p class="suave" id="dica-origem" style="margin-top:-6px">No mata-mata você pode escolher “Vencedor do jogo X” ou “1º do Grupo A”: o app preenche sozinho quando o resultado sair.</p>

          <div class="campos-2">
            <label class="campo"><span>Data</span><input type="date" name="data" value="${U.esc(ini.data)}"></label>
            <label class="campo"><span>Horário</span><input type="time" name="hora" value="${U.esc(ini.hora)}"></label>
          </div>
          <div class="campos-2">
            <label class="campo"><span>Quadra</span><input name="quadra" value="${U.esc(ini.quadra)}" placeholder="Ex.: Quadra 1"></label>
            <label class="campo"><span>Nº do jogo (opcional)</span><input type="number" min="1" name="numero" value="${U.esc(ini.numero)}" placeholder="automático" inputmode="numeric"></label>
          </div>
          ${jogo && jogo.sumula && jogo.sumula.eventos.length ? '<div class="aviso-faixa amarela">Este jogo já tem súmula em andamento. Se trocar os times, ela será apagada.</div>' : ''}
        </form>`,
      botoes: [
        ...(jogo ? [{ texto: '🗑️ Excluir', classe: 'btn-perigo', acao: (m) => { m.fechar(); this.excluir(jogo); } }] : []),
        { texto: 'Cancelar' },
        { texto: 'Salvar', classe: 'btn-primario', acao: (m) => { this.salvarForm(m, jogo, catId); return false; } },
      ],
      aoAbrir: () => {
        const f = document.getElementById('form-jogo');
        const atualizar = () => {
          const mata = f.tipo.value === 'mata';
          document.getElementById('campo-grupo').classList.toggle('oculto', mata);
          document.getElementById('campo-novo-grupo').classList.toggle('oculto', mata || f.grupoId.value !== '__novo');
          document.getElementById('dica-origem').classList.toggle('oculto', !mata);
          for (const lado of ['casa', 'fora']) {
            const atual = f[lado].value || ini[lado];
            f[lado].innerHTML = this.opcoesLado(cat, jogo, mata);
            // Mantém a escolha se ela ainda existir nas opções
            f[lado].value = [...f[lado].options].some((o) => o.value === atual) ? atual : '';
          }
          ini.casa = ''; ini.fora = '';
        };
        f.tipo.onchange = () => {
          // Ao trocar o tipo, sugere uma rodada/fase que combine
          const ehMata = f.tipo.value === 'mata';
          const f2 = T.interpretarFase(f.rodadaTexto.value);
          if (ehMata && (!f2 || f2.fase === 'liga')) f.rodadaTexto.value = 'Semifinal';
          if (!ehMata && (!f2 || f2.fase === 'mata')) f.rodadaTexto.value = `Rodada ${proxima}`;
          atualizar();
        };
        f.grupoId.onchange = atualizar;
        document.getElementById('btn-trocar').onclick = () => {
          const a = f.casa.value;
          f.casa.value = f.fora.value;
          f.fora.value = a;
        };
        atualizar();
      },
    });
  },

  /** Opções do <select> de um lado do jogo: times e (no mata-mata) origens. */
  opcoesLado(cat, jogo, mata) {
    const D = App.dados;
    const U = App.util;
    const R = App.regras;
    const times = D.timesDaCategoria(cat.id);
    let html = `<option value="">— A definir —</option>
      <optgroup label="Times">${times.map((t) => `<option value="t:${t.id}">${U.esc(t.nome)}</option>`).join('')}</optgroup>`;
    if (!mata) return html;

    const outros = D.jogosDaCategoria(cat.id).filter((j) => !j.bye && j !== jogo);
    const rotulo = (j) => {
      const a = D.time(j.casaId);
      const b = D.time(j.foraId);
      const na = a ? a.nome : R.textoOrigem(j.origemCasa, cat.id);
      const nb = b ? b.nome : R.textoOrigem(j.origemFora, cat.id);
      return `jogo ${R.numeroJogo(j)} (${j.rodadaNome}: ${na} x ${nb})`;
    };
    if (outros.length) {
      html += `<optgroup label="Vencedor de um jogo">${outros.map((j) => `<option value="v:${j.id}">Vencedor do ${U.esc(rotulo(j))}</option>`).join('')}</optgroup>`;
      html += `<optgroup label="Perdedor de um jogo">${outros.map((j) => `<option value="p:${j.id}">Perdedor do ${U.esc(rotulo(j))}</option>`).join('')}</optgroup>`;
    }
    for (const g of cat.grupos || []) {
      const qtd = Math.max(2, R.timesDoGrupo(cat, g.id).length);
      html += `<optgroup label="Colocação no ${U.esc(g.nome)}">`;
      for (let p = 1; p <= qtd; p++) html += `<option value="g:${g.id}:${p}">${p}º do ${U.esc(g.nome)}</option>`;
      html += '</optgroup>';
    }
    return html;
  },

  /** Lê o formulário, confirma se precisar e grava. */
  async salvarForm(modal, jogo, catId) {
    const U = App.util;
    const T = App.tabela;
    const f = App.util.lerForm(document.getElementById('form-jogo'));
    if (f.grupoId === '__novo') {
      if (!f.novoGrupo) { U.toast('Digite o nome do novo grupo.', 'erro'); return; }
      f.grupoId = '';
    } else {
      f.novoGrupo = '';
    }
    if (f.tipo === 'mata') { f.grupoId = ''; f.novoGrupo = ''; }

    // Trocar times de um jogo com súmula em andamento apaga a súmula: pergunta antes
    if (jogo && jogo.sumula && jogo.sumula.eventos.length) {
      const mudou = T.valorLado(jogo.casaId, jogo.origemCasa) !== f.casa || T.valorLado(jogo.foraId, jogo.origemFora) !== f.fora;
      if (mudou && !(await U.confirmar('Os times mudaram e a súmula em andamento deste jogo será apagada. Continuar?', 'Apagar súmula', 'btn-perigo'))) return;
    }
    try {
      T.salvarJogo(catId, jogo, f);
      modal.fechar();
      U.toast(jogo ? 'Jogo atualizado!' : 'Jogo adicionado!', 'ok');
      App.render();
    } catch (e) {
      U.toast(e.message, 'erro', 4000);
    }
  },

  /**
   * RESULTADO RÁPIDO: lançar só o placar final, sem súmula detalhada.
   * Conta normalmente na classificação (e no mata-mata decide quem avança).
   */
  resultadoRapido(jogo) {
    const D = App.dados;
    const U = App.util;
    const casa = D.time(jogo.casaId);
    const fora = D.time(jogo.foraId);
    if (!casa || !fora) { U.toast('O jogo ainda não tem os dois times definidos.', 'aviso'); return; }
    if (jogo.status === 'encerrado') { U.toast('Este jogo já está encerrado. Abra o jogo e use “Reabrir” para corrigir.', 'aviso', 4000); return; }
    const mata = jogo.fase === 'mata';
    const temEventos = jogo.sumula && jogo.sumula.eventos.length;
    // Interclasse: modalidades por sets ou por vitória/empate/derrota têm janela própria
    const { cat } = D.categoria(jogo.categoriaId);
    const tipo = App.regras.tipoPlacar(cat);
    if (tipo === 'sets') { this.resultadoSets(jogo, casa, fora, cat); return; }
    if (tipo === 'resultado') { this.resultadoVED(jogo, casa, fora, cat); return; }
    const semEmpate = cat.config.permiteEmpate === false; // ex.: basquete (só no interclasse)
    const campoGol = (nome, rotulo) => `<label class="campo" style="text-align:center"><span>${U.esc(rotulo)}</span>
      <input type="number" name="${nome}" min="0" max="99" inputmode="numeric" style="font-size:2rem;text-align:center;font-weight:800" required></label>`;

    U.modal({
      titulo: '⚡ Resultado rápido',
      html: `
        <p class="suave" style="margin-top:0">Lance só o placar final, sem detalhar gols e cartões. Conta normalmente na classificação.</p>
        <form id="form-rapido">
          <div class="campos-2">${campoGol('casa', casa.nome)}${campoGol('fora', fora.nome)}</div>
          ${mata ? `<div id="campos-pen" class="oculto">
            <p style="margin:0 0 6px"><b>Empate no mata-mata: placar dos pênaltis</b></p>
            <div class="campos-2">
              <label class="campo"><span>${U.esc(casa.nome)}</span><input type="number" name="penCasa" min="0" max="99" inputmode="numeric"></label>
              <label class="campo"><span>${U.esc(fora.nome)}</span><input type="number" name="penFora" min="0" max="99" inputmode="numeric"></label>
            </div></div>` : ''}
          ${temEventos ? '<div class="aviso-faixa amarela">Este jogo tem súmula com eventos lançados. Eles serão descartados e vale só este placar.</div>' : ''}
        </form>`,
      aoAbrir: (m) => {
        const f = document.getElementById('form-rapido');
        f.casa.focus();
        if (mata) {
          const ver = () => document.getElementById('campos-pen').classList.toggle('oculto', f.casa.value === '' || f.casa.value !== f.fora.value);
          f.casa.oninput = ver;
          f.fora.oninput = ver;
        }
      },
      botoes: [
        { texto: 'Cancelar' },
        {
          texto: 'Encerrar com este placar', classe: 'btn-primario',
          acao: () => {
            const d = U.lerForm(document.getElementById('form-rapido'));
            const ok = (n) => Number.isInteger(n) && n >= 0 && n <= 99;
            if (!ok(d.casa) || !ok(d.fora)) { U.toast('Digite os gols dos dois times.', 'erro'); return false; }
            let penCasa = null;
            let penFora = null;
            if (semEmpate && d.casa === d.fora) {
              U.toast('Esta modalidade não tem empate: o placar precisa ter um vencedor.', 'erro', 4000);
              return false;
            }
            if (mata && d.casa === d.fora) {
              if (!ok(d.penCasa) || !ok(d.penFora) || d.penCasa === d.penFora) {
                U.toast('Empate no mata-mata: digite os pênaltis (com um vencedor).', 'erro', 4000);
                return false;
              }
              penCasa = d.penCasa;
              penFora = d.penFora;
            }
            jogo.placarRapido = { casa: d.casa, fora: d.fora, penCasa, penFora };
            jogo.sumula = null;
            jogo.status = 'encerrado';
            App.regras.atualizarMataMata(jogo.categoriaId);
            D.salvar();
            U.toast(`Resultado lançado: ${casa.nome} ${d.casa} x ${d.fora} ${fora.nome}`, 'ok', 3500);
            App.render();
          },
        },
      ],
    });
  },

  /** Grava o resultado rápido (qualquer tipo) e encerra o jogo. */
  gravarResultado(jogo, placarRapido, texto) {
    jogo.placarRapido = placarRapido;
    jogo.sumula = null;
    jogo.status = 'encerrado';
    App.regras.atualizarMataMata(jogo.categoriaId);
    App.dados.salvar();
    App.util.toast(texto, 'ok', 3500);
    App.render();
  },

  /**
   * SETS (vôlei): placar de cada set. Vence quem ganhar mais sets
   * (melhor de 3: 2 sets; melhor de 5: 3 sets).
   */
  resultadoSets(jogo, casa, fora, cat) {
    const U = App.util;
    const melhorDe = cat.config.melhorDe === 5 ? 5 : 3;
    const precisa = Math.ceil(melhorDe / 2);
    const linhas = Array.from({ length: melhorDe }, (_, i) => `
      <div class="campos-2" style="align-items:center">
        <label class="campo" style="text-align:center"><span>${i + 1}º set · ${U.esc(casa.nome)}</span>
          <input type="number" min="0" max="99" inputmode="numeric" data-set="${i}" data-lado="casa" style="font-size:1.4rem;text-align:center;font-weight:800"></label>
        <label class="campo" style="text-align:center"><span>${i + 1}º set · ${U.esc(fora.nome)}</span>
          <input type="number" min="0" max="99" inputmode="numeric" data-set="${i}" data-lado="fora" style="font-size:1.4rem;text-align:center;font-weight:800"></label>
      </div>`).join('');

    U.modal({
      titulo: '🏐 Resultado por sets',
      html: `<p class="suave" style="margin-top:0">Melhor de ${melhorDe}: vence quem ganhar ${precisa} sets. Preencha só os sets jogados.</p>
        <form id="form-sets">${linhas}</form><p id="resumo-sets" class="centro" style="font-weight:800"></p>`,
      aoAbrir: () => {
        const f = document.getElementById('form-sets');
        const resumo = () => {
          const r = this.lerSets(f, melhorDe);
          document.getElementById('resumo-sets').textContent = r.erro ? '' : `Sets: ${casa.nome} ${r.casa} × ${r.fora} ${fora.nome}`;
        };
        f.oninput = resumo;
        f.querySelector('input').focus();
      },
      botoes: [
        { texto: 'Cancelar' },
        {
          texto: 'Encerrar com este placar', classe: 'btn-primario',
          acao: () => {
            const r = this.lerSets(document.getElementById('form-sets'), melhorDe);
            if (r.erro) { U.toast(r.erro, 'erro', 4500); return false; }
            this.gravarResultado(jogo, { casa: r.casa, fora: r.fora, penCasa: null, penFora: null, sets: r.sets },
              `Resultado lançado: ${casa.nome} ${r.casa} × ${r.fora} ${fora.nome} (sets)`);
          },
        },
      ],
    });
  },

  /** Lê e confere os sets do formulário. Devolve { sets, casa, fora } ou { erro }. */
  lerSets(form, melhorDe) {
    const precisa = Math.ceil(melhorDe / 2);
    const sets = [];
    for (let i = 0; i < melhorDe; i++) {
      const a = form.querySelector(`[data-set="${i}"][data-lado="casa"]`).value;
      const b = form.querySelector(`[data-set="${i}"][data-lado="fora"]`).value;
      if (a === '' && b === '') continue;
      if (a === '' || b === '') return { erro: `Preencha os dois lados do ${i + 1}º set.` };
      sets.push([Number(a), Number(b)]);
    }
    return this.conferirSets(sets, melhorDe, precisa);
  },

  /** Regras dos sets: sem set empatado, vencedor com o número certo de sets, nada depois do fim. */
  conferirSets(sets, melhorDe, precisa = Math.ceil(melhorDe / 2)) {
    if (!sets.length) return { erro: 'Digite o placar de pelo menos um set.' };
    let casa = 0;
    let fora = 0;
    for (let i = 0; i < sets.length; i++) {
      const [a, b] = sets[i];
      if (a === b) return { erro: `O ${i + 1}º set não pode terminar empatado.` };
      if (casa === precisa || fora === precisa) return { erro: `O jogo já tinha acabado antes do ${i + 1}º set.` };
      if (a > b) casa++; else fora++;
    }
    if (casa !== precisa && fora !== precisa) return { erro: `Ninguém chegou a ${precisa} sets: confira o placar.` };
    // Guardado como lista de objetos (o Firestore não aceita lista dentro de lista)
    return { sets: sets.map(([a, b]) => ({ casa: a, fora: b })), casa, fora };
  },

  /** VITÓRIA / EMPATE / DERROTA, sem placar (xadrez, tênis de mesa...). */
  resultadoVED(jogo, casa, fora, cat) {
    const U = App.util;
    const podeEmpatar = cat.config.permiteEmpate !== false && jogo.fase !== 'mata';
    const opcoes = [
      { valor: 'casa', texto: `🏆 Vitória: ${casa.nome}` },
      ...(podeEmpatar ? [{ valor: 'empate', texto: '🤝 Empate' }] : []),
      { valor: 'fora', texto: `🏆 Vitória: ${fora.nome}` },
    ];
    U.modal({
      titulo: `${cat.emoji || '🏅'} Resultado`,
      html: `<p class="suave" style="margin-top:0">${U.esc(casa.nome)} × ${U.esc(fora.nome)}</p>
        <div style="display:grid;gap:8px">${opcoes.map((o) => `<button type="button" class="btn btn-bloco" data-ved="${o.valor}" style="min-height:56px">${U.esc(o.texto)}</button>`).join('')}</div>`,
      botoes: [{ texto: 'Cancelar' }],
      aoAbrir: (m) => {
        m.el.querySelectorAll('[data-ved]').forEach((b) => {
          b.onclick = () => {
            const r = b.dataset.ved;
            m.fechar();
            const placar = { casa: r === 'casa' ? 1 : 0, fora: r === 'fora' ? 1 : 0, penCasa: null, penFora: null, resultado: r };
            this.gravarResultado(jogo, placar, r === 'empate' ? 'Empate lançado.' : `Vitória: ${r === 'casa' ? casa.nome : fora.nome}`);
          };
        });
      },
    });
  },

  /** Exclui um jogo, avisando se outros dependem dele. */
  async excluir(jogo) {
    const U = App.util;
    const R = App.regras;
    if (jogo.status === 'encerrado') { U.toast('Súmula encerrada: reabra a súmula para excluir este jogo.', 'aviso', 4000); return; }
    const deps = App.tabela.dependentes(jogo);
    let msg = `Excluir o jogo ${R.numeroJogo(jogo)} (${jogo.rodadaNome})?`;
    if (jogo.sumula && jogo.sumula.eventos.length) msg += ' A súmula em andamento também será apagada.';
    if (deps.length) msg += ` Atenção: ${deps.length} jogo(s) dependem do resultado dele e ficarão “a definir”.`;
    if (!(await U.confirmar(msg, 'Excluir', 'btn-perigo'))) return;
    try {
      App.tabela.excluirJogo(jogo);
      U.toast('Jogo excluído.');
      App.render();
    } catch (e) {
      U.toast(e.message, 'erro', 4000);
    }
  },

  /** Sobe ou desce o jogo dentro da rodada/fase. */
  mover(jogo, direcao) {
    try {
      App.tabela.moverJogo(jogo, direcao);
      App.render();
    } catch (e) {
      App.util.toast(e.message, 'aviso');
    }
  },

  /* ---------- Importação rápida por texto ---------- */
  importar(cat) {
    const U = App.util;
    const D = App.dados;
    const todos = D.jogosDaCategoria(cat.id);
    const rodadas = todos.filter((j) => j.fase !== 'mata').map((j) => j.rodada);
    const padrao = `Rodada ${(rodadas.length ? Math.max(...rodadas) : 0) + 1}`;

    U.modal({
      titulo: '📋 Colar tabela em texto',
      html: `
        <p class="suave" style="margin-top:0">Uma linha por jogo, assim:<br>
          <code>Time A x Time B - 02/11 09:00 - Quadra 1</code><br>
          Linhas sozinhas como <code>Rodada 2</code>, <code>Grupo A</code>, <code>Semifinal</code> ou <code>Final</code>
          valem para os jogos abaixo delas.</p>
        <label class="campo"><span>Texto da tabela</span>
          <textarea id="txt-tabela" rows="10" placeholder="Rodada 1&#10;Leões x Tubarões - 02/11 09:00 - Quadra 1&#10;Águias x Raio Azul - 02/11 09:50 - Quadra 2">${U.esc(this.textoImportacao)}</textarea></label>
        <label class="campo"><span>Rodada/fase dos jogos antes do primeiro título</span>
          <input id="txt-fase" list="lista-fases-imp" value="${U.esc(padrao)}">
          <datalist id="lista-fases-imp">${[padrao, ...App.tabela.FASES_MATA].map((s) => `<option value="${U.esc(s)}">`).join('')}</datalist></label>`,
      botoes: [
        { texto: 'Cancelar' },
        {
          texto: 'Conferir →', classe: 'btn-primario',
          acao: () => {
            this.textoImportacao = document.getElementById('txt-tabela').value;
            const fase = document.getElementById('txt-fase').value;
            if (!this.textoImportacao.trim()) { U.toast('Cole a tabela no campo de texto.', 'erro'); return false; }
            const resultado = App.tabela.interpretarTexto(this.textoImportacao, cat.id, fase);
            setTimeout(() => this.previaImportacao(cat, resultado), 0);
          },
        },
      ],
    });
  },

  /** Mostra o que foi entendido e avisa sobre times que não existem, ANTES de gravar. */
  previaImportacao(cat, resultado) {
    const U = App.util;
    const { jogos, erros, timesNovos } = resultado;
    const novos = new Set(timesNovos.map((n) => App.tabela.normalizar(n)));
    const nome = (n) => novos.has(App.tabela.normalizar(n)) ? `<b style="color:var(--vermelho)">${U.esc(n)} *</b>` : U.esc(n);

    U.modal({
      titulo: `Conferir importação (${jogos.length} jogo${jogos.length === 1 ? '' : 's'})`,
      html: `
        ${timesNovos.length && App.dados.ehInterclasse(App.dados.categoria(cat.id).camp) ? `<div class="aviso-faixa vermelha">⚠️ ${timesNovos.length === 1 ? 'Esta turma não está' : 'Estas turmas não estão'} na modalidade: <b>${timesNovos.map(U.esc).join(', ')}</b>.<br>Confira o nome ou marque a turma na aba Turmas da modalidade.</div>` : ''}
        ${timesNovos.length && !App.dados.ehInterclasse(App.dados.categoria(cat.id).camp) ? `<div class="aviso-faixa amarela">⚠️ ${timesNovos.length === 1 ? 'Este time não existe' : 'Estes times não existem'} na ${U.esc(cat.nome)}:
          <b>${timesNovos.map(U.esc).join(', ')}</b>.<br>Volte e corrija o nome, ou crie ${timesNovos.length === 1 ? 'o time' : 'os times'} (sem jogadores; dá para completar depois).</div>` : ''}
        ${erros.length ? `<div class="aviso-faixa vermelha">${erros.length} linha(s) serão ignoradas:<br>
          ${erros.map((e) => `<small>Linha ${e.linha}: “${U.esc(e.texto)}” — ${U.esc(e.motivo)}</small>`).join('<br>')}</div>` : ''}
        ${jogos.length ? `<div class="tabela-rolagem"><table class="tabela">
          <thead><tr><th class="esq">Fase</th><th class="esq">Jogo</th><th>Data</th><th>Hora</th><th class="esq">Quadra</th></tr></thead>
          <tbody>${jogos.map((j) => `<tr>
            <td class="esq">${U.esc(j.rodadaTexto)}${j.grupoNome ? `<br><small>Grupo ${U.esc(j.grupoNome.replace(/^grupo\s*/i, ''))}</small>` : ''}</td>
            <td class="time-celula">${nome(j.casaNome)} x ${nome(j.foraNome)}</td>
            <td>${U.dataCurta(j.data) || '—'}</td><td>${U.esc(j.hora || '—')}</td><td class="esq">${U.esc(j.quadra || '—')}</td></tr>`).join('')}
          </tbody></table></div>` : '<p class="vazio">Nenhum jogo reconhecido.</p>'}`,
      botoes: [
        { texto: '← Voltar', acao: () => { setTimeout(() => this.importar(cat), 0); } },
        ...(jogos.length && !(timesNovos.length && App.dados.ehInterclasse(App.dados.categoria(cat.id).camp)) ? [{
          texto: timesNovos.length ? `Criar times e ${jogos.length} jogos` : `Criar ${jogos.length} jogos`,
          classe: 'btn-primario',
          acao: () => {
            try {
              const r = App.tabela.importarJogos(cat.id, resultado, true);
              this.textoImportacao = '';
              U.toast(`${r.jogos.length} jogo(s) importado(s)${r.timesCriados ? ` e ${r.timesCriados} time(s) criado(s)` : ''}!`, 'ok', 3500);
              App.render();
            } catch (e) {
              U.toast(e.message, 'erro', 4000);
              return false;
            }
          },
        }] : []),
      ],
    });
  },
};
