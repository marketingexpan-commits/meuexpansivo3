const fs = require('fs');
const content = fs.readFileSync('./migration_data/Maticulas.sql', 'latin1');
const lines = content.split(';');

const uniqueHeaders = new Set();

lines.forEach(line => {
    const match = line.match(/INSERT INTO MATRICULA\s*\((.*?)\)\s*VALUES/is);
    if (match) {
        uniqueHeaders.add(match[1].trim().toUpperCase());
    }
});

console.log("Unique Headers Found:");
Array.from(uniqueHeaders).forEach(h => console.log(`- (${h.split(',').length} cols) ${h}`));
