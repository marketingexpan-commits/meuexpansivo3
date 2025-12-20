console.log("Script starting...");
let firebase;
try {
    const pkg = require("firebase/compat/app");
    firebase = pkg.default || pkg;
    require("firebase/compat/firestore");
    console.log("Firebase loaded.");
} catch (e) {
    console.error("Firebase load error:", e);
    process.exit(1);
}

if (typeof window === 'undefined') {
    global.window = {};
}

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
console.log("DB Initialized.");

const SUBJECTS = [
    'Artes', 'Biologia', 'Ciências', 'Educação Física', 'Empreendedorismo',
    'Ensino Religioso', 'Espanhol', 'Filosofia', 'Física', 'Geografia',
    'História', 'Inglês', 'Literatura', 'Matemática', 'Musicalização',
    'Português', 'Projeto de Vida', 'Química', 'Redação', 'Sociologia'
];

const RAW_TEXT = `
1578 16229 DAVID PARCELLY GRACIANO
ALBUQUERQUE BARR
02 6A MANHA -
MATUTINO
998137431W
R OSORIO DANTAS,289-CENTRO/EXTREMOZ 21/01/2025
U 15/08/2013
1613 16229 DAVID PIETRO ALVES DA SILVA 02 4A MANHA -
RUA ESPÁNMHAAT ,U7T8I0N-OES P ORTE CLUB 3/ 16/09/2025
A 30/04/2015
2098 16229 DEBORAH GABRIELLY DA SILVA
TOMAZ
02 7A MANHA -
MATUTINO
8191654518
R BOM JESUS,18A-/EXTREMOZ 05/06/2025
U 29/08/2012
2038 16229 DIOGO WILLIAM AMARAL
GONÇALVES
01 N5 MANHA -
MATUTINO
84996172379
RUA ITALIA,-SPORT CLUB/EXTREMOZ 03/02/2025
A 30/01/2020
155 152 DJEYDJE HELLENCY MEDEIROS DA
SILVA
02 8A MANHA -
RUA INTERNMAACTIUOTNINAOL, 3 6 -CENTRAL PARQUE CLUBE/EXTREMOZ 11/02/2025
U 12/05/2012
1705 16229 EDGAR PLATINI BORGES MEDEIROS 02 4A MANHA -
MATUTINO
84996091726
R ITALIA,413-SORT CLUB 4/EXTREMOZ 25/01/2025
A 14/07/2015
1968 16229 ELIAS GABRIEL DUARTE DE
OLIVEIRA
02 6A MANHA -
MATUTINO
84994227315
R SAO MATEUS,01/A-LOT POTIGUAR/EXTREMOZ 19/12/2024
U 28/08/2013
1634 1635 ELINY NICOLLE O CUSTODIO
MOURA
01 N4 TARDE -
RUA JOSEFVAE MSAPRERIAT IDNAO CONCEIÇÃO,2000-CENTRAL PARQUE
3/EXTREMOZ
16/01/2025
B 22/06/2021
1722 16229 ELLOAH SOPHIA DE ANDRADE
FARIAS
02 1A MANHA -
R FLUMINENMSAET,U5T4I-NCOE N T RAL PARK CLUB/EXTREMOZ 31/01/2025
A 28/09/2018
1717 1717 EMANUEL MARLON LOPES
FERREIRA
01 N5 MANHA -
R ANDRE DME AATLUBTUIQNUOE R QUE,17-/EXTREMOZ 09/01/2025
A 0
1457 16229 EMANUEL MARTORANO ARNAUD 02 6A MANHA -
MATUTINO
9 98977984 W
R SARGENTO FERNANDES NASC BORGES,-CONJ ESTRELA DO
MAR/EXTREMOZ
30/01/2025
U 17/04/2013
2085 16406 EMANUEL ROBERTO DE SOUZA
MENEZES
03 1S MANHA -
MATUTINO
84987261781
AV VERANISTA ROCCO RUSSO,4669B-/EXTREMOZ 14/04/2025
U 05/03/2009
1739 1739 EMILLY VITORIA SOARES DE
AGUIAR
02 8A MANHA -
R GOIAS,10M9A-TCUENTITNROA L PARK CLUB/EXTREMOZ 18/01/2025
U 18/07/2010
1999 16229 EMILY EDUARDA FARIAS DE LIMA 02 4A TARDE -
VESPERTINO
84991635269
RUA SUECIA,216-SPORT CLUB/EXTREMOZ 14/01/2025
B 27/12/2015
1518 16229 EMMANUELLE THALYTA FERREIRA
PINHEIRO
02 8A MANHA -
AVENIDA AMTLAATNUTTIICNAO , 2 0 33-GRUTAS ESTIVAS/EXTREMOZ 27/05/2025
U 03/11/2011
2051 16358 EMYLLY VICTORIA LIMA MODESTO 02 1A MANHA -
MATUTINO
988792960
RUA ANDRE DE ALBUQUERQUE,767-/ 04/02/2025
B 04/04/2018
1750 16229 ENDRIK RYAN DIAS AGRA 03 3S MANHA -
R COMDT VMAALETNUTTIIMNO P E R EIRA NETO,-CENTRO/EXTREMOZ 29/01/2025
U 29/12/2006
1494 16229 ENZO DA COSTA LUSSAC DE SALES 03 1S MANHA -
RUA ALMIRMANATTEU TMINATOO S O MAIA,188-CONJ ESTRELA DO
MAR/EXTREMOZ
24/01/2025
U 03/07/2009
1495 16229 ENZO GABRIEL BARBOSA DE
SOUZA
02 5A MANHA -
MATUTINO
9 99456140W
R ALMIRANTE ARY PARREIRAS,208-/EXTREMOZ 21/01/2025
U 26/12/2014
1828 16229 ENZO GABRIEL SILVA SANTANA 02 4A MANHA -
RUA ANDORMRAAT U,2T8IN-COE N T RO /EXTREMOZ 21/01/2025
A 28/03/2016
1294 16229 ENZO INACIO DA SILVA 02 2A MANHA -
MATUTINO
994557012
AV. PEDRO VASCONELOS ,953-BOSQUE DAS FLORES/EXTREMOZ 21/01/2025
A 30/12/2017
1468 1471 ENZO LUCCA ANDRADE DE
OLIVEIRA
02 2A MANHA -
RUA SITIO MOAITTIUZTEIINROO , 3 PR5-ZONA RURAL/CEARA MIRIM 27/12/2024
A 31/10/2017
148 16229 ENZO LUIZ MONTEIRO 02 6A MANHA -
RUA FIGUEMIRAETNUSTEI,N-COE N TRAL PARQUE CLUBE/EXTREMOZ 21/01/2025
U 13/09/2013
978 16229 ENZO PAIVA DE ANDRADE LIMA 02 4A TARDE -
RUA COPACVAEBSAPNEAR,T1I1N7O- CENTRAL PARQUE /EXTREMOZ 28/01/2025
B 19/02/2016
1978 16229 ESTHER BEATRIZ NASCIMENTO DA
SILVA
02 6A MANHA -
MATUTINO
84987016189
,-/ 06/01/2025
U 03/03/2014
1650 16229 ESTHER SUENIA COSTA SILVA 02 2A MANHA -
R CHAPECOMEANTSUET,3IN09O- C PARK CLUB/EXTREMOZ 21/01/2025
A 13/09/2017
654 16229 EUDES CORREIA JUNIOR 03 2S MANHA -
RUA JOAQUMIMAT DUET IGNOOI S , 12-CENTRO/EXTREMOZ 24/01/2025
U 12/12/2008
727 726 EVILYN NATASHA CUSTODIO
MOURA
02 2A MANHA -
MATUTINO
3279-2799
RUA JOSEFA MARIA DA CONCEIÇÃO,2000-CENTRAL PARQUE
3/EXTREMOZ
16/01/2025
A 14/05/2018
1881 16229 FELIPE BARBOSA BULHOES 01 N4 TARDE -
VESPERTINO
84988264799
R SAO PAULO,140-CENTRAL PARK 2/EXTREMOZ 23/01/2025
B 20/03/2021
1603 16229 FELIPE GABRIEL DE OLIVEIRA
GRILO
02 5A MANHA -
MATUTINO
987525898W
R ITALIA,622-COLINA DE GENIPABU/EXTREMOZ 25/01/2025
U 15/09/2014
1043 16229 FERNANDA GABRIELLE VIANA DE
FRANÇA
02 9A MANHA -
RUA CORINMHAIATSU T,1IN1O6- C ENTRAL PARQUE1/EXTREMOZ 24/01/2025
U 08/12/2008
141 16229 FERNANDA PESSOA CABRAL 02 5A MANHA -
RUA SAO MMAATTHUETUISN,O12 1 -SAO MIGUEL ARCANJO/EXTREMOZ 21/01/2025
U 15/04/2015
1791 1791 FLAVIA EMILY DE LIMA ARAUJO 03 3S MANHA -
AV ALCIDESM AATRUATUIJNOO,1 1 92-MOINHO/NATAL 11/03/2025
U 16/01/2008
2010 16229 FRANCISCO ARTHUR ESTEVAM
ALVES
02 1A TARDE -
VESPERTINO
84988377805
RUA DAS VIOLETAS/ CASA 01,273-JARDIM
BOTANICO/EXTREMOZ
20/01/2025
B 31/08/2018
1376 16229 GABRIEL ALONSO CAMILO BARROS 02 1A MANHA -
MATUTINO
9 92017697
R MANOEL PATRICIO DE MEDEIROS,-/NATAL 24/01/2025
A 01/05/2018
1879 16138 GABRIEL DE OLIVEIRA SILVA 01 N4 TARDE -
VESPERTINO
84992042290
R BAHIA,151-CENTRAL PARK CLUB/EXTREMOZ 10/01/2025
B 09/07/2020
1492 16229 GABRIEL DE OLIVEIRA TOMAZ 02 1A TARDE -
VESPERTINO
98835-8032
RUA PRINCIPAL,190-BOCA DA ILHA /EXTREMOZ 24/01/2025
B 10/07/2018
1979 16229 GABRIEL FELIPE DE M BARBOSA 02 4A MANHA -
MATUTINO
84987544942
RUA CROACRIA ,439-ESPORT CLUB/EXTREMOZ 07/01/2025
A 25/03/2016
1835 16229 GABRIEL LUCCA ARAUJO DE
OLIVEIRA
02 4A TARDE -
VESPERTINO
84981206928
RUA ILHA DE ITAPARICA,97-VILA NOVA/EXTREMOZ 21/02/2025
B 26/06/2015
533 16229 GABRIEL MATHEUS OTAVIANO DO
NASCIMENTO
03 2S MANHA -
RUA PRINCMIPAATLU ,T2I2N-OES T IVAS/EXTREMOZ 24/01/2025
U 11/09/2008
`;

