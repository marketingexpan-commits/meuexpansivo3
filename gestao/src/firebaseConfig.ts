import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Hardcoded keys from root project to ensure connection works immediately
const firebaseConfig = {
  apiKey: "AIzaSyA_2iu9QDk-GoyJDPAY4l91UUE5KDtBdHU",
  authDomain: "meu-expansivo.firebaseapp.com",
  projectId: "meu-expansivo",
  storageBucket: "meu-expansivo.firebasestorage.app",
  messagingSenderId: "569392934598",
  appId: "1:569392934598:web:3ff679a79c8279ad52f1c7",
  measurementId: "G-YNJBLE23NT"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);