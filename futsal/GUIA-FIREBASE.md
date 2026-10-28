# 🔥 Guia: ligar o Firebase (passo a passo)

Tempo: uns 15 minutos. Custo: **zero** (plano gratuito **Spark**, não pede cartão).
Faça tudo no **computador**, no Chrome, logado na conta Google que vai ser dona do projeto.

---

## 1. Criar o projeto

1. Abra <https://console.firebase.google.com> e clique em **Criar um projeto** (ou "Adicionar projeto").
2. Nome: `  ` → **Continuar**.
3. Google Analytics: **desative** (não precisa) → **Criar projeto** → **Continuar**.

> O plano já começa como **Spark (sem custo)**. Se em algum momento aparecer "Fazer upgrade" ou "Blaze", **não clique**.

## 2. Ligar o login com Google

1. No menu da esquerda: **Criação** (Build) → **Authentication** → **Vamos começar**.
2. Aba **Método de login** → **Google** → ligue **Ativar**.
3. Em "E-mail de suporte do projeto", escolha seu e-mail → **Salvar**.

## 3. Autorizar o endereço do site

1. Ainda em **Authentication**, aba **Configurações** → **Domínios autorizados**.
2. Clique **Adicionar domínio** e digite exatamente: `gcromano.github.io` → **Adicionar**.

> Sem isso, o login no site mostra o erro "endereço não autorizado".
> (`localhost` já vem autorizado, para testes no computador.)

## 4. Criar o banco de dados (Firestore)

1. Menu: **Criação** → **Firestore Database** → **Criar banco de dados**.
2. Local: **southamerica-east1 (São Paulo)** → **Avançar**.
   ⚠️ O local não pode ser mudado depois.
3. Escolha **Iniciar no modo de produção** → **Criar**.

## 5. Colar as regras de segurança (MUITO importante)

1. Ainda no Firestore, aba **Regras**.
2. Apague tudo o que estiver lá.
3. Abra o arquivo **`firestore.rules`** desta pasta (no Mac), copie **todo** o conteúdo e cole.
4. Clique **Publicar**.

> São essas regras que impedem que alguém leia campeonato privado ou altere o que não é dele,
> mesmo pelo console do navegador. Sempre que eu mudar o `firestore.rules`, repita este passo.

## 6. Registrar o app da Web e pegar a configuração

1. Clique na **engrenagem ⚙️** (ao lado de "Visão geral do projeto") → **Configurações do projeto**.
2. Role até **Seus apps** → clique no ícone **`</>`** (Web).
3. Apelido: `futsal-sumula-web`. **Não** marque "Firebase Hosting" → **Registrar app**.
4. Vai aparecer um código com `const firebaseConfig = { ... };`. Copie **só o que está entre as chaves**, por exemplo:

   ```js
   apiKey: "AIza...",
   authDomain: "futsal-sumula.firebaseapp.com",
   projectId: "futsal-sumula",
   storageBucket: "futsal-sumula.firebasestorage.app",
   messagingSenderId: "123456789",
   appId: "1:123456789:web:abc123"
   ```

5. Abra **`js/firebase-config.js`** e troque a linha `App.firebaseConfig = null;` por:

   ```js
   App.firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "futsal-sumula.firebaseapp.com",
     projectId: "futsal-sumula",
     storageBucket: "futsal-sumula.firebasestorage.app",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```

   (com os SEUS valores). Salve o arquivo.

> ✅ Essa configuração **pode** ir para o GitHub. Ela não é senha: só diz qual projeto usar.
> A proteção dos dados está nas regras do passo 5.

## 7. Testar no computador antes de publicar (opcional, recomendado)

No Terminal, na pasta do projeto:

```bash
cd ~/futsal && python3 -m http.server 8123
```

Abra <http://localhost:8123>, clique em **👤 / Entrar com Google** e veja se entra.

## 8. Publicar no GitHub

Siga a seção **"Como subir pelo site do GitHub"** do `README.md`.

---

## 👑 Primeiro acesso: virar admin da Copa CES

1. No **computador**, abra <https://gcromano.github.io/futsal-sumula/>.
2. Clique em **Entrar com Google** e entre com a sua conta.
3. Toque no **💾** (topo) → **Importar arquivo** → escolha
   `~/futsal/dados-iniciais/copa-ces-2026.json` → **Importar**.
4. Pronto: a **Copa CES 2026** aparece na lista, **🔒 Privada**, e **você é o admin**.

> Quem importa o arquivo vira admin. Faça isso uma vez só. Se importar de novo, a Copa CES
> é **substituída** pelo arquivo (resultados lançados depois disso seriam perdidos).

## ➕ Adicionar outro admin depois

1. Abra a **Copa CES** → aba **Config.** → cartão **👥 Admins deste campeonato**.
2. Digite o **e-mail Google** da pessoa → **+ Adicionar admin**.
3. A pessoa abre o site, clica em **Entrar com Google** com ESSE e-mail, e o campeonato aparece para ela.

Para tirar alguém: mesmo lugar → **Remover**. (O campeonato nunca fica sem admin.)

## 🕘 Quem alterou o quê

Aba **Config.** → **🕘 Últimas alterações** → **Ver quem alterou o quê**.
Cada gravação guarda o e-mail de quem fez e a hora do servidor. Ninguém consegue editar ou apagar esse histórico.

---

## Problemas comuns

| Mensagem / situação | O que fazer |
|---|---|
| "Este endereço não está autorizado" | Passo 3: adicionar `gcromano.github.io` |
| "O login com Google não está ativado" | Passo 2 |
| Entra, mas não aparece nada / "sem permissão" | Passo 5: conferir se as regras foram **publicadas** |
| No iPhone, com o app instalado, o login não abre | Entre uma vez pelo **Safari** normal; se continuar, use pelo Safari |
| A bolinha do 👤 fica **laranja** | Há alterações esperando internet. Elas vão sozinhas quando a conexão voltar. Não saia da conta antes. |
| A bolinha fica **cinza** | Sem internet. Pode continuar lançando a súmula normalmente. |

## Limites do plano gratuito (Spark)

Por dia: 50 mil leituras e 20 mil gravações. Um campeonato escolar inteiro usa uma fração pequena disso.
Se um dia passar do limite, o app fica só-leitura até o dia seguinte (não gera cobrança).
