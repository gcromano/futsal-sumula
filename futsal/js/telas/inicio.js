/* =========================================================
   TELA INICIAL — lista de campeonatos + criar novo.
   ========================================================= */

var App = globalThis.App = globalThis.App || {};
App.telas = App.telas || {};

App.telas.inicio = {
  render() {
    const D = App.dados;
    const U = App.util;
    App.titulo('Futsal Súmula', null);

    const camps = D.db.campeonatos.slice().sort((a, b) => (b.dataInicio || '').localeCompare(a.dataInicio || ''));

    let html = '';
    if (!camps.length) {
      html = `
        <div class="cartao vazio">
          <p style="font-size:3rem;margin:0">⚽</p>
          <h2>Nenhum campeonato ainda</h2>
          <p>Crie seu primeiro campeonato no botão <b>+</b> ou carregue um exemplo para testar.</p>
          <div class="grupo-botoes">
            <button class="btn btn-primario" id="btn-novo">+ Novo campeonato</button>
            <button class="btn" id="btn-exemplo">Carregar exemplo</button>
          </div>
        </div>`;
    } else {
      html = camps.map((c) => {
        const jogos = D.db.jogos.filter((j) => j.campeonatoId === c.id && !j.bye);
        const feitos = jogos.filter((j) => j.status === 'encerrado').length;
        const aoVivo = jogos.filter((j) => j.status === 'andamento').length;
        const datas = [U.dataBR(c.dataInicio), U.dataBR(c.dataFim)].filter(Boolean).join(' a ');
        return `
          <a class="cartao cartao-link" href="#/camp/${c.id}">
            <div class="linha-entre">
              <h2 style="margin:0">${U.esc(c.nome)}</h2>
              ${aoVivo ? `<span class="etiqueta vermelha">● ${aoVivo} ao vivo</span>` : ''}
            </div>
            <p class="suave" style="margin:4px 0 8px">${U.esc(c.local || '')}${c.local && datas ? ' · ' : ''}${datas}</p>
            <div class="linha">
              ${c.categorias.map((cat) => `<span class="etiqueta verde">${U.esc(cat.nome)}</span>`).join('')}
              <span class="suave" style="margin-left:auto">${feitos}/${jogos.length} jogos</span>
            </div>
          </a>`;
      }).join('');
    }

    App.main().innerHTML = html + '<button class="fab" id="fab-novo" aria-label="Novo campeonato">+</button>';

    document.getElementById('fab-novo').onclick = () => this.formCampeonato();
    const bn = document.getElementById('btn-novo');
    if (bn) bn.onclick = () => this.formCampeonato();
    const be = document.getElementById('btn-exemplo');
    if (be) be.onclick = () => { App.exemplo.carregar(); U.toast('Exemplo carregado!', 'ok'); App.render(); };
  },

  /**
   * Formulário de campeonato (criar ou editar).
   * Na criação, as categorias são digitadas separadas por vírgula.
   */
  formCampeonato(camp) {
    const U = App.util;
    const D = App.dados;
    const editando = !!camp;
    const c = camp || { nome: '', local: '', dataInicio: '', dataFim: '' };

    U.modal({
      titulo: editando ? 'Editar campeonato' : 'Novo campeonato',
      html: `
        <form id="form-camp">
          <label class="campo"><span>Nome *</span><input name="nome" required value="${U.esc(c.nome)}" placeholder="Ex.: Copa Verão 2026"></label>
          <label class="campo"><span>Local</span><input name="local" value="${U.esc(c.local)}" placeholder="Ex.: Ginásio Municipal"></label>
          <div class="campos-2">
            <label class="campo"><span>Início</span><input type="date" name="dataInicio" value="${U.esc(c.dataInicio)}"></label>
            <label class="campo"><span>Fim</span><input type="date" name="dataFim" value="${U.esc(c.dataFim)}"></label>
          </div>
          ${editando ? '' : `
          <label class="campo"><span>Categorias (separe por vírgula)</span>
            <input name="categorias" value="Sub-9, Sub-11" placeholder="Sub-7, Sub-9, Sub-11, Sub-13">
          </label>`}
        </form>`,
      botoes: [
        { texto: 'Cancelar' },
        {
          texto: 'Salvar', classe: 'btn-primario',
          acao: () => {
            const dados = U.lerForm(document.getElementById('form-camp'));
            if (!dados.nome) { U.toast('Informe o nome do campeonato', 'erro'); return false; }
            if (editando) {
              Object.assign(camp, { nome: dados.nome, local: dados.local, dataInicio: dados.dataInicio, dataFim: dados.dataFim });
              D.salvar();
              App.render();
            } else {
              const ano = dados.dataInicio ? Number(dados.dataInicio.slice(0, 4)) : new Date().getFullYear();
              const novo = {
                id: U.id(), nome: dados.nome, local: dados.local, dataInicio: dados.dataInicio, dataFim: dados.dataFim,
                categorias: (dados.categorias || '').split(',').map((s) => s.trim()).filter(Boolean)
                  .map((nome) => ({ id: U.id(), nome, config: D.configPadrao(nome, ano), grupos: [] })),
              };
              D.db.campeonatos.push(novo);
              D.salvar();
              App.ir(`#/camp/${novo.id}`);
            }
          },
        },
      ],
    });
  },
};
