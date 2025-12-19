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

// TEXTO ACUMULADO DAS IMPORTAÇÕES ANTERIORES PARA RE-SYNC
const ALL_TEXT = `
# BATCH 1 & 2 (Turn 10)
11111 24 Thiago Quintiliano 01 N4 MANHA -
99 24 ALICE MARIA FERREIRA 02 N4 MANHA -
100 24 AYLA MIRELLA ALVES 01 N4 MANHA -
101 24 MARIA ALICE GOMES 02 N5 MANHA -
102 24 VIVIANNY BEZERRA 01 N4 MANHA -

# BATCH 3 (Turn 12)
223 24 ANTHONY MIGUEL GOMES BESSA 02 1A TARDE -
6 24 ANTONIO MIGUEL DA SILVA ANDRADE 02 1A MANHA -
486 24 BEATRIZ MENDONÇA GOMES 02 1A MANHA -
520 24 BENICIO JOSE ANDRADE PESSOA RIBEIRO 02 1A MANHA -
501 24 BERNARDO MOURA DE AZEVEDO 02 1A MANHA -
552 24 HEITOR MIGUEL DA SILVA TAVARES 02 1A MANHA -
296 24 JOÃO VICTOR PINHEIRO DE LIMA 02 1A MANHA -
102 24 LUCAS GABRIEL BARROS DA FRANÇA LIMA 02 1A MANHA -
538 24 MALU AGATHA ALVES CRUZ 02 1A MANHA -
50 24 MARIA ALICE DE SOUSA E LIMA 02 1A MANHA -
469 24 MARIANA FERREIRA DE OLIVEIRA 02 1A MANHA -
316 348 PEDRO RIBEIRO DA SILVA NETO 02 1A MANHA -
339 24 RICKSON GUILHERME PIRES DE OLIVEIRA 02 1A MANHA -
29 24 SASHA SUYANNE SIQUEIRA FERNANDES 02 1A MANHA -
374 24 CHRISTIAAN GAEL DE SOUZA DANTAS 02 1A MANHA -
461 24 ENZO CAUA ARAUJO DE ANDRADE 02 1A TARDE -
555 24 ENZO GABRIEL DA SILVA COSTA 02 1A TARDE -
51 24 JOSÉ RICARDO FERNANDES DA S. E MEDEIROS 02 1A TARDE -
88 24 LIVIA VENANCIO DE OLIVEIRA 02 1A TARDE -
460 24 LUNNA SOPHIE DE ALMEIDA RODRIGUES 02 1A TARDE -
554 24 MARIA SOFIA CAVALCANTE ALVES 02 1A TARDE -
103 24 MIGUEL BRYAN PEREIRA ROCHA 02 1A TARDE -

# BATCH 4 (Turn 15)
23 24 ADRIAN MANOEL ALVES DA SILVA OLIVEIRA 02 2A MANHA -
39 24 ANTONNY LEVY SANTOS DA COSTA 02 2A MANHA -
299 24 ARLEAN DO NASCIMENTO ARAUJO 02 2A MANHA -
518 24 BENJAMIM NAIRON NASCIMENTO FERNANDES 02 2A MANHA -
521 24 DAVI NICHOLAS CAVALCANTE DE SOUZA 02 2A MANHA -
511 24 ELOÁ LOPES DOS SANTOS 02 2A MANHA -
12 24 ENZO MIGUEL ARAUJO DE OLIVEIRA 02 2A MANHA -
325 24 HEITOR OLIVEIRA DE MEDEIROS 02 2A MANHA -
147 24 HELENA SOPHIA DA SILVA MARCOLINO 02 2A MANHA -
499 24 ISLA VITORIA RODRIGUES MOREIRA 02 2A MANHA -
154 24 JENNIFER HELOISA DA SILVA FERNANDES 02 2A MANHA -
92 24 JÚLIA TEREZA DA SILVA ARAÚJO 02 2A MANHA -
219 24 KAUÊ MIGUEL SOUZA DA SILVA 02 2A MANHA -
96 100 LUIZ BENICIO MANIÇOBA DE LIMA 02 2A TARDE -
137 24 LUIZ MANUEL QUEIROZ DE OLIVEIRA 02 2A MANHA -
470 24 MANUELA FERREIRA DE OLIVEIRA 02 2A MANHA -
421 24 MARIA HELENA DOS SANTOS LEÃO 02 2A TARDE -
113 24 NICOLAS DANTE TAVARES TORRES 02 2A MANHA -
224 24 RYAN ALEXANDER SILVA MARINHO 02 2A MANHA -
91 24 URIEL LEVI DOS SANTOS MARREIRO 02 2A MANHA -
140 145 VALENTINA THORRYCCELEE SILVEIRA DE SANTA 02 2A MANHA -
`;

