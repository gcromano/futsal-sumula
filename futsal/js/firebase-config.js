/* =========================================================
   CONFIGURAÇÃO DO FIREBASE

   Enquanto estiver "null", o app funciona em MODO LOCAL
   (dados só neste aparelho, como na primeira versão).

   Para ligar o modo online, cole aqui o objeto "firebaseConfig"
   que o Firebase mostra ao registrar o app da Web
   (passo a passo no arquivo GUIA-FIREBASE.md).

   ✅ Este arquivo PODE ir para o GitHub: a configuração da Web do
   Firebase é pública por natureza. Quem protege os dados são as
   regras do arquivo firestore.rules.
   ========================================================= */

var App = globalThis.App = globalThis.App || {};

App.firebaseConfig = {
  apiKey: "AIzaSyBrN3EL5k_einomPZW5f-hPJt9kXP56e2o",
  authDomain: "futsal-sumula.firebaseapp.com",
  projectId: "futsal-sumula",
  storageBucket: "futsal-sumula.firebasestorage.app",
  messagingSenderId: "494468012070",
  appId: "1:494468012070:web:dbfb3868f612d2737baee7"
};

// Login no mesmo endereço do app (melhor para iPhone/Safari).
// Mude para true SÓ depois de autorizar https://futsal-sumula.web.app/__/auth/handler
// no Google Cloud (passo "Login no iPhone" do GUIA-FIREBASE.md) e publique de novo.
App.loginNoMesmoEndereco = false;

/* Exemplo de como fica depois de colar (os valores são do SEU projeto):

App.firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "futsal-sumula.firebaseapp.com",
  projectId: "futsal-sumula",
  storageBucket: "futsal-sumula.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};

*/
