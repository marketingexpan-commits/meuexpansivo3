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

async function cleanup() {
    console.log("Cleaning up students and grades...");

    const studentsSnap = await db.collection('students').get();
    for (const doc of studentsSnap.docs) {
        if (doc.id.startsWith('student_')) {
            await doc.ref.delete();
            console.log(`Deleted student: ${doc.id}`);
        }
    }

    const gradesSnap = await db.collection('grades').get();
    for (const doc of gradesSnap.docs) {
        if (doc.id.startsWith('student_')) {
            await doc.ref.delete();
            console.log(`Deleted grade: ${doc.id}`);
        }
    }

    console.log("Cleanup finished.");
    process.exit(0);
}

cleanup();
