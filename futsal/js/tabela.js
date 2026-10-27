/* =========================================================
   TABELA.JS — Gera a tabela de jogos automaticamente.

   Formatos:
   - 'pontos': todos contra todos (turno ou turno e returno)
   - 'grupos': todos contra todos dentro de cada grupo e,
               depois, mata-mata com os classificados
   - 'mata'  : só mata-mata (eliminatória)

   Campo "ordem" de cada jogo = rodada * 1000 + posição.
   Ele garante a sequência certa (rodada 1, 2, 3... depois
   mata-mata), usada para ordenar e calcular suspensões.
   ========================================================= */

var App = globalThis.App = globalThis.App || {};

App.tabela = {
  /**
   * Todos contra todos pelo "método do círculo".
   * Recebe a lista de ids e devolve as rodadas:
   * [ [ [casa, fora], [casa, fora] ], ... ]
   * Se o número de times for ímpar, um time folga em cada rodada.
   */
  todosContraTodos(ids, idaEVolta = false) {
    const lista = ids.slice();
    if (lista.length < 2) return [];
    if (lista.length % 2 === 1) lista.push(null); // null = folga
    const n = lista.length;
    const rodadas = [];

    for (let r = 0; r < n - 1; r++) {
      const jogos = [];
      for (let i = 0; i < n / 2; i++) {
        let casa = lista[i];
        let fora = lista[n - 1 - i];
        // Alterna o mando para ninguém jogar sempre "em casa"
        if ((r + i) % 2 === 1) [casa, fora] = [fora, casa];
        if (casa !== null && fora !== null) jogos.push([casa, fora]);
      }
      rodadas.push(jogos);
      // Gira todos menos o primeiro
      lista.splice(1, 0, lista.pop());
    }

    if (idaEVolta) {
      const volta = rodadas.map((jogos) => jogos.map(([c, f]) => [f, c]));
      return rodadas.concat(volta);
    }
    return rodadas;
  },

  /** Menor potência de 2 que cabe n (ex.: 6 → 8). */
  potenciaDe2(n) {
    let p = 1;
    while (p < n) p *= 2;
    return p;
  },

  /**
   * Ordem das "cabeças de chave" no chaveamento.
   * Para 8: [1, 8, 4, 5, 2, 7, 3, 6]  → jogos 1×8, 4×5, 2×7, 3×6.
   * Assim o 1º e o 2º só se encontram na final.
   */
  ordemChave(tamanho) {
    let ordem = [1, 2];
    while (ordem.length < tamanho) {
      const soma = ordem.length * 2 + 1;
      const nova = [];
      for (const s of ordem) nova.push(s, soma - s);
      ordem = nova;
    }
    return ordem.slice(0, Math.max(tamanho, 1));
  },

  /** Nome da fase do mata-mata conforme o número de jogos. */
  nomeFase(qtdJogos, indice) {
    if (qtdJogos === 1) return 'Final';
    if (qtdJogos === 2) return 'Semifinal';
    if (qtdJogos === 4) return 'Quartas de final';
    if (qtdJogos === 8) return 'Oitavas de final';
    return `${indice + 1}ª fase`;
  },

  /** Cria um objeto de jogo com os campos padrão. */
  novoJogo(cat, camp, extra) {
    return Object.assign({
      id: App.util.id(),
      campeonatoId: camp.id,
      categoriaId: cat.id,
      fase: 'liga',        // 'liga' | 'grupo' | 'mata'
      grupoId: null,
      rodada: null,
      rodadaNome: '',
      ordem: 0,
      casaId: null,
      foraId: null,
      origemCasa: null,    // de onde vem o time (mata-mata)
      origemFora: null,
      bye: false,          // true = time passa direto (sem adversário)
      data: '',
      hora: '',
      quadra: '',
      status: 'agendado',  // 'agendado' | 'andamento' | 'encerrado'
      sumula: null,
    }, extra);
  },

  /**
   * Monta o mata-mata.
   * "sementes" = lista de origens já em ordem de força:
   *   { tipo: 'time', timeId }  ou  { tipo: 'grupo', grupoId, posicao }
   * Devolve a lista de jogos criados.
   */
  montarMataMata(cat, camp, sementes, terceiroLugar) {
    const jogos = [];
    const n = sementes.length;
    if (n < 2) return jogos;
    const tamanho = this.potenciaDe2(n);
    const ordem = this.ordemChave(tamanho);
    const totalFases = Math.log2(tamanho);
    let anteriores = [];

    for (let f = 0; f < totalFases; f++) {
      const qtd = tamanho / Math.pow(2, f + 1);
      const nome = this.nomeFase(qtd, f);
      const atuais = [];
      for (let i = 0; i < qtd; i++) {
        const jogo = this.novoJogo(cat, camp, {
          fase: 'mata',
          rodada: f + 1,
          rodadaNome: nome,
          ordem: (100 + f) * 1000 + i,
        });
        if (f === 0) {
          // 1ª fase: pega as sementes na ordem do chaveamento
          const sA = sementes[ordem[i * 2] - 1];
          const sB = sementes[ordem[i * 2 + 1] - 1];
          jogo.origemCasa = sA || null;
          jogo.origemFora = sB || null;
          if (!sB) jogo.bye = true; // não tem adversário: passa direto
        } else {
          jogo.origemCasa = { tipo: 'vencedor', jogoId: anteriores[i * 2].id };
          jogo.origemFora = { tipo: 'vencedor', jogoId: anteriores[i * 2 + 1].id };
        }
        atuais.push(jogo);
      }
      // Disputa de 3º lugar: perdedores das semifinais
      if (qtd === 1 && terceiroLugar && anteriores.length === 2) {
        atuais.unshift(this.novoJogo(cat, camp, {
          fase: 'mata',
          rodada: f + 1,
          rodadaNome: 'Disputa de 3º lugar',
          ordem: (100 + f) * 1000 - 1, // vem logo antes da final
          origemCasa: { tipo: 'perdedor', jogoId: anteriores[0].id },
          origemFora: { tipo: 'perdedor', jogoId: anteriores[1].id },
          terceiro: true,
        }));
      }
      jogos.push(...atuais);
      anteriores = atuais.filter((j) => !j.terceiro);
    }
    return jogos;
  },

  /**
   * Gera (ou refaz) a tabela da categoria.
   * opcoes.sortear = embaralha os times antes (sorteio de grupos/chave).
   * Apaga os jogos antigos dessa categoria.
   */
  gerar(catId, opcoes = {}) {
    const D = App.dados;
    const { camp, cat } = D.categoria(catId);
    if (!cat) throw new Error('Categoria não encontrada');
    const cfg = cat.config;
    let ids = D.timesDaCategoria(catId).map((t) => t.id);
    if (ids.length < 2) throw new Error('Cadastre pelo menos 2 times nesta categoria.');
    if (opcoes.sortear) ids = App.util.embaralhar(ids, opcoes.aleatorio);

    const novos = [];
    cat.grupos = [];

    if (cfg.formato === 'pontos') {
      this.todosContraTodos(ids, cfg.idaEVolta).forEach((rodada, r) => {
        rodada.forEach(([casa, fora], i) => {
          novos.push(this.novoJogo(cat, camp, {
            fase: 'liga', rodada: r + 1, rodadaNome: `Rodada ${r + 1}`,
            ordem: (r + 1) * 1000 + i, casaId: casa, foraId: fora,
          }));
        });
      });
    } else if (cfg.formato === 'grupos') {
      const qtdGrupos = Math.max(1, Math.min(cfg.numGrupos || 2, Math.floor(ids.length / 2)));
      const letras = 'ABCDEFGHIJKLMNOP';
      // Distribui em "zigue-zague": A B C C B A A B C ...
      for (let g = 0; g < qtdGrupos; g++) cat.grupos.push({ id: App.util.id(), nome: 'Grupo ' + letras[g], timeIds: [] });
      ids.forEach((id, i) => {
        const volta = Math.floor(i / qtdGrupos);
        const pos = i % qtdGrupos;
        const g = volta % 2 === 0 ? pos : qtdGrupos - 1 - pos;
        cat.grupos[g].timeIds.push(id);
      });
      // Jogos dentro de cada grupo
      cat.grupos.forEach((grupo, gi) => {
        this.todosContraTodos(grupo.timeIds, cfg.idaEVolta).forEach((rodada, r) => {
          rodada.forEach(([casa, fora], i) => {
            novos.push(this.novoJogo(cat, camp, {
              fase: 'grupo', grupoId: grupo.id, rodada: r + 1,
              rodadaNome: `Rodada ${r + 1}`,
              ordem: (r + 1) * 1000 + gi * 50 + i, casaId: casa, foraId: fora,
            }));
          });
        });
      });
      // Mata-mata: 1º de todos os grupos, depois os 2º, e assim por diante
      const k = Math.max(1, cfg.classificadosPorGrupo || 2);
      const sementes = [];
      for (let p = 1; p <= k; p++) {
        for (const grupo of cat.grupos) {
          if (grupo.timeIds.length >= p) sementes.push({ tipo: 'grupo', grupoId: grupo.id, posicao: p });
        }
      }
      novos.push(...this.montarMataMata(cat, camp, sementes, cfg.terceiroLugar));
    } else {
      // Só mata-mata
      const sementes = ids.map((id) => ({ tipo: 'time', timeId: id }));
      novos.push(...this.montarMataMata(cat, camp, sementes, cfg.terceiroLugar));
    }

    D.db.jogos = D.db.jogos.filter((j) => j.categoriaId !== catId).concat(novos);
    App.regras.atualizarMataMata(catId);
    D.salvar();
    return novos;
  },
};
