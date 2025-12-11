import firebase from "firebase/compat/app";
import "firebase/compat/firestore";

// --- SUAS CHAVES DO FIREBASE (Transcritas da imagem) ---
const firebaseConfig = {
  apiKey: "AIzaSyAe5Rb4dqi80cYUxj69EFr4AGElCI9Rb9o",
  authDomain: "meu-expansivo-app.firebaseapp.com",
  projectId: "meu-expansivo-app",
  storageBucket: "meu-expansivo-app.firebasestorage.app",
  messagingSenderId: "688981571362",
  appId: "1:688981571362:web:179c1dcae4b01f9f9f177b"
};

// Inicializa o Firebase (verifica se já existe instância para evitar erro em hot-reload)
const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();

// Inicializa e exporta o Banco de Dados (Firestore)
export const db = app.firestore();