import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load service account from the same dir
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function inspectData() {
    console.log('--- INSPECIONANDO DADOS DE ALUNOS (unit_qui) ---');
    const studentsRef = db.collection('students');
    const snapshot = await studentsRef.where('unit', '==', 'unit_qui').limit(20).get();

    if (snapshot.empty) {
        console.log('Nenhum aluno encontrado para unit_qui.');
        return;
    }

    const yearCounts = {
        '2024': 0,
        '2025': 0,
        '2026': 0,
        '2027': 0
    };

    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`ID: ${doc.id} | Nome: ${data.name}`);
        console.log(`  Status: ${data.status}`);
        console.log(`  EnrolledYears: ${JSON.stringify(data.enrolledYears)}`);

        if (data.enrolledYears) {
            data.enrolledYears.forEach(y => {
                if (yearCounts[y] !== undefined) yearCounts[y]++;
            });
        }
    });

    console.log('\n--- RESUMO DA AMOSTRA (20 alunos) ---');
    console.log(yearCounts);

    // Check if there are ANY students with 2024 in the whole unit
    const count2024 = await studentsRef.where('unit', '==', 'unit_qui').where('enrolledYears', 'array-contains', '2024').count().get();
    const count2025 = await studentsRef.where('unit', '==', 'unit_qui').where('enrolledYears', 'array-contains', '2025').count().get();
    const count2026 = await studentsRef.where('unit', '==', 'unit_qui').where('enrolledYears', 'array-contains', '2026').count().get();
    const count2027 = await studentsRef.where('unit', '==', 'unit_qui').where('enrolledYears', 'array-contains', '2027').count().get();

    console.log('\n--- CONTAGEM TOTAL NO FIRESTORE (unit_qui) ---');
    console.log(`2024: ${count2024.data().count}`);
    console.log(`2025: ${count2025.data().count}`);
    console.log(`2026: ${count2026.data().count}`);
    console.log(`2027: ${count2027.data().count}`);
}

inspectData().catch(console.error);
