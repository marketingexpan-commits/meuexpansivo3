const fs = require('fs');
const content = fs.readFileSync('./migration_data/Alunos.sql', 'latin1');
const lines = content.split(';');

const targets = ["1852", "2287", "2314"];
const found = [];

lines.forEach(line => {
    if (targets.some(t => line.includes(t))) {
        found.push(line.trim());
    }
});

console.log(`Found ${found.length} rows.`);
fs.writeFileSync('aluno_raw_rows.txt', found.join('\n\n'));
