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
    console.log("Verifying Student 4900...");
    const id = 'student_4900';
    const doc = await db.collection('students').doc(id).get();

    if (!doc.exists) {
        console.error(`[FAIL] ${id} NOT FOUND.`);
    } else {
        const data = doc.data();
        console.log(`[CHECK] ${id}: FOUND`);
        console.log(`Name: ${data.name}`);
        console.log(`Grade: ${data.gradeLevel}`);

        if (data.name.includes("BENJAMIN SILVA")) {
            console.log("Status: PASSED NAME CHECK");
        } else {
            console.log("Status: FAILED NAME CHECK");
        }
    }
}

verify().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
