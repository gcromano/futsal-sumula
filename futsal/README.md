# ⚽ Futsal Súmula

App web para organizar **campeonatos de futsal infantil** com **súmula digital** na beira da quadra.
Funciona no celular (instalável e offline) e no computador. Não precisa de servidor nem de internet depois de instalado.

---

## O que ele faz

- **Campeonatos** com várias categorias (Sub-7, Sub-9, Sub-11...), cada uma com sua configuração:
  tempo de jogo, pontuação, critérios de desempate (em ordem que você escolhe) e formato
  (pontos corridos, grupos + mata-mata ou só mata-mata).
- **Times e elencos** com camisa, nome, nascimento e posição. Alerta quando a idade não bate com a categoria.
- **Tabela de jogos gerada sozinha**, com datas, horários e quadras editáveis. No mata-mata o vencedor avança sozinho.
- **Súmula ao vivo**: placar grande, cronômetro, gols (com assistência), gol contra, faltas, cartões e pedido de tempo.
  - Faltas por período sempre visíveis, com aviso na 5ª falta (a próxima é tiro livre direto sem barreira).
  - 1 pedido de tempo por time por período (o segundo é bloqueado).
  - Jogador expulso ou suspenso aparece bloqueado.
  - Pênaltis no mata-mata quando empata.
  - Linha do tempo com editar/excluir, observações do árbitro, encerrar (trava) e reabrir.
- **Suspensões automáticas**: vermelho = fora do próximo jogo; 3 amarelos (configurável) = fora do próximo jogo e zera.
  2 amarelos no mesmo jogo contam como expulsão.
- **Classificação e estatísticas** que se atualizam quando a súmula é encerrada: tabela, artilharia, assistências,
  goleiro menos vazado, disciplina, página de cada time e de cada jogador.
- **Relatórios para imprimir ou salvar em PDF**: súmula oficial, tabela de jogos, classificação e artilharia.
- **Backup** em arquivo `.json` para guardar ou passar os dados para outro aparelho.

---

## Como rodar no computador

**Jeito mais fácil:** dê dois cliques no arquivo `index.html`. Ele abre no navegador e já funciona
(só o modo offline/instalação não funciona assim).

**Jeito recomendado (igual ao celular):** abra o Terminal nesta pasta e rode:

```bash
python3 -m http.server 8123
```

Depois abra <http://localhost:8123> no navegador.

> No `localhost` o modo offline fica desligado de propósito, para suas mudanças no código aparecerem na hora.
> Para testar o modo offline mesmo assim, abra <http://localhost:8123/?sw>.

**Para testar logo:** na tela inicial toque em **Carregar exemplo** (ou no 💾 → *Adicionar campeonato de exemplo*).
Ele cria um campeonato fictício com times, jogos, súmulas, cartões e suspensões.

---

## Como instalar no celular

Para instalar, o app precisa estar num endereço **https** (um site). Opções gratuitas:
GitHub Pages, Netlify ou Cloudflare Pages — é só subir esta pasta inteira.

Depois de abrir o endereço no celular:

- **Android (Chrome):** menu ⋮ → **Instalar app** (ou *Adicionar à tela inicial*).
- **iPhone (Safari):** botão **Compartilhar** → **Adicionar à Tela de Início**.

Pronto: aparece um ícone ⚽ e o app abre em tela cheia, **mesmo sem internet**.
Quando você atualizar os arquivos no site, o celular baixa a versão nova sozinho (aparece na próxima vez que abrir).

---

## Backup (importante!)

Os dados ficam salvos **só no navegador daquele aparelho**. Se limpar os dados do navegador, perde tudo.

- **Fazer backup:** toque no 💾 (canto de cima) → **Baixar backup (.json)**.
- **Passar para outro aparelho:** mande o arquivo `.json` (WhatsApp, e-mail, Drive) e no outro aparelho
  toque em 💾 → **Escolher arquivo**. ⚠️ Isso **substitui** os dados que estavam lá.
- Dica: faça um backup no fim de cada dia de jogos.

> Se você e seu amigo usarem aparelhos diferentes, combinem quem está com a "versão oficial" e passem o
> backup de um para o outro. Os dois não se sincronizam sozinhos.

---

## Usando na quadra (passo a passo)

1. Crie o campeonato (botão **+**) e as categorias.
2. Em cada categoria, aba **Config.**: escolha formato, tempo, pontuação e desempate.
3. Aba **Times**: cadastre os times e, dentro de cada um, os jogadores.
4. Aba **Jogos** → **Gerar tabela**. Toque no ✏️ de cada jogo para ajustar data, hora e quadra.
5. No dia, toque no jogo para abrir a **súmula**, preencha árbitros/mesa e use **Iniciar**.
6. No fim de cada período: **Encerrar período** (as faltas zeram).
7. No fim: **Encerrar jogo** → a classificação, estatísticas e suspensões se atualizam.
8. Para mandar no WhatsApp: botões 🖨️ → **Imprimir / Salvar PDF** → *Salvar como PDF*.

---

## Regras que o app usa

- **Idade:** cada categoria tem o campo *“Nascidos a partir do ano”*. O app sugere sozinho:
  Sub-11 em 2026 → nascidos em 2016 ou depois. Mude se o regulamento do seu campeonato for diferente.
- **Desempate:** aplicado na ordem configurada. O *confronto direto* considera só os jogos entre os times empatados
  (funciona com 3 ou mais empatados). *Menos cartões*: amarelo = 1, vermelho = 3. *Sorteio*: um número aleatório por time
  (dá para refazer na aba Config.).
- **Suspensões:** calculadas na ordem dos jogos (rodada, depois data/hora). O jogador cumpre no próximo jogo do time dele.
- **Goleiro menos vazado:** gols sofridos pelo time vão para o *goleiro titular* marcado na súmula (campo em *Dados do jogo*).
- **Mata-mata:** se o número de times não fechar a chave (ex.: 6), os melhores colocados passam direto na 1ª fase.
  Em grupos + mata-mata, os cruzamentos são 1º de um grupo × 2º do outro.

---

## Como o código está organizado (para estudar)

```
index.html              → a página única; carrega os scripts na ordem
manifest.webmanifest    → dados do app instalável (nome, ícone, cores)
sw.js                   → service worker: guarda os arquivos para funcionar offline
css/estilo.css          → todo o visual (celular primeiro) + layout de impressão
icons/                  → ícones do app
js/
  util.js               → ajudantes: ids, datas, modal, toast, download...
  dados.js              → salvar/carregar no navegador, buscas e backup
  tabela.js             → geração da tabela (todos contra todos, grupos, chave)
  regras.js             → o "cérebro": placar, vencedor, classificação,
                          desempate, suspensões, estatísticas
  exemplo.js            → campeonato fictício para testes
  app.js                → navegação entre telas (rotas pelo #/endereço)
  telas/
    inicio.js           → lista de campeonatos
    campeonato.js       → abas Jogos, Classificação, Times, Estatísticas, Suspensos, Config.
    time.js             → página do time e do jogador (e seus formulários)
    sumula.js           → súmula ao vivo
    relatorios.js       → páginas para imprimir/PDF
    backup.js           → exportar, importar, exemplo, apagar tudo
```

**Ideia principal:** a súmula guarda só os **eventos** (gol, falta, cartão...). Placar, classificação,
artilharia e suspensões são sempre **calculados** a partir deles em `regras.js`. Por isso, ao editar
ou reabrir uma súmula, tudo se ajusta sozinho.

Todos os scripts ficam dentro de um objeto global `App` (ex.: `App.regras.classificacao(...)`).
Abra o console do navegador (F12) e brinque com eles.
