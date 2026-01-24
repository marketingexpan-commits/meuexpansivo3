import { readFileSync } from 'fs';

const content = readFileSync('./migration_data/Maticulas.sql', 'utf8');
const years = new Set();
const yearCounts = {};

const matches = content.match(/'20\d{2}/g);
if (matches) {
    matches.forEach(m => {
        const year = m.replace(/'/, '');
        years.add(year);
        yearCounts[year] = (yearCounts[year] || 0) + 1;
    });
}

console.log('Years found in Maticulas.sql:');
console.log(yearCounts);
