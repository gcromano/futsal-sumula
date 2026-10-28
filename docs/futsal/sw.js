/* =========================================================
   SERVICE WORKER "DESLIGADOR"
   O app saiu deste endereço (GitHub Pages) e foi para
   https://futsal-sumula.web.app
   Quem tinha o app antigo instalado aqui recebe este arquivo
   na próxima vez que abrir: ele apaga as cópias guardadas,
   se desliga e recarrega a página — que agora redireciona
   para o endereço novo.
   ========================================================= */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.map((n) => caches.delete(n)));
    await self.registration.unregister();
    const janelas = await self.clients.matchAll({ type: 'window' });
    for (const janela of janelas) {
      if ('navigate' in janela) janela.navigate(janela.url).catch(() => {});
    }
  })());
});
