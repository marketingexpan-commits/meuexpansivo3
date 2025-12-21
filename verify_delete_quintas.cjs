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

async function verifyDeletion() {
    console.log("Verifying deletion of 'Quintas' students...");
    const snapshot = await db.collection('students').where('unit', '==', 'Quintas').get();

    if (snapshot.empty) {
        console.log("SUCCESS: No students found for unit 'Quintas'.");
        process.exit(0);
    } else {
        console.error(`FAILURE: Found ${snapshot.size} students still remaining in 'Quintas'.`);
        process.exit(1);
    }
}

verifyDeletion().catch(e => {
    console.error(e);
    process.exit(1);
});
