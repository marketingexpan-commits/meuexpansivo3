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

const statusMap = {
    '00': 'CURSANDO',
    '01': 'TRANSFERIDO',
    '03': 'EVADIDO',
    '09': 'TRANCADO',
    '05': 'RESERVADO',
    '10': 'ATIVO',
    '88': 'REPROVADO',
    '99': 'APROVADO'
};

const segmentMap = {
    '01': 'Educação Infantil',
    '02': 'Educação Infantil',
    '03': 'Fundamental I',
    '04': 'Fundamental II',
    '05': 'Ensino Médio'
};

function getGradeLabel(grau, ser) {
    const segment = segmentMap[grau] || '';
    let label = ser;

    if (ser.endsWith('A')) label = ser.replace('A', 'º Ano');
    if (ser.endsWith('S')) label = ser.replace('S', 'ª Série');
    if (ser.startsWith('N')) label = ser.replace('N', 'Nível ');

    return segment ? `${label} - ${segment}` : label;
}

const unitMap = {
    '01': 'unit_zn',
    '02': 'unit_bs',
    '03': 'unit_ext',
    '04': 'unit_qui'
};

async function reconstitute() {
    console.log("--- STARTING HISTORY RECONSTITUTION ---");

    // 1. Map ALUNO to find Unit (FIL) if MATRICULA lacks it
    console.log("Reading Alunos.sql...");
    const alContent = fs.readFileSync('./migration_data/Alunos.sql', 'latin1');
    const studentUnitMap = {}; // CODIGO -> UnitID
    const alInserts = alContent.split(';');
    alInserts.forEach(seg => {
        const match = seg.match(/INSERT INTO ALUNO\s*\((.*?)\)\s*VALUES\s*\((.*)/is);
        if (match) {
            const cols = match[1].split(',').map(c => c.trim().toUpperCase());
            const vals = match[2].trim().replace(/\)$/is, '').split(',').map(v => v.trim().replace(/^'|'$/g, ''));
            const obj = {};
            cols.forEach((c, i) => obj[c] = vals[i]);
            if (obj.CODIGO && obj.FIL) {
                studentUnitMap[obj.CODIGO] = unitMap[obj.FIL] || obj.FIL;
            }
        }
    });

    // 2. Parse MATRICULA
    console.log("Reading Maticulas.sql...");
    const matContent = fs.readFileSync('./migration_data/Maticulas.sql', 'latin1');
    const historyMap = {}; // CODIGO -> Array of EnrollmentRecords
    const matInserts = matContent.split(';');
    matInserts.forEach(seg => {
        const match = seg.match(/INSERT INTO MATRICULA\s*\((.*?)\)\s*VALUES\s*\((.*)/is);
        if (match) {
            const cols = match[1].split(',').map(c => c.trim().toUpperCase());
            const vals = match[2].trim().replace(/\)$/is, '').split(',').map(v => v.trim().replace(/^'|'$/g, ''));
            const obj = {};
            cols.forEach((c, i) => obj[c] = vals[i]);

            if (obj.CODIGO) {
                if (!historyMap[obj.CODIGO]) historyMap[obj.CODIGO] = [];

                const year = obj.ANO.split('.')[0];
                const unit = unitMap[obj.FIL] || studentUnitMap[obj.CODIGO] || 'unit_zn';
                const grade = getGradeLabel(obj.CODGRAU || obj.CUR, obj.CODSER || obj.SER);
                const statusStr = statusMap[obj.CODSIT || obj.SIT] || 'CONCLUÍDO';

                historyMap[obj.CODIGO].push({
                    year,
                    unit,
                    gradeLevel: grade,
                    schoolClass: obj.TURMA || obj.TUR || 'A',
                    shift: (obj.TURCOD === 'T' || obj.TURNO?.includes('VESP')) ? 'Vespertino' : 'Matutino',
                    status: statusStr
                });
            }
        }
    });

    // 3. Update Firestore
    console.log("Fetching Firestore students...");
    const snap = await getDocs(collection(db, "students"));
    let batch = writeBatch(db);
    let count = 0;
    let upCount = 0;

    for (const d of snap.docs) {
        const student = d.data();
        const code = String(student.code);
        const history = historyMap[code];

        if (history) {
            // Sort by year
            history.sort((a, b) => parseInt(b.year) - parseInt(a.year));

            batch.update(d.ref, { enrollmentHistory: history });
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
    console.log(`--- FINISHED: ${upCount} students updated ---`);
}

reconstitute().catch(console.error);
