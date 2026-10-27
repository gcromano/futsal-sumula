/* =========================================================
   SERVICE WORKER — faz o app abrir mesmo sem internet.

   Na primeira visita, guarda todos os arquivos do app no
   "cache" do navegador. Depois, abre direto do cache.

   Quando há internet, ele também baixa as versões novas
   em segundo plano (aparecem na próxima vez que abrir).
   Se mudar muita coisa, aumente a VERSAO abaixo para
   forçar todos os celulares a baixarem tudo de novo.
   ========================================================= */

const VERSAO = 'futsal-v1';

const ARQUIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/estilo.css',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/util.js',
  './js/dados.js',
  './js/tabela.js',
  './js/regras.js',
  './js/exemplo.js',
  './js/app.js',
  './js/telas/inicio.js',
  './js/telas/campeonato.js',
  './js/telas/time.js',
  './js/telas/sumula.js',
  './js/telas/relatorios.js',
  './js/telas/backup.js',
];

// Instalação: baixa e guarda tudo
self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSAO).then((cache) => cache.addAll(ARQUIVOS)));
  self.skipWaiting();
});

// Ativação: apaga caches de versões antigas
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});

// Pedidos: responde com o que está guardado (rápido e funciona offline)
// e, ao mesmo tempo, busca a versão nova na internet para a próxima vez.
// (estratégia "stale-while-revalidate")
self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return;
  if (new URL(evento.request.url).origin !== location.origin) return;
  evento.respondWith(
    caches.open(VERSAO).then(async (cache) => {
      const salvo = await cache.match(evento.request, { ignoreSearch: true });
      const daRede = fetch(evento.request)
        .then((resposta) => {
          if (resposta.ok) cache.put(evento.request, resposta.clone());
          return resposta;
        })
        .catch(() => salvo || cache.match('./index.html'));
      return salvo || daRede;
    })
  );
});
