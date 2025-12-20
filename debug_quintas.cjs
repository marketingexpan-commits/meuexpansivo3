
const fs = require('fs');

function parseStudents(text) {
    const students = [];
    const content = text.replace(/\r/g, '').split('\n').join(' ');

    const studentRegex = /(\d{1,5})\s+(\d{1,5})\s+([A-Z\xC0-\xFF\s\n\-]+?)\s+(0[1-9])\s+([0-9][A-Z]S?|[0-9][A-Z]|N[1-5])\s+(MATUTINO|VESPERTINO)/g;

    let match;
    while ((match = studentRegex.exec(content)) !== null) {
        let [full, code, ref, name, anchor, grade, shiftRaw] = match;

        if (code === '85') {
            const shift = (shiftRaw.includes('MATUTINO')) ? 'Matutino' : 'Vespertino';
            const nextPart = content.substring(match.index + full.length, match.index + full.length + 300);
            const classMatch = nextPart.match(/\s+([AB])\s+\d{2}\/\d{2}\/\d{4}/);
            const schoolClass = classMatch ? classMatch[1] : 'A';

            console.log("Found Student 85:");
            console.log("Raw Grade:", grade);
            const gradeLevel = translateGrade(grade);
            console.log("Translated Grade:", gradeLevel);
            console.log("Full Match:", full);
        }
    }
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

        if (sigla.includes('S')) {
            return `${num}ª Série - Ens.Médio`;
        }

        if (num >= 1 && num <= 5) return `${num}º Ano - Fundamental I`;
        return `${num}º Ano - Fundamental II`;
    }
    return sigla;
}

const rawText = fs.readFileSync('quintas_data.txt', 'utf8');
parseStudents(rawText);
