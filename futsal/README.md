# ⚽ Futsal Súmula

App web para organizar **campeonatos de futsal infantil e escolar** com **súmula digital** na beira da quadra.
Funciona no celular (instalável e offline) e no computador, hospedado de graça no GitHub Pages.

- **Modo online** (com Firebase): dados na nuvem, login Google, admins por campeonato, campeonatos
  públicos ou privados. Continua funcionando sem internet e envia tudo quando a conexão volta.
- **Modo local** (sem Firebase configurado): dados só no aparelho, como na primeira versão.

👉 Para ligar o modo online, siga o **[GUIA-FIREBASE.md](GUIA-FIREBASE.md)**.

---

## O que ele faz

- **Campeonatos** com várias categorias (Sub-7, Sub-9, Sub-11...), cada uma com sua configuração:
  tempo de jogo, pontuação, critérios de desempate (em ordem que você escolhe) e formato
  (pontos corridos, grupos + mata-mata ou só mata-mata).
- **Times e elencos** com camisa, nome, nascimento e posição. Elenco pode ser **colado em texto** (um jogador por linha). Alerta quando a idade não bate com a categoria
  (dá para desligar por campeonato, ex.: categorias por ano escolar). Seleções podem mostrar a **bandeira** do país.
- **Tabela de jogos do jeito que precisar**: gerada sozinha, montada jogo a jogo, colada em texto — ou tudo misturado.
  Qualquer jogo pode ser editado, trocado, reordenado ou excluído. No mata-mata o vencedor avança sozinho.
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
- **⚡ Resultado rápido**: lançar só o placar final (e pênaltis no mata-mata), sem súmula. Conta na classificação.
- **Relatórios para imprimir ou salvar em PDF**: súmula oficial, tabela de jogos, classificação e artilharia.
- **Backup** em arquivo `.json` para guardar ou passar os dados para outro aparelho.
- **Online:** login Google, admins por campeonato, visibilidade pública/privada, histórico de quem alterou o quê.

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
>
> ⚠️ Com o Firebase configurado, o `localhost` usa o **banco de verdade**. Para testar sem mexer nele,
> abra <http://localhost:8123/?local> (força o modo local, dados só no navegador).

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

## Modo online: quem vê e quem edita

- **Qualquer pessoa logada** (conta Google) pode criar um campeonato e vira **admin** dele.
- Cada campeonato tem sua **lista de admins** (e-mails). Só eles editam e veem a aba Config.
  Admin de um campeonato **não** vê nem mexe nos campeonatos privados dos outros.
- **Visibilidade** (padrão: 🔒 **Privado**):
  - 🔒 **Privado**: só os admins veem.
  - 🌐 **Público**: qualquer visitante, sem login, vê tabela, resultados, classificação, artilharia e estatísticas,
    sem nenhum botão de edição. Telefones, responsáveis e datas de nascimento **nunca** aparecem para visitantes.
- A segurança está nas **regras do Firestore** (`firestore.rules`): mesmo pelo console do navegador ninguém lê
  campeonato privado nem grava onde não é admin. As regras foram testadas automaticamente (53 situações).
- Toda alteração guarda **quem fez e quando** (hora do servidor). Veja em Config. → 🕘 Últimas alterações.
- **Sem internet na quadra?** Continue lançando a súmula. A bolinha no 👤 fica laranja/cinza e tudo é enviado
  sozinho quando a conexão voltar (mesmo se fechar e abrir o app). Só não saia da conta antes.
- Se duas pessoas editarem **o mesmo jogo ao mesmo tempo**, vale a última gravação. Combinem quem lança cada jogo.

Como entrar pela primeira vez, criar a Copa CES e adicionar outros admins: veja o **GUIA-FIREBASE.md**.

---

## Backup (importante!)

**Modo online:** os dados ficam na nuvem. O backup (💾 → Baixar) leva os campeonatos em que você é admin;
importar um arquivo cria/atualiza esses campeonatos na nuvem com você como admin.
Se o aparelho tinha dados da versão antiga (sem nuvem), aparece na tela inicial o botão **☁️ Enviar para a nuvem**.

**Modo local:** os dados ficam salvos **só no navegador daquele aparelho**. Se limpar os dados do navegador, perde tudo.

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
3. Aba **Times**: cadastre os times e, dentro de cada um, os jogadores (um por um no **+**, ou de uma vez
   em **📋 Colar elenco em texto**, veja abaixo).
