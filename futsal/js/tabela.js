/* =========================================================
   TABELA.JS — Gera a tabela de jogos automaticamente.

   Formatos:
   - 'pontos': todos contra todos (turno ou turno e returno)
   - 'grupos': todos contra todos dentro de cada grupo e,
               depois, mata-mata com os classificados
   - 'mata'  : só mata-mata (eliminatória)

   Campo "ordem" de cada jogo = bloco * 1000 + posição.
   - Rodadas de classificação: bloco = número da rodada (1, 2, 3...)
   - Mata-mata: bloco pelo nome da fase (Oitavas 100, Quartas 101,
     Semifinal 102, 3º lugar 103, Final 104)
   Ele garante a sequência certa, usada para ordenar e calcular
   suspensões — tanto para jogos gerados quanto montados na mão.
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
          ordem: this.blocoFase(nome) * 1000 + i,
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
          ordem: this.blocoFase('Disputa de 3º lugar') * 1000, // vem logo antes da final
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

  /* =======================================================
     TABELA MANUAL
     Funções para montar, editar, reordenar e importar jogos
     na mão. Os jogos gerados e os manuais têm o MESMO formato,
     então classificação, estatísticas e suspensões funcionam
     igual para os dois.
     ======================================================= */

  /** Fases conhecidas do mata-mata, na ordem em que acontecem. */
  FASES_MATA: ['Oitavas de final', 'Quartas de final', 'Semifinal', 'Disputa de 3º lugar', 'Final'],

  /** Texto sem acento, minúsculo e sem espaços sobrando (para comparar nomes). */
  normalizar(texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  },

  /** Nome "oficial" de uma fase digitada: "semi" → "Semifinal", "2a fase" → "2ª fase". */
  nomeFaseCanonico(texto) {
    const t = this.normalizar(texto);
    if (!t) return '';
    if (t.includes('oitava')) return 'Oitavas de final';
    if (t.includes('quarta')) return 'Quartas de final';
    if (t.includes('semi')) return 'Semifinal';
    if (t.includes('terceiro') || (t.includes('3') && t.includes('lugar'))) return 'Disputa de 3º lugar';
    if (/^(grande )?final$/.test(t)) return 'Final';
    const m = t.match(/^(\d+)\s*[ªaº°o]?\s*fase$/);
    if (m) return `${m[1]}ª fase`;
    return String(texto).trim();
  },

  /** Bloco (para o campo "ordem") de uma fase do mata-mata. */
  blocoFase(nome) {
    const i = this.FASES_MATA.indexOf(nome);
    if (i >= 0) return 100 + i;
    const m = /^(\d+)ª fase$/.exec(nome || '');
    if (m) return 90 + Math.min(Number(m[1]), 8);
    return 99; // fase com nome livre (ex.: "Repescagem"): antes das oitavas
  },

  /**
   * Entende o texto de rodada/fase.
   * "Rodada 3", "3ª rodada" → { fase: 'liga', rodada: 3 }
   * "Semi", "Final"...      → { fase: 'mata', rodadaNome: 'Semifinal' }
   * Devolve null se não reconhecer (só quando "estrito" = true).
   */
  interpretarFase(texto, estrito = false) {
    const t = this.normalizar(texto);
    const r = t.match(/^rodada\s*(\d+)$/) || t.match(/^(\d+)\s*[ªaº°o]?\s*rodada$/);
    if (r) return { fase: 'liga', rodada: Number(r[1]), rodadaNome: `Rodada ${Number(r[1])}` };
    const nome = this.nomeFaseCanonico(texto);
    const conhecida = this.FASES_MATA.includes(nome) || /^\d+ª fase$/.test(nome);
    if (estrito && !conhecida) return null;
    return nome ? { fase: 'mata', rodadaNome: nome } : null;
  },

  /** Acha um grupo pelo nome ("A" ou "Grupo A"); se não existir, cria. */
  grupoPorNome(cat, nome) {
    let n = String(nome || '').trim();
    if (!n) return null;
    if (!/^grupo\b/i.test(n)) n = 'Grupo ' + n;
    cat.grupos = cat.grupos || [];
    let g = cat.grupos.find((x) => this.normalizar(x.nome) === this.normalizar(n));
    if (!g) {
      g = { id: App.util.id(), nome: n.replace(/^grupo/i, 'Grupo'), timeIds: [] };
      cat.grupos.push(g);
    }
    return g;
  },

  /**
   * Converte o valor de um "lado" do jogo (vindo do formulário) em time ou origem:
   *   't:ID'          → time escolhido direto
   *   'v:JOGO'        → vencedor do jogo
   *   'p:JOGO'        → perdedor do jogo
   *   'g:GRUPO:POS'   → colocado do grupo (ex.: 1º do Grupo A)
   *   ''              → a definir
   */
  lerLado(valor) {
    const [tipo, a, b] = String(valor || '').split(':');
    if (tipo === 't') return { timeId: a, origem: null };
    if (tipo === 'v') return { timeId: null, origem: { tipo: 'vencedor', jogoId: a } };
    if (tipo === 'p') return { timeId: null, origem: { tipo: 'perdedor', jogoId: a } };
    if (tipo === 'g') return { timeId: null, origem: { tipo: 'grupo', grupoId: a, posicao: Number(b) } };
    return { timeId: null, origem: null };
  },

  /** O contrário de lerLado: o valor do formulário para um lado do jogo. */
  valorLado(timeId, origem) {
    if (origem && origem.tipo === 'vencedor') return 'v:' + origem.jogoId;
    if (origem && origem.tipo === 'perdedor') return 'p:' + origem.jogoId;
    if (origem && origem.tipo === 'grupo') return `g:${origem.grupoId}:${origem.posicao}`;
    if (origem && origem.tipo === 'time') return 't:' + origem.timeId;
    return timeId ? 't:' + timeId : '';
  },

  /**
   * Cria (jogo = null) ou altera um jogo.
   * dados = { tipo: 'classificacao' | 'mata', rodadaTexto, grupoId, novoGrupo,
   *           casa, fora (valores de lerLado), data, hora, quadra }
   * Lança Error com mensagem amigável se algo estiver errado.
   */
  salvarJogo(catId, jogo, dados) {
    const D = App.dados;
    const { camp, cat } = D.categoria(catId);
    if (jogo && jogo.status === 'encerrado') throw new Error('Este jogo tem súmula encerrada. Reabra a súmula para editar.');

    // Fase / rodada / grupo
    let fase, rodada, rodadaNome, grupo = null;
    if (dados.tipo === 'mata') {
      const f = this.interpretarFase(dados.rodadaTexto);
      if (!f) throw new Error('Informe a fase (ex.: Quartas de final, Semifinal, Final).');
      if (f.fase === 'liga') throw new Error('“Rodada N” é de fase de classificação. No mata-mata use Quartas, Semifinal, Final...');
      fase = 'mata';
      rodadaNome = f.rodadaNome;
      rodada = this.blocoFase(rodadaNome);
    } else {
      const num = parseInt((String(dados.rodadaTexto || '').match(/\d+/) || [])[0], 10);
      if (!num) throw new Error('Informe o número da rodada (ex.: Rodada 1).');
      rodada = num;
      rodadaNome = `Rodada ${num}`;
      if (dados.novoGrupo) grupo = this.grupoPorNome(cat, dados.novoGrupo);
      else if (dados.grupoId) grupo = (cat.grupos || []).find((g) => g.id === dados.grupoId) || null;
      fase = grupo ? 'grupo' : 'liga';
    }

    // Times (ou origens)
    const casa = this.lerLado(dados.casa);
    const fora = this.lerLado(dados.fora);
    if (fase !== 'mata' && (casa.origem || fora.origem)) {
      throw new Error('“Vencedor do jogo” e “1º do grupo” só podem ser usados no mata-mata.');
    }
    if (dados.casa && dados.casa === dados.fora) throw new Error('Escolha dois times diferentes.');
    if (jogo && ((casa.origem && casa.origem.jogoId === jogo.id) || (fora.origem && fora.origem.jogoId === jogo.id))) {
      throw new Error('Um jogo não pode depender do resultado dele mesmo.');
    }

    const numeroDigitado = parseInt(dados.numero, 10) || null;
    if (numeroDigitado && D.db.jogos.some((j) => j !== jogo && j.campeonatoId === camp.id && j.numero === numeroDigitado)) {
      throw new Error(`Já existe um jogo nº ${numeroDigitado} neste campeonato.`);
    }

    const novo = !jogo;
    if (novo) {
      jogo = this.novoJogo(cat, camp, {});
      D.db.jogos.push(jogo);
    }

    // Se os times mudaram, a súmula antiga não vale mais
    const mudouTimes = !novo && (this.valorLado(jogo.casaId, jogo.origemCasa) !== (dados.casa || '') ||
      this.valorLado(jogo.foraId, jogo.origemFora) !== (dados.fora || ''));
    if (mudouTimes) { jogo.sumula = null; jogo.status = 'agendado'; }

    // Nova posição na ordem só se mudou de bloco (rodada/fase)
    const bloco = rodada;
    if (novo || Math.floor(jogo.ordem / 1000) !== bloco) {
      const ocupadas = D.db.jogos.filter((j) => j.categoriaId === catId && j !== jogo && Math.floor(j.ordem / 1000) === bloco)
        .map((j) => j.ordem % 1000);
      jogo.ordem = bloco * 1000 + (ocupadas.length ? Math.min(999, Math.max(...ocupadas) + 1) : 0);
    }

    Object.assign(jogo, {
      numero: numeroDigitado, // número oficial (opcional)
      fase, rodada, rodadaNome,
      grupoId: grupo ? grupo.id : null,
      casaId: casa.timeId, foraId: fora.timeId,
      origemCasa: casa.origem, origemFora: fora.origem,
      bye: false,
      data: dados.data || '', hora: dados.hora || '', quadra: dados.quadra || '',
    });
    if (jogo.terceiro && rodadaNome !== 'Disputa de 3º lugar') delete jogo.terceiro;

    // Times de um jogo de grupo passam a fazer parte do grupo
    if (grupo) [jogo.casaId, jogo.foraId].forEach((id) => { if (id && !grupo.timeIds.includes(id)) grupo.timeIds.push(id); });

    App.regras.atualizarMataMata(catId);
    D.salvar();
    return jogo;
  },

  /** Exclui um jogo (não deixa se a súmula estiver encerrada). */
  excluirJogo(jogo) {
    const D = App.dados;
    if (jogo.status === 'encerrado') throw new Error('Este jogo tem súmula encerrada. Reabra a súmula para excluir.');
    D.db.jogos = D.db.jogos.filter((j) => j !== jogo);
    App.regras.atualizarMataMata(jogo.categoriaId);
    D.salvar();
  },

  /** Jogos que dependem do resultado deste (para avisar antes de excluir). */
  dependentes(jogo) {
    return App.dados.db.jogos.filter((j) => [j.origemCasa, j.origemFora].some((o) => o && o.jogoId === jogo.id));
  },

  /**
   * Sobe (-1) ou desce (+1) um jogo dentro da mesma rodada/fase.
   * Troca de lugar com o vizinho: a posição E o horário/quadra.
   * Assim o jogo que sobe "pega" o horário mais cedo.
   */
  moverJogo(jogo, direcao) {
    const D = App.dados;
    const bloco = Math.floor(jogo.ordem / 1000);
    const lista = D.jogosDaCategoria(jogo.categoriaId).filter((j) => Math.floor(j.ordem / 1000) === bloco);
    const i = lista.indexOf(jogo);
    const outro = lista[i + direcao];
    if (!outro) throw new Error(direcao < 0 ? 'Já é o primeiro desta rodada/fase.' : 'Já é o último desta rodada/fase.');
    if (jogo.status === 'encerrado' || outro.status === 'encerrado') throw new Error('Não dá para mover jogos com súmula encerrada.');
    for (const campo of ['ordem', 'data', 'hora', 'quadra']) [jogo[campo], outro[campo]] = [outro[campo], jogo[campo]];
    // Se tinham a mesma ordem (dados antigos), garante que fiquem diferentes
    if (jogo.ordem === outro.ordem) jogo.ordem += direcao;
    D.salvar();
  },

  /**
   * IMPORTAÇÃO RÁPIDA POR TEXTO
   * Uma linha por jogo:  "Time A x Time B - 02/11 09:00 - Quadra 1"
   * Linhas de título mudam a rodada/fase ou o grupo dos jogos abaixo:
   *   "Rodada 2", "Semifinal", "Final", "Grupo A"
   * Devolve { jogos, erros, timesNovos } SEM gravar nada.
   */
  interpretarTexto(texto, catId, faseInicial = 'Rodada 1') {
    const D = App.dados;
    const { camp } = D.categoria(catId);
    const ano = camp && camp.dataInicio ? Number(camp.dataInicio.slice(0, 4)) : new Date().getFullYear();
    const porNome = new Map(D.timesDaCategoria(catId).map((t) => [this.normalizar(t.nome), t]));
    const novos = new Map(); // nome normalizado → nome como foi digitado

    let faseAtual = this.interpretarFase(faseInicial) || { fase: 'liga', rodada: 1, rodadaNome: 'Rodada 1' };
    let grupoAtual = '';
    const jogos = [];
    const erros = [];

    const separaTimes = /\s+(?:x|×|vs\.?|versus)\s+/i;
    const reData = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/;
    const reHora = /\b(\d{1,2})(?:[:h](\d{2})|h)(?!\d)/i;

    texto.split(/\r?\n/).forEach((bruta, idx) => {
      const linha = bruta.replace(/^\s*[-•*\d]+[.)]\s+/, '').trim(); // tira "1) " ou "- " do começo
      const n = idx + 1;
      if (!linha || linha.startsWith('#')) return;

      // Linha de título (sem "x" entre dois nomes)
      if (!separaTimes.test(linha)) {
        const g = linha.match(/^grupo\s+(.+)$/i);
        if (g) { grupoAtual = g[1].replace(/[:\-–]+$/, '').trim(); faseAtual = faseAtual.fase === 'mata' ? { fase: 'liga', rodada: 1, rodadaNome: 'Rodada 1' } : faseAtual; return; }
        const f = this.interpretarFase(linha.replace(/[:\-–]+$/, ''), true);
        if (f) { faseAtual = f; if (f.fase === 'mata') grupoAtual = ''; return; }
        erros.push({ linha: n, texto: linha, motivo: 'Não entendi. Use “Time A x Time B - 02/11 09:00 - Quadra 1”.' });
        return;
      }

      // Divide em partes: "Time A x Time B" - "02/11 09:00" - "Quadra 1"
      const partes = linha.split(/\s+[-–—|]\s+/);
      let [nomeA, nomeB] = partes[0].split(separaTimes);
      let resto = partes.slice(1);
      // Sem " - ": tenta achar a data no fim do nome do time B
      const m = (nomeB || '').match(/^(.*?)\s+(\d{1,2}\/\d{1,2}.*)$/);
      if (m) { nomeB = m[1]; resto = [m[2], ...resto]; }
      nomeA = (nomeA || '').trim();
      nomeB = (nomeB || '').trim();
      if (!nomeA || !nomeB) { erros.push({ linha: n, texto: linha, motivo: 'Faltou um dos times.' }); return; }
      if (this.normalizar(nomeA) === this.normalizar(nomeB)) { erros.push({ linha: n, texto: linha, motivo: 'O time não pode jogar contra ele mesmo.' }); return; }

      let data = '';
      let hora = '';
      const quadras = [];
      let erroData = '';
      for (let parte of resto) {
        const d = parte.match(reData);
        if (d) {
          const dia = Number(d[1]);
          const mes = Number(d[2]);
          let a = d[3] ? Number(d[3]) : ano;
          if (a < 100) a += 2000;
          if (dia < 1 || dia > 31 || mes < 1 || mes > 12) erroData = `Data inválida: ${d[0]}`;
          else data = `${a}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
          parte = parte.replace(d[0], ' ');
        }
        const h = parte.match(reHora);
        if (h) {
          const hh = Number(h[1]);
          const mm = Number(h[2] || 0);
          if (hh > 23 || mm > 59) erroData = `Horário inválido: ${h[0]}`;
          else hora = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
          parte = parte.replace(h[0], ' ');
        }
        parte = parte.replace(/\s+/g, ' ').trim();
        if (parte) quadras.push(parte);
      }
      if (erroData) { erros.push({ linha: n, texto: linha, motivo: erroData }); return; }

      // Times: existe na categoria? Senão, anota como "novo"
      const acha = (nome) => {
        const t = porNome.get(this.normalizar(nome));
        if (t) return { id: t.id, nome: t.nome };
        if (!novos.has(this.normalizar(nome))) novos.set(this.normalizar(nome), nome);
        return { id: null, nome: novos.get(this.normalizar(nome)) };
      };
      const a = acha(nomeA);
      const b = acha(nomeB);
      jogos.push({
        linha: n,
        casaId: a.id, casaNome: a.nome,
        foraId: b.id, foraNome: b.nome,
        data, hora, quadra: quadras.join(' - '),
        tipo: faseAtual.fase === 'mata' ? 'mata' : 'classificacao',
        rodadaTexto: faseAtual.rodadaNome,
        grupoNome: faseAtual.fase === 'mata' ? '' : grupoAtual,
      });
    });

    return { jogos, erros, timesNovos: [...novos.values()] };
  },

  /**
   * Grava os jogos interpretados do texto.
   * criarTimes = true → cria (sem jogadores) os times que não existem.
   */
  importarJogos(catId, resultado, criarTimes) {
    const D = App.dados;
    const U = App.util;
    const { camp, cat } = D.categoria(catId);
    // Interclasse: os "times" são as turmas — não cria time solto
    if (D.ehInterclasse(camp) && resultado.timesNovos.length) {
      throw new Error(`Estas turmas não participam desta modalidade: ${resultado.timesNovos.join(', ')}. Cadastre/marque as turmas antes.`);
    }
    // Confere ANTES de gravar qualquer coisa (para não importar pela metade)
    if (!criarTimes && resultado.timesNovos.length) {
      throw new Error(`Estes times não existem nesta categoria: ${resultado.timesNovos.join(', ')}.`);
    }
    const CORES = ['#1f6fd1', '#d93a2b', '#0f7a3d', '#f2b705', '#6b3fa0', '#00838f', '#c2185b', '#ef8a17', '#3949ab', '#222222'];
    const criados = new Map();
    const idDoNome = (id, nome) => {
      if (id) return id;
      const chave = this.normalizar(nome);
      if (!criados.has(chave)) {
        if (!criarTimes) throw new Error(`O time “${nome}” não existe nesta categoria.`);
        const t = {
          id: U.id(), campeonatoId: camp.id, categoriaId: cat.id, nome,
          cor: CORES[(D.timesDaCategoria(catId).length + criados.size) % CORES.length],
          escudo: '', tecnico: '', responsavel: '', telefone: '', sorteio: Math.random(), jogadores: [],
        };
        D.db.times.push(t);
        criados.set(chave, t.id);
      }
      return criados.get(chave);
    };
    const feitos = [];
    for (const j of resultado.jogos) {
      feitos.push(this.salvarJogo(catId, null, {
        tipo: j.tipo, rodadaTexto: j.rodadaTexto, novoGrupo: j.grupoNome,
        casa: 't:' + idDoNome(j.casaId, j.casaNome),
        fora: 't:' + idDoNome(j.foraId, j.foraNome),
        data: j.data, hora: j.hora, quadra: j.quadra,
      }));
    }
    return { jogos: feitos, timesCriados: criados.size };
  },
};
