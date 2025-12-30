const fs = require('fs');

try {
    const raw = fs.readFileSync('debug_output.txt');
    // Try UTF-16LE first (common for PowerShell > redirection)
    let content = raw.toString('utf16le');

    // logic to detect if it's actually just utf8
    if (content.includes('')) { // BOM or garbage
        content = raw.toString('utf8');
    }

    // Trim clean
    console.log(content.replace(/\0/g, ''));
} catch (e) {
    console.error(e);
}
