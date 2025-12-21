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
    // Corrected 3S IDs
    const idsToCheck = [
        'student_1515',
        'student_1901',
        'student_1763',
        'student_1079'
    ];

    console.log("Verifying students (3rd Grade)...");

    for (const id of idsToCheck) {
        const doc = await db.collection('students').doc(id).get();
        if (!doc.exists) {
            console.error(`[MISSING] ${id} NOT FOUND`);
        } else {
            const data = doc.data();
            console.log(`[CHECK] ${id}:`);
            console.log(`   Name: ${data.name}`);
            console.log(`   Grade: ${data.gradeLevel} (Expected: 3ª Série - Ens. Médio)`);
            console.log(`   Unit: ${data.unit} (Expected: Extremoz)`);
            console.log(`   Shift: ${data.shift} (Expected: Matutino)`);
            console.log(`   Class: ${data.schoolClass} (Expected: A)`);

            if (data.gradeLevel === '3ª Série - Ens. Médio' &&
                data.unit === 'Extremoz' &&
                data.shift === 'Matutino' &&
                data.schoolClass === 'A') {
                console.log("   -> STATUS: PASSED");
            } else {
                console.error("   -> STATUS: FAILED");
            }
        }
        console.log('---');
    }
}

verify().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
