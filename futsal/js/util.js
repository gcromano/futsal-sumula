/* =========================================================
   UTIL.JS — Funções ajudantes usadas em todo o app.
   Tudo fica dentro do objeto global "App" para não
   espalhar variáveis soltas pelo navegador.
   ========================================================= */

// Cria o "espaço" do app se ainda não existir.
// (globalThis funciona no navegador e também no Node, usado nos testes)
var App = globalThis.App = globalThis.App || {};

App.util = {
  /** Gera um id curto e único, ex.: "lq3k9a8b2c". */
  id() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  /** Protege texto antes de colocar no HTML (evita quebrar a página com < > & "). */
  esc(texto) {
    return String(texto ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /** Converte "2026-03-15" em "15/03/2026". */
  dataBR(iso) {
    if (!iso) return '';
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
  },

  /** Converte "2026-03-15" em "15/03" (curto, para listas). */
  dataCurta(iso) {
    if (!iso) return '';
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
  },

  /** Idade (em anos completos) numa data de referência. */
  idade(nascimento, referencia) {
    if (!nascimento) return null;
    const n = new Date(nascimento + 'T12:00:00');
    const r = referencia ? new Date(referencia + 'T12:00:00') : new Date();
    let anos = r.getFullYear() - n.getFullYear();
    const aindaNaoFezAniversario =
      r.getMonth() < n.getMonth() || (r.getMonth() === n.getMonth() && r.getDate() < n.getDate());
    if (aindaNaoFezAniversario) anos--;
    return anos;
  },

  /** Formata milissegundos como "mm:ss". */
  mmss(ms) {
    const totalSeg = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSeg / 60);
    const s = totalSeg % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  },

  /** Escolhe preto ou branco para o texto, conforme a cor de fundo. */
  corTexto(hex) {
    const c = (hex || '#888888').replace('#', '');
    const r = parseInt(c.substr(0, 2), 16);
    const g = parseInt(c.substr(2, 2), 16);
    const b = parseInt(c.substr(4, 2), 16);
    const luz = (r * 299 + g * 587 + b * 114) / 1000;
    return luz > 150 ? '#111' : '#fff';
  },

  /**
   * Países para a bandeira dos times (seleções).
   * O código é o de 2 letras (ISO), usado para montar o emoji da bandeira.
   */
  PAISES: {
    de: 'Alemanha', sa: 'Arábia Saudita', ar: 'Argentina', au: 'Austrália', at: 'Áustria', be: 'Bélgica',
    bo: 'Bolívia', br: 'Brasil', cm: 'Camarões', ca: 'Canadá', cl: 'Chile', cn: 'China', co: 'Colômbia',
    kr: 'Coreia do Sul', ci: 'Costa do Marfim', cr: 'Costa Rica', hr: 'Croácia', dk: 'Dinamarca',
    eg: 'Egito', ec: 'Equador', es: 'Espanha', us: 'EUA', fr: 'França', gh: 'Gana', gr: 'Grécia',
    nl: 'Holanda', it: 'Itália', jp: 'Japão', ma: 'Marrocos', mx: 'México', ng: 'Nigéria', no: 'Noruega',
    nz: 'Nova Zelândia', pa: 'Panamá', py: 'Paraguai', pe: 'Peru', pl: 'Polônia', pt: 'Portugal',
    gb: 'Reino Unido', cz: 'República Tcheca', ru: 'Rússia', sn: 'Senegal', rs: 'Sérvia', se: 'Suécia',
    ch: 'Suíça', tn: 'Tunísia', tr: 'Turquia', ua: 'Ucrânia', uy: 'Uruguai', ve: 'Venezuela',
  },

  /** Emoji da bandeira a partir do código do país ("br" → 🇧🇷). */
  bandeira(codigo) {
    const c = String(codigo || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(c)) return '';
    return String.fromCodePoint(...[...c].map((l) => 0x1F1E6 + l.charCodeAt(0) - 65));
  },

  /** HTML do escudo do time: bandeira, imagem ou bolinha colorida com a inicial. */
  escudo(time, classeExtra = '') {
    if (!time) return `<span class="escudo ${classeExtra}" style="background:#ccc">?</span>`;
    if (time.bandeira && App.util.bandeira(time.bandeira)) {
      return `<span class="escudo bandeira ${classeExtra}" title="${App.util.esc(App.util.PAISES[time.bandeira] || '')}">${App.util.bandeira(time.bandeira)}</span>`;
    }
    const cor = time.cor || '#888888';
    if (time.escudo) {
      return `<span class="escudo ${classeExtra}" style="background:${cor}"><img src="${time.escudo}" alt=""></span>`;
    }
    const inicial = App.util.esc((time.nome || '?').trim().charAt(0).toUpperCase());
    return `<span class="escudo ${classeExtra}" style="background:${cor};color:${App.util.corTexto(cor)}">${inicial}</span>`;
  },

  /** Lê todos os campos de um <form> e devolve um objeto { nome: valor }. */
  lerForm(form) {
    const dados = {};
    for (const campo of form.elements) {
      if (!campo.name) continue;
      if (campo.type === 'checkbox') dados[campo.name] = campo.checked;
      else if (campo.type === 'number') dados[campo.name] = campo.value === '' ? null : Number(campo.value);
      else dados[campo.name] = campo.value.trim();
    }
    return dados;
  },

  /** Mostra uma mensagem rápida no rodapé. tipo: '', 'ok', 'erro', 'aviso'. */
  toast(msg, tipo = '', duracao = 2600) {
    const area = document.getElementById('toasts');
    if (!area) return;
    const t = document.createElement('div');
    t.className = 'toast ' + tipo;
    t.textContent = msg;
    area.appendChild(t);
    setTimeout(() => t.remove(), duracao);
  },

  /** Vibra o celular (se o aparelho permitir). */
  vibrar(padrao = 80) {
    if (navigator.vibrate) navigator.vibrate(padrao);
  },

  /**
   * Abre uma janela (modal).
   * opcoes = { titulo, html, botoes: [{ texto, classe, acao(modal) }], aoAbrir(modal) }
   * Se a "acao" de um botão devolver false, o modal continua aberto.
   */
  modal(opcoes) {
    const fundo = document.createElement('div');
    fundo.className = 'modal-fundo';
    const botoes = opcoes.botoes || [{ texto: 'Fechar' }];
    fundo.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        ${opcoes.titulo ? `<h2>${App.util.esc(opcoes.titulo)}</h2>` : ''}
        <div class="modal-corpo">${opcoes.html || ''}</div>
        <div class="modal-botoes">
          ${botoes.map((b, i) => `<button type="button" class="btn ${b.classe || ''}" data-i="${i}">${App.util.esc(b.texto)}</button>`).join('')}
        </div>
      </div>`;
    const modal = {
      el: fundo.querySelector('.modal'),
      fechar() { fundo.remove(); },
    };
    fundo.addEventListener('click', (e) => {
      if (e.target === fundo) modal.fechar(); // clicou fora: fecha
      const b = e.target.closest('[data-i]');
      if (!b || !fundo.contains(b) || b.closest('.modal-corpo')) return;
      const botao = botoes[Number(b.dataset.i)];
      const resultado = botao.acao ? botao.acao(modal) : undefined;
      if (resultado !== false) modal.fechar();
    });
    document.body.appendChild(fundo);
    if (opcoes.aoAbrir) opcoes.aoAbrir(modal);
    return modal;
  },

  /** Pergunta sim/não. Devolve uma Promise com true ou false. */
  confirmar(mensagem, textoSim = 'Sim', classeSim = 'btn-primario') {
    return new Promise((resolver) => {
      App.util.modal({
        titulo: 'Confirmar',
        html: `<p>${App.util.esc(mensagem)}</p>`,
        botoes: [
          { texto: 'Cancelar', acao: () => resolver(false) },
          { texto: textoSim, classe: classeSim, acao: () => resolver(true) },
        ],
      });
    });
  },

  /** Faz o navegador baixar um arquivo com o conteúdo dado. */
  baixarArquivo(nome, conteudo, tipo = 'application/json') {
    const blob = new Blob([conteudo], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  /** Lê uma imagem escolhida e devolve um dataURL pequeno (quadrado de "tamanho" px). */
  reduzirImagem(arquivo, tamanho = 96) {
    return new Promise((resolver, rejeitar) => {
      const leitor = new FileReader();
      leitor.onerror = rejeitar;
      leitor.onload = () => {
        const img = new Image();
        img.onerror = rejeitar;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = tamanho;
          const ctx = canvas.getContext('2d');
          const lado = Math.min(img.width, img.height);
          ctx.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, tamanho, tamanho);
          resolver(canvas.toDataURL('image/png'));
        };
        img.src = leitor.result;
      };
      leitor.readAsDataURL(arquivo);
    });
  },

  /** Embaralha uma cópia da lista (algoritmo de Fisher-Yates). */
  embaralhar(lista, aleatorio = Math.random) {
    const copia = lista.slice();
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(aleatorio() * (i + 1));
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
  },
};
