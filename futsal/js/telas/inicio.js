/* =========================================================
   TELA INICIAL — lista de campeonatos + criar novo.
   Modo online: visitante vê só os públicos; quem entra com
   Google vê também os campeonatos em que é admin.
   ========================================================= */

var App = globalThis.App = globalThis.App || {};
App.telas = App.telas || {};

App.telas.inicio = {
  render() {
    const D = App.dados;
    const U = App.util;
    const N = App.nuvem;
    App.titulo('Futsal Súmula', null);

    // Ainda esperando o servidor responder
    if (N.ativo && N.carregando) {
      App.main().innerHTML = '<div class="cartao vazio">⏳ Carregando campeonatos…</div>';
      return;
    }

    const podeCriar = !N.ativo || !!N.usuario;
    const camps = D.db.campeonatos.slice().sort((a, b) => (b.dataInicio || '').localeCompare(a.dataInicio || ''));
    let html = '';

    // Faixa de login (modo online)
    if (N.ativo && !N.usuario) {
      html += `
        <div class="cartao">
          <h2>👋 Bem-vindo!</h2>
          <p class="suave">Você está vendo os campeonatos <b>públicos</b>. Organizadores entram com a conta Google para criar e editar.</p>
          <button class="btn btn-primario btn-bloco" id="btn-entrar">Entrar com Google</button>
        </div>`;
    }

    // Dados antigos que ficaram só neste aparelho → oferecer envio para a nuvem
    const locais = N.ativo && N.usuario ? D.dadosLocais() : null;
    if (locais) {
      html += `
        <div class="aviso-faixa amarela">
          📦 Este aparelho tem <b>${locais.campeonatos.length} campeonato(s)</b> salvos só aqui (da versão sem nuvem):
          ${locais.campeonatos.map((c) => U.esc(c.nome)).join(', ')}.
          <div class="grupo-botoes"><button class="btn btn-primario" id="btn-migrar">☁️ Enviar para a nuvem</button></div>
          <small>Eles serão criados como <b>privados</b>, com você como admin. Uma cópia continua guardada no aparelho.</small>
        </div>`;
    }

    if (!camps.length) {
      html += `
        <div class="cartao vazio">
          <p style="font-size:3rem;margin:0">⚽</p>
          <h2>${N.ativo && !N.usuario ? 'Nenhum campeonato público no momento' : 'Nenhum campeonato ainda'}</h2>
          ${podeCriar ? `<p>Crie seu primeiro campeonato no botão <b>+</b> ou importe um backup (💾).</p>
          <div class="grupo-botoes">
            <button class="btn btn-primario" id="btn-novo">+ Novo campeonato</button>
            <button class="btn" id="btn-exemplo">Carregar exemplo</button>
          </div>` : ''}
        </div>`;
    } else {
      html += camps.map((c) => {
        const jogos = D.db.jogos.filter((j) => j.campeonatoId === c.id && !j.bye);
        const feitos = jogos.filter((j) => j.status === 'encerrado').length;
        const aoVivo = jogos.filter((j) => j.status === 'andamento').length;
        const datas = [U.dataBR(c.dataInicio), U.dataBR(c.dataFim)].filter(Boolean).join(' a ');
        const selos = N.ativo ? `
          <span class="etiqueta ${c.visibilidade === 'publico' ? 'azul' : ''}">${c.visibilidade === 'publico' ? '🌐 Público' : '🔒 Privado'}</span>
          ${N.ehAdmin(c) ? '<span class="etiqueta verde">Admin</span>' : ''}` : '';
        return `
          <a class="cartao cartao-link" href="#/camp/${c.id}">
            <div class="linha-entre">
              <h2 style="margin:0">${U.esc(c.nome)}</h2>
              ${aoVivo ? `<span class="etiqueta vermelha">● ${aoVivo} ao vivo</span>` : ''}
            </div>
            <p class="suave" style="margin:4px 0 8px">${U.esc(c.local || '')}${c.local && datas ? ' · ' : ''}${datas}</p>
            <div class="linha">
              ${selos}
              ${(c.categorias || []).map((cat) => `<span class="etiqueta verde">${U.esc(cat.nome)}</span>`).join('')}
              <span class="suave" style="margin-left:auto">${feitos}/${jogos.length} jogos</span>
            </div>
          </a>`;
      }).join('');
    }

    App.main().innerHTML = html + (podeCriar ? '<button class="fab" id="fab-novo" aria-label="Novo campeonato">+</button>' : '');

    const ligar = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    ligar('fab-novo', () => this.formCampeonato());
    ligar('btn-novo', () => this.formCampeonato());
    ligar('btn-entrar', () => N.entrar());
    ligar('btn-exemplo', () => { const c = App.exemplo.carregar(); U.toast('Exemplo carregado!', 'ok'); App.ir(`#/camp/${c.id}`); });
    ligar('btn-migrar', () => this.migrar(locais));
  },

  /** Envia os campeonatos que estavam só no aparelho para a nuvem. */
  async migrar(locais) {
    const U = App.util;
    const ok = await U.confirmar(`Enviar ${locais.campeonatos.length} campeonato(s) deste aparelho para a nuvem? Eles ficam privados e você será o admin.`, 'Enviar');
    if (!ok) return;
    try {
      App.nuvem.importar(JSON.parse(JSON.stringify(locais)));
      App.dados.arquivarDadosLocais();
      U.toast('Enviado! (se estiver sem internet, termina de enviar quando a conexão voltar)', 'ok', 5000);
      App.render();
    } catch (e) {
      U.toast(e.message, 'erro', 5000);
    }
  },

  /**
   * Formulário de campeonato (criar ou editar).
   * Na criação, as categorias são digitadas separadas por vírgula.
   */
  formCampeonato(camp) {
    const U = App.util;
    const D = App.dados;
    const N = App.nuvem;
    const editando = !!camp;
    const c = camp || D.novoCampeonato({});

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
            <input name="categorias" value="Sub-9, Sub-11" placeholder="Sub-9, Sub-11 ou 2º ano, 3º ano">
          </label>`}
          ${N.ativo ? `
          <label class="campo"><span>Quem pode ver</span>
            <select name="visibilidade">
              <option value="privado" ${c.visibilidade !== 'publico' ? 'selected' : ''}>🔒 Privado — só os admins</option>
              <option value="publico" ${c.visibilidade === 'publico' ? 'selected' : ''}>🌐 Público — qualquer pessoa vê tabela e resultados</option>
            </select></label>` : ''}
          <label class="check"><input type="checkbox" name="alertaIdade" ${c.alertaIdade !== false ? 'checked' : ''}> Avisar quando a idade do jogador não bater com a categoria</label>
          <p class="suave" style="margin-top:-6px">Desligue em campeonatos por ano escolar (2º ano, 3º ano...).</p>
        </form>`,
      botoes: [
        { texto: 'Cancelar' },
        {
          texto: 'Salvar', classe: 'btn-primario',
          acao: () => {
            const dados = U.lerForm(document.getElementById('form-camp'));
            if (!dados.nome) { U.toast('Informe o nome do campeonato', 'erro'); return false; }
            const campos = {
              nome: dados.nome, local: dados.local, dataInicio: dados.dataInicio, dataFim: dados.dataFim,
              alertaIdade: dados.alertaIdade,
            };
            if (N.ativo) campos.visibilidade = dados.visibilidade === 'publico' ? 'publico' : 'privado';
            if (editando) {
              Object.assign(camp, campos);
              D.salvar();
              App.render();
            } else {
              const ano = dados.dataInicio ? Number(dados.dataInicio.slice(0, 4)) : new Date().getFullYear();
              const novo = D.novoCampeonato(Object.assign(campos, {
                categorias: (dados.categorias || '').split(',').map((s) => s.trim()).filter(Boolean)
                  .map((nome) => ({ id: U.id(), nome, config: D.configPadrao(nome, ano), grupos: [] })),
              }));
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
