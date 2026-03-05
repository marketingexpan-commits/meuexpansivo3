
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

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

async function run() {
    console.log("--- DEBUG DATA DUMP ---");

    const studentsSnap = await getDocs(collection(db, "students"));
    const students = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const messagesSnap = await getDocs(collection(db, "schoolMessages"));
    const messages = messagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    console.log("\n--- BUSCANDO MENSAGENS COM '[PARA: Lúcia]' OU '[PARA: Clenia]' ---");
    const targeted = messages.filter(m => m.content?.includes('[PARA: Lúcia]') || m.content?.includes('[PARA: Clenia]'));

    for (const m of targeted) {
        const student = students.find(s => s.id === m.studentId);
        console.log(`Msg ID: ${m.id}`);
        console.log(`Unidade: ${m.unit}`);
        console.log(`Recipient: ${m.recipient}`);
        console.log(`De: ${m.studentName} (ID: ${m.studentId})`);
        if (student) {
            console.log(`Grade Aluno: ${student.gradeLevel} (ID: ${student.gradeId})`);
        } else {
            console.log(`Aluno não encontrado no cache!`);
        }
        console.log(`Conteúdo: ${m.content.substring(0, 50)}...`);
        console.log('---');
    }
}

run().catch(console.error);
