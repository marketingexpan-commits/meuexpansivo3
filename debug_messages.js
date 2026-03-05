
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

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
    console.log("--- BUSCANDO COORDENADORES ---");
    const contactsSnap = await getDocs(collection(db, "unitContacts"));
    const contacts = contactsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    contacts.forEach(c => {
        console.log(`ID: ${c.id}, Nome: ${c.name}, Segmento: ${c.segment}, Unidade: ${c.unit}`);
    });

    console.log("\n--- BUSCANDO MENSAGENS SUSPEITAS ---");
    // Buscamos todas as mensagens e filtramos em memória para ser mais flexível
    const messagesSnap = await getDocs(collection(db, "schoolMessages"));
    const messages = messagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const suspicious = messages.filter(m => {
        // Se a mensagem for para coordenação
        if (m.recipient !== 'coordination') return false;

        // Verificamos se o conteúdo tem um prefixo [PARA: ...]
        // E se o nome nesse prefixo pertence a um coordenador de Fundamental I
        // mas o aluno é de Fundamental II.

        // Para isso precisamos dos perfis dos alunos
        return true; // Vamos listar tudo primeiro para ver o padrão
    });

    console.log(`Total de mensagens: ${messages.length}`);
    // Listar as 10 mais recentes para ver o formato
    messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    messages.slice(0, 20).forEach(m => {
        console.log(`[${m.timestamp}] De: ${m.studentName} - Conteúdo: ${m.content.substring(0, 50)}...`);
    });
}

run().catch(console.error);