function parseStudents(text) {
    const students = [];
    const content = text.replace(/\r/g, '').split('\n').join(' ');
    const studentRegex = /(\d{1,4})\s+(\d{1,3})\s+([A-Z\xC0-\xFF\s]{5,100}?)\s+(01|02)\s+(N[1-5]|[1-9][AB S]?|(?:\d+º\s+Ano))\s+(MANHA|TARDE|MATUTINO|VESPERTINO|TARDE-VESPE|TARDE-VESPERTINO|MANHÃ)/g;

    let match;
    while ((match = studentRegex.exec(content)) !== null) {
        let [full, code, ref, name, anchor, grade, shiftRaw] = match;
        students.push({ code, name: name.trim(), gradeSigla: grade.toUpperCase() });
    }
    return students;
}

function translateGrade(sigla) {
    const infantMap = { 'N1': 'Nível I', 'N2': 'Nível II', 'N3': 'Nível III', 'N4': 'Nível IV', 'N5': 'Nível V' };
    if (sigla.startsWith('N')) return `${infantMap[sigla] || sigla} - Edu. Infantil`;
    if (/^\d/.test(sigla)) {
        const num = parseInt(sigla.match(/^\d+/)[0]);
        if (sigla.includes('S')) return `${num}ª Série - Ens. Médio`;
        if (num >= 1 && num <= 5) return `${num}º Ano - Fundamental I`;
        return `${num}º Ano - Fundamental II`;
    }
    return sigla;
}

async function runCleanup() {
    console.log("Iniciando correção crítica de inversão e limpeza de registros...");
    const parsed = parseStudents(ALL_TEXT);
    console.log(`Parsed ${parsed.length} alunos históricos para re-sync.`);

    for (const p of parsed) {
        const studentId = `student_${p.code}`;
        const officialGrade = translateGrade(p.gradeSigla);
        const isInfantil = officialGrade.includes('Infantil');

        console.log(`Corrigindo [${p.code}] ${p.name}: Sigla=${p.gradeSigla} -> ${officialGrade}`);

        // 1. Atualizar o Aluno com gradeLevel e gradeLevelSigla
        const docRef = db.collection('students').doc(studentId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            console.log(`     -> [AVISO] Aluno ${p.name} (${studentId}) não encontrado no Firestore. Pulando.`);
            continue;
        }

        await docRef.update({
            gradeLevel: officialGrade,
            gradeLevelSigla: p.gradeSigla
        });

        // 2. Se for Infantil, DELETAR registros na coleção grades
        if (isInfantil) {
            const gradesSnap = await db.collection('grades').where('studentId', '==', studentId).get();
            if (!gradesSnap.empty) {
                console.log(`     -> Removendo ${gradesSnap.size} matérias indevidas para aluno Infantil...`);
                const batchNum = db.batch();
                gradesSnap.docs.forEach(doc => batchNum.delete(doc.ref));
                await batchNum.commit();
            }
        } else {
            // Se for Fundamental/Médio, garantir que tenha as 20 disciplinas
            const gradesSnap = await db.collection('grades').where('studentId', '==', studentId).get();
            if (gradesSnap.size < 20) {
                console.log(`     -> [FIX] Gerando 20 disciplinas para [${p.code}] ${p.name} (Atualmente tem ${gradesSnap.size})...`);
                const batchGrades = db.batch();
                const now = new Date().toISOString();
                for (const subject of SUBJECTS) {
                    const gradeId = `${studentId}_${subject.replace(/\s+/g, '_')}`;
                    batchGrades.set(db.collection('grades').doc(gradeId), {
                        id: gradeId,
                        studentId: studentId,
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
                await batchGrades.commit();
            }
        }
    }

    console.log("Correção crítica finalizada!");
    process.exit(0);
}

runCleanup().catch(e => { console.error(e); process.exit(1); });
