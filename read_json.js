const fs = require('fs');
const buffer = fs.readFileSync('grades_list.json');
console.log('First 20 bytes:', buffer.slice(0, 20).toString('hex'));
const decoded = buffer.toString('utf16le');
console.log('Decoded start:', decoded.substring(0, 500));
