import firebase from "firebase/compat/app";
import "firebase/compat/firestore";

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

const SUBJECTS = [
    'Artes', 'Biologia', 'Ciências', 'Educação Física', 'Empreendedorismo',
    'Ensino Religioso', 'Espanhol', 'Filosofia', 'Física', 'Geografia',
    'História', 'Inglês', 'Literatura', 'Matemática', 'Musicalização',
    'Português', 'Projeto de Vida', 'Química', 'Redação', 'Sociologia'
];

async function fixGrades() {
    console.log("Iniciando saneamento do banco (Unidade Boa Sorte)...");

    const snapshot = await db.collection('students')
        .where('unit', '==', 'Boa Sorte')
        .get();

    console.log(`Verificando ${snapshot.size} alunos...`);

    for (const doc of snapshot.docs) {
        const student = doc.data();
        let currentGrade = student.gradeLevel || "";

        // Normalização para comparação (evitar problemas de encoding com º)
        const normalizedGrade = currentGrade.normalize('NFD');
        const target1 = "1º Ano - Fundamental I";

        if (currentGrade.includes('1º Ano') || currentGrade.includes('1A') || currentGrade.includes('Nível I')) {
            console.log(`Corrigindo: ${student.name} | De: "${currentGrade}" Para: "${target1}"`);

            await db.collection('students').doc(doc.id).update({
                gradeLevel: target1
            });

            // Garantir 20 disciplinas
            const gradesSnapshot = await db.collection('grades')
                .where('studentId', '==', doc.id)
                .get();

            if (gradesSnapshot.size < 20) {
                console.log(`     -> Criando 20 disciplinas para ${student.name}...`);
                const batch = db.batch();
                const now = new Date().toISOString();

                for (const subject of SUBJECTS) {
                    const gradeId = `${doc.id}_${subject.replace(/\s+/g, '_')}`;
                    const gradeRef = db.collection('grades').doc(gradeId);
                    batch.set(gradeRef, {
                        id: gradeId,
                        studentId: doc.id,
                        subject: subject,
                        bimesters: {
                            bimester1: { nota: null, recuperacao: null, media: 0, faltas: 0 },
                            bimester2: { nota: null, recuperacao: null, media: 0, faltas: 0 },
                            bimester3: { nota: null, recuperacao: null, media: 0, faltas: 0 },
                            bimester4: { nota: null, recuperacao: null, media: 0, faltas: 0 }
                        },
                        mediaAnual: 0,
                        mediaFinal: 0,
                        situacaoFinal: 'Recuperação',
                        lastUpdated: now
                    }, { merge: true });
                }
                await batch.commit();
            }
        }
    }

    console.log("Saneamento concluído!");
    process.exit(0);
}

fixGrades().catch(err => {
    console.error(err);
    process.exit(1);
});