function parseStudents(text) {
    const students = [];
    const content = text.replace(/\r/g, '').split('\n').join(' ');

    // Regex rigorosa: codigo(1-4dig) ref(1-5dig) nome sigla(01/02/03) grade turno
    // Importante: O nome pode conter espaços e caracteres acentuados.
    // O Anchor é 01, 02 ou 03.
    // Ex: 1886 16229 ABRAÃO... 02 4A MANHA

    const studentRegex = /(\d{1,4})\s+(\d{1,5})\s+([A-Z\xC0-\xFF\s\n\-]{5,100}?)\s+(01|02|03)\s+(N[1-5]|[1-9][AB S]?|(?:\d+º\s+Ano))\s+(MANHA|TARDE|MATUTINO|VESPERTINO|TARDE-VESPE|TARDE-VESPERTINO|MANHÃ)/g;

    let match;
    while ((match = studentRegex.exec(content)) !== null) {
        let [full, code, ref, name, anchor, grade, shiftRaw] = match;
        const shift = (shiftRaw.includes('MANHA') || shiftRaw.includes('MATUTINO') || shiftRaw.includes('MANHÃ')) ? 'Matutino' : 'Vespertino';

        // Tentar capturar a turma (A ou B) na vizinhança
        const nextPart = content.substring(match.index + full.length, match.index + full.length + 300);
        const classMatch = nextPart.match(/\s+([AB])\s+\d{2}\/\d{2}\/\d{4}/);
        const schoolClass = classMatch ? classMatch[1] : 'A';

        students.push({
            code,
            name: name.trim().replace(/\s+/g, ' '),
            gradeSigla: grade.toUpperCase(),
            shift,
            schoolClass
        });
    }
    return students;
}

