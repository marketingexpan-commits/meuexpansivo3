import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, getDocs, addDoc, updateDoc, doc, writeBatch, orderBy } from 'firebase/firestore';
import type { SchoolUnitDetail } from '../types';
import { UNIT_DETAILS } from '../utils/academicDefaults';
import { Card, CardContent, CardHeader } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Loader2, Plus, Edit2, ToggleLeft, ToggleRight, Building2, MapPin, Phone, MessageCircle, Database, Mail, Instagram, Hash } from 'lucide-react';

export default function Unidades() {
    const [units, setUnits] = useState<SchoolUnitDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUnit, setEditingUnit] = useState<SchoolUnitDetail | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        fullName: '',
        professionalTitle: '', // NOVO: "Educação Infantil, Ensino Fundamental e Médio"
        cnpj: '',
        address: '',
        district: '', // NOVO: Bairro
        phone: '',
        whatsapp: '',
        email: '',
        instagram: '',
        inepCode: '',
        city: '',
        uf: '',
        cep: '',
        authorization: '', // NOVO: "Ato de autorização nº..."
        directorName: '',
        secretaryName: '',
        pixKey: '',
        logoUrl: '',
        isActive: true
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const unitsSnap = await getDocs(query(collection(db, 'school_units'), orderBy('fullName')));
            setUnits(unitsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolUnitDetail)));
        } catch (error) {
            console.error("Error loading units:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSeedData = async () => {
        if (!confirm("Deseja sincronizar os dados das unidades legadas com o Firestore?")) return;

        setLoading(true);
        try {
            const batch = writeBatch(db);

            Object.entries(UNIT_DETAILS).forEach(([id, details]) => {
                const docRef = doc(collection(db, 'school_units'), id);
                batch.set(docRef, {
                    fullName: details.name,
                    cnpj: details.cnpj,
                    address: details.address,
                    phone: details.phone,
                    whatsapp: details.phone.replace(/\D/g, ''), // Clean phone for whatsapp
                    email: details.email || '',
                    district: details.district || '',
                    city: details.city || '',
                    uf: details.uf || '',
                    cep: details.cep || '',
                    professionalTitle: details.professionalTitle || '',
                    authorization: details.authorization || '',
                    isActive: true
                });
            });

            await batch.commit();
            alert("Unidades sincronizadas!");
            loadData();
        } catch (error) {
            console.error("Error seeding units:", error);
            alert("Erro ao sincronizar.");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (editingUnit) {
                await updateDoc(doc(db, 'school_units', editingUnit.id), formData);
            } else {
                // For new units, we use the fullName as ID root or auto-id
                await addDoc(collection(db, 'school_units'), formData);
            }
            setIsModalOpen(false);
            setEditingUnit(null);
            setFormData({ fullName: '', professionalTitle: '', cnpj: '', address: '', district: '', phone: '', whatsapp: '', email: '', instagram: '', inepCode: '', city: '', uf: '', cep: '', authorization: '', directorName: '', secretaryName: '', pixKey: '', logoUrl: '', isActive: true });
            loadData();
        } catch (error) {
            console.error("Error saving unit:", error);
            alert("Erro ao salvar.");
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (unit: SchoolUnitDetail) => {
        setEditingUnit(unit);
        setFormData({
            fullName: unit.fullName,
            professionalTitle: unit.professionalTitle || '',
            cnpj: unit.cnpj,
            address: unit.address,
            district: unit.district || '',
            phone: unit.phone,
            whatsapp: unit.whatsapp,
            email: unit.email || '',
            instagram: unit.instagram || '',
            inepCode: unit.inepCode || '',
            city: unit.city || '',
            uf: unit.uf || '',
            cep: unit.cep || '',
            authorization: unit.authorization || '',
            directorName: unit.directorName || '',
            secretaryName: unit.secretaryName || '',
            pixKey: unit.pixKey || '',
            logoUrl: unit.logoUrl || '',
            isActive: unit.isActive
        });
        setIsModalOpen(true);
    };

    const toggleStatus = async (unit: SchoolUnitDetail) => {
        try {
            await updateDoc(doc(db, 'school_units', unit.id), { isActive: !unit.isActive });
            loadData();
        } catch (error) {
            console.error("Error toggling status:", error);
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-2xl font-bold text-blue-950">Gestão de Unidades</h1>
                    <p className="text-slate-500 text-sm mt-1">Configure os dados institucionais de cada unidade escolar.</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={handleSeedData} className="gap-2 text-blue-700 border-blue-200 bg-blue-50">
                        <Database className="w-4 h-4" />
                        Sincronizar Legado
                    </Button>
                    <Button onClick={() => { setEditingUnit(null); setIsModalOpen(true); }} className="gap-2">
                        <Plus className="w-4 h-4" />
                        Nova Unidade
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {loading ? (
                    <div className="col-span-full h-40 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                ) : units.map(unit => (
                    <Card key={unit.id} className={`overflow-hidden border-2 transition-all ${unit.isActive ? 'border-transparent hover:border-blue-200' : 'opacity-60 grayscale'}`}>
                        <CardHeader className="bg-slate-50 border-b border-slate-100 pb-3">
                            <div className="flex justify-between items-start">
                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                    <Building2 className="w-5 h-5 text-blue-600" />
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => toggleStatus(unit)} className="p-1.5 hover:bg-white rounded-md transition-colors">
                                        {unit.isActive ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                                    </button>
                                    <button onClick={() => handleEdit(unit)} className="p-1.5 hover:bg-white rounded-md transition-colors text-blue-600">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <h3 className="font-bold text-blue-950 mt-3 truncate">{unit.fullName}</h3>
                            {unit.professionalTitle && <p className="text-[10px] text-blue-600 font-bold uppercase mt-0.5">{unit.professionalTitle}</p>}
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{unit.cnpj}</p>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-3">
                            <div className="flex items-start gap-2 text-xs text-slate-600">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                                <span className="line-clamp-2">{unit.address}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{unit.phone}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                <MessageCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                <span>{unit.whatsapp}</span>
                            </div>
                            {unit.email && (
                                <div className="flex items-center gap-2 text-xs text-slate-600 truncate" title={unit.email}>
                                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span className="truncate">{unit.email}</span>
                                </div>
                            )}
                            {unit.instagram && (
                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                    <Instagram className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                    <span>@{unit.instagram.replace('@', '')}</span>
                                </div>
                            )}
                            {unit.inepCode && (
                                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-2 pt-2 border-t border-slate-50">
                                    <Hash className="w-3 h-3 shrink-0" />
                                    <span>INEP: {unit.inepCode}</span>
                                </div>
                            )}
                            {(unit.directorName || unit.secretaryName || unit.authorization) && (
                                <div className="mt-2 text-[10px] text-slate-500 bg-slate-50 p-2 rounded space-y-1">
                                    {unit.authorization && <div className="italic text-slate-400 border-b border-slate-100 pb-1 mb-1"><strong>Auth:</strong> {unit.authorization}</div>}
                                    {unit.directorName && <div><strong>Dir:</strong> {unit.directorName}</div>}
                                    {unit.secretaryName && <div><strong>Sec:</strong> {unit.secretaryName}</div>}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-blue-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-lg max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200 shadow-2xl">
                        <CardHeader className="border-b border-slate-100">
                            <h2 className="text-xl font-bold text-blue-950">{editingUnit ? 'Editar Unidade' : 'Cadastrar Unidade'}</h2>
                        </CardHeader>
                        <CardContent className="pt-6 overflow-y-auto">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <Input
                                    label="Nome Completo (Ex: Expansivo - Unidade X)"
                                    required
                                    value={formData.fullName}
                                    onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                />
                                <Input
                                    label="Título Profissional (Ex: Educação Infantil, Fundamental e Médio)"
                                    value={formData.professionalTitle}
                                    onChange={e => setFormData({ ...formData, professionalTitle: e.target.value })}
                                />
                                <Input
                                    label="CNPJ"
                                    required
                                    value={formData.cnpj}
                                    onChange={e => setFormData({ ...formData, cnpj: e.target.value })}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-1.5">
                                        <Input
                                            label="Endereço (Rua, Número, Comp.)"
                                            required
                                            value={formData.address}
                                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-span-0.5">
                                        <Input
                                            label="Bairro"
                                            value={formData.district}
                                            onChange={e => setFormData({ ...formData, district: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        label="Telefone"
                                        required
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                    <Input
                                        label="WhatsApp (Só números)"
                                        required
                                        value={formData.whatsapp}
                                        onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                                    />
                                </div>
                                <Input
                                    label="E-mail da Unidade"
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        label="Instagram (usuario)"
                                        value={formData.instagram}
                                        onChange={e => setFormData({ ...formData, instagram: e.target.value })}
                                    />
                                    <Input
                                        label="Código INEP"
                                        value={formData.inepCode}
                                        onChange={e => setFormData({ ...formData, inepCode: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="col-span-1">
                                        <Input
                                            label="CEP"
                                            value={formData.cep}
                                            onChange={e => setFormData({ ...formData, cep: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <Input
                                            label="Cidade"
                                            value={formData.city}
                                            onChange={e => setFormData({ ...formData, city: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <Input
                                            label="UF"
                                            value={formData.uf}
                                            onChange={e => setFormData({ ...formData, uf: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <Input
                                    label="Ato de Criação / Autorização (Ex: Portaria SEEC nº 123/2020)"
                                    value={formData.authorization}
                                    onChange={e => setFormData({ ...formData, authorization: e.target.value })}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        label="Diretor(a)"
                                        value={formData.directorName}
                                        onChange={e => setFormData({ ...formData, directorName: e.target.value })}
                                    />
                                    <Input
                                        label="Secretário(a)"
                                        value={formData.secretaryName}
                                        onChange={e => setFormData({ ...formData, secretaryName: e.target.value })}
                                    />
                                </div>
                                <Input
                                    label="Chave PIX da Unidade"
                                    value={formData.pixKey}
                                    placeholder="E-mail, CPF, CNPJ ou Celular"
                                    onChange={e => setFormData({ ...formData, pixKey: e.target.value })}
                                />
                                <Input
                                    label="URL do Logo Customizado (Opcional)"
                                    value={formData.logoUrl}
                                    onChange={e => setFormData({ ...formData, logoUrl: e.target.value })}
                                />
                                <div className="flex justify-end gap-3 pt-4">
                                    <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                                    <Button type="submit" isLoading={loading}>Salvar Unidade</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
