const fs = require('fs');

const matriculasContent = fs.readFileSync('./migration_data/Maticulas.sql', 'latin1');
const matInserts = matriculasContent.split(';');

const gradeMap = {}; // CUR_SER -> List of student names (sampled)

const alumnosContent = fs.readFileSync('./migration_data/Alunos.sql', 'latin1');
const alunosMap = {}; // CODIGO -> Name
const alInserts = alumnosContent.split(';');

alInserts.forEach(seg => {
    const match = seg.match(/INSERT INTO ALUNO\s*\((.*?)\)\s*VALUES\s*\((.*)/is);
    if (match) {
        const valStr = match[2].trim().replace(/\)$/s, '');
        const vals = valStr.split(',').map(v => v.trim().replace(/^'|'$/g, ''));
        alunosMap[vals[0]] = vals[3];
    }
});

matInserts.forEach(seg => {
    const match = seg.match(/INSERT INTO MATRICULA\s*\((.*?)\)\s*VALUES\s*\((.*)/is);
    if (match) {
        const colNames = match[1].split(',').map(c => c.trim().toUpperCase());
        const valStr = match[2].trim().replace(/\)$/is, '').replace(/;$/is, '');
        const vals = valStr.split(',').map(v => v.trim().replace(/^'|'$/g, ''));

        const obj = {};
        colNames.forEach((col, i) => { if (i < vals.length) obj[col] = vals[i]; });

        if (obj.CUR && obj.SER) {
            const key = `${obj.CUR}_${obj.SER}`;
            if (!gradeMap[key]) gradeMap[key] = new Set();
            if (gradeMap[key].size < 3) {
                const name = alunosMap[obj.CODIGO] || `Code:${obj.CODIGO}`;
                gradeMap[key].add(`${name} (${obj.ANO})`);
            }
        }
    }
});

console.log("MAPPING SAMPLES (CUR_SER -> Names):");
Object.keys(gradeMap).sort().forEach(key => {
    console.log(`${key}: ${Array.from(gradeMap[key]).join(', ')}`);
});
