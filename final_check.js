
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAe5Rb4dqi8OcyUXj69EFr4AGElCI9Rb9o",
    authDomain: "meu-expansivo-app.firebaseapp.com",
    projectId: "meu-expansivo-app",
    storageBucket: "meu-expansivo-app.firebasestorage.app",
    messagingSenderId: "688981571362",
    appId: "1:688981571362:web:179c1dcae4b01f9f9f177b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const TARGET_MESSAGE_IDS = [
    "1LzFWciCFlB3kpgLetHk",
    "4W1dqTbxS7YAMcQDR1Cr",
    "AOBxjVBkZE4lW6Flvp4P"
];

async function run() {
    console.log("--- VERIFICAÇÃO FINAL ---");

    for (const id of TARGET_MESSAGE_IDS) {
        const msgRef = doc(db, "schoolMessages", id);
        const snap = await getDoc(msgRef);

        if (snap.exists()) {
            const data = snap.data();
            console.log(`ID: ${id}`);
            console.log(`De: ${data.studentName}`);
            console.log(`Conteúdo: ${data.content}`);
            console.log('---');
        } else {
            console.error(`ERRO: Mensagem ${id} não encontrada.`);
        }
    }
}

run().catch(console.error);
