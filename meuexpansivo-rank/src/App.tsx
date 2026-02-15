import { useState, useEffect } from 'react';
import type { StudentRank, RankSettings, GradeConfig } from './services/rankService';
import { rankService } from './services/rankService';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Medal, Star, ShieldCheck, User, Globe } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

// Helper for medals
const RankIcon = ({ position }: { position: number }) => {
  switch (position) {
    case 1: return <Trophy className="w-12 h-12 text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />;
    case 2: return <Medal className="w-10 h-10 text-slate-300" />;
    case 3: return <Medal className="w-8 h-8 text-orange-400" />;
    default: return null;
  }
};

const AwardsLegend = ({ config }: { config?: GradeConfig }) => {
  if (!config) return null;
  const { rank1, rank2, rank3 } = config.awards;
  if (!rank1 && !rank2 && !rank3) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex flex-col gap-8 ml-12 py-8 border-l-4 border-yellow-400/20 pl-10 max-w-[300px]"
    >
      <div className="space-y-1">
        <p className="text-[10px] font-black text-yellow-600 uppercase tracking-[0.2em]">1º Lugar - Prêmio</p>
        <p translate="no" className="text-xl font-black text-blue-950 leading-tight uppercase tracking-tighter">{rank1 || '---'}</p>
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">2º Lugar - Prêmio</p>
        <p translate="no" className="text-xl font-black text-blue-900 leading-tight uppercase tracking-tighter">{rank2 || '---'}</p>
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-black text-orange-400 uppercase tracking-[0.2em]">3º Lugar - Prêmio</p>
        <p translate="no" className="text-xl font-black text-blue-900 leading-tight uppercase tracking-tighter">{rank3 || '---'}</p>
      </div>
    </motion.div>
  );
};

const RankCard = ({ student, index }: { student: StudentRank, index: number }) => {
  // ... existing RankCard component ...
  // (I will keep it unchanged but need to ensure it's still there)
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.2, duration: 0.5, type: "spring" }}
      className={twMerge(
        "bg-white p-5 flex flex-col items-center gap-3 relative shadow-xl rounded-[2rem] border border-slate-100 w-full max-w-[300px]",
        student.rankPosition === 1 ? "ring-4 ring-yellow-400 scale-110 z-10" : ""
      )}
    >
      {/* Rank Icon */}
      <div className="absolute top-4 right-4 z-20">
        <RankIcon position={student.rankPosition || 0} />
      </div>

      {/* Photo 3x4 */}
      <div className="relative w-full aspect-[3/4] group">
        <div className={twMerge(
          "w-full h-full rounded-2xl overflow-hidden shadow-lg transition-transform duration-500 group-hover:scale-[1.02] border-4",
          student.rankPosition === 1 ? "border-yellow-400" :
            student.rankPosition === 2 ? "border-slate-300" :
              "border-orange-500"
        )}>
          {student.photoUrl ? (
            <img src={student.photoUrl} alt={student.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300">
              <User size={64} />
            </div>
          )}
        </div>

        {/* Rank Number Badge */}
        <div className={twMerge(
          "absolute -bottom-4 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full font-black text-xl border shadow-xl z-10 whitespace-nowrap",
          student.rankPosition === 1 ? "bg-yellow-400 text-yellow-950 border-yellow-200" :
            student.rankPosition === 2 ? "bg-slate-200 text-slate-800 border-slate-100" :
              "bg-white text-orange-600 border-orange-200"
        )}>
          {student.rankPosition}º LUGAR
        </div>
      </div>

      {/* Details */}
      <div className="text-center mt-8 space-y-1">
        <h3 translate="no" className="text-xl font-black text-slate-900 leading-tight uppercase tracking-tighter">
          {student.name.split(' ').slice(0, 2).join(' ')}
        </h3>
        <div className="flex flex-col items-center gap-0.5 text-slate-500 font-bold uppercase tracking-wider text-xs">
          <span className="text-blue-600">{student.gradeLevel}</span>
          <div className="flex items-center gap-2">
            <span>TURMA {student.schoolClass}</span>
            <span className="opacity-30">•</span>
            <span>{student.shift === 'shift_morning' ? 'MATUTINO' : 'VESPERTINO'}</span>
          </div>
        </div>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-3 gap-2 w-full mt-6 pt-6 border-t border-slate-100">
        <div className="text-center">
          <p className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">Nota</p>
          <p className="text-xl font-black text-blue-600">{student.avgGrade.toFixed(1)}</p>
        </div>
        <div className="text-center border-x border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">Freq</p>
          <p className="text-xl font-black text-emerald-500">{student.attendanceRate}%</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">Perf</p>
          <p className="text-xl font-black text-purple-600">{student.totalScore.toFixed(0)}</p>
        </div>
      </div>
    </motion.div>
  );
};

