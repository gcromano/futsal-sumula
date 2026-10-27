/* =========================================================
   RELATÓRIOS PARA IMPRIMIR OU SALVAR EM PDF
   #/imprimir/sumula/JOGO
   #/imprimir/tabela/CATEGORIA
   #/imprimir/classificacao/CATEGORIA
   #/imprimir/artilharia/CATEGORIA

   O botão "Imprimir / PDF" chama window.print().
   No celular, escolha "Salvar como PDF" na tela de impressão
   e depois mande o arquivo no WhatsApp.
   ========================================================= */

var App = globalThis.App = globalThis.App || {};
App.telas = App.telas || {};

App.telas.relatorios = {
  render(tipo, id) {
    const D = App.dados;
    let html = '';
    let voltar = '#/';
    let titulo = 'Relatório';

    if (tipo === 'sumula') {
      const jogo = D.jogo(id);
      if (!jogo) { App.ir('#/'); return; }
      voltar = `#/sumula/${jogo.id}`;
      titulo = 'Súmula oficial';
      html = this.sumula(jogo);
    } else {
      const { camp, cat } = D.categoria(id);
      if (!cat) { App.ir('#/'); return; }
      const cab = this.cabecalho(camp, cat);
      if (tipo === 'tabela') { titulo = 'Tabela de jogos'; voltar = `#/camp/${camp.id}/${cat.id}/jogos`; html = cab + this.tabela(cat); }
      if (tipo === 'classificacao') { titulo = 'Classificação'; voltar = `#/camp/${camp.id}/${cat.id}/classificacao`; html = cab + this.classificacao(cat); }
      if (tipo === 'artilharia') { titulo = 'Artilharia'; voltar = `#/camp/${camp.id}/${cat.id}/estatisticas`; html = cab + this.artilharia(cat); }
    }

    App.titulo(titulo, voltar);
    App.main().innerHTML = `
      <div class="grupo-botoes nao-imprimir">
        <button class="btn btn-primario" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
      </div>
      <p class="suave nao-imprimir">Dica: no celular, escolha “Salvar como PDF” e depois compartilhe no WhatsApp.</p>
      <div class="folha">${html}
        <div class="rodape">Gerado em ${new Date().toLocaleString('pt-BR')} · Futsal Súmula</div>
      </div>`;
  },

  cabecalho(camp, cat, subtitulo) {
    const U = App.util;
    return `<h1>${U.esc(camp.nome)}</h1>
      <p class="sub">${U.esc(cat.nome)}${camp.local ? ' · ' + U.esc(camp.local) : ''}${subtitulo ? ' · ' + U.esc(subtitulo) : ''}</p>`;
  },

  /* ---------- Súmula oficial ---------- */
  sumula(jogo) {
    const D = App.dados;
    const U = App.util;
    const R = App.regras;
    const { camp, cat } = D.categoria(jogo.categoriaId);
    const casa = D.time(jogo.casaId);
    const fora = D.time(jogo.foraId);
    if (!casa || !fora) return '<p>Jogo sem times definidos.</p>';
    const s = jogo.sumula || R.novaSumula(jogo);
    const p = R.placar(jogo);
    const pen = R.temPenaltis(jogo) ? R.placarPenaltis(jogo) : null;
    const suspensos = R.suspensosNoJogo(jogo).map((x) => x.jogadorId);
    const NOMES = App.telas.sumula.TIPOS;

    // Tabela do elenco de um time com gols e cartões no jogo
    const elenco = (time) => {
      const linhas = time.jogadores.map((pl) => {
        const evs = s.eventos.filter((e) => e.jogadorId === pl.id);
        const gols = evs.filter((e) => e.tipo === 'gol').length;
        const ca = evs.filter((e) => e.tipo === 'amarelo').length;
        const cv = evs.filter((e) => e.tipo === 'vermelho').length;
        const obs = suspensos.includes(pl.id) ? 'SUSPENSO' : (pl.posicao === 'goleiro' ? 'GOL' : '');
        return `<tr><td class="n">${U.esc(pl.numero)}</td><td>${U.esc(pl.nome)}</td><td class="n">${gols || ''}</td><td class="n">${ca || ''}</td><td class="n">${cv || ''}</td><td class="n">${obs}</td></tr>`;
      }).join('');
      const faltas = [];
      for (let per = 1; per <= Math.max(s.periodo, cat.config.numPeriodos); per++) faltas.push(`${per}ºP: ${R.faltasNoPeriodo(jogo, time.id, per)}`);
      return `<div>
        <h2>${U.esc(time.nome)}</h2>
        <table><thead><tr><th class="n">Nº</th><th>Atleta</th><th class="n">G</th><th class="n">CA</th><th class="n">CV</th><th class="n">Obs</th></tr></thead>
        <tbody>${linhas || '<tr><td colspan="6">Sem jogadores</td></tr>'}</tbody></table>
        <p>Técnico: ${U.esc(time.tecnico || '—')}<br>Faltas: ${faltas.join(' · ')}</p>
      </div>`;
    };

    const eventos = s.eventos.slice().sort((a, b) => a.periodo - b.periodo || a.minuto - b.minuto);
    const linhasEv = eventos.map((e) => {
      const t = D.time(e.timeId);
      let desc = e.tipo === 'tempo' ? '' : App.telas.sumula.nomeJogador(e.jogadorId);
      if (e.tipo === 'gol' && e.assistenciaId) desc += ` (assist.: ${App.telas.sumula.nomeJogador(e.assistenciaId)})`;
      return `<tr><td class="n">${e.periodo}º</td><td class="n">${e.minuto}'</td><td>${NOMES[e.tipo].nome}</td><td>${U.esc(t ? t.nome : '')}</td><td>${U.esc(desc)}</td></tr>`;
    }).join('');

    return `
      ${this.cabecalho(camp, cat, 'SÚMULA DE JOGO')}
      <table>
        <tr><th>Fase</th><td>${U.esc(jogo.rodadaNome)}</td><th>Data</th><td>${U.dataBR(jogo.data) || '—'} ${U.esc(jogo.hora || '')}</td></tr>
        <tr><th>Local</th><td>${U.esc(camp.local || '—')}</td><th>Quadra</th><td>${U.esc(jogo.quadra || '—')}</td></tr>
      </table>
      <div class="placar-folha">
        <div>${U.esc(casa.nome)}</div>
        <div class="gols">${jogo.status === 'agendado' ? '&nbsp;×&nbsp;' : `${p.casa} × ${p.fora}`}</div>
        <div>${U.esc(fora.nome)}</div>
      </div>
      ${pen ? `<p class="sub"><b>Pênaltis: ${pen.casa} × ${pen.fora}</b></p>` : ''}
      ${jogo.status !== 'encerrado' ? '<p class="sub"><b>(JOGO NÃO ENCERRADO)</b></p>' : ''}

      <h2>Arbitragem e mesa</h2>
      <table>
        <tr><th>Árbitro 1</th><td>${U.esc(s.arbitro1 || '—')}</td><th>Árbitro 2</th><td>${U.esc(s.arbitro2 || '—')}</td></tr>
        <tr><th>Mesário</th><td>${U.esc(s.mesario || '—')}</td><th>Anotador</th><td>${U.esc(s.anotador || '—')}</td></tr>
        <tr><th>Cronometrista</th><td colspan="3">${U.esc(s.cronometrista || '—')}</td></tr>
      </table>

      <div class="colunas">${elenco(casa)}${elenco(fora)}</div>

      <h2>Eventos do jogo</h2>
      <table><thead><tr><th class="n">Per.</th><th class="n">Min.</th><th>Evento</th><th>Time</th><th>Atleta</th></tr></thead>
      <tbody>${linhasEv || '<tr><td colspan="5">Nenhum evento</td></tr>'}</tbody></table>

      ${s.penaltis.length ? `<h2>Disputa de pênaltis</h2>
        <table><thead><tr><th class="n">#</th><th>Time</th><th>Atleta</th><th class="n">Resultado</th></tr></thead><tbody>
        ${s.penaltis.map((c, i) => `<tr><td class="n">${i + 1}</td><td>${U.esc((D.time(c.timeId) || {}).nome || '')}</td><td>${U.esc(App.telas.sumula.nomeJogador(c.jogadorId))}</td><td class="n">${c.convertido ? 'Gol' : 'Perdeu'}</td></tr>`).join('')}
        </tbody></table>` : ''}

      <h2>Observações do árbitro</h2>
      <div class="obs">${U.esc(s.observacoes || 'Sem observações.')}</div>

      <div class="assinaturas">
        <div>Árbitro 1</div><div>Árbitro 2</div>
        <div>Técnico ${U.esc(casa.nome)}</div><div>Técnico ${U.esc(fora.nome)}</div>
      </div>`;
  },

  /* ---------- Tabela de jogos ---------- */
  tabela(cat) {
    const D = App.dados;
    const U = App.util;
    const R = App.regras;
    const jogos = D.jogosDaCategoria(cat.id).filter((j) => !j.bye);
    if (!jogos.length) return '<p>Tabela ainda não gerada.</p>';
    const grupos = Object.fromEntries((cat.grupos || []).map((g) => [g.id, g.nome]));
    let atual = '';
    let html = '';
    for (const j of jogos) {
      const bloco = j.fase === 'mata' ? j.rodadaNome : `Rodada ${j.rodada}`;
      if (bloco !== atual) {
        if (atual) html += '</tbody></table>';
        atual = bloco;
        html += `<h2>${U.esc(bloco)}</h2><table><thead><tr><th class="n">Data</th><th class="n">Hora</th><th class="n">Quadra</th>${cat.grupos && cat.grupos.length ? '<th class="n">Grupo</th>' : ''}<th>Mandante</th><th class="n">Placar</th><th>Visitante</th></tr></thead><tbody>`;
      }
      const casa = D.time(j.casaId);
      const fora = D.time(j.foraId);
      const p = R.placar(j);
      const pen = R.temPenaltis(j) ? R.placarPenaltis(j) : null;
      const placar = j.status === 'encerrado' ? `${p.casa} × ${p.fora}${pen ? ` (${pen.casa}×${pen.fora} pên.)` : ''}` : '×';
      html += `<tr><td class="n">${U.dataCurta(j.data) || '—'}</td><td class="n">${U.esc(j.hora || '—')}</td><td class="n">${U.esc(j.quadra || '—')}</td>
        ${cat.grupos && cat.grupos.length ? `<td class="n">${U.esc((grupos[j.grupoId] || '').replace('Grupo ', ''))}</td>` : ''}
        <td>${U.esc(casa ? casa.nome : R.textoOrigem(j.origemCasa, cat.id))}</td><td class="n"><b>${placar}</b></td><td>${U.esc(fora ? fora.nome : R.textoOrigem(j.origemFora, cat.id))}</td></tr>`;
    }
    return html + '</tbody></table>';
  },

  /* ---------- Classificação ---------- */
  classificacao(cat) {
    const D = App.dados;
    const U = App.util;
    const R = App.regras;
    const tabela = (titulo, linhas) => `
      <h2>${U.esc(titulo)}</h2>
      <table><thead><tr><th class="n">#</th><th>Time</th><th class="n">P</th><th class="n">J</th><th class="n">V</th><th class="n">E</th><th class="n">D</th><th class="n">GP</th><th class="n">GC</th><th class="n">SG</th></tr></thead>
      <tbody>${linhas.map((l) => `<tr><td class="n">${l.pos}</td><td>${U.esc(D.time(l.timeId).nome)}</td><td class="n"><b>${l.pts}</b></td><td class="n">${l.j}</td><td class="n">${l.v}</td><td class="n">${l.e}</td><td class="n">${l.d}</td><td class="n">${l.gp}</td><td class="n">${l.gc}</td><td class="n">${l.sg}</td></tr>`).join('')}</tbody></table>`;

    let html = '';
    if (cat.config.formato === 'pontos') html += tabela('Classificação', R.classificacao(cat.id));
    if (cat.config.formato === 'grupos') (cat.grupos || []).forEach((g) => { html += tabela(g.nome, R.classificacao(cat.id, g.id)); });
    if (cat.config.formato !== 'pontos') {
      const mata = D.jogosDaCategoria(cat.id).filter((j) => j.fase === 'mata' && !j.bye);
      if (mata.length) {
        html += `<h2>Mata-mata</h2><table><tbody>${mata.map((j) => {
          const casa = D.time(j.casaId);
          const fora = D.time(j.foraId);
          const p = R.placar(j);
          const pen = R.temPenaltis(j) ? R.placarPenaltis(j) : null;
          return `<tr><td>${U.esc(j.rodadaNome)}</td><td>${U.esc(casa ? casa.nome : R.textoOrigem(j.origemCasa, cat.id))}</td>
            <td class="n"><b>${j.status === 'encerrado' ? `${p.casa} × ${p.fora}${pen ? ` (${pen.casa}×${pen.fora})` : ''}` : '×'}</b></td>
            <td>${U.esc(fora ? fora.nome : R.textoOrigem(j.origemFora, cat.id))}</td></tr>`;
        }).join('')}</tbody></table>`;
      }
    }
    html += `<p>Critérios de desempate: ${cat.config.desempate.map((c) => App.dados.NOMES_DESEMPATE[c]).join(' → ')}</p>`;
    return html;
  },

  /* ---------- Artilharia (e assistências) ---------- */
  artilharia(cat) {
    const U = App.util;
    const est = App.regras.estatisticas(cat.id);
    const tabela = (titulo, col, linhas, campo) => `
      <h2>${titulo}</h2>
      ${linhas.length ? `<table><thead><tr><th class="n">#</th><th>Atleta</th><th>Time</th><th class="n">${col}</th></tr></thead><tbody>
      ${linhas.map((x, i) => `<tr><td class="n">${i + 1}</td><td>${U.esc(x.jogador.nome)} (${U.esc(x.jogador.numero)})</td><td>${U.esc(x.time.nome)}</td><td class="n"><b>${x[campo]}</b></td></tr>`).join('')}
      </tbody></table>` : '<p>Sem registros ainda.</p>'}`;
    return tabela('Artilharia', 'Gols', est.artilharia, 'gols') +
      tabela('Assistências', 'Assist.', est.assistencias, 'assist');
  },
};
