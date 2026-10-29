/* =========================================================
   SERVICE WORKER — faz o app abrir mesmo sem internet
   e receber as atualizações sozinho.

   ESTRATÉGIAS DE CACHE
   - Páginas, .js, .css e manifest → "internet primeiro"
     (network-first): sempre tenta a versão mais nova do site.
     Se estiver sem internet (ou a internet demorar mais de
     4 segundos), usa a cópia guardada.
   - Ícones, bandeiras e o SDK do Firebase (js/vendor) → "cache primeiro":
     quase nunca mudam, então abrem na hora.

   ATUALIZAÇÃO
   - Versão nova deste arquivo instalada → ativa na hora
     (skipWaiting + clients.claim) e a página decide quando
     recarregar (nunca no meio de uma súmula).
   - Não precisa mudar a VERSAO a cada publicação: o app
     detecta sozinho quando os arquivos mudaram (veja app.js).
     Mude a VERSAO só se mudar a lista ARQUIVOS abaixo.
   ========================================================= */

const VERSAO = 'futsal-v8';
const TEMPO_LIMITE_REDE = 4000; // ms: depois disso usa o cache (internet fraca na quadra)

const ARQUIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/estilo.css',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/util.js',
  './js/vendor/firebase-app-compat.js',
  './js/vendor/firebase-auth-compat.js',
  './js/vendor/firebase-firestore-compat.js',
  './js/firebase-config.js',
  './js/dados.js',
  './js/nuvem.js',
  './js/tabela.js',
  './js/regras.js',
  './js/interclasse.js',
  './js/exemplo.js',
  './js/app.js',
  './js/telas/inicio.js',
  './js/telas/campeonato.js',
  './js/telas/jogos.js',
  './js/telas/time.js',
  './js/telas/sumula.js',
  './js/telas/sumula-esportes.js',
  './js/telas/relatorios.js',
  './js/telas/backup.js',
  './js/telas/interclasse.js',
  // Bandeiras das seleções (flag-icons, licença MIT) — guardadas para funcionar offline
  './icons/bandeiras/ar.svg',
  './icons/bandeiras/at.svg',
  './icons/bandeiras/au.svg',
  './icons/bandeiras/be.svg',
  './icons/bandeiras/bo.svg',
  './icons/bandeiras/br.svg',
  './icons/bandeiras/ca.svg',
  './icons/bandeiras/ch.svg',
  './icons/bandeiras/ci.svg',
  './icons/bandeiras/cl.svg',
  './icons/bandeiras/cm.svg',
  './icons/bandeiras/cn.svg',
  './icons/bandeiras/co.svg',
  './icons/bandeiras/cr.svg',
  './icons/bandeiras/cz.svg',
  './icons/bandeiras/de.svg',
  './icons/bandeiras/dk.svg',
  './icons/bandeiras/ec.svg',
  './icons/bandeiras/eg.svg',
  './icons/bandeiras/es.svg',
  './icons/bandeiras/fr.svg',
  './icons/bandeiras/gb.svg',
  './icons/bandeiras/gh.svg',
  './icons/bandeiras/gr.svg',
  './icons/bandeiras/hr.svg',
  './icons/bandeiras/it.svg',
  './icons/bandeiras/jp.svg',
  './icons/bandeiras/kr.svg',
  './icons/bandeiras/ma.svg',
  './icons/bandeiras/mx.svg',
  './icons/bandeiras/ng.svg',
  './icons/bandeiras/nl.svg',
  './icons/bandeiras/no.svg',
  './icons/bandeiras/nz.svg',
  './icons/bandeiras/pa.svg',
  './icons/bandeiras/pe.svg',
  './icons/bandeiras/pl.svg',
  './icons/bandeiras/pt.svg',
  './icons/bandeiras/py.svg',
  './icons/bandeiras/rs.svg',
  './icons/bandeiras/ru.svg',
  './icons/bandeiras/sa.svg',
  './icons/bandeiras/se.svg',
  './icons/bandeiras/sn.svg',
  './icons/bandeiras/tn.svg',
  './icons/bandeiras/tr.svg',
  './icons/bandeiras/ua.svg',
  './icons/bandeiras/us.svg',
  './icons/bandeiras/uy.svg',
  './icons/bandeiras/ve.svg',
];

// Instalação: baixa tudo direto do servidor (sem cache HTTP) e ativa na hora
self.addEventListener('install', (evento) => {
  self.skipWaiting();
  evento.waitUntil(
    caches.open(VERSAO).then((cache) =>
      cache.addAll(ARQUIVOS.map((url) => new Request(url, { cache: 'reload' }))))
  );
});

// Ativação: apaga caches antigos e assume as páginas abertas
self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    const nomes = await caches.keys();
    // Versões antigas do app (até a v4) não sabiam se atualizar sozinhas.
    // Para elas, recarregamos as páginas abertas UMA vez — menos quem está na súmula.
    const vindoDeVersaoAntiga = nomes.some((n) => /^futsal-v[1-4]$/.test(n));
    await Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n)));
    await self.clients.claim();
    if (vindoDeVersaoAntiga) {
      const janelas = await self.clients.matchAll({ type: 'window' });
      for (const janela of janelas) {
        if (janela.url.includes('#/sumula/')) continue;
        if ('navigate' in janela) janela.navigate(janela.url).catch(() => {});
      }
    }
  })());
});

/** Arquivos que devem vir da internet primeiro. */
function ehDoApp(url, pedido) {
  if (pedido.mode === 'navigate') return true;
  if (url.pathname.includes('/js/vendor/')) return false; // SDK do Firebase: cache primeiro
  return /\.(html|js|css|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
}

// Pedidos do app
self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);
  if (url.origin !== location.origin) return; // Firebase, Google etc.: não mexe

  evento.respondWith(ehDoApp(url, pedido) ? internetPrimeiro(evento, pedido) : cachePrimeiro(pedido));
});

/**
 * Internet primeiro: tenta o servidor (validando com ele, sem usar cache HTTP velho).
 * Sem internet ou demorando demais → usa a cópia guardada.
 */
async function internetPrimeiro(evento, pedido) {
  const cache = await caches.open(VERSAO);
  const daRede = fetch(pedido, { cache: 'no-cache' }).then((resposta) => {
    if (resposta.ok) cache.put(pedido, resposta.clone());
    return resposta;
  });
  // Mesmo se respondermos com o cache por causa da demora, deixa terminar e atualizar a cópia
  evento.waitUntil(daRede.catch(() => {}));

  const salvo = () => cache.match(pedido, { ignoreSearch: true })
    .then((r) => r || (pedido.mode === 'navigate' ? cache.match('./index.html') : undefined));

  try {
    return await Promise.race([
      daRede,
      new Promise((_, falhar) => setTimeout(() => falhar(new Error('demorou')), TEMPO_LIMITE_REDE)),
    ]);
  } catch (e) {
    const copia = await salvo();
    if (copia) return copia;
    return daRede; // não tem cópia: espera a internet mesmo
  }
}

/** Cache primeiro: abre na hora; se não tiver, busca e guarda. */
async function cachePrimeiro(pedido) {
  const cache = await caches.open(VERSAO);
  const salvo = await cache.match(pedido, { ignoreSearch: true });
  if (salvo) return salvo;
  const resposta = await fetch(pedido);
  if (resposta.ok) cache.put(pedido, resposta.clone());
  return resposta;
}
