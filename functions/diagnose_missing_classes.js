const admin = require('firebase-admin');
var serviceAccount = require("./serviceAccountKey.json");

// Check if app already initialized
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} else {
    admin.app();
}

const db = admin.firestore();

async function diagnose() {
    console.log("Iniciando diagnóstico de alunos sem turma...");
    const snapshot = await db.collection('students').get();

    let missingClassCount = 0;
    let details = [];

    snapshot.forEach(doc => {
        const student = doc.data();
        // Check for missing schoolClass
        if (!student.schoolClass || student.schoolClass.trim() === '') {
            missingClassCount++;
            details.push({
                name: student.name,
                code: student.code,
                unit: student.unit,
                gradeLevel: student.gradeLevel,
                shift: student.shift,
                schoolClass: student.schoolClass
            });
        }
    });

    console.log(`Total de alunos: ${snapshot.size}`);
    console.log(`Alunos sem turma: ${missingClassCount}`);

    if (missingClassCount > 0) {
        console.log("Detalhes dos primeiros 20:");
        console.table(details.slice(0, 20));
    }
}

diagnose().catch(console.error);
