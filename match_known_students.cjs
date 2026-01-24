const fs = require('fs');

const matriculasContent = fs.readFileSync('./migration_data/Maticulas.sql', 'latin1');
const matInserts = matriculasContent.split(';');

const TARGET_STUDENTS = [
    { name: 'MARIA VALENTINA MEDEIROS DA SILVA', code: '1852' },
    { name: 'ARTHUR KAYCK BEZERRA VENANCIO', code: '2287' },
    { name: 'AYLA MAITTE HERCULANO DA SILVA', code: '2314' },
    { name: 'AYSLLA MARYANE PEREIRA LOBATO', code: '2202' },
    { name: 'ANNA LIZ DA SILVA SOUSA', code: '2114' },
    { name: 'MARIA LUIZA AZEVEDO LIMA DO REGO', code: '2191' }
];

const results = [];

matInserts.forEach(seg => {
    const match = seg.match(/INSERT INTO MATRICULA\s*\((.*?)\)\s*VALUES\s*\((.*)/is);
    if (match) {
        const colNames = match[1].split(',').map(c => c.trim().toUpperCase());
        const valStr = match[2].trim().replace(/\)$/is, '').replace(/;$/is, '');
        const vals = valStr.split(',').map(v => v.trim().replace(/^'|'$/g, ''));

        const obj = {};
        colNames.forEach((col, i) => { if (i < vals.length) obj[col] = vals[i]; });

        const target = TARGET_STUDENTS.find(s => s.code === obj.CODIGO);
        if (target) {
            results.push({
                student: target.name,
                code: obj.CODIGO,
                ano: obj.ANO,
                cur: obj.CUR,
                ser: obj.SER,
                fil: obj.FIL,
                tur: obj.TUR,
                turc: obj.TURC,
                turcod: obj.TURCOD,
                sit: obj.SIT || obj.CODSIT
            });
        }
    }
});

fs.writeFileSync('mapping_results.json', JSON.stringify(results, null, 2));
console.log(`Saved ${results.length} mapping records to mapping_results.json`);
