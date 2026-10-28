/* =========================================================
   APP.JS — Liga tudo: navegação entre telas (rotas).

   O app usa o "hash" da URL para saber qual tela mostrar:
     #/                          → início (lista de campeonatos)
     #/camp/ID/CATEGORIA/ABA     → campeonato
     #/time/ID                   → página do time
     #/jogador/ID                → página do jogador
     #/sumula/ID                 → súmula ao vivo
     #/imprimir/TIPO/ID          → relatórios para imprimir/PDF
     #/backup                    → backup e dados de exemplo
   ========================================================= */

var App = globalThis.App = globalThis.App || {};
App.telas = App.telas || {};

/** Lista de rotas: [expressão, função que desenha a tela]. */
App.rotas = [
  [/^#?\/?$/, () => App.telas.inicio.render()],
  [/^#\/camp\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?$/, (m) => App.telas.campeonato.render(m[1], m[2], m[3])],
  [/^#\/time\/([^/]+)$/, (m) => App.telas.time.render(m[1])],
  [/^#\/jogador\/([^/]+)$/, (m) => App.telas.time.renderJogador(m[1])],
  [/^#\/sumula\/([^/]+)$/, (m) => App.telas.sumula.render(m[1])],
  [/^#\/imprimir\/([^/]+)\/([^/]+)$/, (m) => App.telas.relatorios.render(m[1], m[2])],
  [/^#\/backup$/, () => App.telas.backup.render()],
];

/** Função de "limpeza" da tela atual (ex.: parar o cronômetro da súmula). */
App.aoSair = null;

/** Endereço para onde o botão ‹ volta. */
App.voltarPara = '#/';

/** Muda o título do topo e o destino do botão voltar. */
App.titulo = function (texto, voltarPara) {
  document.getElementById('titulo-tela').textContent = texto;
  document.title = texto + ' · Futsal Súmula';
  App.voltarPara = voltarPara || null;
  document.getElementById('btn-voltar').style.visibility = voltarPara ? 'visible' : 'hidden';
};

/**
 * Pode editar este campeonato? (admin no modo online; sempre no modo local)
 * Só serve para a tela — quem garante a segurança são as regras do Firestore.
 */
App.podeEditar = function (camp) {
  return App.nuvem.podeEditar(camp);
};

/** Liga/desliga o modo "só leitura" (esconde botões com a classe so-admin). */
App.leitura = function (somenteLeitura) {
  document.body.classList.toggle('leitura', !!somenteLeitura);
};

/** Atualiza o botão da conta e a bolinha de sincronização no topo. */
App.atualizarStatus = function () {
  const N = App.nuvem;
  const btn = document.getElementById('btn-conta');
  if (!btn) return;
  btn.classList.toggle('oculto', !N.ativo);
  if (!N.ativo) return;
  const icone = document.getElementById('conta-icone');
  const status = document.getElementById('status-sync');
  if (N.usuario) {
    icone.innerHTML = N.usuario.foto ? `<img src="${App.util.esc(N.usuario.foto)}" alt="" referrerpolicy="no-referrer">` : App.util.esc(N.usuario.email.charAt(0).toUpperCase());
  } else {
    icone.textContent = '👤';
  }
  status.className = 'status-sync';
  if (!N.usuario) status.classList.add('visitante');
  else if (!navigator.onLine) status.classList.add('offline');
  else if (N.pendentes > 0) status.classList.add('pendente');
  btn.title = !N.usuario ? 'Entrar' : !navigator.onLine ? 'Sem internet: as alterações ficam guardadas e serão enviadas depois'
    : N.pendentes ? 'Enviando alterações...' : 'Tudo salvo na nuvem';
};

/** Janela da conta: entrar, sair e situação da sincronização. */
App.abrirConta = function () {
  const N = App.nuvem;
  const U = App.util;
  if (!N.usuario) { N.entrar(); return; }
  const situacao = !navigator.onLine
    ? `<div class="aviso-faixa amarela">📴 Sem internet. ${N.pendentes ? 'Há alterações guardadas neste aparelho; elas serão enviadas sozinhas quando a conexão voltar.' : 'Nada pendente.'}</div>`
    : N.pendentes ? '<div class="aviso-faixa amarela">⏳ Enviando alterações...</div>'
      : '<div class="aviso-faixa verde">✅ Tudo salvo na nuvem.</div>';
  U.modal({
    titulo: 'Minha conta',
    html: `<p>Conectado como<br><b>${U.esc(N.usuario.nome)}</b><br><span class="suave">${U.esc(N.usuario.email)}</span></p>${situacao}
      ${N.pendentes ? '<p class="suave">Não saia da conta antes de tudo ser enviado.</p>' : ''}`,
    botoes: [
      { texto: 'Fechar' },
      {
        texto: 'Sair da conta', classe: 'btn-perigo',
        acao: () => {
          if (N.pendentes && !confirm('Ainda há alterações não enviadas. Sair mesmo assim?')) return false;
          N.sair();
        },
      },
    ],
  });
};

/** Desenha a tela conforme o endereço atual. */
App.render = function () {
  if (App.aoSair) { App.aoSair(); App.aoSair = null; }
  App.leitura(false); // cada tela liga o modo leitura se precisar
  const hash = location.hash || '#/';
  for (const [regex, desenhar] of App.rotas) {
    const m = hash.match(regex);
    if (m) {
      try {
        desenhar(m);
      } catch (e) {
        console.error(e);
        App.main().innerHTML = `<div class="cartao vazio">Ops, algo deu errado nesta tela.<br><small>${App.util.esc(e.message)}</small><br><br><a class="btn" href="#/">Ir para o início</a></div>`;
      }
      return;
    }
  }
  location.hash = '#/';
};

/** Atalho para o <main id="app">. */
App.main = function () {
  return document.getElementById('app');
};

/** Vai para outro endereço (se já estiver nele, só redesenha). */
App.ir = function (hash) {
  if (location.hash === hash) App.render();
  else location.hash = hash;
};

/* ---------- Início do app ---------- */
App.iniciar = function () {
  App.nuvem.iniciar();   // liga o Firebase se estiver configurado
  App.dados.carregar();
  document.getElementById('btn-conta').addEventListener('click', App.abrirConta);
  App.atualizarStatus();

  // Navegação
  window.addEventListener('hashchange', () => { App.render(); window.scrollTo(0, 0); });
  document.getElementById('btn-voltar').addEventListener('click', () => {
    if (App.voltarPara) location.hash = App.voltarPara;
  });

  // Qualquer elemento com data-href vira um "link" (útil dentro de cartões)
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-href]');
    if (el && !e.target.closest('button, a, input, select, label')) location.hash = el.dataset.href;
  });

  App.render();

  // PWA: registra o "service worker" que faz o app funcionar offline.
  // No computador de desenvolvimento (localhost) fica desligado para as
  // mudanças no código aparecerem na hora. Para testar mesmo assim: ?sw
  const local = ['localhost', '127.0.0.1'].includes(location.hostname) && !location.search.includes('sw');
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !local) {
    // Já havia um service worker controlando a página? (se não, é a 1ª visita: não recarrega)
    const jaTinhaControle = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (jaTinhaControle) App.atualizacao.novaVersao('service worker novo');
    });
    // updateViaCache 'none': o navegador sempre confere o sw.js no servidor
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then((reg) => { App.atualizacao.registro = reg; })
      .catch((e) => console.warn('Service worker não registrado', e));
  }

  // Procura versão nova ao abrir e sempre que o app volta a aparecer na tela
  setTimeout(() => App.atualizacao.verificar(true), 2500);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') App.atualizacao.verificar();
  });
  window.addEventListener('online', () => App.atualizacao.verificar());
  window.addEventListener('hashchange', () => App.atualizacao.tentarRecarregar());
};

