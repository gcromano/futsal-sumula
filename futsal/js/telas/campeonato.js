/* =========================================================
   TELA DO CAMPEONATO
   Escolhe a categoria (chips) e mostra abas:
   Jogos | Classificação | Times | Estatísticas | Suspensos | Config
   ========================================================= */

var App = globalThis.App = globalThis.App || {};
App.telas = App.telas || {};

App.telas.campeonato = {
  ABAS: [
    ['jogos', 'Jogos'],
    ['classificacao', 'Classificação'],
    ['times', 'Times'],
    ['estatisticas', 'Estatísticas'],
    ['suspensos', 'Suspensos'],
    ['config', 'Config.'],
  ],

  render(campId, catId, aba) {
    const D = App.dados;
    const U = App.util;
    const camp = D.campeonato(campId);
    if (!camp) { App.ir('#/'); return; }

    // Visitante (não admin) vê tudo em modo leitura e não vê a aba Config.
    const pode = App.podeEditar(camp);
    App.leitura(!pode);

    // Categoria padrão = primeira; aba padrão = jogos
    const cat = camp.categorias.find((c) => c.id === catId) || camp.categorias[0];
    aba = aba || 'jogos';
    if (aba === 'config' && !pode) aba = 'jogos';
    App.titulo(camp.nome, '#/');
    const selo = App.nuvem.ativo
      ? ` <span class="etiqueta ${camp.visibilidade === 'publico' ? 'azul' : ''}">${camp.visibilidade === 'publico' ? '🌐 Público' : '🔒 Privado'}</span>` : '';

    const datas = [U.dataBR(camp.dataInicio), U.dataBR(camp.dataFim)].filter(Boolean).join(' a ');
    let html = `
      <div class="linha-entre" style="margin-bottom:10px">
        <div class="cresce suave">${U.esc(camp.local || '')}${camp.local && datas ? ' · ' : ''}${datas}${selo}</div>
        <button class="btn btn-pequeno so-admin" id="btn-editar-camp">✏️ Editar</button>
      </div>
      <div class="chips">
        ${camp.categorias.map((c) => `<a class="chip ${cat && c.id === cat.id ? 'ativo' : ''}" href="#/camp/${camp.id}/${c.id}/${aba}">${U.esc(c.nome)}</a>`).join('')}
        <button class="chip so-admin" id="btn-nova-cat">+ Categoria</button>
      </div>`;

    if (!cat) {
      html += `<div class="cartao vazio">${pode ? 'Crie uma categoria (ex.: Sub-9) para começar.' : 'Este campeonato ainda não tem categorias.'}</div>`;
      App.main().innerHTML = html;
      this.ligarTopo(camp);
      return;
    }

    html += `<nav class="abas">
      ${this.ABAS.filter(([id]) => pode || id !== 'config').map(([id, nome]) => `<a class="aba ${aba === id ? 'ativo' : ''}" href="#/camp/${camp.id}/${cat.id}/${id}">${nome}</a>`).join('')}
    </nav><div id="conteudo-aba"></div>`;
    App.main().innerHTML = html;
    this.ligarTopo(camp);

    const area = document.getElementById('conteudo-aba');
    const desenhar = {
      jogos: () => this.abaJogos(area, camp, cat),
      classificacao: () => this.abaClassificacao(area, camp, cat),
      times: () => this.abaTimes(area, camp, cat),
      estatisticas: () => this.abaEstatisticas(area, camp, cat),
      suspensos: () => this.abaSuspensos(area, camp, cat),
      config: () => this.abaConfig(area, camp, cat),
    }[aba] || (() => this.abaJogos(area, camp, cat));
    desenhar();
  },

  /** Botões do topo: editar campeonato e nova categoria. */
  ligarTopo(camp) {
    const D = App.dados;
    const U = App.util;
    document.getElementById('btn-editar-camp').onclick = () => App.telas.inicio.formCampeonato(camp);
    document.getElementById('btn-nova-cat').onclick = () => {
      U.modal({
        titulo: 'Nova categoria',
        html: `<label class="campo"><span>Nome</span><input id="nome-cat" placeholder="Ex.: Sub-13"></label>`,
        aoAbrir: () => document.getElementById('nome-cat').focus(),
        botoes: [
          { texto: 'Cancelar' },
          {
            texto: 'Criar', classe: 'btn-primario',
            acao: () => {
              const nome = document.getElementById('nome-cat').value.trim();
              if (!nome) return false;
              const ano = camp.dataInicio ? Number(camp.dataInicio.slice(0, 4)) : new Date().getFullYear();
              const cat = { id: U.id(), nome, config: D.configPadrao(nome, ano), grupos: [] };
              camp.categorias.push(cat);
              D.salvar();
              App.ir(`#/camp/${camp.id}/${cat.id}/times`);
            },
          },
        ],
      });
    };
  },

  /* =======================================================
     ABA JOGOS
     A tabela pode ser gerada automaticamente, montada na mão,
     colada em texto — ou tudo isso misturado.
     ======================================================= */
  abaJogos(area, camp, cat) {
    const D = App.dados;
    const U = App.util;
    const J = App.telas.jogos;
    const jogos = D.jogosDaCategoria(cat.id);
    const qtdTimes = D.timesDaCategoria(cat.id).length;

    if (!jogos.length && !App.podeEditar(camp)) {
      area.innerHTML = '<div class="cartao vazio">A tabela de jogos ainda não foi publicada.</div>';
      return;
    }
    if (!jogos.length) {
      area.innerHTML = `
        <div class="cartao">
          <h2>Como quer criar a tabela?</h2>
          <p class="suave">${qtdTimes} time(s) cadastrado(s) nesta categoria.</p>
          <div style="display:grid;gap:6px">
            <button class="btn btn-primario" id="btn-gerar">⚙️ Gerar automaticamente</button>
            <p class="suave" style="margin:0 0 8px">Formato atual: <b>${D.NOMES_FORMATO[cat.config.formato]}</b> (muda na aba Config.)</p>
            <button class="btn" id="btn-manual">✍️ Montar manualmente</button>
            <p class="suave" style="margin:0 0 8px">Adicione os jogos um por um, como já estão na tabela do campeonato.</p>
            <button class="btn" id="btn-colar">📋 Colar tabela em texto</button>
            <p class="suave" style="margin:0">Cole várias linhas de uma vez: “Time A x Time B - 02/11 09:00 - Quadra 1”.</p>
          </div>
        </div>`;
      document.getElementById('btn-gerar').onclick = () => this.gerarTabela(camp, cat);
      document.getElementById('btn-manual').onclick = () => J.formJogo(null, cat.id);
      document.getElementById('btn-colar').onclick = () => J.importar(cat);
      return;
    }

    // Separa em blocos por rodada/fase, na ordem
    const blocos = [];
    for (const j of jogos) {
      const chave = j.fase === 'mata' ? j.rodadaNome : `Rodada ${j.rodada}`;
      let b = blocos.find((x) => x.chave === chave);
      if (!b) { b = { chave, jogos: [] }; blocos.push(b); }
      b.jogos.push(j);
    }

    const susp = App.regras.suspensoes(cat.id);
    const org = J.organizando;
    area.innerHTML = `
      <div class="grupo-botoes so-admin">
        <button class="btn btn-primario" id="btn-add">+ Adicionar jogo</button>
        <button class="btn ${org ? 'btn-aviso' : ''}" id="btn-org">${org ? '✓ Concluir' : '↕️ Organizar'}</button>
      </div>
      ${org ? '<div class="aviso-faixa amarela">Modo organizar: use ↑ ↓ para trocar a ordem (o jogo que sobe pega o horário do outro) e 🗑️ para excluir. Toque em ✏️ para editar times, rodada, data e quadra.</div>' : ''}
      ${blocos.map((b) => `
        <h3 class="titulo-rodada">${U.esc(b.chave)}</h3>
        ${b.jogos.map((j) => this.cartaoJogo(j, susp, { organizando: org })).join('')}
      `).join('')}
      <div class="grupo-botoes" style="margin-top:16px">
        <button class="btn so-admin" id="btn-colar">📋 Colar tabela em texto</button>
        <button class="btn so-admin" id="btn-gerar">⚙️ Gerar automaticamente</button>
        <a class="btn" href="#/imprimir/tabela/${cat.id}">🖨️ Imprimir tabela</a>
      </div>`;

    document.getElementById('btn-add').onclick = () => J.formJogo(null, cat.id);
    document.getElementById('btn-org').onclick = () => { J.organizando = !J.organizando; App.render(); };
    document.getElementById('btn-colar').onclick = () => J.importar(cat);
    document.getElementById('btn-gerar').onclick = () => this.gerarTabela(camp, cat);
    this.ligarCartoes(area);
  },

  /** Liga os botões dos cartões de jogo (editar, subir, descer, excluir). */
  ligarCartoes(area) {
    const D = App.dados;
    const J = App.telas.jogos;
    area.querySelectorAll('[data-editar-jogo]').forEach((b) => { b.onclick = () => J.formJogo(D.jogo(b.dataset.editarJogo)); });
    area.querySelectorAll('[data-subir]').forEach((b) => { b.onclick = () => J.mover(D.jogo(b.dataset.subir), -1); });
    area.querySelectorAll('[data-descer]').forEach((b) => { b.onclick = () => J.mover(D.jogo(b.dataset.descer), 1); });
    area.querySelectorAll('[data-excluir-jogo]').forEach((b) => { b.onclick = () => J.excluir(D.jogo(b.dataset.excluirJogo)); });
    area.querySelectorAll('[data-rapido]').forEach((b) => { b.onclick = () => J.resultadoRapido(D.jogo(b.dataset.rapido)); });
  },

  /** HTML de um jogo na lista (usado também na página do time). */
  cartaoJogo(j, susp, opcoes = {}) {
    const D = App.dados;
    const U = App.util;
    const R = App.regras;
    const casa = D.time(j.casaId);
    const fora = D.time(j.foraId);
    const travado = j.status === 'encerrado';

    // Barra do modo "Organizar"
    const barraOrg = opcoes.organizando ? `
      <div class="linha" style="margin-top:8px;justify-content:flex-end">
        ${travado ? '<span class="suave cresce">🔒 Súmula encerrada</span>' : `
        <button class="btn btn-pequeno btn-icone" data-subir="${j.id}" aria-label="Subir">↑</button>
        <button class="btn btn-pequeno btn-icone" data-descer="${j.id}" aria-label="Descer">↓</button>
        <button class="btn btn-pequeno btn-icone" data-excluir-jogo="${j.id}" aria-label="Excluir">🗑️</button>`}
      </div>` : '';

    if (j.bye) {
      const nome = casa ? casa.nome : R.textoOrigem(j.origemCasa, j.categoriaId);
      return `<div class="jogo"><div class="jogo-info"><span>${U.esc(j.rodadaNome)}</span>
        <button class="btn btn-pequeno btn-icone so-admin" data-editar-jogo="${j.id}" aria-label="Editar jogo" style="min-height:30px;padding:2px 8px">✏️</button></div>
        <div class="linha">${U.escudo(casa)} <b>${U.esc(nome)}</b> <span class="suave">passa direto (sem adversário)</span></div>${barraOrg}</div>`;
    }

    const grupo = j.grupoId ? ((D.categoria(j.categoriaId).cat || {}).grupos || []).find((g) => g.id === j.grupoId) : null;
    const info = [`Jogo ${R.numeroJogo(j)}`, grupo && grupo.nome, j.data && U.dataCurta(j.data), j.hora, j.quadra].filter(Boolean).join(' · ');
    const status = travado ? `<span class="etiqueta verde">${j.placarRapido ? '⚡ Resultado' : 'Encerrado'}</span>`
      : j.status === 'andamento' ? '<span class="etiqueta vermelha">● Ao vivo</span>' : '';

    let centro = '<span class="suave">×</span>';
    if (j.status !== 'agendado') {
      const p = R.placar(j);
      const pen = R.temPenaltis(j) ? R.placarPenaltis(j) : null;
      centro = `${p.casa} × ${p.fora}${pen ? `<small>pên. ${pen.casa}×${pen.fora}</small>` : ''}`;
    }
    const nomeCasa = casa ? casa.nome : R.textoOrigem(j.origemCasa, j.categoriaId);
    const nomeFora = fora ? fora.nome : R.textoOrigem(j.origemFora, j.categoriaId);
    const qtdSusp = susp && !travado ? (susp.porJogo[j.id] || []).length : 0;

    return `
      <div class="jogo" data-href="#/sumula/${j.id}" style="cursor:pointer">
        <div class="jogo-info">
          <span>${U.esc(info)}${j.data ? '' : ' · <i>sem data</i>'} ${status} ${qtdSusp ? `<span class="etiqueta amarela">${qtdSusp} suspenso(s)</span>` : ''}</span>
          ${travado ? '' : `<span class="so-admin" style="display:flex;gap:4px">
            ${casa && fora ? `<button class="btn btn-pequeno btn-icone" data-rapido="${j.id}" aria-label="Lançar só o placar" title="Resultado rápido" style="min-height:30px;padding:2px 8px">⚡</button>` : ''}
            <button class="btn btn-pequeno btn-icone" data-editar-jogo="${j.id}" aria-label="Editar jogo" style="min-height:30px;padding:2px 8px">✏️</button></span>`}
        </div>
        <div class="jogo-times">
          <div class="jogo-time">${U.escudo(casa)}<span class="nome">${U.esc(nomeCasa)}</span></div>
          <div class="jogo-placar">${centro}</div>
          <div class="jogo-time fora">${U.escudo(fora)}<span class="nome">${U.esc(nomeFora)}</span></div>
        </div>
        ${barraOrg}
      </div>`;
  },

  /** Editar um jogo (atalho; o formulário fica em telas/jogos.js). */
  formJogo(jogo) {
    App.telas.jogos.formJogo(jogo);
  },

  /** Pergunta e gera a tabela de jogos automaticamente. */
  gerarTabela(camp, cat) {
    const D = App.dados;
    const U = App.util;
    const times = D.timesDaCategoria(cat.id);
    if (times.length < 2) { U.toast('Cadastre pelo menos 2 times na aba Times.', 'erro'); return; }
    const existentes = D.jogosDaCategoria(cat.id).filter((j) => !j.bye);
    const comSumula = existentes.filter((j) => j.sumula && j.sumula.eventos.length).length;
    const cfg = cat.config;
    let detalhe = '';
    if (cfg.formato === 'pontos') detalhe = `Todos contra todos${cfg.idaEVolta ? ', ida e volta' : ''}.`;
    if (cfg.formato === 'grupos') detalhe = `${cfg.numGrupos} grupos, passam ${cfg.classificadosPorGrupo} de cada para o mata-mata.`;
    if (cfg.formato === 'mata') detalhe = 'Eliminatória simples. Se o número de times não fechar a chave, alguns passam direto.';

    U.modal({
      titulo: 'Gerar automaticamente',
      html: `
        <p><b>${D.NOMES_FORMATO[cfg.formato]}</b> com ${times.length} times. ${detalhe}</p>
        <label class="check"><input type="checkbox" id="chk-sortear" checked> Sortear a ordem dos times${cfg.formato === 'grupos' ? ' (sorteio dos grupos)' : ''}</label>
        <p class="suave">Depois de gerar, você pode editar, trocar, reordenar ou excluir qualquer jogo na mão.</p>
        ${existentes.length ? `<div class="aviso-faixa ${comSumula ? 'vermelha' : 'amarela'}">Atenção: os ${existentes.length} jogo(s) atuais desta categoria serão SUBSTITUÍDOS${comSumula ? `, inclusive ${comSumula} com súmula` : ''}.</div>` : ''}`,
      botoes: [
        { texto: 'Cancelar' },
        {
          texto: 'Gerar', classe: existentes.length ? 'btn-perigo' : 'btn-primario',
          acao: () => {
            try {
              App.tabela.gerar(cat.id, { sortear: document.getElementById('chk-sortear').checked });
              U.toast('Tabela gerada!', 'ok');
              App.ir(`#/camp/${camp.id}/${cat.id}/jogos`);
            } catch (e) {
              U.toast(e.message, 'erro');
            }
          },
        },
      ],
    });
  },

  /* =======================================================
     ABA CLASSIFICAÇÃO
     Montada a partir dos jogos que existem (gerados ou manuais):
     tabela geral, tabelas por grupo e chave do mata-mata.
     ======================================================= */
  abaClassificacao(area, camp, cat) {
    const R = App.regras;
    const cfg = cat.config;
    const est = R.estruturaClassificacao(cat);
    let html = `<div class="grupo-botoes"><a class="btn" href="#/imprimir/classificacao/${cat.id}">🖨️ Imprimir classificação</a></div>`;

    if (est.geral) {
      html += `<div class="cartao"><h2>Classificação</h2>${this.tabelaClassificacao(R.classificacao(cat.id), 0)}</div>`;
    }
    if (est.grupos.length) {
      html += `<div class="grade-cartoes">` + est.grupos.map((g) => `
        <div class="cartao"><h2>${App.util.esc(g.nome)}</h2>${this.tabelaClassificacao(R.classificacao(cat.id, g.id), est.mata ? cfg.classificadosPorGrupo : 0)}</div>
      `).join('') + `</div>`;
    }
    if (est.mata) {
      html += `<div class="cartao"><h2>Mata-mata</h2>${this.chaveMataMata(cat.id)}</div>`;
    }
    html += `<p class="suave">Critérios de desempate: ${cfg.desempate.map((c) => App.dados.NOMES_DESEMPATE[c]).join(' → ')}</p>`;
    area.innerHTML = html;
  },

  /** Tabela de classificação. "destaque" = quantos primeiros ficam marcados (classificados). */
  tabelaClassificacao(linhas, destaque) {
    const U = App.util;
    const D = App.dados;
    if (!linhas.length) return '<p class="vazio">Sem times.</p>';
    return `<div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>#</th><th class="esq">Time</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th></tr></thead>
      <tbody>
        ${linhas.map((l) => {
          const t = D.time(l.timeId);
          return `<tr class="${l.pos <= destaque ? 'classifica' : ''}">
            <td>${l.pos}</td>
            <td class="time-celula"><a href="#/time/${t.id}" class="time-mini">${U.escudo(t)} ${U.esc(t.nome)}</a></td>
            <td><b>${l.pts}</b></td><td>${l.j}</td><td>${l.v}</td><td>${l.e}</td><td>${l.d}</td>
            <td>${l.gp}</td><td>${l.gc}</td><td>${l.sg > 0 ? '+' : ''}${l.sg}</td>
          </tr>`;
        }).join('')}
      </tbody></table></div>`;
  },

  /** Desenho do chaveamento (colunas por fase). */
  chaveMataMata(catId) {
    const D = App.dados;
    const R = App.regras;
    const U = App.util;
    const jogos = D.jogosDaCategoria(catId).filter((j) => j.fase === 'mata').sort((a, b) => a.ordem - b.ordem);
    if (!jogos.length) return '<p class="vazio">Sem jogos de mata-mata.</p>';

    const fases = [];
    for (const j of jogos) {
      const nome = j.rodadaNome;
      let f = fases.find((x) => x.nome === nome);
      if (!f) { f = { nome, jogos: [] }; fases.push(f); }
      f.jogos.push(j);
    }
    const linhaTime = (j, lado) => {
      const id = lado === 'casa' ? j.casaId : j.foraId;
      const t = D.time(id);
      const nome = t ? t.nome : (j.bye && lado === 'fora' ? '—' : R.textoOrigem(lado === 'casa' ? j.origemCasa : j.origemFora, catId));
      let gols = '';
      if (j.status !== 'agendado' && !j.bye) {
        const p = R.placar(j);
        const pen = R.temPenaltis(j) ? R.placarPenaltis(j) : null;
        gols = (lado === 'casa' ? p.casa : p.fora) + (pen ? ` (${lado === 'casa' ? pen.casa : pen.fora})` : '');
      }
      const venceu = id && R.vencedor(j) === id;
      return `<div class="${venceu ? 'venceu' : ''}"><span>${t ? U.nomeTime(t) : U.esc(nome)}</span><span>${gols}</span></div>`;
    };
    return `<div class="chave">${fases.map((f) => `
      <div class="chave-coluna">
        <h4>${U.esc(f.nome)}</h4>
        ${f.jogos.map((j) => `<a class="chave-jogo" href="${j.bye ? 'javascript:void 0' : '#/sumula/' + j.id}">${linhaTime(j, 'casa')}${linhaTime(j, 'fora')}</a>`).join('')}
      </div>`).join('')}</div>`;
  },

  /* =======================================================
     ABA TIMES
     ======================================================= */
  abaTimes(area, camp, cat) {
    const D = App.dados;
    const U = App.util;
    const R = App.regras;
    const times = D.timesDaCategoria(cat.id);
    const suspensos = R.suspensosAtuais(cat.id);

    area.innerHTML = times.length ? `
      <div class="cartao"><ul class="lista">
        ${times.map((t) => {
          const alertas = t.jogadores.filter((p) => R.alertaIdade(p, cat)).length;
          const qtdSusp = t.jogadores.filter((p) => suspensos.has(p.id)).length;
          return `<li><a class="item" href="#/time/${t.id}">
            ${U.escudo(t)}
            <div class="cresce">
              <b>${U.esc(t.nome)}</b><br>
              <span class="suave">${t.jogadores.length} jogador(es)${t.tecnico ? ' · Téc. ' + U.esc(t.tecnico) : ''}</span>
            </div>
            ${alertas ? `<span class="etiqueta amarela" title="Idade fora da categoria">⚠️ ${alertas}</span>` : ''}
            ${qtdSusp ? `<span class="etiqueta vermelha">${qtdSusp} susp.</span>` : ''}
            <span class="suave">›</span>
          </a></li>`;
        }).join('')}
      </ul></div>` : `<div class="cartao vazio">Nenhum time nesta categoria. Toque no <b>+</b> para cadastrar.</div>`;

    area.insertAdjacentHTML('beforeend', '<button class="fab so-admin" id="fab-time" aria-label="Novo time">+</button>');
    document.getElementById('fab-time').onclick = () => App.telas.time.formTime(camp, cat);
  },

  /* =======================================================
     ABA ESTATÍSTICAS
     ======================================================= */
  abaEstatisticas(area, camp, cat) {
    const U = App.util;
    const est = App.regras.estatisticas(cat.id);
    const nomeJog = (x) => `<a href="#/jogador/${x.jogadorId}">${U.esc(x.jogador.nome)}</a> <span class="suave">${U.nomeTime(x.time)}</span>`;
    const tabela = (titulo, colunas, linhas) => `
      <div class="cartao"><h2>${titulo}</h2>
        ${linhas.length ? `<div class="tabela-rolagem"><table class="tabela">
          <thead><tr><th>#</th>${colunas.map((c, i) => `<th class="${i === 0 ? 'esq' : ''}">${c}</th>`).join('')}</tr></thead>
          <tbody>${linhas.map((l, i) => `<tr><td>${i + 1}</td>${l.map((v, k) => `<td class="${k === 0 ? 'time-celula' : ''}">${v}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>` : '<p class="vazio">Nada ainda. Os números aparecem quando as súmulas são encerradas.</p>'}
      </div>`;

    area.innerHTML = `
      <div class="grupo-botoes"><a class="btn" href="#/imprimir/artilharia/${cat.id}">🖨️ Imprimir artilharia</a></div>
      <div class="grade-cartoes">
        ${tabela('⚽ Artilharia', ['Jogador', 'Gols'], est.artilharia.map((x) => [nomeJog(x), `<b>${x.gols}</b>`]))}
        ${tabela('🅰️ Assistências', ['Jogador', 'Assist.'], est.assistencias.map((x) => [nomeJog(x), `<b>${x.assist}</b>`]))}
        ${tabela('🧤 Goleiro menos vazado', ['Goleiro', 'J', 'GS', 'Média'], est.goleiros.map((x) => [nomeJog(x), x.jogos, x.sofridos, x.media.toFixed(2)]))}
        ${tabela('🟨 Disciplina (menos cartões primeiro)', ['Time', 'Faltas', 'CA', 'CV', 'Pontos'], est.disciplina.map((x) => [
          `<a href="#/time/${x.time.id}" class="time-mini">${U.escudo(x.time)} ${U.esc(x.time.nome)}</a>`, x.faltas, x.amarelos, x.vermelhos, `<b>${x.pontos}</b>`]))}
      </div>
      <p class="suave">Disciplina: amarelo = 1 ponto, vermelho = 3 pontos. Goleiro: média de gols sofridos por jogo como titular.</p>`;
  },

  /* =======================================================
     ABA SUSPENSOS
     ======================================================= */
  abaSuspensos(area, camp, cat) {
    const D = App.dados;
    const U = App.util;
    const R = App.regras;
    const susp = R.suspensoes(cat.id);
    const jogos = D.jogosDaCategoria(cat.id);
    const limite = cat.config.limiteAmarelos;

    const linhaJog = (s) => {
      const { time, jogador } = D.jogador(s.jogadorId);
      if (!jogador) return '';
      return `<li><span class="camisa">${U.esc(jogador.numero)}</span>
        <div class="cresce"><a href="#/jogador/${jogador.id}"><b>${U.esc(jogador.nome)}</b></a> <span class="suave">${U.nomeTime(time)}</span><br>
        <span class="suave">${U.esc(s.motivo)}</span></div></li>`;
    };
    const tituloJogo = (j) => `${U.esc(j.rodadaNome)}: ${U.esc((D.time(j.casaId) || {}).nome)} × ${U.esc((D.time(j.foraId) || {}).nome)}${j.data ? ' · ' + U.dataCurta(j.data) : ''}`;

    // Próximos jogos (ainda não encerrados) com suspensos
    const proximos = jogos.filter((j) => j.status !== 'encerrado' && (susp.porJogo[j.id] || []).length);
    // Histórico: jogos encerrados agrupados por rodada
    const historico = {};
    jogos.filter((j) => j.status === 'encerrado' && (susp.porJogo[j.id] || []).length).forEach((j) => {
      const chave = j.fase === 'mata' ? j.rodadaNome : `Rodada ${j.rodada}`;
      (historico[chave] = historico[chave] || []).push(j);
    });
    // Pendentes sem jogo definido ainda
    const pendentes = Object.entries(susp.pendentes);
    // Amarelos pendurados
    const pendurados = Object.entries(susp.amarelos).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);

    area.innerHTML = `
      <div class="cartao"><h2>🚫 Suspensos nos próximos jogos</h2>
        ${proximos.length ? proximos.map((j) => `<h3 class="suave" style="margin:10px 0 0">${tituloJogo(j)}</h3><ul class="lista">${susp.porJogo[j.id].map(linhaJog).join('')}</ul>`).join('')
          : '<p class="vazio">Nenhum jogador suspenso para os próximos jogos.</p>'}
      </div>
      ${pendentes.length ? `<div class="cartao"><h2>⏳ Suspensões aguardando jogo</h2><ul class="lista">
        ${pendentes.map(([id, motivos]) => linhaJog({ jogadorId: id, motivo: motivos.join(' + ') })).join('')}</ul></div>` : ''}
      <div class="cartao"><h2>🟨 Amarelos acumulados (limite ${limite})</h2>
        ${pendurados.length ? `<ul class="lista">${pendurados.map(([id, n]) => linhaJog({ jogadorId: id, motivo: `${n} de ${limite} amarelos${n === limite - 1 ? ' — PENDURADO' : ''}` })).join('')}</ul>` : '<p class="vazio">Ninguém com amarelos acumulados.</p>'}
      </div>
      <div class="cartao"><h2>📋 Suspensões cumpridas por rodada</h2>
        ${Object.keys(historico).length ? Object.entries(historico).map(([rod, js]) => `
          <h3 style="margin:12px 0 0">${U.esc(rod)}</h3>
          ${js.map((j) => `<p class="suave" style="margin:6px 0 0">${tituloJogo(j)}</p><ul class="lista">${susp.porJogo[j.id].map(linhaJog).join('')}</ul>`).join('')}
        `).join('') : '<p class="vazio">Nenhuma suspensão cumprida ainda.</p>'}
      </div>`;
  },

  /* =======================================================
     ABA CONFIGURAÇÕES DA CATEGORIA
     ======================================================= */
  /** Cartão do campeonato na aba Config.: visibilidade, alerta de idade, admins e histórico. */
  htmlConfigCampeonato(camp) {
    const U = App.util;
    const N = App.nuvem;
    const admins = camp.admins || [];
    return `
      <div class="cartao">
        <h2>Campeonato</h2>
        ${N.ativo ? `<p><b>Visibilidade:</b> ${camp.visibilidade === 'publico'
          ? '🌐 Público — qualquer pessoa vê tabela, resultados e estatísticas (sem dados pessoais).'
          : '🔒 Privado — só os admins abaixo veem.'}</p>` : ''}
        <p><b>Alerta de idade:</b> ${camp.alertaIdade === false ? 'desligado' : 'ligado'}</p>
        <button class="btn btn-pequeno" id="btn-cfg-camp">✏️ Mudar nome, datas, visibilidade e alerta</button>
      </div>
      ${N.ativo ? `
      <div class="cartao">
        <h2>👥 Admins deste campeonato</h2>
        <p class="suave">Só estes e-mails (contas Google) podem ver${camp.visibilidade === 'publico' ? ' as configurações' : ''} e editar este campeonato.</p>
        <ul class="lista">
          ${admins.map((e) => `<li><span class="cresce">${U.esc(e)}${N.usuario && e === N.usuario.email.toLowerCase() ? ' <span class="etiqueta verde">você</span>' : ''}
            ${e === camp.criadoPor ? ' <span class="etiqueta">criador</span>' : ''}</span>
            ${admins.length > 1 ? `<button class="btn btn-pequeno" data-remover-admin="${U.esc(e)}">Remover</button>` : ''}</li>`).join('')}
        </ul>
        <form id="form-admin" class="linha" style="margin-top:8px">
          <input type="email" id="novo-admin" placeholder="email@gmail.com" class="cresce" style="flex:1;min-width:180px" autocomplete="off">
          <button class="btn btn-primario" type="submit">+ Adicionar admin</button>
        </form>
      </div>
      <div class="cartao">
        <h2>🕘 Últimas alterações</h2>
        <div id="historico"><button class="btn btn-pequeno" id="btn-historico">Ver quem alterou o quê</button></div>
      </div>` : ''}`;
  },

  ligarConfigCampeonato(camp) {
    const U = App.util;
    const N = App.nuvem;
    document.getElementById('btn-cfg-camp').onclick = () => App.telas.inicio.formCampeonato(camp);
    if (!N.ativo) return;

    document.getElementById('form-admin').onsubmit = (e) => {
      e.preventDefault();
      const email = document.getElementById('novo-admin').value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { U.toast('Digite um e-mail válido.', 'erro'); return; }
      if ((camp.admins || []).includes(email)) { U.toast('Este e-mail já é admin.', 'aviso'); return; }
      camp.admins = [...(camp.admins || []), email];
      App.dados.salvar();
      U.toast(`${email} agora é admin. Ele entra com essa conta Google e o campeonato aparece na lista.`, 'ok', 5000);
      App.render();
    };

    App.main().querySelectorAll('[data-remover-admin]').forEach((b) => {
      b.onclick = async () => {
        const email = b.dataset.removerAdmin;
        const souEu = N.usuario && email === N.usuario.email.toLowerCase();
        const msg = souEu
          ? 'Remover VOCÊ dos admins? Você perde o acesso a este campeonato na hora.'
          : `Remover ${email} dos admins deste campeonato?`;
        if (!(await U.confirmar(msg, 'Remover', 'btn-perigo'))) return;
        camp.admins = camp.admins.filter((e) => e !== email);
        App.dados.salvar();
        if (souEu) App.ir('#/'); else App.render();
      };
    });

    document.getElementById('btn-historico').onclick = async () => {
      const area = document.getElementById('historico');
      area.innerHTML = '<p class="suave">Carregando…</p>';
      try {
        const itens = await N.historico(camp.id);
        area.innerHTML = itens.length ? `<ul class="lista">${itens.map((h) => `
          <li style="display:block"><b>${U.esc(h.quem)}</b> <span class="suave">· ${h.quando ? h.quando.toDate().toLocaleString('pt-BR') : 'agora'}</span><br>
          <small>${U.esc(h.resumo)}</small></li>`).join('')}</ul>` : '<p class="vazio">Nenhuma alteração registrada ainda.</p>';
      } catch (e) {
        area.innerHTML = `<p class="suave">Não foi possível carregar (${U.esc(e.code || e.message)}). Precisa de internet.</p>`;
      }
    };
  },

  abaConfig(area, camp, cat) {
    const D = App.dados;
    const U = App.util;
    const c = cat.config;
    // Cópia da ordem de desempate, para reordenar antes de salvar
    let ordem = c.desempate.slice();
    Object.keys(D.NOMES_DESEMPATE).forEach((k) => { if (!ordem.includes(k)) ordem.push(k); });
    let ativos = new Set(c.desempate);

    const opt = (valor, texto, atual) => `<option value="${valor}" ${String(atual) === String(valor) ? 'selected' : ''}>${texto}</option>`;

    area.innerHTML = this.htmlConfigCampeonato(camp) + `
      <form id="form-config">
        <div class="cartao">
          <h2>Categoria</h2>
          <label class="campo"><span>Nome</span><input name="nome" value="${U.esc(cat.nome)}"></label>
          <label class="campo"><span>Nascidos a partir do ano (para alerta de idade)</span>
            <input type="number" name="anoMinimo" value="${c.anoMinimo ?? ''}" placeholder="Ex.: 2016"></label>
        </div>

        <div class="cartao">
          <h2>Formato</h2>
          <label class="campo"><span>Formato da disputa</span>
            <select name="formato" id="sel-formato">
              ${Object.entries(D.NOMES_FORMATO).map(([k, v]) => opt(k, v, c.formato)).join('')}
            </select></label>
          <label class="check"><input type="checkbox" name="idaEVolta" ${c.idaEVolta ? 'checked' : ''}> Turno e returno (ida e volta)</label>
          <div id="campos-grupos" class="campos-2">
            <label class="campo"><span>Nº de grupos</span><input type="number" min="1" max="8" name="numGrupos" value="${c.numGrupos}"></label>
            <label class="campo"><span>Classificados por grupo</span><input type="number" min="1" max="8" name="classificadosPorGrupo" value="${c.classificadosPorGrupo}"></label>
          </div>
          <label class="check" id="campo-terceiro"><input type="checkbox" name="terceiroLugar" ${c.terceiroLugar ? 'checked' : ''}> Disputa de 3º lugar</label>
          <p class="suave">Mudou o formato? Depois de salvar, use “Refazer tabela” na aba Jogos.</p>
        </div>

        <div class="cartao">
          <h2>Tempo de jogo</h2>
          <div class="campos-2">
            <label class="campo"><span>Minutos por período</span><input type="number" min="1" name="duracaoPeriodo" value="${c.duracaoPeriodo}"></label>
            <label class="campo"><span>Nº de períodos</span><input type="number" min="1" max="4" name="numPeriodos" value="${c.numPeriodos}"></label>
          </div>
        </div>

        <div class="cartao">
          <h2>Pontuação</h2>
          <div class="campos-3">
            <label class="campo"><span>Vitória</span><input type="number" name="pontosVitoria" value="${c.pontosVitoria}"></label>
            <label class="campo"><span>Empate</span><input type="number" name="pontosEmpate" value="${c.pontosEmpate}"></label>
            <label class="campo"><span>Derrota</span><input type="number" name="pontosDerrota" value="${c.pontosDerrota}"></label>
          </div>
        </div>

        <div class="cartao">
          <h2>Disciplina</h2>
          <div class="campos-2">
            <label class="campo"><span>Amarelos para suspensão</span><input type="number" min="1" name="limiteAmarelos" value="${c.limiteAmarelos}"></label>
            <label class="campo"><span>Limite de faltas (aviso)</span><input type="number" min="1" name="limiteFaltas" value="${c.limiteFaltas}"></label>
          </div>
        </div>

        <div class="cartao">
          <h2>Critérios de desempate</h2>
          <p class="suave">Use as setas para mudar a ordem. Desmarque para não usar.</p>
          <ul class="lista" id="lista-desempate"></ul>
          <button type="button" class="btn btn-pequeno" id="btn-sorteio">🎲 Refazer sorteio entre os times</button>
        </div>

        <div class="grupo-botoes">
          <button type="submit" class="btn btn-primario">💾 Salvar configurações</button>
        </div>
      </form>
      <div class="cartao">
        <h2>Zona de perigo</h2>
        <div class="grupo-botoes">
          <button class="btn btn-perigo" id="btn-apagar-cat">Apagar categoria ${U.esc(cat.nome)}</button>
          <button class="btn btn-perigo" id="btn-apagar-camp">Apagar campeonato inteiro</button>
        </div>
      </div>`;

    // Mostra/esconde campos conforme o formato
    const sel = document.getElementById('sel-formato');
    const atualizarCampos = () => {
      document.getElementById('campos-grupos').classList.toggle('oculto', sel.value !== 'grupos');
      document.getElementById('campo-terceiro').classList.toggle('oculto', sel.value === 'pontos');
    };
    sel.onchange = atualizarCampos;
    atualizarCampos();

    // Lista de desempate com setas
    const lista = document.getElementById('lista-desempate');
    const desenharLista = () => {
      lista.innerHTML = ordem.map((k, i) => `
        <li>
          <input type="checkbox" data-crit="${k}" ${ativos.has(k) ? 'checked' : ''}>
          <span class="cresce"><b>${i + 1}.</b> ${D.NOMES_DESEMPATE[k]}</span>
          <button type="button" class="btn btn-pequeno btn-icone" data-sobe="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="btn btn-pequeno btn-icone" data-desce="${i}" ${i === ordem.length - 1 ? 'disabled' : ''}>↓</button>
        </li>`).join('');
    };
    desenharLista();
    lista.onclick = (e) => {
      const sobe = e.target.closest('[data-sobe]');
      const desce = e.target.closest('[data-desce]');
      if (sobe) { const i = +sobe.dataset.sobe; [ordem[i - 1], ordem[i]] = [ordem[i], ordem[i - 1]]; desenharLista(); }
      if (desce) { const i = +desce.dataset.desce; [ordem[i + 1], ordem[i]] = [ordem[i], ordem[i + 1]]; desenharLista(); }
    };
    lista.onchange = (e) => {
      const k = e.target.dataset.crit;
      if (!k) return;
      if (e.target.checked) ativos.add(k); else ativos.delete(k);
    };

    document.getElementById('btn-sorteio').onclick = () => {
      D.timesDaCategoria(cat.id).forEach((t) => { t.sorteio = Math.random(); });
      D.salvar();
      U.toast('Sorteio refeito.', 'ok');
    };

    document.getElementById('form-config').onsubmit = (e) => {
      e.preventDefault();
      const f = U.lerForm(e.target);
      cat.nome = f.nome || cat.nome;
      const numeros = ['numGrupos', 'classificadosPorGrupo', 'duracaoPeriodo', 'numPeriodos', 'pontosVitoria', 'pontosEmpate', 'pontosDerrota', 'limiteAmarelos', 'limiteFaltas'];
      numeros.forEach((k) => { if (f[k] !== null && !isNaN(f[k])) c[k] = f[k]; });
      c.anoMinimo = f.anoMinimo || null;
      c.formato = f.formato;
      c.idaEVolta = f.idaEVolta;
      c.terceiroLugar = f.terceiroLugar;
      c.desempate = ordem.filter((k) => ativos.has(k));
      if (!c.desempate.length) c.desempate = ['pontos'];
      D.salvar();
      U.toast('Configurações salvas!', 'ok');
      App.render();
    };

    document.getElementById('btn-apagar-cat').onclick = async () => {
      if (!(await U.confirmar(`Apagar a categoria ${cat.nome}, com todos os times e jogos dela? Não dá para desfazer.`, 'Apagar', 'btn-perigo'))) return;
      D.apagarCategoria(cat.id);
      App.ir(`#/camp/${camp.id}`);
    };
    this.ligarConfigCampeonato(camp);

    document.getElementById('btn-apagar-camp').onclick = async () => {
      if (!(await U.confirmar(`Apagar o campeonato ${camp.nome} inteiro? Não dá para desfazer (faça um backup antes).`, 'Apagar tudo', 'btn-perigo'))) return;
      D.apagarCampeonato(camp.id);
      App.ir('#/');
    };
  },
};
