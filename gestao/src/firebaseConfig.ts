import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAe5Rb4dqi80cYUxj69EFr4AGElCI9Rb9o",
  authDomain: "meu-expansivo-app.firebaseapp.com",
  projectId: "meu-expansivo-app",
  storageBucket: "meu-expansivo-app.firebasestorage.app",
  messagingSenderId: "688981571362",
  appId: "1:688981571362:web:179c1dcae4b01f9f9f177b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);