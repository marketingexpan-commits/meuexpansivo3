import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import "firebase/compat/auth";

// --- SUAS CHAVES DO FIREBASE (Transcritas da imagem) ---
const firebaseConfig = {
  apiKey: "AIzaSyAe5Rb4dqi8OcyUXj69EFr4AGElCI9Rb9o",
  authDomain: "meu-expansivo-app.firebaseapp.com",
  databaseURL: "https://meu-expansivo-app-default-rtdb.firebaseio.com",
  projectId: "meu-expansivo-app",
  storageBucket: "meu-expansivo-app.firebasestorage.app",
  messagingSenderId: "688981571362",
  appId: "1:688981571362:web:179c1dcae4b01f9f9f177b"
};

// Inicializa o Firebase (verifica se já existe instância para evitar erro em hot-reload)
const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();

// Inicializa e exporta o Banco de Dados (Firestore)
export const db = app.firestore();
// Inicializa e exporta o Serviço de Autenticação
export const auth = app.auth();
// FORCE BUCKET: Explicitly tell Firebase which bucket to use
export const storage = app.storage("gs://meu-expansivo-app.firebasestorage.app");