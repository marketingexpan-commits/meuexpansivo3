const pkg = require("firebase/compat/app");
const firebase = pkg.default || pkg;
require("firebase/compat/firestore");

const firebaseConfig = {
    apiKey: "AIzaSyAe5Rb4dqi80cYUxj69EFr4AGElCI9Rb9o",
    authDomain: "meu-expansivo-app.firebaseapp.com",
    projectId: "meu-expansivo-app",
    storageBucket: "meu-expansivo-app.firebasestorage.app",
    messagingSenderId: "688981571362",
    appId: "1:688981571362:web:179c1dcae4b01f9f9f177b"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();

async function deleteThiagoAbsences() {
    console.log("Searching for Student 'Thiago Quintiliano'...");
    const studentsRef = db.collection('students');
    const snapshot = await studentsRef.get();

    let studentId = null;
    let studentDetails = null;

    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.name && data.name.trim().toLowerCase() === 'thiago quintiliano') {
            studentId = doc.id;
            studentDetails = data;
        }
    });

    if (!studentId) {
        console.log("Exact match not found. Trying loose search...");
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.name && data.name.toLowerCase().includes('thiago') && data.name.toLowerCase().includes('quintiliano')) {
                studentId = doc.id;
                studentDetails = data;
            }
        });
    }

    if (!studentId) {
        console.error("Student not found.");
        process.exit(1);
    }

    console.log(`Targeting Student: ${studentDetails.name} (ID: ${studentId})`);
    console.log(`Unit: ${studentDetails.unit} | Grade: ${studentDetails.gradeLevel} | Class: ${studentDetails.schoolClass}`);

    const attRef = db.collection('attendance')
        .where('unit', '==', studentDetails.unit)
        .where('gradeLevel', '==', studentDetails.gradeLevel)
        .where('schoolClass', '==', studentDetails.schoolClass);

    try {
        const attSnapshot = await attRef.get();
        console.log(`Found ${attSnapshot.size} attendance records for his class.`);

        let deletedCount = 0;
        let updatedCount = 0;

        const batch = db.batch();
        let operationCount = 0;

        attSnapshot.forEach(doc => {
            const data = doc.data();
            // Check if studentStatus exists and has the student
            if (data.studentStatus && data.studentStatus[studentId]) {
                console.log(`Found absence in record ${doc.id} (${data.date})`);

                const newStatus = { ...data.studentStatus };
                delete newStatus[studentId]; // Remove the student

                if (Object.keys(newStatus).length === 0) {
                    console.log(`  -> Deleting empty document.`);
                    batch.delete(doc.ref);
                    deletedCount++;
                } else {
                    console.log(`  -> Updating document (removing student).`);
                    batch.update(doc.ref, { studentStatus: newStatus });
                    updatedCount++;
                }
                operationCount++;
            }
        });

        if (operationCount > 0) {
            await batch.commit();
            console.log(`SUCCESS: Removed absences from ${operationCount} records.`);
            console.log(`Updated: ${updatedCount} | Deleted Docs: ${deletedCount}`);
        } else {
            console.log("No absences found for this student in the fetched records.");
        }

    } catch (error) {
        console.error("Error processing attendance:", error);
    }
}

deleteThiagoAbsences().then(() => {
    console.log("Done.");
    process.exit(0);
}).catch(err => {
    console.log("Error:", err);
    process.exit(1);
});
