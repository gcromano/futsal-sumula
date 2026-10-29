/* =========================================================
   TELAS DO TIME E DO JOGADOR
   - Página do time: dados, resumo, elenco e jogos
   - Página do jogador: estatísticas, situação disciplinar
     e histórico de eventos
   ========================================================= */

var App = globalThis.App = globalThis.App || {};
App.telas = App.telas || {};

App.telas.time = {
  /* ---------- Formulário do time (criar/editar) ---------- */
  formTime(camp, cat, time) {
    const U = App.util;
    const D = App.dados;
    const t = time || { nome: '', cor: '#1f6fd1', escudo: '', bandeira: '', tecnico: '', responsavel: '', telefone: '' };
    // Lista de países (para seleções), em ordem alfabética
    const paises = Object.entries(U.PAISES).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
    let escudo = t.escudo || '';

    U.modal({
      titulo: time ? 'Editar time' : 'Novo time',
      html: `
        <form id="form-time">
          <label class="campo"><span>Nome *</span><input name="nome" required value="${U.esc(t.nome)}"></label>
          <div class="campos-2">
            <label class="campo"><span>Cor</span><input type="color" name="cor" value="${U.esc(t.cor)}"></label>
            <label class="campo"><span>Escudo (imagem, opcional)</span><input type="file" accept="image/*" id="arq-escudo"></label>
          </div>
          <label class="campo"><span>Bandeira (para seleções)</span>
            <select name="bandeira">
              <option value="">Sem bandeira (usar cor/escudo)</option>
              ${paises.map(([cod, nome]) => `<option value="${cod}" ${t.bandeira === cod ? 'selected' : ''}>${U.esc(nome)}</option>`).join('')}
            </select></label>
          <div class="linha" style="margin-bottom:12px">
            <span id="previa-escudo">${U.escudo({ ...t, escudo }, 'grande')}</span>
            <button type="button" class="btn btn-pequeno" id="btn-tirar-escudo">Remover imagem</button>
          </div>
          <label class="campo"><span>Técnico</span><input name="tecnico" value="${U.esc(t.tecnico)}"></label>
          <label class="campo"><span>Responsável</span><input name="responsavel" value="${U.esc(t.responsavel)}"></label>
          <label class="campo"><span>Telefone (WhatsApp)</span><input type="tel" name="telefone" value="${U.esc(t.telefone)}" placeholder="(11) 99999-9999"></label>
        </form>`,
      aoAbrir: () => {
        const form = document.getElementById('form-time');
        const previa = () => {
          const dados = U.lerForm(form);
          document.getElementById('previa-escudo').innerHTML = U.escudo({ nome: dados.nome || '?', cor: dados.cor, bandeira: dados.bandeira, escudo }, 'grande');
        };
        form.cor.oninput = previa;
        form.bandeira.onchange = () => {
          // Escolheu um país e o nome está vazio: preenche com o nome do país
          if (form.bandeira.value && !form.nome.value.trim()) form.nome.value = U.PAISES[form.bandeira.value];
          previa();
        };
        form.nome.oninput = previa;
        document.getElementById('arq-escudo').onchange = async (e) => {
          if (!e.target.files[0]) return;
          try { escudo = await U.reduzirImagem(e.target.files[0], 96); previa(); }
          catch (err) { U.toast('Não consegui ler a imagem.', 'erro'); }
        };
        document.getElementById('btn-tirar-escudo').onclick = () => { escudo = ''; previa(); };
      },
      botoes: [
        { texto: 'Cancelar' },
        {
          texto: 'Salvar', classe: 'btn-primario',
          acao: () => {
            const dados = U.lerForm(document.getElementById('form-time'));
            if (!dados.nome) { U.toast('Informe o nome do time', 'erro'); return false; }
            if (time) {
              Object.assign(time, dados, { escudo });
            } else {
              D.db.times.push({
                id: U.id(), campeonatoId: camp.id, categoriaId: cat.id, sorteio: Math.random(), jogadores: [],
                ...dados, escudo,
              });
            }
            D.salvar();
            App.render();
          },
        },
      ],
    });
  },

  /* ---------- Formulário do jogador ---------- */
  formJogador(time, jogador) {
    const U = App.util;
    const D = App.dados;
    const p = jogador || { numero: '', nome: '', nascimento: '', posicao: 'linha' };
    U.modal({
      titulo: jogador ? 'Editar jogador' : 'Novo jogador',
      html: `
        <form id="form-jog">
          <div class="campos-2">
            <label class="campo"><span>Camisa *</span><input type="number" min="0" max="99" name="numero" required value="${U.esc(p.numero)}" inputmode="numeric"></label>
            <label class="campo"><span>Posição</span>
              <select name="posicao">
                <option value="linha" ${p.posicao === 'linha' ? 'selected' : ''}>Linha</option>
                <option value="goleiro" ${p.posicao === 'goleiro' ? 'selected' : ''}>Goleiro</option>
              </select></label>
          </div>
          <label class="campo"><span>Nome *</span><input name="nome" required value="${U.esc(p.nome)}"></label>
          <label class="campo"><span>Data de nascimento</span><input type="date" name="nascimento" value="${U.esc(p.nascimento)}"></label>
          <div id="alerta-idade"></div>
        </form>`,
      aoAbrir: () => {
        const form = document.getElementById('form-jog');
        const { cat } = D.categoria(time.categoriaId);
        const checar = () => {
          const alerta = App.regras.alertaIdade({ nascimento: form.nascimento.value }, cat);
          document.getElementById('alerta-idade').innerHTML = alerta ? `<div class="aviso-faixa amarela">⚠️ ${U.esc(alerta)}</div>` : '';
        };
        form.nascimento.onchange = checar;
        checar();
        if (!jogador) form.numero.focus();
      },
      botoes: [
        { texto: 'Cancelar' },
        {
          texto: 'Salvar', classe: 'btn-primario',
          acao: () => {
            const d = U.lerForm(document.getElementById('form-jog'));
            if (d.numero === null || !d.nome) { U.toast('Preencha camisa e nome', 'erro'); return false; }
            const repetido = time.jogadores.find((x) => Number(x.numero) === d.numero && x !== jogador);
            if (repetido) { U.toast(`A camisa ${d.numero} já é de ${repetido.nome}`, 'erro'); return false; }
            if (jogador) Object.assign(jogador, d);
            else time.jogadores.push({ id: U.id(), ...d });
            time.jogadores.sort((a, b) => a.numero - b.numero);
            D.salvar();
            App.render();
          },
        },
      ],
    });
  },

  /* ---------- Colar elenco em texto ---------- */

  /** Texto colado da última vez (para não perder ao voltar da conferência). */
  textoElenco: '',

  /**
   * Lê a lista colada. Um jogador por linha:
   *   "10 - João Silva"
   * Também aceita "10 João Silva", "10. João", "10) João" e, opcionalmente,
   * data de nascimento e "goleiro" depois de outro " - ":
   *   "1 - Pedro Souza - 15/03/2016 - goleiro"
   * Não grava nada: devolve { novos, problemas } para a conferência.
   */
  lerElenco(texto, time) {
    const novos = [];      // { linha, numero, nome, nascimento, posicao }
    const problemas = [];  // { linha, texto, motivo }
    const usados = new Map((time.jogadores || []).map((p) => [Number(p.numero), p.nome]));
    const doTexto = new Map(); // número → linha onde apareceu primeiro no texto

    texto.split(/\r?\n/).forEach((bruta, i) => {
      const linha = bruta.trim().replace(/^[•*·]\s*/, '');
      const n = i + 1;
      if (!linha) return;

      const m = linha.match(/^(\d{1,3})\s*(?:[-–—.):]\s*|\s+)(.+)$/);
      if (!m) { problemas.push({ linha: n, texto: linha, motivo: 'Não entendi. Use “número - nome”, ex.: 10 - João Silva.' }); return; }
      const numero = Number(m[1]);
      if (numero > 99) { problemas.push({ linha: n, texto: linha, motivo: `Camisa ${numero}: use de 0 a 99.` }); return; }

      // O resto pode ter partes extras: data de nascimento e/ou "goleiro"
      let nome = m[2];
      let nascimento = '';
      let posicao = 'linha';
      const partes = nome.split(/\s+[-–—|]\s+/);
      nome = partes.shift();
      for (const parte of partes) {
        const d = parte.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (d) {
          let ano = Number(d[3]);
          if (ano < 100) ano += 2000;
          nascimento = `${ano}-${String(d[2]).padStart(2, '0')}-${String(d[1]).padStart(2, '0')}`;
        } else if (/^(g|gol|goleiro|goleira)$/i.test(parte.trim())) {
          posicao = 'goleiro';
        } else {
          nome += ' - ' + parte; // não era data nem posição: faz parte do nome
        }
      }
      // "(goleiro)" ou "(G)" no fim do nome
      const g = nome.match(/\s*\((g|gol|goleiro|goleira)\)\s*$/i);
      if (g) { posicao = 'goleiro'; nome = nome.slice(0, g.index); }
      nome = nome.replace(/\s+/g, ' ').trim();
      if (!/\p{L}/u.test(nome)) { problemas.push({ linha: n, texto: linha, motivo: 'Faltou o nome.' }); return; }

      if (usados.has(numero)) {
        problemas.push({ linha: n, texto: linha, motivo: `Camisa ${numero} já é de ${usados.get(numero)} no elenco.` });
        return;
      }
      if (doTexto.has(numero)) {
        problemas.push({ linha: n, texto: linha, motivo: `Camisa ${numero} repetida (já está na linha ${doTexto.get(numero)}).` });
        return;
      }
      doTexto.set(numero, n);
      novos.push({ linha: n, numero, nome, nascimento, posicao });
    });
    return { novos, problemas };
  },

  /** Passo 1: campo para colar a lista. */
  colarElenco(time) {
    const U = App.util;
    U.modal({
      titulo: `📋 Colar elenco · ${time.nome}`,
      html: `
        <p class="suave" style="margin-top:0">Um jogador por linha, no formato <code>número - nome</code>.<br>
          Se quiser, acrescente a data de nascimento e “goleiro”: <code>1 - Pedro Souza - 15/03/2016 - goleiro</code></p>
        <label class="campo"><span>Lista de jogadores</span>
          <textarea id="txt-elenco" rows="10" placeholder="1 - Pedro Souza - goleiro&#10;7 - Lucas Lima&#10;10 - João Silva">${U.esc(this.textoElenco)}</textarea></label>`,
      aoAbrir: () => document.getElementById('txt-elenco').focus(),
      botoes: [
        { texto: 'Cancelar' },
        {
          texto: 'Conferir →', classe: 'btn-primario',
          acao: () => {
            this.textoElenco = document.getElementById('txt-elenco').value;
            if (!this.textoElenco.trim()) { U.toast('Cole a lista de jogadores.', 'erro'); return false; }
            const resultado = this.lerElenco(this.textoElenco, time);
            setTimeout(() => this.conferirElenco(time, resultado), 0);
          },
        },
      ],
    });
  },

  /** Passo 2: conferência antes de gravar. */
  conferirElenco(time, { novos, problemas }) {
    const U = App.util;
    const D = App.dados;
    const { cat } = D.categoria(time.categoriaId);
    U.modal({
      titulo: `Conferir elenco (${novos.length} jogador${novos.length === 1 ? '' : 'es'})`,
      html: `
        ${problemas.length ? `<div class="aviso-faixa vermelha">${problemas.length} linha(s) NÃO serão criadas:<br>
          ${problemas.map((p) => `<small>Linha ${p.linha}: “${U.esc(p.texto)}” — ${U.esc(p.motivo)}</small>`).join('<br>')}</div>` : ''}
        ${novos.length ? `<div class="tabela-rolagem"><table class="tabela">
          <thead><tr><th>Nº</th><th class="esq">Nome</th><th>Posição</th><th>Nasc.</th></tr></thead>
          <tbody>${novos.map((p) => {
            const alerta = App.regras.alertaIdade(p, cat);
            return `<tr><td><b>${p.numero}</b></td><td class="time-celula">${U.esc(p.nome)}${alerta ? '<br><span class="etiqueta amarela">⚠️ idade fora da categoria</span>' : ''}</td>
              <td>${p.posicao === 'goleiro' ? 'Goleiro' : 'Linha'}</td><td>${p.nascimento ? U.dataBR(p.nascimento) : '—'}</td></tr>`;
          }).join('')}</tbody></table></div>` : '<p class="vazio">Nenhum jogador para criar.</p>'}`,
      botoes: [
        { texto: '← Voltar', acao: () => { setTimeout(() => this.colarElenco(time), 0); } },
        ...(novos.length ? [{
          texto: `Criar ${novos.length} jogador${novos.length === 1 ? '' : 'es'}`,
          classe: 'btn-primario',
          acao: () => {
            novos.forEach((p) => time.jogadores.push({ id: U.id(), numero: p.numero, nome: p.nome, nascimento: p.nascimento, posicao: p.posicao }));
            time.jogadores.sort((a, b) => a.numero - b.numero);
            this.textoElenco = '';
            D.salvar(); // modo local: aparelho; modo online: nuvem (ou guarda até ter internet)
            U.toast(`${novos.length} jogador(es) adicionado(s) ao ${time.nome}!`, 'ok', 3500);
            App.render();
          },
        }] : []),
      ],
    });
  },

  /* ---------- Página do time ---------- */
  render(timeId) {
    const D = App.dados;
    const U = App.util;
    const R = App.regras;
    const time = D.time(timeId);
    if (!time) { App.ir('#/'); return; }
    const { camp, cat } = D.categoria(time.categoriaId);
    // Interclasse: o "time" é a turma naquela modalidade (nome e cor vêm da turma)
    const inter = D.ehInterclasse(camp);
    App.titulo(time.nome, `#/camp/${camp.id}/${cat.id}/${inter ? 'turmas' : 'times'}`);
    App.leitura(!App.podeEditar(camp));

    const resumo = R.resumoTime(time.id);
    const susp = R.suspensoes(cat.id);
    const est = R.estatisticas(cat.id).porJogador;
    const suspensos = R.suspensosAtuais(cat.id, susp);
    const jogos = D.jogosDaCategoria(cat.id).filter((j) => !j.bye && (j.casaId === time.id || j.foraId === time.id));
    const fone = (time.telefone || '').replace(/\D/g, '');

    App.main().innerHTML = `
      <div class="cartao">
        <div class="linha">
          ${U.escudo(time, 'grande')}
          <div class="cresce">
            <h2 style="margin:0">${U.esc(time.nome)}</h2>
            <span class="suave">${U.esc(camp.nome)} · ${U.esc(cat.nome)}</span>
          </div>
        </div>
        <p style="margin:12px 0 0">
          ${time.tecnico ? `<b>Técnico:</b> ${U.esc(time.tecnico)}<br>` : ''}
          ${time.responsavel ? `<b>Responsável:</b> ${U.esc(time.responsavel)}<br>` : ''}
          ${time.telefone ? `<b>Telefone:</b> <a href="tel:${fone}">${U.esc(time.telefone)}</a> · <a href="https://wa.me/55${fone}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
        </p>
        ${inter ? `<p class="suave">Turma <a href="#/turma/${camp.id}/${time.turmaId}">${U.esc(time.nome)}</a> em ${U.esc(cat.emoji || '')} ${U.esc(cat.nome)}. Nome e cor mudam na aba Turmas do interclasse.</p>` : `<div class="grupo-botoes so-admin">
          <button class="btn btn-pequeno" id="btn-editar-time">✏️ Editar</button>
          <button class="btn btn-pequeno btn-perigo" id="btn-apagar-time">Apagar time</button>
        </div>`}
      </div>

      <div class="cartao">
        <h2>Campanha</h2>
        <div class="tabela-rolagem"><table class="tabela">
          <thead><tr><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th></tr></thead>
          <tbody><tr><td>${resumo.j}</td><td>${resumo.v}</td><td>${resumo.e}</td><td>${resumo.d}</td><td>${resumo.gp}</td><td>${resumo.gc}</td><td>${resumo.sg}</td></tr></tbody>
        </table></div>
      </div>

      <div class="cartao">
        <div class="linha-entre"><h2>Elenco (${time.jogadores.length})</h2>
          ${inter ? `<a class="btn btn-pequeno so-admin" href="#/turma/${camp.id}/${time.turmaId}">✏️ Elenco da turma</a>` : `<button class="btn btn-pequeno so-admin" id="btn-colar-elenco">📋 Colar elenco em texto</button>`}</div>
        ${time.jogadores.length ? `<ul class="lista">
          ${time.jogadores.map((p) => {
            const alerta = R.alertaIdade(p, cat);
            const s = est[p.id] || {};
            const idade = U.idade(p.nascimento, camp.dataInicio);
            return `<li><a class="item" href="#/jogador/${p.id}">
              <span class="camisa">${U.esc(p.numero)}</span>
              <div class="cresce">
                <b>${U.esc(p.nome)}</b> ${p.posicao === 'goleiro' ? '<span class="etiqueta azul">GOL</span>' : ''}<br>
                <span class="suave">${idade !== null ? idade + ' anos' : 'sem data de nasc.'}
                  ${s.gols ? ` · ⚽ ${s.gols}` : ''}${s.amarelos ? ` · <span class="cartao-ico am"></span> ${s.amarelos}` : ''}${s.vermelhos ? ` · <span class="cartao-ico vm"></span> ${s.vermelhos}` : ''}</span>
                ${alerta ? `<br><span class="etiqueta amarela">⚠️ Idade fora da categoria</span>` : ''}
              </div>
              ${suspensos.has(p.id) ? '<span class="etiqueta vermelha">Suspenso</span>' : ''}
              <span class="suave">›</span>
            </a></li>`;
          }).join('')}
        </ul>` : '<p class="vazio">Nenhum jogador. Toque no <b>+</b> para adicionar.</p>'}
      </div>

      <div class="cartao">
        <h2>Jogos</h2>
        ${jogos.length ? jogos.map((j) => App.telas.campeonato.cartaoJogo(j, susp)).join('') : '<p class="vazio">Sem jogos na tabela.</p>'}
      </div>
      ${inter ? '' : '<button class="fab so-admin" id="fab-jog" aria-label="Novo jogador">+</button>'}`;

    // Interclasse: o elenco é da turma (editado na página da turma)
    if (!inter) document.getElementById('fab-jog').onclick = () => this.formJogador(time);
    if (!inter) document.getElementById('btn-colar-elenco').onclick = () => this.colarElenco(time);
    if (!inter) document.getElementById('btn-editar-time').onclick = () => this.formTime(camp, cat, time);
    if (!inter) document.getElementById('btn-apagar-time').onclick = async () => {
      const temJogos = jogos.some((j) => j.sumula);
      const msg = `Apagar o time ${time.nome}?` + (temJogos ? ' Ele já tem súmulas: a classificação e as estatísticas vão ficar incompletas.' : '') + ' Não dá para desfazer.';
      if (!(await U.confirmar(msg, 'Apagar', 'btn-perigo'))) return;
      D.apagarTime(time.id);
      App.ir(`#/camp/${camp.id}/${cat.id}/times`);
    };
    App.telas.campeonato.ligarCartoes(App.main());
  },

  /* ---------- Página do jogador ---------- */
  renderJogador(jogadorId) {
    const D = App.dados;
    const U = App.util;
    const R = App.regras;
    const { time, jogador } = D.jogador(jogadorId);
    if (!jogador) { App.ir('#/'); return; }
    const { camp, cat } = D.categoria(time.categoriaId);
    App.titulo(jogador.nome, `#/time/${time.id}`);
    App.leitura(!App.podeEditar(camp));

    const s = R.estatisticas(cat.id).porJogador[jogador.id] || { gols: 0, assist: 0, amarelos: 0, vermelhos: 0, golsContra: 0 };
    const susp = R.suspensoes(cat.id);
    const alerta = R.alertaIdade(jogador, cat);
    const idade = U.idade(jogador.nascimento, camp.dataInicio);
    const acumulados = susp.amarelos[jogador.id] || 0;

    // Próximo jogo em que está suspenso
    const proxSusp = D.jogosDaCategoria(cat.id).find((j) => j.status !== 'encerrado' && (susp.porJogo[j.id] || []).some((x) => x.jogadorId === jogador.id));

    // Histórico: eventos deste jogador em cada jogo
    const ICONES = { gol: '⚽ Gol', golContra: '🔄 Gol contra', falta: '✋ Falta', amarelo: '🟨 Amarelo', vermelho: '🟥 Vermelho' };
    const historico = [];
    for (const j of D.jogosDaCategoria(cat.id)) {
      if (!j.sumula) continue;
      const evs = j.sumula.eventos.filter((e) => e.jogadorId === jogador.id || e.assistenciaId === jogador.id);
      if (!evs.length) continue;
      const adv = D.time(j.casaId === time.id ? j.foraId : j.casaId);
      historico.push(`<li style="display:block">
        <a href="#/sumula/${j.id}"><b>${U.esc(j.rodadaNome)}</b> × ${U.esc(adv ? adv.nome : '?')}</a>
        <div class="suave">${evs.map((e) => e.jogadorId === jogador.id
          ? `${ICONES[e.tipo] || e.tipo} ${e.minuto}' (${e.periodo}ºP)`
          : `🅰️ Assistência ${e.minuto}'`).join(' · ')}</div></li>`);
    }

    App.main().innerHTML = `
      <div class="cartao">
        <div class="linha">
          <span class="camisa" style="width:56px;height:56px;font-size:1.5rem">${U.esc(jogador.numero)}</span>
          <div class="cresce">
            <h2 style="margin:0">${U.esc(jogador.nome)}</h2>
            <a href="#/time/${time.id}" class="suave">${U.esc(time.nome)}</a> · <span class="suave">${jogador.posicao === 'goleiro' ? 'Goleiro' : 'Linha'}</span>
          </div>
        </div>
        <p>${jogador.nascimento ? `Nascimento: ${U.dataBR(jogador.nascimento)} (${idade} anos)` : 'Sem data de nascimento'}</p>
        ${alerta ? `<div class="aviso-faixa amarela">⚠️ ${U.esc(alerta)}</div>` : ''}
        ${proxSusp ? `<div class="aviso-faixa vermelha">🚫 Suspenso no jogo ${U.esc(proxSusp.rodadaNome)} (${U.esc((susp.porJogo[proxSusp.id].find((x) => x.jogadorId === jogador.id) || {}).motivo)})</div>`
          : susp.pendentes[jogador.id] ? `<div class="aviso-faixa vermelha">🚫 Suspensão a cumprir no próximo jogo: ${U.esc(susp.pendentes[jogador.id].join(' + '))}</div>` : ''}
        <div class="grupo-botoes so-admin">
          <button class="btn btn-pequeno" id="btn-editar-jog">✏️ Editar</button>
          <button class="btn btn-pequeno btn-perigo" id="btn-apagar-jog">Apagar</button>
        </div>
      </div>

      <div class="cartao">
        <h2>Estatísticas</h2>
        <div class="tabela-rolagem"><table class="tabela">
          <thead><tr><th>Gols</th><th>Assist.</th><th>CA</th><th>CV</th><th>G. contra</th></tr></thead>
          <tbody><tr><td><b>${s.gols}</b></td><td>${s.assist}</td><td>${s.amarelos}</td><td>${s.vermelhos}</td><td>${s.golsContra}</td></tr></tbody>
        </table></div>
        <p class="suave">Amarelos acumulados para suspensão: <b>${acumulados} de ${cat.config.limiteAmarelos}</b></p>
      </div>

      <div class="cartao">
        <h2>Histórico nos jogos</h2>
        ${historico.length ? `<ul class="lista">${historico.join('')}</ul>` : '<p class="vazio">Nenhum evento registrado ainda.</p>'}
      </div>`;

    document.getElementById('btn-editar-jog').onclick = () => this.formJogador(time, jogador);
    document.getElementById('btn-apagar-jog').onclick = async () => {
      if (!(await U.confirmar(`Apagar ${jogador.nome} do elenco? Os eventos dele nas súmulas ficam sem nome.`, 'Apagar', 'btn-perigo'))) return;
      time.jogadores = time.jogadores.filter((p) => p.id !== jogador.id);
      D.salvar();
      App.ir(`#/time/${time.id}`);
    };
  },
};
