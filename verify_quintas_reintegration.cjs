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
    console.log("Verifying Quintas Reintegration...");

    // Check specific students from the list
    // 85 (3S), 182 (1S), 336 (9A)
    const checkList = [
        { id: 'student_85', expectedGrade: '3ª Série - Ens. Médio', expectedClass: 'A' },
        { id: 'student_182', expectedGrade: '1ª Série - Ens. Médio', expectedClass: 'A' },
        { id: 'student_336', expectedGrade: '9º Ano - Fundamental II', expectedClass: 'A' },
        { id: 'student_1208', expectedGrade: '5º Ano - Fundamental I', expectedClass: 'A' } // 03 5A VESPERTINO -> A 18/03/2014
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
            console.log(`   Class: ${data.schoolClass}`);
            console.log(`   Shift: ${data.shift}`);

            if (data.unit === 'Quintas' &&
                data.gradeLevel === item.expectedGrade &&
                data.schoolClass === item.expectedClass) {
                console.log("   -> STATUS: PASSED");
            } else {
                console.error("   -> STATUS: FAILED (Mismatch)");
            }
        }
    }
}

verify().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
