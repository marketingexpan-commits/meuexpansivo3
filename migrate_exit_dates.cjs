const fs = require('fs');
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, writeBatch } = require("firebase/firestore");

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

async function migrateExitDates() {
    console.log("--- STARTING EXIT DATE MIGRATION ---");

    // 1. Parse Alunos.sql
    console.log("Reading Alunos.sql...");
    const alContent = fs.readFileSync('./migration_data/Alunos.sql', 'latin1');
    const exitDateMap = {}; // CODIGO -> Date
    const alInserts = alContent.split(';');

    alInserts.forEach(seg => {
        const match = seg.match(/INSERT INTO ALUNO\s*\((.*?)\)\s*VALUES\s*\((.*)/is);
        if (match) {
            const cols = match[1].split(',').map(c => c.trim().toUpperCase());
            const vals = match[2].trim().replace(/\)$/is, '').split(',').map(v => v.trim().replace(/^'|'$/g, ''));
            const obj = {};
            cols.forEach((c, i) => obj[c] = vals[i]);

            if (obj.CODIGO && obj.DATASIT) {
                const date = obj.DATASIT.trim();
                // Check if it's a valid recent date (starts with 20)
                if (date.startsWith('20')) {
                    exitDateMap[String(obj.CODIGO)] = date;
                }
            }
        }
    });

    console.log(`Mapped ${Object.keys(exitDateMap).length} exit dates.`);

    // 2. Update Firestore
    console.log("Fetching Firestore students...");
    const snap = await getDocs(collection(db, "students"));
    let batch = writeBatch(db);
    let count = 0;
    let upCount = 0;

    for (const d of snap.docs) {
        const student = d.data();
        const code = String(student.code);
        const exitDate = exitDateMap[code];

        if (exitDate && student.data_desligamento !== exitDate) {
            batch.update(d.ref, { data_desligamento: exitDate });
            count++;
            upCount++;

            if (count >= 400) {
                await batch.commit();
                console.log(`Updated ${upCount} students...`);
                batch = writeBatch(db);
                count = 0;
            }
        }
    }

    if (count > 0) await batch.commit();
    console.log(`--- FINISHED: ${upCount} exit dates updated ---`);
}

migrateExitDates().catch(console.error);
