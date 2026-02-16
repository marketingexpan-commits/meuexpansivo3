import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { getDoc, setDoc, doc, onSnapshot } from 'firebase/firestore';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Trophy, Loader2, Save, Power, Megaphone, Gift, Copy, Trash2, Building2, Check } from 'lucide-react';
import { ACADEMIC_GRADES, ACADEMIC_SEGMENTS } from '../utils/academicDefaults';

interface GradeConfig {
    awards: {
        rank1: string;
        rank2: string;
        rank3: string;
    };
    sponsorName?: string;
    sponsorLogoUrl?: string;
    sponsorInfo?: string;
    sponsorPhone?: string;
    sponsorAddress?: string;
}

interface RankSettings {
    isEnabled: boolean;
    sponsorName: string;
    sponsorLogoUrl: string;
    sponsorInfo: string;
    sponsorPhone?: string;
    sponsorAddress?: string;
    showcaseEnabled?: boolean;
    gradeConfigs?: Record<string, GradeConfig>;
}

const UNITS_LIST = [
    { id: 'unit_zn', label: 'Zona Norte' },
    { id: 'unit_bs', label: 'Boa Sorte' },
    { id: 'unit_ext', label: 'Extremoz' },
    { id: 'unit_qui', label: 'Quintas' }
];

