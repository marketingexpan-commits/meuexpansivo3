
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";

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
    console.log("--- BUSCANDO MENSAGENS ESPECÍFICAS ---");

    const q = query(collection(db, "schoolMessages"), where("unit", "==", "unit_bs"));
    const snap = await getDocs(q);
    const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const targets = messages.filter(m =>
        m.content?.includes('[PARA: Lúcia]') ||
        m.content?.includes('[PARA: Clenia]')
    );

    console.log(`Encontradas ${targets.length} mensagens para análise.`);

    for (const m of targets) {
        const sDoc = await getDoc(doc(db, "students", m.studentId));
        const student = sDoc.exists() ? sDoc.data() : null;

        console.log(`ID: ${m.id}`);
        console.log(`De: ${m.studentName} (${student?.gradeLevel || 'Série desconhecida'})`);
        console.log(`Conteúdo Original: ${m.content}`);
        console.log('---');
    }
}

run().catch(console.error);
