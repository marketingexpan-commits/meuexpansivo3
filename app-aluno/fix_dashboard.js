const fs = require('fs');
const path = 'c:\\Users\\Hemenson Campos\\Desktop\\MeuExpansivo\\components\\StudentDashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replacement 1: Bimester Calc
// Regex to catch the exact function call
const bimSearch = /const freqPercent = calculateAttendancePercentage\(grade\.subject, currentAbsences, student\.gradeLevel, bimesterNum, academicSubjects, academicSettings, calendarEvents\);/;
const bimReplace = `const freqResult = calculateAttendancePercentage(grade.subject, currentAbsences, student.gradeLevel, bimesterNum, academicSubjects, academicSettings, calendarEvents, student.unit, classSchedules);
                                                                        const freqPercent = freqResult?.percent ?? null;
                                                                        const isFreqEstimated = freqResult?.isEstimated ?? false;`;

if (content.match(bimSearch)) {
    content = content.replace(bimSearch, bimReplace);
    console.log('Bimester calc replaced.');
} else {
    console.log('Bimester calc pattern NOT FOUND.');
}

// Replacement 2: Bimester JSX
const bimJsxSearch = /{isBimesterStarted \? `\${freqPercent \|\| 100}%` : '-'}/;
const bimJsxReplace = `{isBimesterStarted ? (<div className="flex flex-col items-center"><span>{freqPercent !== null ? \`\${freqPercent}%\` : '100%'}</span>{isFreqEstimated && <span className="text-[8px] text-amber-600">⚠ Est.</span>}</div>) : '-'}`;

if (content.match(bimJsxSearch)) {
    content = content.replace(bimJsxSearch, bimJsxReplace);
    console.log('Bimester JSX replaced.');
} else {
    console.log('Bimester JSX pattern NOT FOUND.');
}

// Replacement 3: Annual Calc
const annualSearch = /const annualFreq = calculateAnnualAttendancePercentage\(grade\.subject, totalAbsences, student\.gradeLevel, elapsedBimesters, academicSubjects, academicSettings, calendarEvents\);/;
const annualReplace = `const annualResult = calculateAnnualAttendancePercentage(grade.subject, totalAbsences, student.gradeLevel, elapsedBimesters, academicSubjects, academicSettings, calendarEvents, student.unit, classSchedules);
                                                            const annualFreq = annualResult?.percent ?? null;
                                                            const isAnnualEstimated = annualResult?.isEstimated ?? false;`;

if (content.match(annualSearch)) {
    content = content.replace(annualSearch, annualReplace);
    console.log('Annual calc replaced.');
} else {
    console.log('Annual calc pattern NOT FOUND.');
}

// Replacement 4: Annual JSX
const annualJsxSearch = /{annualFreq !== null \? `\${annualFreq}%` : '100%'}/;
const annualJsxReplace = `<div className="flex flex-col items-center"><span>{annualFreq !== null ? \`\${annualFreq}%\` : '100%'}</span>{isAnnualEstimated && <span className="text-[8px] text-amber-600">⚠ Est.</span>}</div>`;

if (content.match(annualJsxSearch)) {
    content = content.replace(annualJsxSearch, annualJsxReplace);
    console.log('Annual JSX replaced.');
} else {
    console.log('Annual JSX pattern NOT FOUND.');
}

fs.writeFileSync(path, content, 'utf8');
console.log('Write completed.');
