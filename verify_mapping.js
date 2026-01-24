import { readFileSync } from 'fs';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";

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

async function verifyMapping() {
    console.log("Analyzing Alunos.sql for sample mappings (multi-line)...");
    const content = readFileSync('./migration_data/Alunos.sql', 'utf8');
    const samples = [];

    // Improved regex to handle multi-line and extra whitespace
    const regex = /INSERT INTO ALUNO\s*\([^]*?VALUES\s*\((.*?)\);/gs;
    let match;
    while ((match = regex.exec(content)) !== null && samples.length < 10) {
        const values = match[1].split(',').map(v => v.trim().replace(/^'|'$/g, ''));
        // CODIGO is index 0, NOME is index 3
        samples.push({ codigo: values[0], nome: values[3] });
    }

    console.log("Samples found in SQL:", samples);

    for (const sample of samples) {
        console.log(`Checking Firestore for: ${sample.nome}`);
        const studentsRef = collection(db, "students");
        // Search by name (allowing for whitespace issues)
        const q = query(studentsRef, where("name", "==", sample.nome.trim()));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.log(`  Not found in Firestore.`);
        } else {
            querySnapshot.forEach(doc => {
                const data = doc.data();
                console.log(`  Found! ID: ${doc.id} | Name: ${data.name} | Code: ${data.code}`);
                console.log(`  Mapping Match (SQL ${sample.codigo} vs FS ${data.code}): ${sample.codigo === String(data.code) ? "YES" : "NO"}`);
            });
        }
    }
}

verifyMapping().catch(console.error);
