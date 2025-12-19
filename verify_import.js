import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
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

async function checkStudents() {
    const snapshot = await db.collection('students').get();
    console.log(`Total students: ${snapshot.size}`);
    snapshot.docs.forEach(doc => {
        const student = doc.data();
        console.log(`- ${student.name} [Code: ${student.code}] (${student.gradeLevel})`);
    });
    process.exit(0);
}

checkStudents();
