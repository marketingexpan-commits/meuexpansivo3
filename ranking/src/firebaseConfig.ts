import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAe5Rb4dqi8OcyUXj69EFr4AGElCI9Rb9o",
    authDomain: "meu-expansivo-app.firebaseapp.com",
    databaseURL: "https://meu-expansivo-app-default-rtdb.firebaseio.com",
    projectId: "meu-expansivo-app",
    storageBucket: "meu-expansivo-app.firebasestorage.app",
    messagingSenderId: "688981571362",
    appId: "1:688981571362:web:179c1dcae4b01f9f9f177b"
};

const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
const isSmartTV = /webos|smarttv|tizen|viera|bravia/.test(ua);

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, isSmartTV ? {
    experimentalForceLongPolling: true,
} : {});