/* =========================================================
   ATUALIZAÇÃO AUTOMÁTICA
   Como o app descobre que você publicou uma versão nova:
   1) "Impressão digital": pergunta ao servidor a data/ETag de
      cada arquivo do app (index.html, .js, .css). É leve: o
      servidor responde só "mudou / não mudou". Se mudou desde
      que a página abriu → versão nova.
   2) Service worker novo instalado → também é versão nova.
   Então recarrega sozinho — MAS nunca no meio de uma súmula,
   com uma janela aberta ou com alguém digitando. Na súmula
   aparece só o aviso "Nova versão disponível — atualizar".
   ========================================================= */
App.atualizacao = {
  registro: null,       // registro do service worker
  impressao: null,      // impressão digital dos arquivos quando a página abriu
  pendente: false,      // há versão nova esperando para recarregar?
  verificando: false,
  ultimaVerificacao: 0,
  timer: null,

  /** Arquivos do app carregados nesta página (menos o SDK do Firebase, que não muda). */
  arquivos() {
    const urls = new Set([new URL('index.html', location.href).pathname]);
    document.querySelectorAll('script[src], link[rel="stylesheet"]').forEach((el) => {
      const u = new URL(el.src || el.href, location.href);
      if (u.origin === location.origin && !u.pathname.includes('/vendor/')) urls.add(u.pathname);
    });
    return [...urls];
  },

  /** Junta ETag/data de cada arquivo numa "impressão digital" da versão publicada. */
  async impressaoAtual() {
    const partes = await Promise.all(this.arquivos().map(async (url) => {
      const r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      const marca = r.headers.get('etag') || r.headers.get('last-modified');
      if (marca) return `${url}=${marca}`;
      // Sem ETag/data: usa um resumo do conteúdo
      const texto = await r.text();
      let h = 0;
      for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) | 0;
      return `${url}=${texto.length}:${h}`;
    }));
    return partes.join('|');
  },

  /** Confere se há versão nova (no máximo 1 vez a cada 30 s, a não ser que "agora"). */
  async verificar(agora) {
    if (this.pendente || this.verificando || !navigator.onLine) return;
    if (!agora && Date.now() - this.ultimaVerificacao < 30000) return;
    this.verificando = true;
    this.ultimaVerificacao = Date.now();
    try {
      if (this.registro) this.registro.update().catch(() => {});
      const atual = await this.impressaoAtual();
      if (!this.impressao) this.impressao = atual;              // 1ª vez: guarda a da página aberta
      else if (atual !== this.impressao) this.novaVersao('arquivos mudaram');
    } catch (e) {
      // Sem internet ou servidor fora: tenta de novo na próxima vez
    } finally {
      this.verificando = false;
    }
  },

  /** Chegou versão nova: recarrega se for seguro; se não, espera (e avisa na súmula). */
  novaVersao(motivo) {
    console.info('Nova versão do app:', motivo);
    this.pendente = true;
    this.tentarRecarregar();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tentarRecarregar(), 1500);
  },

  /** Pode recarregar agora sem atrapalhar ninguém? */
  seguro() {
    const ativo = document.activeElement;
    const digitando = ativo && /^(INPUT|TEXTAREA|SELECT)$/.test(ativo.tagName);
    const enviando = App.nuvem && App.nuvem.pendentes > 0;
    return !App.atualizacao.naSumula() && !document.querySelector('.modal-fundo') && !digitando && !enviando;
  },

  naSumula() {
    return (location.hash || '').startsWith('#/sumula/');
  },

  tentarRecarregar() {
    if (!this.pendente) return;
    if (this.seguro()) { this.recarregar(); return; }
    this.mostrarAviso(this.naSumula());
  },

  recarregar() {
    if (this.recarregando) return;
    this.recarregando = true;
    location.reload();
  },

  /** Faixa discreta no rodapé. Só aparece na súmula (no resto, recarrega sozinho). */
  mostrarAviso(mostrar) {
    let aviso = document.getElementById('aviso-versao');
    if (!mostrar) { if (aviso) aviso.remove(); return; }
    if (aviso) return;
    aviso = document.createElement('button');
    aviso.id = 'aviso-versao';
    aviso.className = 'aviso-versao nao-imprimir';
    aviso.innerHTML = '🔄 Nova versão disponível — <u>atualizar</u>';
    aviso.onclick = () => this.recarregar();
    document.body.appendChild(aviso);
  },
};

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', App.iniciar);
}