4. Aba **Jogos** → escolha **Gerar automaticamente**, **Montar manualmente** ou **Colar tabela em texto**
   (veja a seção abaixo). Toque no ✏️ de um jogo para mudar times, rodada, data, hora e quadra.
5. No dia, toque no jogo para abrir a **súmula**, preencha árbitros/mesa e use **Iniciar**.
6. No fim de cada período: **Encerrar período** (as faltas zeram).
7. No fim: **Encerrar jogo** → a classificação, estatísticas e suspensões se atualizam.
8. Para mandar no WhatsApp: botões 🖨️ → **Imprimir / Salvar PDF** → *Salvar como PDF*.

---

## Colar elenco em texto

Na página do time (só admins): **📋 Colar elenco em texto**. Um jogador por linha:

```text
1 - Pedro Souza - goleiro
7 - Lucas Lima
10 - João Silva - 15/03/2016
```

- Formato básico: `número - nome`. Também aceita `10 João Silva`, `10. João`, `10) João`.
- Opcional, depois de outro ` - `: data de nascimento (`15/03/2016`) e/ou `goleiro`. Também vale `Pedro (G)`.
- Antes de gravar aparece a **conferência**: camisas repetidas na lista ou já usadas no elenco, e linhas que o
  app não entendeu, ficam de fora e são listadas. Dá para **Voltar** e corrigir sem perder o texto.
- Funciona no modo local e no online (no online, a data de nascimento vai para a parte privada, que só admins leem).

---

## Tabela de jogos: automática, manual ou colada

- **Gerar automaticamente:** segue o formato da aba Config. Depois dá para ajustar qualquer jogo na mão.
  ⚠️ Gerar de novo substitui todos os jogos da categoria.
- **Adicionar jogo:** escolha o tipo (*Classificação* ou *Mata-mata*), a rodada ou fase (Rodada 1, Quartas, Semifinal,
  Final...), o grupo (pode criar um novo ali mesmo), os dois times, data, horário e quadra.
- **Mata-mata montado na mão:** no lugar de um time escolha **“Vencedor do jogo X”**, **“Perdedor do jogo X”**
  (para 3º lugar) ou **“1º do Grupo A”**. O app preenche sozinho quando o resultado sair.
  Cada jogo tem um número (“Jogo 7”) que aparece no cartão e na tabela impressa.
- **↕️ Organizar:** mostra setas ↑ ↓ e lixeira. Ao subir um jogo, ele troca de lugar **e de horário/quadra** com o de cima.
- **🔒 Jogo com súmula encerrada** não pode ser editado, movido nem excluído. Reabra a súmula antes.
- **📋 Colar tabela em texto:** uma linha por jogo, por exemplo:

```text
Grupo A
Rodada 1
Leões x Tubarões - 02/11 09:00 - Quadra 1
Águias x Raio Azul - 02/11 09:50 - Quadra 2
Rodada 2
Leões x Águias - 09/11 09:00 - Quadra 1
Semifinal
Leões x Raio Azul - 16/11 10:00
```

  Linhas sozinhas (*Rodada 2*, *Grupo A*, *Semifinal*, *Final*) valem para os jogos de baixo. Aceita `x`, `X` ou `vs`,
  hora `09:00` ou `9h`, e não liga para acentos ou maiúsculas nos nomes dos times.
  Antes de gravar, o app mostra uma **conferência**: avisa os times que não existem (você corrige ou manda criar) e as
  linhas que não entendeu.

---

## Regras que o app usa

- **Idade:** cada categoria tem o campo *“Nascidos a partir do ano”*. O app sugere sozinho:
  Sub-11 em 2026 → nascidos em 2016 ou depois. Mude se o regulamento do seu campeonato for diferente.
  Categorias por ano escolar (“2º ano”) não ganham sugestão, e o alerta pode ser desligado no campeonato.