function translateGrade(sigla) {
    const infantilMap = {
        'N1': 'Nível I - Edu. Infantil',
        'N2': 'Nível II - Edu. Infantil',
        'N3': 'Nível III - Edu. Infantil',
        'N4': 'Nível IV - Edu. Infantil',
        'N5': 'Nível V - Edu. Infantil'
    };
    if (sigla.startsWith('N')) return infantilMap[sigla] || sigla;
    if (/^\d/.test(sigla)) {
        const num = parseInt(sigla.match(/^\d+/)[0]);
        if (sigla.includes('S')) return `${num}ª Série - Ens.Médio`;
        if (num >= 1 && num <= 5) return `${num}º Ano - Fundamental I`;
        return `${num}º Ano - Fundamental II`;
    }
    return sigla;
}

async function importStudents() {
    const parsed = parseStudents(RAW_TEXT);
    console.log(`Alunos parseados: ${parsed.length} `);

    for (const data of parsed) {
        const gradeLevel = translateGrade(data.gradeSigla);
        const studentId = `student_${data.code} `;

        const student = {
            id: studentId,
            code: data.code,
            name: data.name,
            password: '123',
            gradeLevel: gradeLevel,
            gradeLevelSigla: data.gradeSigla,
            shift: data.shift,
            schoolClass: data.schoolClass,
            unit: 'Extremoz',
            isBlocked: false,
            nome_responsavel: '',
            metodo_pagamento: 'Interno'
        };

        try {
            await db.collection('students').doc(studentId).set(student);
            console.log(`[OK] ${student.name} (${student.gradeLevel})`);

            const isInfantil = data.gradeSigla.startsWith('N') || gradeLevel.includes('Infantil');

            if (isInfantil) {
                // REGRA DE OURO: Remover notas para Infantil
                const gradesSnap = await db.collection('grades').where('studentId', '==', studentId).get();
                if (!gradesSnap.empty) {
                    console.log(`   -> [LIMPEZA] Removendo ${gradesSnap.size} matérias indevidas.`);
                    const batch = db.batch();
                    gradesSnap.docs.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                }
            } else {
                // Garantir 20 disciplinas para Fundamental/Médio
                const now = new Date().toISOString();
                for (const subject of SUBJECTS) {
                    const gradeId = `${studentId}_${subject.replace(/\s+/g, '_')} `;
                    await db.collection('grades').doc(gradeId).set({
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
                console.log(`   -> [GRADES] 20 matérias garantidas.`);
            }
        } catch (e) {
            console.error(`[ERRO] ${data.name}: `, e);
        }
    }
    console.log("Importação finalizada.");
}

importStudents().catch(err => {
    console.error("ERRO FATAL:", err);
    process.exit(1);
}).then(() => process.exit(0));
