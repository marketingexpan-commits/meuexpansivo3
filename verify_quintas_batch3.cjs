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
    console.log("Verifying Quintas Batch 3...");

    // Check specific students from the batch 3 list
    // 2087 (N4 Vespertino), 2096 (7A Matutino), 2120 (2S Matutino)
    const checkList = [
        { id: 'student_2087', expectedGrade: 'Nível IV - Edu. Infantil', expectedShift: 'Vespertino' },
        { id: 'student_2096', expectedGrade: '7º Ano - Fundamental II', expectedShift: 'Matutino' },
        { id: 'student_2120', expectedGrade: '2ª Série - Ens. Médio', expectedShift: 'Matutino' }
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

            if (data.unit === 'Quintas' &&
                data.gradeLevel === item.expectedGrade &&
                data.shift === item.expectedShift) {
                console.log("   -> STATUS: PASSED");
            } else {
                console.error("   -> STATUS: FAILED (Mismatch)");
            }
        }
    }
}

verify().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
