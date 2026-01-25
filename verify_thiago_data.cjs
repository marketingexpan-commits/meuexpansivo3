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

const ACADEMIC_GRADES = {
    SERIE_2: { id: 'grade_2_ser', label: '2ª Série' }
};

async function verifyThiago() {
    console.log("--- VERIFYING THIAGO'S DATA ---");

    // 1. Fetch Student
    const studentsSnap = await getDocs(query(collection(db, "students"), where("name", ">=", "Thiago"), where("name", "<=", "Thiago\uf8ff")));
    const student = studentsSnap.docs[0]?.data();

    if (!student) { console.error("Thiago not found."); return; }
    console.log(`Student: ${student.name} (Grade: ${student.gradeLevel})`);

    // 2. Fetch Grades
    const gradesSnap = await getDocs(query(collection(db, "grades"), where("studentId", "==", student.id)));
    const grades = gradesSnap.docs.map(d => d.data());
    console.log(`\nGRADES FOUND (${grades.length}):`);
    grades.forEach(g => console.log(`- ${g.subject} (ID)`));

    // 3. Matched Matrix
    const gradeEntry = Object.values(ACADEMIC_GRADES).find(g => student.gradeLevel === g.label);
    const targetGradeId = gradeEntry ? gradeEntry.id : student.gradeLevel;

    console.log(`\nLooking for Matrix: Unit=${student.unit}, Shift=${student.shift}, Grade=${targetGradeId}`);

    const matricesSnap = await getDocs(collection(db, "academic_matrices"));
    const matchingMatrix = matricesSnap.docs.map(d => d.data()).find(m =>
        m.unit === student.unit &&
        m.shift === student.shift &&
        (m.gradeId === targetGradeId || m.gradeId === student.gradeLevel)
    );

    if (matchingMatrix) {
        console.log(`\nMATRIX FOUND (ID: ${matchingMatrix.id})`);
        console.log("Subjects in Matrix:");
        matchingMatrix.subjects.forEach(s => {
            console.log(`- ${s.name} [${s.id}] (Hours: ${s.weeklyHours})`);
        });

        // 4. CHECK MATCH
        console.log("\n--- CROSS CHECK ---");
        grades.forEach(g => {
            const match = matchingMatrix.subjects.find(s => s.id === g.subject);
            if (match) {
                console.log(`✅ Grade "${g.subject}" -> Matrix "${match.name}" (Hours: ${match.weeklyHours})`);
            } else {
                console.log(`❌ Grade "${g.subject}" -> NOT IN MATRIX!`);
            }
        });

    } else {
        console.log("❌ NO MATRIX FOUND.");
    }
}

verifyThiago().catch(console.error);
