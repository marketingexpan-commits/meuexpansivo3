
import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc, getDoc } from "firebase/firestore";

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
    console.log("--- INICIANDO TRANSFERÊNCIA DE MENSAGENS ---");

    for (const id of TARGET_MESSAGE_IDS) {
        const msgRef = doc(db, "schoolMessages", id);
        const snap = await getDoc(msgRef);

        if (snap.exists()) {
            const data = snap.data();
            const oldContent = data.content;

            // Reassina para Luiza (Coord. Fund 2 / Médio - Boa Sorte)
            const newContent = oldContent
                .replace('[PARA: Lúcia]', '[PARA: Luiza]')
                .replace('[PARA: Clenia]', '[PARA: Luiza]');

            if (oldContent !== newContent) {
                await updateDoc(msgRef, { content: newContent });
                console.log(`SUCESSO: Mensagem ${id} transferida para Luiza.`);
                console.log(`  De: ${oldContent.substring(0, 30)}...`);
                console.log(`  Para: ${newContent.substring(0, 30)}...`);
            } else {
                console.log(`AVISO: Mensagem ${id} já possui o prefixo correto ou não contém o prefixo esperado.`);
            }
        } else {
            console.error(`ERRO: Mensagem ${id} não encontrada.`);
        }
    }

    console.log("\n--- OPERAÇÃO CONCLUÍDA ---");
}

run().catch(console.error);
