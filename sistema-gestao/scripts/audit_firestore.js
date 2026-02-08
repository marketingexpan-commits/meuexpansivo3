import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from 'fs';

const firebaseConfig = {
    apiKey: "AIzaSyAe5Rb4dqi8OcyUXj69EFr4AGElCI9Rb9o",
    authDomain: "meu-expansivo-app.firebaseapp.com",
    databaseURL: "https://meu-expansivo-app-default-rtdb.firebaseio.com",
    projectId: "meu-expansivo-app",
    storageBucket: "meu-expansivo-app.firebasestorage.app",
    messagingSenderId: "688981571362",
    appId: "1:688981571362:web:179c1dcae4b01f9f9f177b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function auditFirestore() {
    let output = '--- FIRESTORE AUDIT ---\n';
    const snapshot = await getDocs(collection(db, 'students'));
    output += `Total students in DB: ${snapshot.size}\n`;

    const unitCounts = {};
    const yearCounts = {};
    const statusCounts = {};

    snapshot.forEach(doc => {
        const data = doc.data();

        // Unit
        const unit = data.unit || 'MISSING';
        unitCounts[unit] = (unitCounts[unit] || 0) + 1;

        // Years
        if (data.enrolledYears && Array.isArray(data.enrolledYears)) {
            data.enrolledYears.forEach(y => {
                yearCounts[y] = (yearCounts[y] || 0) + 1;
            });
        }

        // Status
        const status = data.status || 'MISSING';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    output += '\nUnit Distribution:\n';
    output += JSON.stringify(unitCounts, null, 2) + '\n';

    output += '\nYear Distribution (enrolledYears):\n';
    output += JSON.stringify(yearCounts, null, 2) + '\n';

    output += '\nStatus Distribution:\n';
    output += JSON.stringify(statusCounts, null, 2) + '\n';

    // Check specific units
    const unitsSnap = await getDocs(collection(db, 'school_units'));
    output += `\nAvailable School Units IDs:\n`;
    unitsSnap.forEach(doc => {
        output += `- ${doc.id} (${doc.data().fullName})\n`;
    });

    fs.writeFileSync('audit_firestore_results.txt', output);
    console.log('Results written to audit_firestore_results.txt');
}

auditFirestore().then(() => process.exit(0));
