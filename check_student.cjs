
const firebaseConfig = {
    apiKey: "AIzaSyAe5Rb4dqi80cYUxj69EFr4AGElCI9Rb9o",
    authDomain: "meu-expansivo-app.firebaseapp.com",
    projectId: "meu-expansivo-app",
    storageBucket: "meu-expansivo-app.firebasestorage.app",
    messagingSenderId: "688981571362",
    appId: "1:688981571362:web:179c1dcae4b01f9f9f177b"
};

const pkg = require("firebase/compat/app");
const firebase = pkg.default || pkg;
require("firebase/compat/firestore");

if (typeof window === 'undefined') {
    global.window = {};
}

const app = firebase.initializeApp(firebaseConfig);
const db = app.firestore();

async function checkStudent() {
    console.log("Checking Student 85...");
    const doc = await db.collection('students').doc('student_85').get();
    if (!doc.exists) {
        console.log("Student 85 not found in DB.");
    } else {
        console.log("Student 85 Grade Level:", doc.data().gradeLevel);
    }
    process.exit(0);
}

checkStudent().catch(e => console.error(e));