export default function RankingConfig() {
    const userUnit = localStorage.getItem('userUnit') || 'unit_zn';
    const isAdminGeral = userUnit === 'admin_geral';

    const [currentUnitId, setCurrentUnitId] = useState<string>(isAdminGeral ? (localStorage.getItem('rankAdminUnit') || 'unit_zn') : userUnit);
    const [settings, setSettings] = useState<RankSettings>({
        isEnabled: false,
        sponsorName: '',
        sponsorLogoUrl: '',
        sponsorInfo: '',
        gradeConfigs: {}
    });
    const [selectedGradeId, setSelectedGradeId] = useState<string>('grade_6_ano');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showReplicateModal, setShowReplicateModal] = useState(false);
    const [selectedReplicationGrades, setSelectedReplicationGrades] = useState<string[]>([]);

    const relevantGrades = Object.values(ACADEMIC_GRADES).filter(g =>
        g.segmentId === ACADEMIC_SEGMENTS.FUND_2.id ||
        g.segmentId === ACADEMIC_SEGMENTS.MEDIO.id
    ).sort((a, b) => (a.order || 0) - (b.order || 0));

    useEffect(() => {
        setLoading(true);
        const unsub = onSnapshot(doc(db, 'rank_settings', currentUnitId), async (snap) => {
            if (snap.exists()) {
                const data = snap.data() as RankSettings;
                setSettings({
                    ...data,
                    gradeConfigs: data.gradeConfigs || {}
                });
                setLoading(false);
            } else {
                // FALLBACK: Try to load 'global' if unit doc doesn't exist yet
                try {
                    const globalSnap = await getDoc(doc(db, 'rank_settings', 'global'));
                    if (globalSnap.exists()) {
                        const data = globalSnap.data() as RankSettings;
                        setSettings({
                            ...data,
                            gradeConfigs: data.gradeConfigs || {}
                        });
                    } else {
                        // Real initialization
                        setSettings({
                            isEnabled: false,
                            sponsorName: '',
                            sponsorLogoUrl: '',
                            sponsorInfo: '',
                            gradeConfigs: {}
                        });
                    }
                } catch (e) {
                    console.error("Migration fallback error:", e);
                }
                setLoading(false);
            }
        }, (error) => {
            console.error("Erro ao carregar configurações de rank:", error);
            setLoading(false);
        });

        return () => unsub();
    }, [currentUnitId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, 'rank_settings', currentUnitId), {
                ...settings,
                lastUpdated: new Date().toISOString()
            });
            alert("Configurações salvas com sucesso!");
        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Erro ao salvar configurações.");
        } finally {
            setSaving(false);
        }
    };

    const currentGradeConfig: GradeConfig = settings.gradeConfigs?.[selectedGradeId] || {
        awards: { rank1: '', rank2: '', rank3: '' },
        sponsorName: '',
        sponsorLogoUrl: '',
        sponsorInfo: '',
        sponsorPhone: '',
        sponsorAddress: ''
    };

    const updateGradeConfig = (field: string, value: string) => {
        const newConfigs = { ...(settings.gradeConfigs || {}) };
        const gradeRef = { ...currentGradeConfig };

        if (field.startsWith('rank')) {
            gradeRef.awards = { ...gradeRef.awards, [field]: value };
        } else {
            (gradeRef as any)[field] = value;
        }

        newConfigs[selectedGradeId] = gradeRef;
        setSettings({ ...settings, gradeConfigs: newConfigs });
    };

    const resetGradeConfig = () => {
        if (!confirm("Deseja apagar todos os dados de prêmios e parceiro desta série?")) return;
        const newConfigs = { ...(settings.gradeConfigs || {}) };
        delete newConfigs[selectedGradeId];
        setSettings({ ...settings, gradeConfigs: newConfigs });
    };

    const cleanupLegacyData = () => {
        const legacyKeys = Object.keys(settings.gradeConfigs || {}).filter(key =>
            !relevantGrades.some(g => g.id === key)
        );

        if (legacyKeys.length === 0) {
            alert("Nenhum dado legado encontrado.");
            return;
        }

        if (!confirm(`Foram encontrados ${legacyKeys.length} registros de séries antigas/inválidas. Deseja apagá-los para limpar o sistema?`)) return;

        const newConfigs = { ...(settings.gradeConfigs || {}) };
        legacyKeys.forEach(key => delete newConfigs[key]);
        setSettings({ ...settings, gradeConfigs: newConfigs });
        alert("Dados legados removidos localmente. Clique em 'Salvar Alterações' para confirmar no servidor.");
    };


    const handleSelectiveReplication = () => {
        if (selectedReplicationGrades.length === 0) return;
        const newConfigs = { ...(settings.gradeConfigs || {}) };
        selectedReplicationGrades.forEach(gradeId => {
            newConfigs[gradeId] = { ...currentGradeConfig };
        });
        setSettings({ ...settings, gradeConfigs: newConfigs });
        setShowReplicateModal(false);
        setSelectedReplicationGrades([]);
        alert("Configuração replicada para as séries selecionadas!");
    };

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-900" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-blue-950">Configuração do Sistema de Ranking</h1>
                    <p className="text-slate-500 text-sm">Gerencie o Top 3, prêmios e patrocínios por série.</p>
                </div>

                <div className="flex items-center gap-3">
                    {isAdminGeral && (
                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
                            <Building2 className="w-4 h-4 text-slate-400" />
                            <select
                                value={currentUnitId}
                                onChange={(e) => {
                                    setCurrentUnitId(e.target.value);
                                    localStorage.setItem('rankAdminUnit', e.target.value);
                                }}
                                className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
                            >
                                {UNITS_LIST.map(u => (
                                    <option key={u.id} value={u.id}>{u.label}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <Button onClick={handleSave} disabled={saving} className="gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar Alterações
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Left Sidebar: Series Selection */}
                <Card className="p-4 space-y-2 h-fit">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 ml-2">Séries</h3>
                    {relevantGrades.map(g => (
                        <button
                            key={g.id}
                            onClick={() => setSelectedGradeId(g.id)}
                            className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-between group ${selectedGradeId === g.id
                                ? 'bg-blue-950 text-white shadow-lg shadow-blue-900/20 scale-[1.02]'
                                : 'text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            {g.label}
                            {settings.gradeConfigs?.[g.id] && (
                                <Check className={`w-3 h-3 ${selectedGradeId === g.id ? 'text-blue-300' : 'text-emerald-500'}`} />
                            )}
                        </button>
                    ))}
                </Card>

                <div className="md:col-span-3 space-y-6">
                    {/* Status & Replication Actions */}
                    <div className="flex flex-col lg:flex-row gap-4">
                        {/* Status Toggle */}
                        <div className="flex-1 flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-xl ${settings.isEnabled ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                                    <Power className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-blue-950">Status do Sistema</h3>
                                    <p className="text-xs text-slate-500">{settings.isEnabled ? 'Ranking ativo nas TVs.' : 'Ranking desativado.'}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSettings({ ...settings, isEnabled: !settings.isEnabled })}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${settings.isEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {/* Showcase Toggle */}
                        <div className="flex-1 flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-xl ${settings.showcaseEnabled ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                                    <Megaphone className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-blue-950">Vitrine de Parceiros</h3>
                                    <p className="text-xs text-slate-500">{settings.showcaseEnabled ? 'Tela azul ativa.' : 'Tela azul desativada.'}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSettings({ ...settings, showcaseEnabled: !settings.showcaseEnabled })}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${settings.showcaseEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.showcaseEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {/* Replication Tools */}
                        <div className="flex gap-2 min-w-[200px]">
                            <Button
                                variant="outline"
                                onClick={() => setShowReplicateModal(true)}
                                className="flex-1 gap-2 h-14 rounded-2xl border-slate-200 text-slate-600 font-bold"
                            >
                                <Copy className="w-4 h-4" />
                                Replicar...
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Awards Section */}
                        <Card className="p-6 space-y-4 border-yellow-100 bg-yellow-50/10">
                            <div className="flex items-center justify-between border-b border-yellow-101 pb-2">
                                <div className="flex items-center gap-2 text-yellow-700 font-bold uppercase tracking-wider text-xs">
                                    <Gift className="w-4 h-4" />
                                    Premiações: {relevantGrades.find(g => g.id === selectedGradeId)?.label}
                                </div>
                                <button
                                    onClick={resetGradeConfig}
                                    className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                    title="Limpar dados da série"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-yellow-600 uppercase mb-1 ml-1">Prêmio 1º Lugar</label>
                                    <Input
                                        value={currentGradeConfig.awards.rank1}
                                        onChange={e => updateGradeConfig('rank1', e.target.value)}
                                        placeholder="Ex: Isenção de Mensalidade"
                                        className="border-yellow-200"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Prêmio 2º Lugar</label>
                                    <Input
                                        value={currentGradeConfig.awards.rank2}
                                        onChange={e => updateGradeConfig('rank2', e.target.value)}
                                        placeholder="Ex: Vale Compras Livraria"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-orange-400 uppercase mb-1 ml-1">Prêmio 3º Lugar</label>
                                    <Input
                                        value={currentGradeConfig.awards.rank3}
                                        onChange={e => updateGradeConfig('rank3', e.target.value)}
                                        placeholder="Ex: Kit Escolar Premium"
                                        className="border-orange-100"
                                    />
                                </div>
                            </div>
                        </Card>

                        {/* Specific Partner Section */}
                        <Card className="p-6 space-y-4 border-blue-100">
                            <div className="flex items-center gap-2 text-blue-900 font-bold border-b border-blue-50 pb-2 uppercase tracking-wider text-xs">
                                <Megaphone className="w-4 h-4" />
                                Parceiro da Série
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Nome do Parceiro</label>
                                    <Input
                                        value={currentGradeConfig.sponsorName || ''}
                                        onChange={e => updateGradeConfig('sponsorName', e.target.value)}
                                        placeholder="Ex: SCHALK"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">URL da Logomarca (PNG)</label>
                                    <Input
                                        value={currentGradeConfig.sponsorLogoUrl || ''}
                                        onChange={e => updateGradeConfig('sponsorLogoUrl', e.target.value)}
                                        placeholder="https://..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Tagline / Promoção</label>
                                    <Input
                                        value={currentGradeConfig.sponsorInfo || ''}
                                        onChange={e => updateGradeConfig('sponsorInfo', e.target.value)}
                                        placeholder="Ex: Apoio Institucional"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Telefone / WhatsApp</label>
                                        <Input
                                            value={currentGradeConfig.sponsorPhone || ''}
                                            onChange={e => updateGradeConfig('sponsorPhone', e.target.value)}
                                            placeholder="(84) 99999-9999"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Endereço</label>
                                        <Input
                                            value={currentGradeConfig.sponsorAddress || ''}
                                            onChange={e => updateGradeConfig('sponsorAddress', e.target.value)}
                                            placeholder="Rua Exemplo, 123"
                                        />
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Unit General Partner Section */}
                    <Card className="p-6 space-y-4 border-slate-200 bg-slate-50/50 rounded-[2rem]">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2 text-slate-900 font-bold uppercase tracking-wider text-xs">
                                <Building2 className="w-4 h-4 text-blue-600" />
                                Parceiro Padrão (Toda a Unidade)
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-100 uppercase">Geral</span>
                        </div>

                        <p className="text-[10px] text-slate-500 italic">Este parceiro será exibido em todas as séries que NÃO tiverem um parceiro específico.</p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Nome Padrão</label>
                                <Input
                                    value={settings.sponsorName || ''}
                                    onChange={e => setSettings({ ...settings, sponsorName: e.target.value })}
                                    placeholder="Ex: Apoio Institucional"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Logo Padrão</label>
                                <Input
                                    value={settings.sponsorLogoUrl || ''}
                                    onChange={e => setSettings({ ...settings, sponsorLogoUrl: e.target.value })}
                                    placeholder="https://..."
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Tagline Padrão</label>
                                <Input
                                    value={settings.sponsorInfo || ''}
                                    onChange={e => setSettings({ ...settings, sponsorInfo: e.target.value })}
                                    placeholder="Mais informações..."
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Telefone Padrão</label>
                                <Input
                                    value={settings.sponsorPhone || ''}
                                    onChange={e => setSettings({ ...settings, sponsorPhone: e.target.value })}
                                    placeholder="(84) 99999-9999"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Endereço Padrão</label>
                                <Input
                                    value={settings.sponsorAddress || ''}
                                    onChange={e => setSettings({ ...settings, sponsorAddress: e.target.value })}
                                    placeholder="Rua Exemplo, 123"
                                />
                            </div>
                        </div>
                    </Card>

                    {/* Rule Summary */}
                    <Card className="p-6 bg-blue-950 text-white overflow-hidden relative rounded-[2rem]">
                        <Trophy className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10" />
                        <div className="flex items-center justify-between relative z-10">
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-tighter mb-4">Cálculo Automático</h3>
                                <div className="flex gap-6">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-blue-300 uppercase">Notas</p>
                                        <p className="text-2xl font-black">60%</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-emerald-400 uppercase">Freq.</p>
                                        <p className="text-2xl font-black">30%</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-yellow-400 uppercase">Comport.</p>
                                        <p className="text-2xl font-black">10%</p>
                                    </div>
                                </div>
                            </div>
                            <div className="hidden lg:block text-right">
                                <p className="text-xs text-blue-200 max-w-[200px]">
                                    Pesos definidos para o cálculo do Índice Geral de Desempenho.
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* Cleanup Section */}
                    <div className="flex justify-end">
                        <button
                            onClick={cleanupLegacyData}
                            className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1 uppercase tracking-widest"
                        >
                            <Trash2 className="w-3 h-3" />
                            Limpar Dados de Séries Legadas
                        </button>
                    </div>
                </div>
            </div>

            {/* Replication Modal */}
            {showReplicateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-blue-950/40 backdrop-blur-sm" onClick={() => setShowReplicateModal(false)} />
                    <Card className="relative w-full max-w-lg p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-blue-950">Replicar Configuração</h2>
                            <button onClick={() => setShowReplicateModal(false)} className="text-slate-400 hover:text-slate-600">
                                <Trash2 className="w-5 h-5 rotate-45" />
                            </button>
                        </div>

                        <p className="text-sm text-slate-500 mb-6">
                            Selecione as séries para as quais deseja replicar as informações de <strong>{relevantGrades.find(g => g.id === selectedGradeId)?.label}</strong>.
                        </p>

                        <div className="grid grid-cols-2 gap-3 mb-8">
                            {relevantGrades.filter(g => g.id !== selectedGradeId).map(g => (
                                <button
                                    key={g.id}
                                    onClick={() => {
                                        if (selectedReplicationGrades.includes(g.id)) {
                                            setSelectedReplicationGrades(prev => prev.filter(id => id !== g.id));
                                        } else {
                                            setSelectedReplicationGrades(prev => [...prev, g.id]);
                                        }
                                    }}
                                    className={`p-3 rounded-xl border-2 text-sm font-bold transition-all text-left ${selectedReplicationGrades.includes(g.id)
                                        ? 'border-blue-50 bg-blue-50 text-blue-700'
                                        : 'border-slate-100 text-slate-500 hover:border-slate-200'
                                        }`}
                                >
                                    {g.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setShowReplicateModal(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                className="flex-1"
                                disabled={selectedReplicationGrades.length === 0}
                                onClick={handleSelectiveReplication}
                            >
                                Replicar ({selectedReplicationGrades.length})
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
