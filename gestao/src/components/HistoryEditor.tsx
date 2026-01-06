
import { useState } from 'react';
import { Plus, Trash2, Edit2, Save, Check, X, BookOpen } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { studentService } from '../services/studentService';
import type { AcademicHistoryRecord, Student } from '../types';

interface HistoryEditorProps {
    student: Student;
    onSave: (records: AcademicHistoryRecord[]) => void;
    onCancel: () => void;
}

interface SubjectEntry {
    name: string;
    grade: string;
    status: string;
    ch?: string;
    b1?: string;
    b2?: string;
    b3?: string;
    b4?: string;
}

export function HistoryEditor({ student, onSave, onCancel }: HistoryEditorProps) {
    const [records, setRecords] = useState<AcademicHistoryRecord[]>(student.academicHistory || []);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<AcademicHistoryRecord>>({
        year: new Date().getFullYear().toString(),
        schoolName: 'Escola ...',
        cityState: 'Natal/RN',
        status: 'Aprovado',
        gradeLevel: '',
        average: '',
        totalHours: '800h',
        subjects: [] // Start with empty subjects
    });

    // Subject Form State
    const [subjectForm, setSubjectForm] = useState<SubjectEntry>({
        name: '', grade: '', status: 'Aprovado', ch: '',
        b1: '', b2: '', b3: '', b4: ''
    });

    const handleAddNew = () => {
        setIsAdding(true);
        setEditingId(null);
        setFormData({
            year: (new Date().getFullYear() - 1).toString(),
            schoolName: '',
            cityState: 'Natal/RN',
            status: 'Aprovado',
            gradeLevel: '',
            average: '',
            totalHours: '800h',
            subjects: []
        });
    };

    const handleEdit = (record: AcademicHistoryRecord) => {
        setEditingId(record.id);
        setIsAdding(false);
        setFormData({ ...record, subjects: record.subjects || [] });
    };

    const handleDelete = (id: string) => {
        if (confirm('Tem certeza que deseja remover este registro?')) {
            setRecords(prev => prev.filter(r => r.id !== id));
        }
    };

    const handleAddSubject = () => {
        if (!subjectForm.name) return;
        setFormData(prev => ({
            ...prev,
            subjects: [...(prev.subjects || []), { ...subjectForm }]
        }));
        setSubjectForm({ name: '', grade: '', status: 'Aprovado', ch: '', b1: '', b2: '', b3: '', b4: '' });
        // Keep focus on name input?
    };

    const handleRemoveSubject = (index: number) => {
        setFormData(prev => ({
            ...prev,
            subjects: prev.subjects?.filter((_, i) => i !== index)
        }));
    };

    const handleSaveForm = () => {
        if (!formData.year || !formData.gradeLevel || !formData.schoolName) {
            alert('Preencha os campos obrigatórios (Ano, Série e Escola)');
            return;
        }

        if (isAdding) {
            const newRecord: AcademicHistoryRecord = {
                id: crypto.randomUUID(),
                year: formData.year!,
                gradeLevel: formData.gradeLevel!,
                schoolName: formData.schoolName!,
                cityState: formData.cityState || '',
                status: formData.status || 'Aprovado',
                average: formData.average,
                totalHours: formData.totalHours,
                observation: formData.observation,
                subjects: formData.subjects
            };
            setRecords(prev => [...prev, newRecord].sort((a, b) => Number(b.year) - Number(a.year)));
            setIsAdding(false);
        } else if (editingId) {
            setRecords(prev => prev.map(r => r.id === editingId ? { ...r, ...formData } as AcademicHistoryRecord : r).sort((a, b) => Number(b.year) - Number(a.year)));
            setEditingId(null);
        }
    };

    const handleFinalSave = () => {
        setIsSaving(true);

        // 1. Generate PDF Immediately (Synchronous)
        onSave(records);

        // 2. Persist to Database in Background
        // Firestore hates 'undefined', so we sanitize data
        const sanitizedRecords = records.map(r => ({
            ...r,
            average: r.average || null,
            totalHours: r.totalHours || null,
            observation: r.observation || null,
            subjects: r.subjects || []
        }));

        studentService.updateStudent(student.id, { academicHistory: sanitizedRecords })
            .catch(error => {
                console.error("Error saving history:", error);
                alert("Atenção: O documento foi gerado, mas houve um erro ao salvar os dados no sistema. Erro técnico: " + error.message);
            })
            .finally(() => {
                setIsSaving(false);
            });
    };

    const GRADE_OPTIONS = [
        { label: '1º Ano - Fund. I', value: '1º Ano - Fund. I' },
        { label: '2º Ano - Fund. I', value: '2º Ano - Fund. I' },
        { label: '3º Ano - Fund. I', value: '3º Ano - Fund. I' },
        { label: '4º Ano - Fund. I', value: '4º Ano - Fund. I' },
        { label: '5º Ano - Fund. I', value: '5º Ano - Fund. I' },
        { label: '6º Ano - Fund. II', value: '6º Ano - Fund. II' },
        { label: '7º Ano - Fund. II', value: '7º Ano - Fund. II' },
        { label: '8º Ano - Fund. II', value: '8º Ano - Fund. II' },
        { label: '9º Ano - Fund. II', value: '9º Ano - Fund. II' },
        { label: '1ª Série - Médio', value: '1ª Série - Médio' },
        { label: '2ª Série - Médio', value: '2ª Série - Médio' },
        { label: '3ª Série - Médio', value: '3ª Série - Médio' }
    ];

    const COMMON_SUBJECTS = [
        'Língua Portuguesa', 'Matemática', 'História', 'Geografia', 'Ciências',
        'Artes', 'Inglês', 'Ed. Física', 'Ens. Religioso',
        'Física', 'Química', 'Biologia', 'Sociologia', 'Filosofia'
    ];

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-slate-800">Composição do Histórico</h3>
                    <p className="text-xs text-slate-500">Adicione os anos anteriores cursados em outras instituições.</p>
                </div>
                <Button onClick={handleAddNew} disabled={isAdding || !!editingId} className="bg-blue-600 text-white hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" /> Adicionar Ano
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(isAdding || editingId) && (
                    <div className="bg-white p-4 rounded-xl border-2 border-blue-100 shadow-lg animate-in fade-in slide-in-from-top-2">
                        <h4 className="font-bold text-blue-800 mb-4 text-sm uppercase tracking-wide border-b border-blue-50 pb-2 flex justify-between">
                            {isAdding ? 'Novo Registro' : 'Editar Registro'}
                            <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                        </h4>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                            <Input
                                label="Ano Letivo"
                                value={formData.year}
                                onChange={e => setFormData({ ...formData, year: e.target.value })}
                                placeholder="ex: 2023"
                            />
                            <div className="md:col-span-2">
                                <Select
                                    label="Série/Ano"
                                    value={formData.gradeLevel}
                                    onChange={e => setFormData({ ...formData, gradeLevel: e.target.value })}
                                    options={GRADE_OPTIONS}
                                />
                            </div>
                            <Select
                                label="Resultado Final"
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                                options={[{ label: 'Aprovado', value: 'Aprovado' }, { label: 'Reprovado', value: 'Reprovado' }, { label: 'Cursando', value: 'Cursando' }]}
                            />
                            <div className="md:col-span-2">
                                <Input
                                    label="Escola"
                                    value={formData.schoolName}
                                    onChange={e => setFormData({ ...formData, schoolName: e.target.value })}
                                    placeholder="Nome da instituição"
                                />
                            </div>
                            <div className="md:col-span-1">
                                <Input
                                    label="Cidade/UF"
                                    value={formData.cityState}
                                    onChange={e => setFormData({ ...formData, cityState: e.target.value })}
                                />
                            </div>
                            <Input
                                label="Carga Horária Total"
                                value={formData.totalHours || ''}
                                onChange={e => setFormData({ ...formData, totalHours: e.target.value })}
                            />
                        </div>

                        {/* DETAILED GRADES SECTION */}
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                            <div className="flex items-center justify-between mb-3">
                                <h5 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-blue-500" /> Notas / Disciplinas (Opcional)
                                </h5>
                                <span className="text-xs text-slate-400 bg-white px-2 py-1 rounded border">
                                    {formData.subjects?.length || 0} lançadas
                                </span>
                            </div>

                            {/* Add Subject Form */}
                            <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 mb-4">
                                <label className="text-xs font-bold text-blue-700 uppercase mb-2 block">Adicionar Disciplina e Notas</label>
                                <div className="grid grid-cols-12 gap-2 items-end">
                                    <div className="col-span-3">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Disciplina</label>
                                        <input
                                            list="common-subjects"
                                            className="w-full text-sm border-slate-200 rounded-md focus:ring-blue-500 focus:border-blue-500 h-9"
                                            placeholder="Nome..."
                                            value={subjectForm.name}
                                            onChange={e => setSubjectForm(prev => ({ ...prev, name: e.target.value }))}
                                            onKeyDown={e => e.key === 'Enter' && handleAddSubject()}
                                        />
                                        <datalist id="common-subjects">
                                            {COMMON_SUBJECTS.map(s => <option key={s} value={s} />)}
                                        </datalist>
                                    </div>

                                    <div className="col-span-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block text-center">CH</label>
                                        <input
                                            className="w-full text-xs border-slate-200 rounded-md focus:ring-blue-500 focus:border-blue-500 text-center h-9 px-0"
                                            placeholder="80h"
                                            value={subjectForm.ch || ''}
                                            onChange={e => setSubjectForm(prev => ({ ...prev, ch: e.target.value }))}
                                            onKeyDown={e => e.key === 'Enter' && handleAddSubject()}
                                        />
                                    </div>

                                    {/* Bimesters */}
                                    {[1, 2, 3, 4].map((bim) => (
                                        <div key={bim} className="col-span-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block text-center">{bim}ºB</label>
                                            <input
                                                className="w-full text-xs border-slate-200 rounded-md focus:ring-blue-500 focus:border-blue-500 text-center h-9 px-0"
                                                placeholder="N/A"
                                                value={(subjectForm as any)[`b${bim}`] || ''}
                                                onChange={e => setSubjectForm(prev => ({ ...prev, [`b${bim}`]: e.target.value }))}
                                                onKeyDown={e => e.key === 'Enter' && handleAddSubject()}
                                            />
                                        </div>
                                    ))}

                                    <div className="col-span-2">
                                        <label className="text-[10px] font-bold text-slate-700 uppercase mb-1 block text-center">Final</label>
                                        <input
                                            className="w-full text-sm font-bold border-blue-200 bg-white rounded-md focus:ring-blue-500 focus:border-blue-500 text-center h-9"
                                            placeholder="Nota"
                                            value={subjectForm.grade}
                                            onChange={e => setSubjectForm(prev => ({ ...prev, grade: e.target.value }))}
                                            onKeyDown={e => e.key === 'Enter' && handleAddSubject()}
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <Button size="sm" onClick={handleAddSubject} disabled={!subjectForm.name} className="w-full h-9 bg-blue-600 text-white hover:bg-blue-700">
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Subjects List Header */}
                            {formData.subjects && formData.subjects.length > 0 && (
                                <div className="grid grid-cols-12 gap-2 px-3 py-1 bg-slate-100 text-[10px] font-bold text-slate-500 uppercase rounded-t-md">
                                    <div className="col-span-3">Disciplina</div>
                                    <div className="col-span-1 text-center">CH</div>
                                    <div className="col-span-1 text-center">1ºB</div>
                                    <div className="col-span-1 text-center">2ºB</div>
                                    <div className="col-span-1 text-center">3ºB</div>
                                    <div className="col-span-1 text-center">4ºB</div>
                                    <div className="col-span-2 text-center">Final</div>
                                    <div className="col-span-2 text-right">Ação</div>
                                </div>
                            )}

                            {/* Subjects List */}
                            {formData.subjects && formData.subjects.length > 0 ? (
                                <div className="max-h-60 overflow-y-auto border border-t-0 border-slate-200 rounded-b-md bg-white">
                                    {formData.subjects.map((sub, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-slate-50 text-xs items-center hover:bg-slate-50">
                                            <div className="col-span-3 font-medium text-slate-700 truncate" title={sub.name}>{sub.name}</div>
                                            <div className="col-span-1 text-center text-slate-400 font-mono text-[10px]">{sub.ch || '-'}</div>
                                            <div className="col-span-1 text-center text-slate-500">{sub.b1 || '-'}</div>
                                            <div className="col-span-1 text-center text-slate-500">{sub.b2 || '-'}</div>
                                            <div className="col-span-1 text-center text-slate-500">{sub.b3 || '-'}</div>
                                            <div className="col-span-1 text-center text-slate-500">{sub.b4 || '-'}</div>
                                            <div className="col-span-2 text-center font-bold text-slate-800 bg-slate-100 rounded py-0.5">{sub.grade}</div>
                                            <div className="col-span-2 text-right">
                                                <button onClick={() => handleRemoveSubject(idx)} className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-xs text-slate-400 italic">
                                    Nenhuma disciplina informada.
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
                            <Button variant="ghost" onClick={() => { setIsAdding(false); setEditingId(null); }} className="text-slate-500">
                                Cancelar
                            </Button>
                            <Button onClick={handleSaveForm} className="bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-100">
                                <Check className="w-4 h-4 mr-2" /> Salvar Alterações no Ano
                            </Button>
                        </div>
                    </div>
                )}

                {records.length === 0 && !isAdding && (
                    <div className="text-center py-10 text-slate-400">
                        <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                        <p>Nenhum registro anterior adicionado.</p>
                        <p className="text-xs">Clique em "Adicionar Ano" para inserir o histórico pregresso.</p>
                    </div>
                )}

                {records.map(record => (
                    <div key={record.id} className={`bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-3 group hover:border-blue-300 transition-colors ${editingId === record.id ? 'hidden' : ''}`}>
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-slate-100 rounded-xl flex flex-col items-center justify-center border border-slate-200">
                                    <span className="font-bold text-lg text-slate-700">{record.year}</span>
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm">{record.gradeLevel}</h4>
                                    <p className="text-xs text-slate-500 font-medium">{record.schoolName}</p>
                                    <p className="text-xs text-slate-400">{record.cityState}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right mr-2 hidden sm:block">
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${record.status === 'Aprovado' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {record.status}
                                    </span>
                                    {(record.subjects?.length || 0) > 0 && (
                                        <div className="text-[10px] text-blue-500 mt-1 font-medium bg-blue-50 px-2 py-0.5 rounded-full inline-block">
                                            {record.subjects?.length} disciplinas
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => handleEdit(record)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(record.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Preview of subjects if present */}
                        {record.subjects && record.subjects.length > 0 && (
                            <div className="mt-1 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {record.subjects.slice(0, 4).map((s, i) => (
                                    <div key={i} className="text-[10px] text-slate-500 bg-slate-50 px-2 py-1 rounded flex justify-between">
                                        <span className="truncate">{s.name}</span>
                                        <span className="font-bold">{s.grade}</span>
                                    </div>
                                ))}
                                {record.subjects.length > 4 && (
                                    <div className="text-[10px] text-slate-400 px-2 py-1 flex items-center">
                                        +{record.subjects.length - 4} outras...
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center animate-in slide-in-from-bottom-2">
                <Button variant="ghost" onClick={onCancel} className="text-slate-500">
                    Cancelar
                </Button>
                <div className="flex items-center gap-3">
                    <div className="text-right text-xs text-slate-400 hidden sm:block">
                        <p>Ao salvar, os dados serão</p>
                        <p>gravados no perfil do aluno.</p>
                    </div>
                    <Button
                        onClick={handleFinalSave}
                        disabled={isSaving || isAdding || !!editingId}
                        className="bg-blue-800 hover:bg-blue-900 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? (
                            <>Salvnado...</>
                        ) : (
                            <><Save className="w-5 h-5 mr-2" /> Salvar e Gerar PDF</>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
