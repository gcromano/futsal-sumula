/* =========================================================
   TELA DE BACKUP
   - Exportar: baixa um arquivo .json
     (modo online: só os campeonatos em que você é admin)
   - Importar: escolhe um .json
     (modo local: substitui os dados do aparelho;
      modo online: cria/atualiza os campeonatos na nuvem
      e você vira admin — é assim que se cria a Copa CES)
   - Dados de exemplo e apagar tudo (só modo local)
   ========================================================= */

var App = globalThis.App = globalThis.App || {};
App.telas = App.telas || {};

App.telas.backup = {
  render() {
    const D = App.dados;
    const U = App.util;
    const N = App.nuvem;
    App.titulo('Backup e dados', '#/');
    const online = D.online();
    const logado = !!N.usuario;
    const meus = online ? D.db.campeonatos.filter((c) => N.ehAdmin(c)) : D.db.campeonatos;
    const tamanho = new Blob([D.exportar()]).size;

    App.main().innerHTML = `
      <div class="cartao">
        <h2>${online ? '☁️ Modo online' : '📱 Modo local'}</h2>
        <p class="suave">${online
          ? (logado ? `Conectado como <b>${U.esc(N.usuario.email)}</b>. Os dados ficam na nuvem (Firebase) e funcionam offline: o que você lançar sem internet é enviado quando a conexão voltar.`
            : 'Você não entrou. Entre com Google para criar, editar, importar e exportar.')
          : 'O Firebase ainda não foi configurado (arquivo js/firebase-config.js). Os dados ficam só neste aparelho.'}</p>
        ${online && !logado ? '<button class="btn btn-primario btn-bloco" id="btn-entrar">Entrar com Google</button>' : ''}
      </div>

      ${!online || logado ? `
      <div class="cartao">
        <h2>💾 Exportar backup</h2>
        <p class="suave">Baixa um arquivo com ${online ? 'os campeonatos em que você é admin' : 'todos os campeonatos'} (times, jogos e súmulas).
        Guarde em lugar seguro: ele tem nomes, telefones e datas de nascimento.</p>
        <p class="suave">${meus.length} campeonato(s) · ${(tamanho / 1024).toFixed(1)} KB</p>
        <button class="btn btn-primario btn-bloco" id="btn-exportar">⬇️ Baixar backup (.json)</button>
      </div>

      <div class="cartao">
        <h2>📂 Importar arquivo</h2>
        <p class="suave">${online
          ? 'Os campeonatos do arquivo são criados na nuvem e <b>você vira admin</b> deles. Se já existir um campeonato igual em que você é admin, ele é <b>substituído</b> pelo do arquivo. Use também para criar a <b>Copa CES</b> (arquivo copa-ces-2026.json).'
          : 'Escolha um arquivo de backup. <b>Os dados atuais deste aparelho serão substituídos.</b>'}</p>
        <label class="btn btn-bloco">📂 Escolher arquivo
          <input type="file" id="arq-backup" accept=".json,application/json" class="oculto">
        </label>
      </div>

      <div class="cartao">
        <h2>🧪 Dados de exemplo</h2>
        <p class="suave">Adiciona um campeonato fictício${online ? ' (privado, só você vê)' : ''} com times, jogos e súmulas para testar. Não apaga nada.</p>
        <button class="btn btn-bloco" id="btn-exemplo">Adicionar campeonato de exemplo</button>
        <button class="btn btn-bloco" id="btn-exemplo-inter" style="margin-top:8px">🏅 Adicionar interclasse de exemplo</button>
      </div>` : ''}

      ${!online ? `
      <div class="cartao">
        <h2>⚠️ Apagar tudo</h2>
        <p class="suave">Remove todos os dados deste aparelho. Faça um backup antes!</p>
        <button class="btn btn-perigo btn-bloco" id="btn-apagar">Apagar todos os dados</button>
      </div>` : ''}`;

    const ligar = (id, fn, evento = 'onclick') => { const el = document.getElementById(id); if (el) el[evento] = fn; };

    ligar('btn-entrar', () => N.entrar());

    ligar('btn-exportar', () => {
      const data = new Date().toISOString().slice(0, 10);
      U.baixarArquivo(`futsal-backup-${data}.json`, D.exportar());
      U.toast('Backup baixado!', 'ok');
    });

    ligar('arq-backup', async (e) => {
      const arq = e.target.files[0];
      if (!arq) return;
      const texto = await arq.text();
      e.target.value = '';
      const msg = online
        ? `Importar “${arq.name}” para a nuvem? Você vira admin dos campeonatos do arquivo.`
        : `Importar “${arq.name}”? Os dados atuais deste aparelho serão SUBSTITUÍDOS.`;
      if (!(await U.confirmar(msg, 'Importar', online ? 'btn-primario' : 'btn-perigo'))) return;
      try {
        const nomes = D.importar(texto);
        U.toast(`Importado: ${nomes.join(', ')}`, 'ok', 4000);
        App.ir('#/');
      } catch (err) {
        U.toast(err.message, 'erro', 5000);
      }
    }, 'onchange');

    ligar('btn-exemplo', () => {
      const camp = App.exemplo.carregar();
      U.toast('Campeonato de exemplo criado!', 'ok');
      App.ir(`#/camp/${camp.id}`);
    });

    ligar('btn-exemplo-inter', () => {
      const camp = App.exemplo.carregarInterclasse();
      U.toast('Interclasse de exemplo criado!', 'ok');
      App.ir(`#/inter/${camp.id}`);
    });

    ligar('btn-apagar', async () => {
      const ok = await U.confirmar('Apagar TODOS os dados deste aparelho? Não dá para desfazer.', 'Apagar tudo', 'btn-perigo');
      if (!ok) return;
      D.db = D.novoBanco();
      D.salvar();
      U.toast('Dados apagados.');
      App.ir('#/');
    });
  },
};
