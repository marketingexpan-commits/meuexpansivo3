import { readFileSync } from 'fs';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, writeBatch } from "firebase/firestore";

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

async function repairData() {
    console.log("--- STARTING DATA REPAIR ---");

    // 1. Map CODIGO -> MATRICULA from Alunos.sql
    console.log("Reading Alunos.sql...");
    const alumnosContent = readFileSync('./migration_data/Alunos.sql', 'utf8');
    const codigoToMatricula = {};
    const alumnoRegex = /INSERT INTO ALUNO\s*\([^]*?VALUES\s*\((.*?)\);/gs;
    let match;
    while ((match = alumnoRegex.exec(alumnosContent)) !== null) {
        const values = match[1].split(',').map(v => v.trim().replace(/^'|'$/g, ''));
        codigoToMatricula[values[0]] = values[1]; // CODIGO -> MATRICULA
    }
    console.log(`Mapped ${Object.keys(codigoToMatricula).length} student IDs to matriculas.`);

    // 2. Map CODIGO -> Years from Maticulas.sql
    console.log("Reading Maticulas.sql...");
    const matriculasContent = readFileSync('./migration_data/Maticulas.sql', 'utf8');
    const codigoToYears = {};
    const matriculaRegex = /INSERT INTO MATRICULA\s*\([^]*?VALUES\s*\((.*?)\);/gs;
    while ((match = matriculaRegex.exec(matriculasContent)) !== null) {
        const values = match[1].split(',').map(v => v.trim().replace(/^'|'$/g, ''));
        const yearFull = values[0];
        const year = yearFull.split('.')[0]; // Handle 2024.1 -> 2024
        const codigo = values[1];

        if (!codigoToYears[codigo]) codigoToYears[codigo] = new Set();
        codigoToYears[codigo].add(year);
    }
    console.log(`Extracted enrollment records for ${Object.keys(codigoToYears).length} student IDs.`);

    // 3. Consolidate to MATRICULA -> Years
    const matriculaToYears = {};
    for (const [codigo, years] of Object.entries(codigoToYears)) {
        const matricula = codigoToMatricula[codigo];
        if (matricula) {
            matriculaToYears[matricula] = Array.from(years).sort();
        }
    }
    console.log(`Consolidated enrollment data for ${Object.keys(matriculaToYears).length} unique matriculas.`);

    // 4. Update Firestore Students
    console.log("Fetching students from Firestore...");
    const studentsRef = collection(db, "students");
    const q = query(studentsRef, where("unit", "==", "unit_qui"));
    const querySnapshot = await getDocs(q);
    console.log(`Found ${querySnapshot.size} students in Firestore.`);

    let updatedCount = 0;
    let batch = writeBatch(db);
    let batchCount = 0;

    for (const studentDoc of querySnapshot.docs) {
        const student = studentDoc.data();
        const studentCode = String(student.code); // This is the MATRICULA

        // Base years from SQL
        let years = matriculaToYears[studentCode] || [];

        // Add 2026/2025/2024 if student is CURSANDO or has status that implies active
        if (student.status === "CURSANDO" || student.status === "ATIVO") {
            if (!years.includes("2024")) years.push("2024");
            if (!years.includes("2025")) years.push("2025");
            if (!years.includes("2026")) years.push("2026");
        }

        // Remove duplicates and sort
        const finalYears = Array.from(new Set(years)).sort();

        // Update if changed
        if (JSON.stringify(student.enrolledYears) !== JSON.stringify(finalYears)) {
            batch.update(studentDoc.ref, { enrolledYears: finalYears });
            batchCount++;
            updatedCount++;

            if (batchCount >= 450) {
                console.log(`Committing batch of ${batchCount} updates...`);
                await batch.commit();
                batch = writeBatch(db);
                batchCount = 0;
            }
        }
    }

    if (batchCount > 0) {
        console.log(`Committing final batch of ${batchCount} updates...`);
        await batch.commit();
    }

    console.log(`--- REPAIR COMPLETED ---`);
    console.log(`Total students updated: ${updatedCount}`);
}

repairData().catch(console.error);
