const fs = require('fs');

const matriculasContent = fs.readFileSync('./migration_data/Maticulas.sql', 'latin1');
const matInserts = matriculasContent.split(';');

const samples = [];
matInserts.forEach(seg => {
    const match = seg.match(/INSERT INTO MATRICULA\s*\((.*?)\)\s*VALUES\s*\((.*)/is);
    if (match) {
        const colNames = match[1].split(',').map(c => c.trim().toUpperCase());
        const valStr = match[2].trim().replace(/\)$/s, '');
        const vals = valStr.split(',').map(v => v.trim().replace(/^'|'$/g, ''));

        const obj = {};
        colNames.forEach((col, i) => { if (i < vals.length) obj[col] = vals[i]; });

        if (samples.length < 50) {
            samples.push({
                ano: obj.ANO,
                codigo: obj.CODIGO,
                fil: obj.FIL,
                cur: obj.CUR,
                ser: obj.SER,
                tur: obj.TUR,
                turc: obj.TURC,
                sit: obj.SIT,
                turcod: obj.TURCOD
            });
        }
    }
});

console.log("SAMPLE RECORDS (First 50):");
console.log(JSON.stringify(samples, null, 2));

const uniqueValues = {
    fil: new Set(),
    cur: new Set(),
    ser: new Set(),
    turcod: new Set(),
    sit: new Set()
};

samples.forEach(s => {
    uniqueValues.fil.add(s.fil);
    uniqueValues.cur.add(s.cur);
    uniqueValues.ser.add(s.ser);
    uniqueValues.turcod.add(s.turcod);
    uniqueValues.sit.add(s.sit);
});

console.log("\nUNIQUE CODES FOUND IN SAMPLES:");
Object.keys(uniqueValues).forEach(key => {
    console.log(`${key.toUpperCase()}: ${Array.from(uniqueValues[key]).join(', ')}`);
});
