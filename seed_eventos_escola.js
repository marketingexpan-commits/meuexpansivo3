import firebase from "firebase/compat/app";
import "firebase/compat/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAe5Rb4dqi80cYUxj69EFr4AGElCI9Rb9o",
    authDomain: "meu-expansivo-app.firebaseapp.com",
    projectId: "meu-expansivo-app",
    storageBucket: "meu-expansivo-app.firebasestorage.app",
    messagingSenderId: "688981571362",
    appId: "1:688981571362:web:179c1dcae4b01f9f9f177b"
};

// Fix for Node.js environment
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
if (typeof fetch === 'undefined') {
    global.fetch = require('node-fetch');
}
if (typeof window === 'undefined') {
    global.window = {};
}

const app = firebase.initializeApp(firebaseConfig);
const db = app.firestore();

async function seedEventosEscola() {
    try {
        console.log("Buscando aluna VIVIANNY BEZERRA (Código: 54321)...");
        const snapshot = await db.collection('students').where('code', '==', '54321').get();

        if (snapshot.empty) {
            console.error("Aluna não encontrada!");
            process.exit(1);
        }

        const studentDoc = snapshot.docs[0];
        const studentId = studentDoc.id;

        console.log(`Aluna encontrada (ID: ${studentId}). Criando evento na coleção 'eventos_escola'...`);

        // Usamos YYYY-MM-DD para máxima compatibilidade técnica, 
        // mas o componente tratará de exibir como DD/MM/AAAA.
        const evento = {
            description: 'Excursão Pedagógica ao Planetário',
            value: 150.00,
            dueDate: '2026-03-25',
            status: 'Pendente',
            type: 'Evento',
            studentId: studentId,
            lastUpdated: new Date().toISOString()
        };

        await db.collection('eventos_escola').add(evento);
        console.log(`Evento '${evento.description}' adicionado com sucesso!`);

        process.exit(0);
    } catch (error) {
        console.error("Erro ao popular eventos_escola:", error);
        process.exit(1);
    }
}

seedEventosEscola();
