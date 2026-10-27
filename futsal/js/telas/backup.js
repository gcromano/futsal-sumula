/* =========================================================
   TELA DE BACKUP
   - Exportar: baixa um arquivo .json com TUDO
   - Importar: escolhe um .json e substitui os dados atuais
   - Dados de exemplo e apagar tudo
   ========================================================= */

var App = globalThis.App = globalThis.App || {};
App.telas = App.telas || {};

App.telas.backup = {
  render() {
    const D = App.dados;
    const U = App.util;
    App.titulo('Backup e dados', '#/');

    const tamanho = new Blob([JSON.stringify(D.db)]).size;
    App.main().innerHTML = `
      <div class="cartao">
        <h2>💾 Exportar backup</h2>
        <p class="suave">Baixa um arquivo com todos os campeonatos, times, jogos e súmulas.
        Use para guardar uma cópia ou para passar os dados para outro aparelho (mande o arquivo pelo WhatsApp, e-mail ou Drive).</p>
        <p class="suave">Hoje: ${D.db.campeonatos.length} campeonato(s), ${D.db.times.length} time(s), ${D.db.jogos.length} jogo(s) · ${(tamanho / 1024).toFixed(1)} KB</p>
        <button class="btn btn-primario btn-bloco" id="btn-exportar">⬇️ Baixar backup (.json)</button>
      </div>

      <div class="cartao">
        <h2>📂 Importar backup</h2>
        <p class="suave">Escolha um arquivo de backup. <b>Os dados atuais deste aparelho serão substituídos.</b></p>
        <label class="btn btn-bloco">📂 Escolher arquivo
          <input type="file" id="arq-backup" accept=".json,application/json" class="oculto">
        </label>
      </div>

      <div class="cartao">
        <h2>🧪 Dados de exemplo</h2>
        <p class="suave">Adiciona um campeonato fictício (com times, jogos e algumas súmulas já preenchidas) para você testar o app. Não apaga nada.</p>
        <button class="btn btn-bloco" id="btn-exemplo">Adicionar campeonato de exemplo</button>
      </div>

      <div class="cartao">
        <h2>⚠️ Apagar tudo</h2>
        <p class="suave">Remove todos os dados deste aparelho. Faça um backup antes!</p>
        <button class="btn btn-perigo btn-bloco" id="btn-apagar">Apagar todos os dados</button>
      </div>

      <p class="suave centro">Os dados ficam salvos só neste navegador/aparelho.</p>`;

    document.getElementById('btn-exportar').onclick = () => {
      const data = new Date().toISOString().slice(0, 10);
      U.baixarArquivo(`futsal-backup-${data}.json`, D.exportar());
      U.toast('Backup baixado!', 'ok');
    };

    document.getElementById('arq-backup').onchange = async (e) => {
      const arq = e.target.files[0];
      if (!arq) return;
      const texto = await arq.text();
      e.target.value = '';
      const ok = await U.confirmar(`Importar “${arq.name}”? Os dados atuais deste aparelho serão SUBSTITUÍDOS.`, 'Importar', 'btn-perigo');
      if (!ok) return;
      try {
        D.importar(texto);
        U.toast('Backup importado com sucesso!', 'ok');
        App.ir('#/');
      } catch (err) {
        U.toast(err.message, 'erro', 5000);
      }
    };

    document.getElementById('btn-exemplo').onclick = () => {
      const camp = App.exemplo.carregar();
      U.toast('Campeonato de exemplo criado!', 'ok');
      App.ir(`#/camp/${camp.id}`);
    };

    document.getElementById('btn-apagar').onclick = async () => {
      const ok = await U.confirmar('Apagar TODOS os dados deste aparelho? Não dá para desfazer.', 'Apagar tudo', 'btn-perigo');
      if (!ok) return;
      D.db = D.novoBanco();
      D.salvar();
      U.toast('Dados apagados.');
      App.ir('#/');
    };
  },
};
