import { readFileSync } from 'fs';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, writeBatch } from "firebase/firestore";

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

async function performFinalRepair() {
    console.log("--- STARTING FINAL DATA REPAIR ---");

    // 1. Trace exact column mapping from file content to avoid any index guesswork
    console.log("Detecting SQL structures...");
    const alumnosContent = readFileSync('./migration_data/Alunos.sql', 'utf8');
    const matriculasContent = readFileSync('./migration_data/Maticulas.sql', 'utf8');

    // Mappings
    const matriculaToCodigo = {}; // Current FS code -> Desired FS code
    const codigoToYears = {};      // Desired FS code -> List of Years

    // 2. Parse Alunos.sql
    console.log("Parsing Alunos.sql for ID cross-reference...");
    const alumnoRegex = /INSERT INTO ALUNO\s*\((.*?)\)\s*VALUES\s*\((.*?)\);/gs;
    let match;
    while ((match = alumnoRegex.exec(alumnosContent)) !== null) {
        const cols = match[1].split(',').map(c => c.trim().toUpperCase());
        const vals = match[2].split(',').map(v => v.trim().replace(/^'|'$/g, ''));

        const idxCodigo = cols.indexOf('CODIGO');
        const idxMatricula = cols.indexOf('MATRICULA');

        if (idxCodigo !== -1 && idxMatricula !== -1) {
            matriculaToCodigo[vals[idxMatricula]] = vals[idxCodigo];
        }
    }
    console.log(`Mapped ${Object.keys(matriculaToCodigo).length} students (Matricula -> Código).`);

    // 3. Parse Maticulas.sql
    console.log("Parsing Maticulas.sql for full history...");
    const matriculaRegex = /INSERT INTO MATRICULA\s*\((.*?)\)\s*VALUES\s*\((.*?)\);/gs;
    while ((match = matriculaRegex.exec(matriculasContent)) !== null) {
        const cols = match[1].split(',').map(c => c.trim().toUpperCase());
        const vals = match[2].split(',').map(v => v.trim().replace(/^'|'$/g, ''));

        const idxAno = cols.indexOf('ANO');
        const idxCodigo = cols.indexOf('CODIGO');

        if (idxAno !== -1 && idxCodigo !== -1) {
            const year = vals[idxAno].split('.')[0];
            const codigo = vals[idxCodigo];

            if (!codigoToYears[codigo]) codigoToYears[codigo] = new Set();
            codigoToYears[codigo].add(year);
        }
    }
    console.log(`Found history for ${Object.keys(codigoToYears).length} unique student codes.`);

    // 4. Update Firestore
    console.log("Updating Firestore students for unit_qui...");
    const studentsRef = collection(db, "students");
    const q = query(studentsRef, where("unit", "==", "unit_qui"));
    const querySnapshot = await getDocs(q);
    console.log(`Fetched ${querySnapshot.size} students to check.`);

    let updatedCount = 0;
    let batch = writeBatch(db);
    let batchCount = 0;

    for (const studentDoc of querySnapshot.docs) {
        const data = studentDoc.data();
        const currentCodeInFs = String(data.code); // Currently stores SQL MATRICULA

        // Find correct 5-digit CODIGO
        const correctCodigo = matriculaToCodigo[currentCodeInFs];

        if (correctCodigo) {
            // Get full years list using the correct CODIGO
            const historyYears = Array.from(codigoToYears[correctCodigo] || []).sort();

            // Add 2024, 2025, 2026 if active (as safety margin for current operations)
            const forceCurrentYears = ["ATIVO", "CURSANDO"].includes(data.status);
            const finalYearsSet = new Set([...historyYears]);
            if (forceCurrentYears) {
                finalYearsSet.add("2024");
                finalYearsSet.add("2025");
                finalYearsSet.add("2026");
            }
            const finalYears = Array.from(finalYearsSet).sort();

            // Prepare update
            const updates = {};
            if (data.code !== correctCodigo) updates.code = correctCodigo;
            if (JSON.stringify(data.enrolledYears) !== JSON.stringify(finalYears)) updates.enrolledYears = finalYears;

            if (Object.keys(updates).length > 0) {
                batch.update(studentDoc.ref, updates);
                batchCount++;
                updatedCount++;

                if (batchCount >= 450) {
                    await batch.commit();
                    console.log(`Batch committed (${updatedCount} so far)...`);
                    batch = writeBatch(db);
                    batchCount = 0;
                }
            }
        }
    }

    if (batchCount > 0) {
        await batch.commit();
    }

    console.log(`--- REPAIR COMPLETED ---`);
    console.log(`Total students updated/fixed: ${updatedCount}`);
}

performFinalRepair().catch(console.error);
