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

// HARDCODED ACADEMIC_GRADES from codebase for simulation
const ACADEMIC_GRADES = {
    SERIE_2: { id: 'grade_2_ser', label: '2ª Série' }
    // ... others irrelevant for this test case if we focus on "2ª Série"
};

async function debugLookup() {
    console.log("--- DEBUGGING MATRIX LOOKUP LOGIC ---");

    // 1. Fetch Student "Thiago Luis" (or similar)
    const studentsSnap = await getDocs(query(collection(db, "students"), where("name", ">=", "Thiago"), where("name", "<=", "Thiago\uf8ff")));
    const student = studentsSnap.docs[0]?.data();

    if (!student) {
        console.error("Student Thiago not found for debug.");
        return;
    }

    console.log(`\n1. STUDENT DATA:`);
    console.log(`- Name: ${student.name}`);
    console.log(`- ID: ${student.id}`);
    console.log(`- Unit: "${student.unit}"`);
    console.log(`- Shift: "${student.shift}"`);
    console.log(`- GradeLevel (DB): "${student.gradeLevel}"`);

    // 2. Fetch All Matrices
    console.log(`\n2. FETCHING MATRICES...`);
    const matricesSnap = await getDocs(collection(db, "academic_matrices"));
    const matrices = matricesSnap.docs.map(d => d.data());
    console.log(`- Found ${matrices.length} matrices.`);

    // 3. Simulating Logic from bulletinGenerator.ts
    console.log(`\n3. SIMULATING LOGIC:`);

    // A) Resolve Grade ID
    const gradeEntry = Object.values(ACADEMIC_GRADES).find(g =>
        student.gradeLevel === g.label ||
        student.gradeLevel.includes(g.label) ||
        (g.label.includes('Ano') && student.gradeLevel.includes(g.label))
    );
    const targetGradeId = gradeEntry ? gradeEntry.id : '';
    console.log(`- Logic Resolved Grade ID: "${targetGradeId}" (from label "${gradeEntry?.label}")`);

    // B) Find Matrix
    console.log(`\n4. SEARCHING CANDIDATES:`);
    matrices.forEach((m, idx) => {
        // Log "near misses"
        if (m.unit === student.unit) {
            console.log(`   [Candidate #${idx}] Unit Match! Shift: "${m.shift}" vs Student: "${student.shift}" | Grade: "${m.gradeId}" vs Target: "${targetGradeId}"`);
        }
    });

    const matchingMatrix = matrices.find(m =>
        m.unit === student.unit &&
        m.shift === student.shift &&
        (m.gradeId === targetGradeId || m.gradeId === student.gradeLevel)
    );

    if (matchingMatrix) {
        console.log(`\n✅ SUCCESS! Found Matching Matrix (ID: ${matchingMatrix.id})`);
        console.log(`- Matrix Subjects: ${matchingMatrix.subjects.map(s => `${s.name} (${s.id})`).join(', ')}`);

        // 5. FETCH GRADES
        console.log(`\n5. CHECKING GRADES vs MATRIX MATCH:`);
        const gradesSnap = await getDocs(query(collection(db, "grades"), where("studentId", "==", student.id)));
        const grades = gradesSnap.docs.map(d => d.data());
        console.log(`- Found ${grades.length} grades for student.`);

        grades.forEach(g => {
            const match = matchingMatrix.subjects.find(s => s.id === g.subject);
            if (match) {
                console.log(`  [OK] Grade Subject "${g.subject}" matches Matrix "${match.name}" (Hours: ${match.weeklyHours})`);
            } else {
                console.log(`  [MISMATCH] Grade Subject "${g.subject}" NOT FOUND in Matrix.`);
            }
        });
    } else {
        console.log(`\n❌ FAILURE! No matrix matched.`);
        console.log(`Reason Analysis:`);
        // Deep dive for Thiago's specific case
        const unitMatches = matrices.filter(m => m.unit === student.unit);
        if (unitMatches.length === 0) console.log(`- No matrices found for unit "${student.unit}" AT ALL.`);

        const shiftMatches = unitMatches.filter(m => m.shift === student.shift);
        if (shiftMatches.length === 0) console.log(`- Unit found, but NO matrices for shift "${student.shift}". (Available: ${[...new Set(unitMatches.map(m => m.shift))].join(', ')})`);

        const gradeMatches = shiftMatches.filter(m => m.gradeId === targetGradeId || m.gradeId === student.gradeLevel);
        if (gradeMatches.length === 0) console.log(`- Unit & Shift found, but GRADE mismatch. (Expected: "${targetGradeId}", Available in Shift: ${shiftMatches.map(m => m.gradeId).join(', ')})`);
    }

}

debugLookup().catch(console.error);