- **Nº do jogo:** automático por categoria, ou o número oficial digitado no jogo (ex.: Copa CES, jogos 1 a 42).
- **Resultado rápido:** entra na classificação e decide o mata-mata, mas não tem gols por jogador nem cartões,
  então não conta em artilharia, disciplina e suspensões.
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
firestore.rules         → REGRAS DE SEGURANÇA (copiar no Firebase → Firestore → Regras)
GUIA-FIREBASE.md        → passo a passo do Firebase
dados-iniciais/         → copa-ces-2026.json (importar pelo app; NÃO vai para o GitHub)
manifest.webmanifest    → dados do app instalável (nome, ícone, cores)
sw.js                   → service worker: guarda os arquivos para funcionar offline
css/estilo.css          → todo o visual (celular primeiro) + layout de impressão
icons/                  → ícones do app
js/
  util.js               → ajudantes: ids, datas, modal, toast, bandeiras, download...
  vendor/               → cópia do Firebase (para funcionar offline, sem depender de CDN)
  firebase-config.js    → configuração do SEU projeto Firebase (null = modo local)
  dados.js              → dados na memória, salvar (local ou nuvem), buscas e backup
  nuvem.js              → login Google + sincronização com o Firestore (tempo real e offline)
  tabela.js             → geração da tabela (todos contra todos, grupos, chave)
                          + tabela manual: salvar, mover, excluir e ler texto
  regras.js             → o "cérebro": placar, vencedor, classificação,
                          desempate, suspensões, estatísticas
  exemplo.js            → campeonato fictício para testes
  app.js                → navegação entre telas (rotas pelo #/endereço)
  telas/
    inicio.js           → lista de campeonatos
    campeonato.js       → abas Jogos, Classificação, Times, Estatísticas, Suspensos, Config.
    jogos.js            → adicionar/editar/organizar jogos e colar tabela em texto
    time.js             → página do time e do jogador (e seus formulários)
    sumula.js           → súmula ao vivo
    relatorios.js       → páginas para imprimir/PDF
    backup.js           → exportar, importar, exemplo, apagar tudo
```

**Modo online, em uma frase:** as telas continuam lendo e mudando `App.dados.db` na memória; o `nuvem.js`
escuta o Firestore para preencher essa memória e, a cada `App.dados.salvar()`, grava no servidor só o que mudou.

**Ideia principal:** a súmula guarda só os **eventos** (gol, falta, cartão...). Placar, classificação,
artilharia e suspensões são sempre **calculados** a partir deles em `regras.js`. Por isso, ao editar
ou reabrir uma súmula, tudo se ajusta sozinho.

Todos os scripts ficam dentro de um objeto global `App` (ex.: `App.regras.classificacao(...)`).
Abra o console do navegador (F12) e brinque com eles.

---

## Como subir pelo site do GitHub

**Antes:** faça o GUIA-FIREBASE.md até o passo 6 (colar a configuração em `js/firebase-config.js`).
Se subir sem isso, o site continua funcionando em modo local.

1. Abra <https://github.com/gcromano/futsal-sumula> → **Add file** → **Upload files**.
2. No Finder, abra a pasta `~/futsal` e **arraste para a página** estes itens (as pastas inteiras):

   | Enviar | |
   |---|---|
   | `index.html` | na raiz (é o que faz o link funcionar) |
   | `manifest.webmanifest`, `sw.js` | |
   | `README.md`, `GUIA-FIREBASE.md`, `firestore.rules` | |
   | pasta `css/` | |
   | pasta `icons/` | |
   | pasta `js/` | inclui `js/vendor/`, `js/telas/`, `nuvem.js`, `firebase-config.js` |

3. **NÃO arraste:** `dados-iniciais/` (dados do campeonato), arquivos `futsal-backup-*.json`, `.claude/`,
   e nunca um arquivo de "conta de serviço" (`*adminsdk*.json`) se algum dia baixar um.
4. Escreva a mensagem (ex.: "Tabela manual + modo online com Firebase") → **Commit changes**.
5. Espere 1–2 minutos e abra <https://gcromano.github.io/futsal-sumula/>.

**Apagar do repositório:** nada. Nenhum arquivo da versão anterior foi removido ou renomeado
(os que mudaram são substituídos pelo upload).

**`.gitignore` no mesmo commit:** o Finder esconde arquivos que começam com ponto. Na pasta `~/futsal`,
aperte **Cmd + Shift + .** (ponto) para mostrar os ocultos e arraste o `.gitignore` junto com o resto.
(Ele protege quem usar git pelo Terminal; no upload pelo site, quem decide o que vai é você.)
