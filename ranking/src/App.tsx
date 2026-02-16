import { useState, useEffect, useMemo } from 'react';
import type { StudentRank, RankSettings, GradeConfig } from './services/rankService';
import { rankService } from './services/rankService';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Medal, User, Globe, Building2, Phone } from 'lucide-react';
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
        <p translate="no" className="text-xl font-black text-[#001c3d] leading-tight uppercase tracking-tighter">{rank1 || '---'}</p>
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">2º Lugar - Prêmio</p>
        <p translate="no" className="text-xl font-black text-[#001c3d] leading-tight uppercase tracking-tighter">{rank2 || '---'}</p>
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-black text-orange-400 uppercase tracking-[0.2em]">3º Lugar - Prêmio</p>
        <p translate="no" className="text-xl font-black text-[#001c3d] leading-tight uppercase tracking-tighter">{rank3 || '---'}</p>
      </div>
    </motion.div>
  );
};

const RankCard = ({ student, index }: { student: StudentRank, index: number }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: student.rankPosition === 1 ? 1.04 : 1.0
      }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.2, duration: 0.5, type: "spring" }}
      style={{
        zIndex: student.rankPosition === 1 ? 30 : 10,
        opacity: student.rankPosition === 1 ? 1 : 0.9
      }}
      className={twMerge(
        "bg-white p-5 flex flex-col items-center gap-3 relative shadow-xl rounded-[2rem] border border-slate-100 w-full max-w-[300px]",
        student.rankPosition === 1 ? "ring-4 ring-yellow-400" : ""
      )}
    >
      {/* Rank Icon */}
      <div className="absolute top-6 right-6 z-20">
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
      <div className="flex items-center justify-center gap-5 w-full mt-6 pt-6 border-t border-slate-100">
        <div className="text-center">
          <p className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">Nota</p>
          <p className="text-xl font-black text-blue-600">{student.avgGrade.toFixed(1)}</p>
        </div>
        <div className="w-px h-10 bg-slate-100" />
        <div className="text-center">
          <p className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">Freq</p>
          <p className="text-xl font-black text-[#001c3d]">{student.attendanceRate}%</p>
        </div>
        <div className="w-px h-10 bg-slate-100" />
        <div className="text-center">
          <p className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">Perf</p>
          <p className="text-xl font-black text-orange-600">{student.totalScore.toFixed(0)}</p>
        </div>
      </div>
    </motion.div>
  );
};

