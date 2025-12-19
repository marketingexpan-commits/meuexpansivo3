import React, { useMemo } from 'react';
import { Student, GradeEntry, SchoolUnit, AttendanceRecord, AttendanceStatus } from '../types';
import { SchoolLogo } from './SchoolLogo';

interface HistoricalReport2025Props {
    student: Student;
    grades: GradeEntry[];
    unitData: { address: string; cep: string; phone: string; email: string; cnpj: string } | null;
    attendanceRecords: AttendanceRecord[];
}

export const HistoricalReport2025: React.FC<HistoricalReport2025Props> = ({ student, grades, unitData, attendanceRecords }) => {
    const hsSubjects2025 = useMemo(() => [
        "Português", "Matemática", "Inglês", "História", "Geografia",
        "Literatura", "Biologia", "Física", "Química", "Redação",
        "Espanhol", "Ens. Artes", "Filosofia", "Sociologia",
        "Ed. Física", "Projeto de Vida", "Empreendedorismo"
    ], []);

    const historicalGrades = useMemo(() => {
        const student2025Grades = grades.filter(g => g.studentId === student.id && g.year === 2025);

        // Calculate Overall Average for Global Approval Rule
        const totalMedia = student2025Grades.reduce((acc, g) => acc + (g.mediaAnual || 0), 0);
        const countMedia = student2025Grades.length;
        const overallAverage = countMedia > 0 ? totalMedia / countMedia : 0;
        const isOverallApproved = overallAverage >= 7.0;

        return hsSubjects2025.map(subject => {
            const grade = student2025Grades.find(g => g.subject === subject);

            // Calculate Retroactive Absences for 2025 (Daily Records)
            const subjectAbsences = attendanceRecords.reduce((acc, record) => {
                if (record.discipline !== subject) return acc;
                const [y] = record.date.split('-').map(Number);
                if (y !== 2025) return acc;
                if (record.studentStatus[student.id] === AttendanceStatus.ABSENT) {
                    return acc + 1;
                }
                return acc;
            }, 0);

            if (!grade && subjectAbsences === 0) return null; // Only show if there is data (grade or absence)

            // Determine final status
            // If overall is approved, they are approved. Else take individual status or 'Reprovado' default.
            const situacao = isOverallApproved ? 'Aprovado' : (grade?.situacaoFinal || 'Reprovado');

            return {
                subject,
                mediaAnual: grade?.mediaAnual || 0, // Using raw value, no rounding
                situacao,
                faltas: subjectAbsences
            };
        }).filter(Boolean) as { subject: string; mediaAnual: number; situacao: string; faltas: number }[];
    }, [grades, student.id, hsSubjects2025, attendanceRecords]);

    if (historicalGrades.length === 0) {
        return (
            <div className="bg-white p-8 rounded-xl shadow-sm border text-center text-gray-500">
                Nenhum dado histórico de 2025 encontrado para este aluno.
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden font-sans">
            {/* CABEÇALHO DINÂMICO DA UNIDADE */}
            <div className="p-6 bg-gradient-to-r from-blue-900 to-blue-800 text-white flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                    <SchoolLogo variant="header" />
                    <div>
                        <h2 className="text-xl font-bold">Colégio e Curso Expansivo</h2>
                        <p className="text-blue-200 text-sm font-medium">Unidade {student.unit}</p>
                        {unitData && (
                            <div className="text-xs text-blue-100/80 mt-1 max-w-md">
                                <p>{unitData.address}</p>
                                <p>CNPJ: {unitData.cnpj} | Contato: {unitData.phone}</p>
                            </div>
                        )}
                    </div>
                </div>
                <div className="text-center md:text-right">
                    <h1 className="text-2xl font-black uppercase tracking-tight">Resumo de Média Anual</h1>
                    <p className="text-blue-200 font-bold">Ano Letivo 2025</p>
                </div>
            </div>

            {/* INFO DO ALUNO */}
            <div className="p-4 bg-blue-50 border-b border-blue-100 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <div><span className="font-bold text-blue-900 text-xs uppercase opacity-70">Aluno:</span> <span className="font-bold text-gray-800">{student.name}</span></div>
                <div><span className="font-bold text-blue-900 text-xs uppercase opacity-70">Código:</span> <span className="font-mono text-gray-700">{student.code}</span></div>
                <div><span className="font-bold text-blue-900 text-xs uppercase opacity-70">Série:</span> <span className="font-bold text-gray-800">{student.gradeLevel}</span></div>
            </div>

            {/* TABELA DE MÉDIAS */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-100 border-b border-gray-200">
                            <th className="px-6 py-3 text-xs font-black text-gray-600 uppercase tracking-wider">Disciplina</th>
                            <th className="px-6 py-3 text-xs font-black text-gray-600 uppercase tracking-wider text-center">Média Anual</th>
                            <th className="px-6 py-3 text-xs font-black text-red-600 uppercase tracking-wider text-center bg-red-50/50">Faltas (2025)</th>
                            <th className="px-6 py-3 text-xs font-black text-gray-600 uppercase tracking-wider text-center">Situação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {historicalGrades.map((g, idx) => (
                            <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                <td className="px-6 py-4 font-bold text-gray-700 uppercase text-xs md:text-sm">{g.subject}</td>
                                <td className="px-6 py-4 text-center font-black text-blue-900 text-lg">{g.mediaAnual.toFixed(1)}</td>
                                <td className="px-6 py-4 text-center font-bold text-red-700 bg-red-50/30">{g.faltas}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase border-2 ${g.situacao === 'Aprovado'
                                        ? 'bg-green-50 text-green-700 border-green-200'
                                        : 'bg-red-50 text-red-700 border-red-200'
                                        }`}>
                                        {g.situacao}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 text-center">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    Este documento é um resumo informativo do histórico escolar de 2025.
                </p>
            </div>
        </div>
    );
};
