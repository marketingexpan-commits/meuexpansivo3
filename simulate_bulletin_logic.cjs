const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, query, where } = require("firebase/firestore");

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

// Simula exatamente a lógica do bulletinGenerator.ts
const ACADEMIC_GRADES = {
    SERIE_2: { id: 'grade_2_ser', label: '2ª Série' }
};

async function simulateBulletinLogic() {
    console.log("=== SIMULANDO LÓGICA DO BOLETIM ===\n");

    // 1. Buscar aluno
    const studentsSnap = await getDocs(query(collection(db, "students"), where("name", ">=", "Thiago"), where("name", "<=", "Thiago\uf8ff")));
    const student = studentsSnap.docs[0]?.data();

    console.log("1. DADOS DO ALUNO:");
    console.log(`   Nome: ${student.name}`);
    console.log(`   Unit: ${student.unit}`);
    console.log(`   Shift: ${student.shift}`);
    console.log(`   GradeLevel: "${student.gradeLevel}"`);

    // 2. Buscar notas
    const gradesSnap = await getDocs(query(collection(db, "grades"), where("studentId", "==", student.id)));
    const grades = gradesSnap.docs.map(d => d.data());

    console.log(`\n2. NOTAS DO ALUNO (${grades.length}):`);
    grades.forEach(g => console.log(`   - ${g.subject}`));

    // 3. Buscar matrizes
    const matricesSnap = await getDocs(collection(db, "academic_matrices"));
    const matrices = matricesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log(`\n3. TOTAL DE MATRIZES NO BANCO: ${matrices.length}`);

    // 4. SIMULAR A LÓGICA EXATA DO BOLETIM (linhas 255-273 do bulletinGenerator.ts)
    console.log("\n4. SIMULANDO BUSCA DA MATRIZ:");
    console.log("   Passo 1: Resolver Grade ID do Label");

    const gradeEntry = Object.values(ACADEMIC_GRADES).find(g =>
        student.gradeLevel === g.label ||
        student.gradeLevel.includes(g.label) ||
        (g.label.includes('Ano') && student.gradeLevel.includes(g.label))
    );
    const targetGradeId = gradeEntry ? gradeEntry.id : '';

    console.log(`   - Student gradeLevel: "${student.gradeLevel}"`);
    console.log(`   - Matched ACADEMIC_GRADES entry: ${gradeEntry ? gradeEntry.label : 'NONE'}`);
    console.log(`   - Resolved targetGradeId: "${targetGradeId}"`);

    console.log("\n   Passo 2: Buscar matriz matching");
    console.log(`   Critérios:`);
    console.log(`     - m.unit === "${student.unit}"`);
    console.log(`     - m.shift === "${student.shift}"`);
    console.log(`     - m.gradeId === "${targetGradeId}" OU m.gradeId === "${student.gradeLevel}"`);

    const matchingMatrix = matrices.find(m =>
        m.unit === student.unit &&
        m.shift === student.shift &&
        (m.gradeId === targetGradeId || m.gradeId === student.gradeLevel)
    );

    if (matchingMatrix) {
        console.log(`\n   ✅ MATRIZ ENCONTRADA: ${matchingMatrix.id}`);
        console.log(`\n5. CÁLCULO DE C.H. PREV. PARA CADA NOTA:`);

        grades.forEach(g => {
            const ms = matchingMatrix.subjects.find(s => s.id === g.subject);
            if (ms) {
                const weeklyClasses = ms.weeklyHours;
                const totalCH = weeklyClasses > 0 ? (weeklyClasses * 40) : '-';
                console.log(`\n   Disciplina: ${g.subject}`);
                console.log(`   - Encontrado na matriz: ${ms.name}`);
                console.log(`   - Horas semanais: ${weeklyClasses}h`);
                console.log(`   - C.H. PREV. (${weeklyClasses}h × 40 semanas): ${totalCH}${totalCH !== '-' ? 'h' : ''}`);
            } else {
                console.log(`\n   Disciplina: ${g.subject}`);
                console.log(`   - ❌ NÃO ENCONTRADA na matriz!`);
                console.log(`   - C.H. PREV.: - (vazio)`);
            }
        });

    } else {
        console.log(`\n   ❌ MATRIZ NÃO ENCONTRADA!`);
        console.log(`\n   Matrizes disponíveis para debug:`);
        matrices.forEach(m => {
            const unitMatch = m.unit === student.unit ? '✓' : '✗';
            const shiftMatch = m.shift === student.shift ? '✓' : '✗';
            const gradeMatch = (m.gradeId === targetGradeId || m.gradeId === student.gradeLevel) ? '✓' : '✗';
            console.log(`   - ${m.id}`);
            console.log(`     Unit: ${m.unit} ${unitMatch}`);
            console.log(`     Shift: ${m.shift} ${shiftMatch}`);
            console.log(`     GradeId: ${m.gradeId} ${gradeMatch}`);
        });
    }
}

simulateBulletinLogic().catch(console.error);
