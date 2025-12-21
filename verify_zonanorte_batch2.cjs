const firebase = require("firebase/compat/app");
require("firebase/compat/firestore");

const firebaseConfig = {
    apiKey: "AIzaSyAe5Rb4dqi80cYUxj69EFr4AGElCI9Rb9o",
    authDomain: "meu-expansivo-app.firebaseapp.com",
    projectId: "meu-expansivo-app",
    storageBucket: "meu-expansivo-app.firebasestorage.app",
    messagingSenderId: "688981571362",
    appId: "1:688981571362:web:179c1dcae4b01f9f9f177b"
};

const app = firebase.initializeApp(firebaseConfig);
const db = app.firestore();

async function verify() {
    console.log("Verifying Zona Norte Batch 2...");

    // Check specific students from the batch 2 list
    // 3614: MURILLO... 6A MANHA (Matutino) Class A
    // 3669: ESTER... 2A TARDE (Vespertino) Class B
    // 3694: ANNA... 3S MANHA (Matutino) Class A
    // 3713: REBECA... N5 MANHA (Matutino) Class A

    const checkList = [
        { id: 'student_3614', expectedGrade: '6º Ano - Fundamental II', expectedShift: 'Matutino', expectedClass: 'A' },
        { id: 'student_3669', expectedGrade: '2º Ano - Fundamental I', expectedShift: 'Vespertino', expectedClass: 'B' },
        { id: 'student_3694', expectedGrade: '3ª Série - Ens. Médio', expectedShift: 'Matutino', expectedClass: 'A' },
        { id: 'student_3713', expectedGrade: 'Nível V - Edu. Infantil', expectedShift: 'Matutino', expectedClass: 'A' }
    ];

    for (const item of checkList) {
        const doc = await db.collection('students').doc(item.id).get();
        if (!doc.exists) {
            console.error(`[FAIL] ${item.id} not found.`);
        } else {
            const data = doc.data();
            console.log(`[CHECK] ${item.id}:`);
            console.log(`   Name: ${data.name}`);
            console.log(`   Unit: ${data.unit}`);
            console.log(`   Grade: ${data.gradeLevel}`);
            console.log(`   Shift: ${data.shift}`);
            console.log(`   Class: ${data.schoolClass}`);

            let passed = true;
            if (data.unit !== 'Zona Norte') { console.error('   -> FAIL: Unit mismatch'); passed = false; }
            if (data.gradeLevel !== item.expectedGrade) { console.error(`   -> FAIL: Grade mismatch (Exp: ${item.expectedGrade}, Got: ${data.gradeLevel})`); passed = false; }
            if (data.shift !== item.expectedShift) { console.error(`   -> FAIL: Shift mismatch (Exp: ${item.expectedShift}, Got: ${data.shift})`); passed = false; }
            if (data.schoolClass !== item.expectedClass) { console.error(`   -> FAIL: Class mismatch (Exp: ${item.expectedClass}, Got: ${data.schoolClass})`); passed = false; }

            if (passed) console.log("   -> STATUS: PASSED");
        }
    }
}

verify().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