function App() {
  const [ranks, setRanks] = useState<Record<string, StudentRank[]>>({});
  const [settings, setSettings] = useState<RankSettings | null>(null);
  const [currentGradeIndex, setCurrentGradeIndex] = useState(0);
  const [unitName, setUnitName] = useState("Unidade...");

  // Get unit from URL (supports path like /zn or query ?u=zn)
  const path = window.location.pathname.replace('/', '').toLowerCase();
  const query = new URLSearchParams(window.location.search);
  const qUnit = query.get('u') || query.get('unit');

  const rawUnit = qUnit || path || "zn";

  // Normalize to canonical ID
  const unitId = rawUnit.startsWith('unit_') ? rawUnit : `unit_${rawUnit}`;

  const grades = Object.keys(ranks).sort();
  const currentGrade = grades[currentGradeIndex];

  // Grade matching logic for configs
  const currentGradeConfig = settings?.gradeConfigs ? Object.entries(settings.gradeConfigs).find(([id]) => {
    if (!currentGrade) return false;
    const label = currentGrade.toLowerCase();
    // Match common grade IDs to their labels
    if (id === 'grade_6_ano' && label.includes('6º')) return true;
    if (id === 'grade_7_ano' && label.includes('7º')) return true;
    if (id === 'grade_8_ano' && label.includes('8º')) return true;
    if (id === 'grade_9_ano' && label.includes('9º')) return true;
    if (id === 'grade_1_ser' && label.includes('1ª')) return true;
    if (id === 'grade_2_ser' && label.includes('2ª')) return true;
    if (id === 'grade_3_ser' && label.includes('3ª')) return true;
    return false;
  })?.[1] : null;

  useEffect(() => {
    // Canonical units mapping
    const unitNames: Record<string, string> = {
      'unit_zn': 'Unidade Zona Norte',
      'unit_bs': 'Unidade Boa Sorte',
      'unit_ext': 'Unidade Extremoz',
      'unit_qui': 'Unidade Quintas'
    };
    setUnitName(unitNames[unitId] || "Unidade Escolhida");

    const unsubRanks = rankService.listenToRank(unitId, (newRanks) => {
      setRanks(newRanks);
    });

    const unsubSettings = rankService.listenToSettings(unitId, (s) => {
      setSettings(s);
    });

    return () => {
      unsubRanks();
      unsubSettings();
    };
  }, [unitId]);

  useEffect(() => {
    if (grades.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentGradeIndex((prev) => (prev + 1) % grades.length);
    }, 15000); // 15 seconds per grade

    return () => clearInterval(interval);
  }, [grades.length]);

  if (!settings || !settings.isEnabled) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0f172a] p-10 text-center">
        <ShieldCheck size={120} className="text-slate-700 mb-8 animate-pulse" />
        <h1 className="text-4xl font-black text-white mb-4 uppercase tracking-tighter">Sistema de Rank</h1>
        <p className="text-xl text-slate-400 max-w-lg">O sistema de classificação em tempo real está indisponível para esta unidade no momento.</p>
      </div>
    );
  }


  return (
    <div className="h-screen w-screen bg-[#f8fafc] text-slate-900 flex flex-col overflow-hidden relative">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-600/5 blur-[120px] rounded-full -mr-40 -mt-40" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-sky-600/5 blur-[100px] rounded-full -ml-20 -mb-20" />

      {/* Header */}
      <header className="h-28 px-12 flex items-center justify-between bg-white border-b border-slate-200 shadow-sm z-20">
        <div className="flex items-center gap-6">
          <img
            src="https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png"
            alt="Logo"
            className="h-12"
          />
          <div className="w-px h-10 bg-slate-200" />
          <div>
            <h1 translate="no" className="text-3xl font-black tracking-tighter uppercase leading-none text-blue-900">RANK EXPANSIVO</h1>
            <p translate="no" className="text-sm font-bold text-blue-600 tracking-[0.2em] uppercase mt-1">{unitName}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Série em destaque</p>
            <div className="h-1.5 w-16 bg-blue-600 ml-auto mt-1 rounded-full" />
          </div>
          <h2 translate="no" className="text-5xl font-black text-blue-900 uppercase tracking-tighter ml-2">
            {currentGrade || 'Carregando...'}
          </h2>
        </div>
      </header>

      {/* Main Rank Area */}
      <main className="flex-1 flex items-center justify-center p-12 z-20 overflow-hidden">
        {!currentGrade ? (
          <div className="flex flex-col items-center gap-4 animate-pulse">
            <Star className="text-blue-500/30" size={80} />
            <p className="text-slate-500 font-bold uppercase tracking-widest">Aguardando dados...</p>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center max-w-[1600px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentGrade}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center gap-12 w-full"
              >
                {/* Score Cards Container */}
                <div className="flex items-end gap-12">
                  {/* 2nd Place */}
                  {ranks[currentGrade]?.[1] && <RankCard student={ranks[currentGrade][1]} index={1} />}

                  {/* 1st Place */}
                  {ranks[currentGrade]?.[0] && <RankCard student={ranks[currentGrade][0]} index={0} />}

                  {/* 3rd Place */}
                  {ranks[currentGrade]?.[2] && <RankCard student={ranks[currentGrade][2]} index={2} />}
                </div>

                {/* Vertical Awards Legend */}
                <AwardsLegend config={currentGradeConfig || undefined} />
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Footer / Sponsor */}
      <footer className="h-36 px-16 flex items-center justify-between bg-slate-50 border-t border-slate-200 z-20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 px-5 py-2.5 bg-blue-600/10 border border-blue-600/20 rounded-full">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-xs font-black text-blue-700 uppercase tracking-widest italic">ATUALIZAÇÃO EM TEMPO REAL</span>
          </div>
          <p className="text-xs text-slate-400 font-bold max-w-sm uppercase leading-relaxed italic">
            Participação exclusiva para alunos do Ensino Fundamental II e Médio.
          </p>
        </div>

        <motion.div
          key={currentGradeConfig?.sponsorName || settings?.sponsorName || 'default'}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-8"
        >
          {(() => {
            const isValid = (val?: string) => {
              if (!val) return false;
              const v = val.trim().toUpperCase();
              return v !== '' && v !== 'GIZ' && v !== 'APOIO INSTITUCIONAL';
            };

            const partnerName = isValid(currentGradeConfig?.sponsorName) ? currentGradeConfig?.sponsorName : (isValid(settings?.sponsorName) ? settings?.sponsorName : null);
            const partnerInfo = isValid(currentGradeConfig?.sponsorInfo) ? currentGradeConfig?.sponsorInfo : (isValid(settings?.sponsorInfo) ? settings?.sponsorInfo : null);
            const partnerLogo = currentGradeConfig?.sponsorLogoUrl || settings?.sponsorLogoUrl;

            return (
              <>
                <div className="text-right">
                  <p className="text-xs text-blue-600 font-black tracking-[0.2em] uppercase mb-2">PARCEIRO</p>
                  {partnerName && (
                    <p translate="no" className="text-3xl font-black text-blue-900 tracking-tighter leading-none uppercase">
                      {partnerName}
                    </p>
                  )}
                  {partnerInfo && (
                    <p translate="no" className="text-[10px] text-slate-400 font-black uppercase mt-1">
                      {partnerInfo}
                    </p>
                  )}
                </div>
                <div className="px-10 py-6 bg-white rounded-[2rem] border border-slate-200 shadow-md flex items-center justify-center min-w-[200px] max-h-[100px]">
                  {partnerLogo ? (
                    <img src={partnerLogo} alt="Partner" className="h-16 object-contain" />
                  ) : (
                    <Globe className="text-slate-200 h-10 w-10 opacity-20" />
                  )}
                </div>
              </>
            );
          })()}
        </motion.div>
      </footer>
    </div>
  );
}

export default App;