const SponsorsShowcase = ({ settings, unitName }: { settings: RankSettings, unitName: string }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Extract all unique sponsors (unit sponsor + grade sponsors)
  const allSponsors = useMemo(() => {
    const sponsors: Array<{ name: string; logo?: string; info?: string; phone?: string; address?: string }> = [];

    const isValidPartner = (name?: string, phone?: string, address?: string) => {
      if (!name) return false;
      const n = name.toUpperCase();
      // If name is placeholder, ONLY show if it has some real contact info
      if (n === 'APOIO INSTITUCIONAL' || n === 'GIZ' || n === '') {
        return !!(phone || address);
      }
      return true;
    };

    // 1. Add unit-wide sponsor if valid
    if (isValidPartner(settings.sponsorName, settings.sponsorPhone, settings.sponsorAddress)) {
      sponsors.push({
        name: settings.sponsorName || 'Parceiro Escola',
        logo: settings.sponsorLogoUrl,
        info: settings.sponsorInfo,
        phone: settings.sponsorPhone,
        address: settings.sponsorAddress
      });
    }

    // 2. Add all grade-specific sponsors (unique ones)
    if (settings.gradeConfigs) {
      Object.values(settings.gradeConfigs).forEach(config => {
        if (isValidPartner(config.sponsorName, config.sponsorPhone, config.sponsorAddress)) {
          const exists = sponsors.some(s => s.name.toLowerCase() === config.sponsorName?.toLowerCase());
          if (!exists) {
            sponsors.push({
              name: config.sponsorName || 'Parceiro Escola',
              logo: config.sponsorLogoUrl,
              info: config.sponsorInfo,
              phone: config.sponsorPhone,
              address: config.sponsorAddress
            });
          }
        }
      });
    }

    return sponsors;
  }, [settings]);

  useEffect(() => {
    if (allSponsors.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % allSponsors.length);
    }, 8000); // 8 seconds per sponsor in showcase
    return () => clearInterval(interval);
  }, [allSponsors.length]);

  if (allSponsors.length === 0) return null;

  const sponsor = allSponsors[currentIndex];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#001c3d] text-white p-20"
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-blue-600/10 blur-[150px] rounded-full" />

      {/* Header Logo & Unit (Matching main design) */}
      <div className="absolute top-12 left-12 z-20 flex items-center gap-6">
        <img
          src="https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png"
          alt="Logo"
          className="h-12 brightness-0 invert"
        />
        <div className="w-px h-10 bg-white/20" />
        <div>
          <h1 translate="no" className="text-3xl font-black tracking-tighter uppercase leading-none text-white">RANKING EXPANSIVO</h1>
          <p translate="no" className="text-sm font-bold text-blue-400 tracking-[0.2em] uppercase mt-1">{unitName}</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={sponsor.name}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 1.05 }}
          transition={{ duration: 1, ease: "easeInOut" }}
          className="relative z-10 flex flex-col items-center text-center max-w-4xl"
        >
          <p className="text-blue-400 font-black tracking-[0.4em] uppercase mb-12 text-sm">Parceiro</p>

          <div className="bg-white p-12 rounded-[3rem] shadow-2xl mb-12 flex items-center justify-center min-w-[300px] min-h-[300px]">
            {sponsor.logo ? (
              <img src={sponsor.logo} alt={sponsor.name} className="h-40 object-contain" />
            ) : (
              <Globe className="text-slate-200 h-24 w-24 opacity-20" />
            )}
          </div>

          <h2 translate="no" className="text-7xl font-black tracking-tighter uppercase mb-6">{sponsor.name}</h2>

          {sponsor.info && (
            <p translate="no" className="text-2xl text-blue-200 font-bold uppercase tracking-widest mb-10 opacity-80 italic">
              "{sponsor.info}"
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mt-10 w-full">
            {sponsor.address && (
              <div className="flex flex-col items-center gap-3">
                <Building2 className="text-blue-400 h-6 w-6" />
                <p translate="no" className="text-lg font-bold opacity-70 uppercase tracking-tight">{sponsor.address}</p>
              </div>
            )}
            {sponsor.phone && (
              <div className="flex flex-col items-center gap-3">
                <Phone className="text-blue-400 h-6 w-6" />
                <p translate="no" className="text-2xl font-black text-blue-400 tracking-wider italic">{sponsor.phone}</p>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Showcase step indicators */}
      <div className="absolute bottom-12 flex gap-3">
        {allSponsors.map((_: any, i: number) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all duration-500 ${i === currentIndex ? 'w-12 bg-blue-500' : 'w-3 bg-white/20'}`}
          />
        ))}
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

  const grades = useMemo(() => {
    const rawGrades = Object.keys(ranks);
    const academicOrder = ['6º', '7º', '8º', '9º', '1ª', '2ª', '3ª'];

    return rawGrades.sort((a, b) => {
      const idxA = academicOrder.findIndex(o => a.includes(o));
      const idxB = academicOrder.findIndex(o => b.includes(o));

      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [ranks]);

  // Extra step for Sponsor Showcase
  const hasSponsors = useMemo(() => {
    const isValidPartner = (name?: string, phone?: string, address?: string) => {
      if (!name) return false;
      const n = name.toUpperCase();
      if (n === 'APOIO INSTITUCIONAL' || n === 'GIZ' || n === '') return !!(phone || address);
      return true;
    };
    if (!settings) return false;
    if (isValidPartner(settings.sponsorName, settings.sponsorPhone, settings.sponsorAddress)) return true;
    if (settings.gradeConfigs) {
      return Object.values(settings.gradeConfigs).some(c => isValidPartner(c.sponsorName, c.sponsorPhone, c.sponsorAddress));
    }
    return false;
  }, [settings]);

  const totalSteps = grades.length + (settings?.isEnabled && settings.showcaseEnabled && hasSponsors ? 1 : 0);
  const isShowcaseStep = currentGradeIndex === grades.length && settings?.showcaseEnabled;

  const currentGrade = !isShowcaseStep ? grades[currentGradeIndex] : null;

  // Grade matching logic for configs
  const currentGradeConfig = useMemo(() => {
    if (!settings?.gradeConfigs || !currentGrade) return null;
    return Object.entries(settings.gradeConfigs).find(([id]) => {
      const label = currentGrade.toLowerCase();
      if (id === 'grade_6_ano' && label.includes('6º')) return true;
      if (id === 'grade_7_ano' && label.includes('7º')) return true;
      if (id === 'grade_8_ano' && label.includes('8º')) return true;
      if (id === 'grade_9_ano' && label.includes('9º')) return true;
      if (id === 'grade_1_ser' && label.includes('1ª')) return true;
      if (id === 'grade_2_ser' && label.includes('2ª')) return true;
      if (id === 'grade_3_ser' && label.includes('3ª')) return true;
      return false;
    })?.[1] || null;
  }, [settings, currentGrade]);

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
    if (totalSteps <= 1) return;

    const interval = setInterval(() => {
      setCurrentGradeIndex((prev) => (prev + 1) % totalSteps);
    }, isShowcaseStep ? 30000 : 15000); // More time for showcase

    return () => clearInterval(interval);
  }, [totalSteps, isShowcaseStep]);

  const isLoading = !settings || !settings.isEnabled || grades.length === 0;

  return (
    <div className="h-screen w-screen bg-[#f8fafc] text-slate-900 flex flex-col overflow-hidden relative">
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading-screen"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05, filter: "blur(15px)" }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#f8fafc]"
          >
            {/* Background Glows */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 blur-[120px] rounded-full" />

            <div className="relative flex flex-col items-center">
              <motion.div
                animate={{
                  scale: [1, 1.02, 1],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="mb-10 relative"
              >
                <img
                  src="https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png"
                  alt="Logo Expansivo"
                  className="h-32 w-auto object-contain drop-shadow-xl"
                />
              </motion.div>

              <div className="text-center">
                <h1 className="text-2xl font-black text-[#001c3d] mb-4 uppercase tracking-tighter">
                  Carregando Ranking
                </h1>

                {/* Linear Progress Bar below the logo/text */}
                <div className="w-48 h-1 bg-slate-200 rounded-full overflow-hidden relative mx-auto">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-blue-600 rounded-full"
                    initial={{ width: "0%", left: "-100%" }}
                    animate={{ width: "100%", left: "100%" }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                </div>

                <p className="mt-4 text-slate-400 font-bold uppercase tracking-[0.3em] text-[9px] opacity-60">
                  Sincronizando ambiente escolar
                </p>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {isShowcaseStep && settings && (
          <SponsorsShowcase settings={settings} unitName={unitName} />
        )}
      </AnimatePresence>

      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-600/5 blur-[120px] rounded-full -mr-40 -mt-40" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-sky-600/5 blur-[100px] rounded-full -ml-20 -mb-20" />

      {/* Header */}
      <header className="h-28 px-12 flex items-center justify-between bg-white border-b border-slate-100 shadow-sm z-20">
        <div className="flex items-center gap-6">
          <img
            src="https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png"
            alt="Logo"
            className="h-12"
          />
          <div className="w-px h-10 bg-slate-100" />
          <div>
            <h1 translate="no" className="text-3xl font-black tracking-tighter uppercase leading-none text-[#001c3d]">RANKING EXPANSIVO</h1>
            <p translate="no" className="text-sm font-bold text-blue-600 tracking-[0.2em] uppercase mt-1">{unitName}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Série em destaque</p>
            <div className="h-1.5 w-16 bg-blue-600 ml-auto mt-1 rounded-full" />
          </div>
          <h2 translate="no" className="text-5xl font-black text-[#001c3d] uppercase tracking-tighter ml-2">
            {currentGrade || 'Patrocinadores'}
          </h2>
        </div>
      </header>

      {/* Main Rank Area */}
      <main className="flex-1 flex items-center justify-center p-12 z-20 overflow-hidden">
        {!currentGrade ? (
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <motion.div
                animate={{ scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="relative z-10"
              >
                <img
                  src="https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png"
                  alt="Logo Expansivo"
                  className="h-24 opacity-20 grayscale"
                />
              </motion.div>
              <div className="absolute inset-0 bg-blue-600/5 blur-xl rounded-full scale-150 animate-pulse" />
            </div>
            <p className="text-slate-300 font-bold uppercase tracking-[0.3em] text-[10px]">Aguardando sincronização...</p>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center max-w-[1600px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentGrade}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex items-center justify-center gap-10 w-full"
              >
                {/* Score Cards Container */}
                <div className="flex items-end gap-8">
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

      <footer className="h-36 px-16 flex items-center justify-between bg-[#001c3d] border-t border-white/5 z-20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 px-5 py-2.5 bg-blue-600/20 border border-blue-500/30 rounded-full">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-xs font-black text-blue-400 uppercase tracking-widest italic">ATUALIZAÇÃO EM TEMPO REAL</span>
          </div>
          <p className="text-xs text-white/50 font-bold max-w-sm uppercase leading-relaxed italic">
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
                  <p className="text-xs text-blue-400 font-black tracking-[0.2em] uppercase mb-2">PARCEIRO</p>
                  {partnerName && (
                    <p translate="no" className="text-3xl font-black text-white tracking-tighter leading-none uppercase">
                      {partnerName}
                    </p>
                  )}
                  {partnerInfo && (
                    <p translate="no" className="text-[10px] text-white/40 font-black uppercase mt-1">
                      {partnerInfo}
                    </p>
                  )}
                </div>
                <div className="px-10 py-6 bg-white rounded-[2rem] border border-white/10 shadow-xl flex items-center justify-center min-w-[200px] max-h-[100px]">
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
