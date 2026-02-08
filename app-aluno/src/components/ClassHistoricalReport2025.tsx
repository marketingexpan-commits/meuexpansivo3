import React, { useMemo } from 'react';
import { Student, GradeEntry, AttendanceRecord, AttendanceStatus } from '../types';
import { SchoolLogo } from './SchoolLogo';
import { HS_SUBJECTS_2025 } from '../constants';

interface ClassHistoricalReport2025Props {
    students: Student[];
    grades: GradeEntry[];
    attendanceRecords: AttendanceRecord[];
    unitData: { address: string; cep: string; phone: string; email: string; cnpj: string } | null;
}

export const ClassHistoricalReport2025: React.FC<ClassHistoricalReport2025Props> = ({ students, grades, attendanceRecords, unitData }) => {

    // Sort students alphabetically
    const sortedStudents = useMemo(() => {
        return [...students].sort((a, b) => a.name.localeCompare(b.name));
    }, [students]);

    // Calculate data for each student
    const tableData = useMemo(() => {
        return sortedStudents.map(student => {
            const student2025Grades = grades.filter(g => (g.studentId === student.id || g.studentId === student.id.replace('student_', '')) && g.year === 2025);

            // Determine Overall Approval Status (Global Rule)
            // If average of annual averages >= 7.0, student is approved in ALL subjects
            // Note: This logic mimics the single-student report behavior requested.
            const totalMedia = student2025Grades.reduce((acc, g) => acc + (g.mediaAnual || 0), 0);
            const countMedia = student2025Grades.length;
            const overallAverage = countMedia > 0 ? totalMedia / countMedia : 0;
            const isOverallApproved = overallAverage >= 7.0;

            const gradesMap: Record<string, string> = {};

            HS_SUBJECTS_2025.forEach(subject => {
                const gradeEntry = student2025Grades.find(g => g.subject === subject);
                if (gradeEntry) {
                    // Check if specific subject is essentially approved via global rule or individual grade
                    const finalMedia = gradeEntry.mediaAnual || 0;
                    gradesMap[subject] = String(finalMedia);
                } else {
                    gradesMap[subject] = '-';
                }
            });

            // Calculate Retroactive Absences for 2025
            const totalAbsences2025 = attendanceRecords.reduce((acc, record) => {
                // Must be 2025
                const [y] = record.date.split('-').map(Number);
                if (y !== 2025) return acc;

                // Must be absent
                if (record.studentStatus[student.id] === AttendanceStatus.ABSENT) {
                    return acc + 1;
                }
                return acc;
            }, 0);

            return {
                student,
                grades: gradesMap,
                mediaFinal: overallAverage.toFixed(2), // Keep 2 decimals for overall average to be precise
                // If Overall Approved, Status is Approved. Otherwise, check individual? 
                // User said: "Status: Reflita a aprovação global do PDF em todas as linhas do aluno aprovado"
                // Since this is a summary row, we show the calculated final average.
                // We will color code the Media Final column based on approval.
                isApproved: isOverallApproved,
                totalAbsences: totalAbsences2025
            };
        });
    }, [sortedStudents, grades, attendanceRecords]);

    if (students.length === 0) {
        return <div className="p-8 text-center text-gray-500">Nenhum aluno selecionado para o relatório de 2025.</div>;
    }

    const firstStudent = students[0]; // For header Unit info context if needed, though we use passed unitData

    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden font-sans print:shadow-none print:border-none">
            {/* CABEÇALHO DINÂMICO */}
            <div className="p-6 bg-gradient-to-r from-blue-900 to-blue-800 text-white flex flex-col md:flex-row justify-between items-center gap-6 print:bg-none print:text-black print:p-0 print:mb-4">
                <div className="flex items-center gap-4">
                    <SchoolLogo variant="header" />
                    <div>
                        <h2 className="text-xl font-bold uppercase">Colégio e Curso Expansivo</h2>
                        <p className="text-blue-200 text-sm font-medium print:text-gray-600">Unidade {firstStudent.unit}</p>
                        {unitData && (
                            <div className="text-xs text-blue-100/80 mt-1 max-w-md print:text-gray-500">
                                <p>{unitData.address}</p>
                                <p>CNPJ: {unitData.cnpj} | Contato: {unitData.phone}</p>
                            </div>
                        )}
                    </div>
                </div>
                <div className="text-center md:text-right">
                    <h1 className="text-2xl font-black uppercase tracking-tight">Pauta de Resultados Finais</h1>
                    <p className="text-blue-200 font-bold print:text-gray-800">Ano Letivo 2025</p>
                </div>
            </div>

            {/* TABELA PAUTA */}
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[10px] md:text-xs">
                    <thead>
                        <tr className="bg-gray-100 border-b-2 border-gray-300">
                            <th className="p-2 border-r border-gray-300 text-left w-64 min-w-[200px] sticky left-0 bg-gray-100 z-10">ALUNO</th>
                            {HS_SUBJECTS_2025.map(subject => (
                                <th key={subject} className="p-2 border-r border-gray-300 text-center w-10 relative h-32 align-bottom">
                                    <div className="transform -rotate-90 origin-bottom-left absolute bottom-2 left-6 w-32 text-left font-bold text-gray-700 uppercase tracking-tight whitespace-nowrap">
                                        {subject}
                                    </div>
                                </th>
                            ))}
                            <th className="p-2 border-r border-gray-300 text-center font-bold bg-blue-50 text-blue-900 w-12 vertical-header h-32 align-bottom relative">
                                <div className="transform -rotate-90 origin-bottom-left absolute bottom-2 left-6 w-32 text-left font-bold uppercase tracking-tight whitespace-nowrap">
                                    MÉDIA(S)
                                </div>
                            </th>
                            <th className="p-2 text-center font-bold bg-gray-50 text-red-700 w-12 h-32 align-bottom relative">
                                <div className="transform -rotate-90 origin-bottom-left absolute bottom-2 left-6 w-32 text-left font-bold uppercase tracking-tight whitespace-nowrap">
                                    FALTAS (2025)
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {tableData.map((row, idx) => (
                            <tr key={row.student.id} className={`hover:bg-blue-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                                <td className="p-2 border-r border-gray-300 font-bold text-gray-800 sticky left-0 bg-inherit z-10 border-b border-gray-200 flex flex-col justify-center h-10">
                                    <span className="text-[9px] text-gray-400 font-mono">{row.student.code}</span>
                                    <span className="truncate">{row.student.name}</span>
                                </td>
                                {HS_SUBJECTS_2025.map(subject => (
                                    <td key={subject} className="p-1 border-r border-gray-200 text-center text-gray-700 font-medium">
                                        {row.grades[subject]}
                                    </td>
                                ))}
                                <td className={`p-1 border-r border-gray-200 text-center font-bold ${row.isApproved ? 'text-blue-700 bg-blue-50/50' : 'text-red-700 bg-red-50/50'}`}>
                                    {row.mediaFinal}
                                </td>
                                <td className="p-1 text-center font-bold text-gray-600">
                                    {row.totalAbsences}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-200 text-center">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    Este documento reflete o histórico consolidado de 2025 e integra as faltas do diário eletrônico.
                </p>
            </div>
        </div>
    );
};
