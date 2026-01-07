import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/storage";

// --- SUAS CHAVES DO FIREBASE (Transcritas da imagem) ---
const firebaseConfig = {
  apiKey: "AIzaSyA_2iu9QDk-GoyJDPAY4l91UUE5KDtBdHU",
  authDomain: "meu-expansivo.firebaseapp.com",
  projectId: "meu-expansivo",
  storageBucket: "meu-expansivo.firebasestorage.app",
  messagingSenderId: "569392934598",
  appId: "1:569392934598:web:3ff679a79c8279ad52f1c7",
  measurementId: "G-YNJBLE23NT"
};

// Inicializa o Firebase (verifica se já existe instância para evitar erro em hot-reload)
const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();

// Inicializa e exporta o Banco de Dados (Firestore)
export const db = app.firestore();
// FORCE BUCKET: Explicitly tell Firebase which bucket to use
export const storage = app.storage("gs://meu-expansivo.firebasestorage.app");