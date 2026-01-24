import { readFileSync } from 'fs';

function findInAlunos(query) {
    const content = readFileSync('./migration_data/Alunos.sql', 'utf8');
    const regex = /INSERT INTO ALUNO\s*\([^]*?VALUES\s*\((.*?)\);/gs;
    let match;
    const results = [];
    while ((match = regex.exec(content)) !== null) {
        if (match[0].toUpperCase().includes(query.toUpperCase())) {
            const values = match[1].split(',').map(v => v.trim().replace(/^'|'$/g, ''));
            results.push({
                raw: match[0].substring(0, 150),
                codigo: values[0],
                matricula: values[1],
                nome: values[3]
            });
        }
    }
    return results;
}

function findInMatriculas(codigo) {
    const content = readFileSync('./migration_data/Maticulas.sql', 'utf8');
    const regex = /INSERT INTO MATRICULA\s*\([^]*?VALUES\s*\((.*?)\);/gs;
    let match;
    const results = [];
    while ((match = regex.exec(content)) !== null) {
        const values = match[1].split(',').map(v => v.trim().replace(/^'|'$/g, ''));
        if (values[1] === codigo) {
            results.push({
                ano: values[0],
                codigo: values[1],
                matricula: values[2]
            });
        }
    }
    return results;
}

console.log('--- ISABELLA CAROLYNNA ---');
const isabella = findInAlunos('ISABELLA CAROLYNNA');
console.log('Alunos:', isabella);
if (isabella.length > 0) console.log('Matriculas (by CODIGO):', findInMatriculas(isabella[0].codigo));

console.log('\n--- ALICE LIANE ---');
const alice = findInAlunos('ALICE LIANE');
console.log('Alunos:', alice);
if (alice.length > 0) console.log('Matriculas (by CODIGO):', findInMatriculas(alice[0].codigo));
