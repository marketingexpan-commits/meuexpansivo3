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
      className="flex flex-col space-y-8 ml-12 py-8 border-l-4 border-yellow-400/20 pl-10 max-w-[300px]"
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

const RankCard = ({ student, index, isSmartTV }: { student: StudentRank, index: number, isSmartTV: boolean }) => {
  const is1st = student.rankPosition === 1;
  const targetScale = is1st ? 1.04 : 1.0;
  const tvDelay = index * 0.7; // Generous 0.7s delay for TV sequence

  return (
    <motion.div
      {...(!isSmartTV ? {
        initial: { opacity: 0, y: 50, scale: 0.9 },
        animate: {
          opacity: is1st ? 1 : 0.9,
          y: 0,
          scale: targetScale
        },
        transition: {
          delay: index * 0.3,
          duration: 0.8,
          type: "spring",
          ease: "easeOut"
        }
      } : {})}
      exit={{ opacity: 0, scale: 0.9 }}
      style={{
        zIndex: is1st ? 30 : 10,
        transformOrigin: 'center center',
        ...(isSmartTV ? {
          opacity: 0,
          animation: `tvCardEntrance 0.8s ease-out ${tvDelay}s forwards`,
          '--target-scale': targetScale
        } : {})
      } as any}
      className={twMerge(
        "bg-white p-4 flex flex-col items-center relative shadow-xl rounded-[2rem] border border-slate-100 w-full max-w-[240px]",
        is1st ? "ring-4 ring-yellow-400" : ""
      )}
    >
      {/* Rank Icon */}
      <div className="absolute top-6 right-6 z-20">
        <RankIcon position={student.rankPosition || 0} />
      </div>

      {/* Photo 3x4 with Padding Hack for Legacy Support */}
      <div className="relative w-full group">
        <div className="w-full pb-[133.33%] relative">
          <div className={twMerge(
            "absolute inset-0 w-full h-full rounded-2xl overflow-hidden shadow-lg border-4 transition-transform duration-500 group-hover:scale-[1.02] bg-slate-100",
            student.rankPosition === 1 ? "border-yellow-400" :
              student.rankPosition === 2 ? "border-slate-300" :
                "border-orange-500"
          )}>
            {student.photoUrl ? (
              <img src={student.photoUrl} alt={student.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <User size={64} />
              </div>
            )}
          </div>
        </div>

        {/* Rank Number Badge - Now outside overflow-hidden */}
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
      <div className="text-center mt-6 space-y-1">
        <h3 translate="no" className="text-lg font-black text-slate-900 leading-tight uppercase tracking-tighter" style={{ fontSize: student.name.length > 15 ? '1.1rem' : '1.25rem' }}>
          {student.name.split(' ').slice(0, 2).join(' ')}
        </h3>
        <div className="flex flex-col items-center space-y-0 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
          <span className="text-blue-600 leading-none">{student.gradeLevel}</span>
          <div className="flex items-center space-x-1 auto-cols-min leading-none mt-0.5">
            <span>TURMA {student.schoolClass}</span>
            <span className="opacity-30 mx-0.5">•</span>
            <span>{student.shift === 'shift_morning' ? 'MATUTINO' : 'VESPERTINO'}</span>
          </div>
        </div>
      </div>

      {/* Scores */}
      <div className="flex items-center justify-center space-x-5 w-full mt-2 pt-3 border-t border-slate-100">
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

const SponsorsShowcase = ({ settings, unitName, scale }: { settings: RankSettings, unitName: string, scale: number }) => {
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
    }, 5000); // 5 seconds per sponsor in showcase
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
      <div className="absolute top-12 left-12 z-20 flex items-center space-x-6">
        <img
          src="https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png"
          alt="Logo"
          className="h-12 brightness-0 invert"
          crossOrigin="anonymous"
        />
        <div className="w-px h-10 bg-white/20" />
        <div>
          <h1 translate="no" className="text-3xl font-black tracking-tighter uppercase leading-none text-white">RANKING EXPANSIVO</h1>
          <p translate="no" className="text-sm font-bold text-blue-400 tracking-[0.2em] uppercase mt-1">{unitName}</p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center h-screen py-16 relative">
        <motion.div
          key={sponsor.name}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 1.05 }}
          transition={{ duration: 1, ease: "easeInOut" }}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'center center'
          }}
          className="relative z-10 flex flex-col items-center text-center max-w-4xl"
        >
          <p className="text-blue-400 font-black tracking-[0.4em] uppercase mb-8 text-sm">Parceiro</p>

          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl mb-8 flex items-center justify-center min-w-[280px] min-h-[280px]">
            {sponsor.logo ? (
              <img
                src={sponsor.logo}
                alt={sponsor.name}
                className="h-32 object-contain"
                crossOrigin="anonymous"
                loading="eager"
                onError={(e) => {
                  console.log(`Failed to load showcase logo for ${sponsor.name}`);
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement?.classList.add('flex-col');
                  const fallback = document.createElement('div');
                  fallback.innerHTML = `<span class="text-slate-400 font-bold">LOGOTIPO</span>`;
                  e.currentTarget.parentElement?.appendChild(fallback);
                }}
              />
            ) : (
              <Globe className="text-slate-200 h-20 w-20 opacity-20" />
            )}
          </div>

          <h2 translate="no" className="text-6xl font-black tracking-tighter uppercase mb-4 leading-tight">{sponsor.name}</h2>

          {sponsor.info && (
            <p translate="no" className="text-xl text-blue-200 font-bold uppercase tracking-widest mb-8 opacity-80 italic">
              "{sponsor.info}"
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4 w-full">
            {sponsor.address && (
              <div className="flex flex-col items-center space-y-2">
                <Building2 className="text-blue-400 h-5 w-5" />
                <p translate="no" className="text-base font-bold opacity-70 uppercase tracking-tight">{sponsor.address}</p>
              </div>
            )}
            {sponsor.phone && (
              <div className="flex flex-col items-center space-y-2">
                <Phone className="text-blue-400 h-5 w-5" />
                <p translate="no" className="text-3xl font-black text-blue-400 tracking-wider italic">{sponsor.phone}</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

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
  const [isSmartTV, setIsSmartTV] = useState(false);

  useEffect(() => {
    // Smart TV Detection Logic
    const ua = navigator.userAgent.toLowerCase();
    const isSmartTVDetected = /webos|smarttv|tizen|viera|bravia/.test(ua);

    if (isSmartTVDetected) {
      document.body.classList.add('is-smart-tv');
      setIsSmartTV(true);
    }
  }, []);

  const [ranks, setRanks] = useState<Record<string, StudentRank[]>>({});
  const [settings, setSettings] = useState<RankSettings | null>(null);
  const [currentGradeIndex, setCurrentGradeIndex] = useState(0);
  const [unitName, setUnitName] = useState("Unidade...");
  const [scaleFactor, setScaleFactor] = useState(1);
  const [showcaseScale, setShowcaseScale] = useState(1);

  // Dynamic Scaling Hook for Zoom/Resize Protection
  useEffect(() => {
    const handleResize = () => {
      const h = window.innerHeight;
      // Cards Scale: Header(112) + Footer(112) + Buffer(120) = 344px reserved
      // Base Height adjusted to ensure fit
      const availableForCards = h - 260;
      const computedCardScale = Math.min(1.15, Math.max(0.5, availableForCards / 525));
      setScaleFactor(computedCardScale);

      // Showcase Scale: Padding(128) + Buffer(80) = 208px reserved
      const availableForShowcase = h - 220;
      const computedShowcaseScale = Math.min(1, Math.max(0.5, availableForShowcase / 850));
      setShowcaseScale(computedShowcaseScale);
    };

    // Run immediately and on resize
    handleResize();
    window.addEventListener('resize', handleResize);

    // Optimization: Debounce not strictly needed for simple transform, 
    // but ensures TV doesn't run this often (TVs don't resize)
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // Count sponsors to determine duration
  const sponsorsCount = useMemo(() => {
    if (!settings) return 0;

    const isValidPartner = (name?: string, phone?: string, address?: string) => {
      if (!name) return false;
      const n = name.toUpperCase();
      if (n === 'APOIO INSTITUCIONAL' || n === 'GIZ' || n === '') return !!(phone || address);
      return true;
    };

    const seenNames = new Set<string>();
    let count = 0;

    // Unit sponsor
    if (isValidPartner(settings.sponsorName, settings.sponsorPhone, settings.sponsorAddress)) {
      const name = (settings.sponsorName || 'Parceiro Escola').toLowerCase();
      seenNames.add(name);
      count++;
    }

    // Grade sponsors
    if (settings.gradeConfigs) {
      Object.values(settings.gradeConfigs).forEach(config => {
        if (isValidPartner(config.sponsorName, config.sponsorPhone, config.sponsorAddress)) {
          const name = (config.sponsorName || 'Parceiro Escola').toLowerCase();
          if (!seenNames.has(name)) {
            seenNames.add(name);
            count++;
          }
        }
      });
    }
    return count;
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
    }, isShowcaseStep ? Math.max(5000, sponsorsCount * 5000) : 25000); // Dynamic: 5s per sponsor (min 5s), 25s per grade

    return () => clearInterval(interval);
  }, [totalSteps, isShowcaseStep]);

  const isLoading = !settings || !settings.isEnabled || grades.length === 0;

  return (
    <div className={twMerge(
      "h-screen w-full bg-slate-50 flex flex-col relative overflow-hidden",
      isSmartTV && "bg-[#f8fafc]" // Slightly lighter background for TVs to compensate for lack of blurs
    )}>
      {/* Global CSS Overrides for Smart TV and Animation Fixes */}
      <style>{`
        body.is-smart-tv {
          font-family: 'Inter', sans-serif !important;
          background-color: #001c3d !important;
        }
        body.is-smart-tv * {
          font-family: 'Inter', sans-serif !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
        body.is-smart-tv .blur-[150px], 
        body.is-smart-tv .blur-[100px] {
          display: none !important;
        }
        /* Fix for legacy WebOS space utilities */
        .flex.space-x-6 > * + * { margin-left: 1.5rem; }
        .flex.space-x-5 > * + * { margin-left: 1.25rem; }
        .flex.space-x-3 > * + * { margin-left: 0.75rem; }
        .flex.space-x-2 > * + * { margin-left: 0.5rem; }
        .flex.flex-col.space-y-8 > * + * { margin-top: 2rem; }
        .flex.flex-col.space-y-1 > * + * { margin-top: 0.25rem; }
        .flex.flex-col.space-y-0.5 > * + * { margin-top: 0.125rem; }

        /* Hardware Accelerated Sequential Entrance for Old TVs */
        @keyframes tvCardEntrance {
          0% { 
            opacity: 0; 
            transform: translateY(50px) scale(0.9);
          }
          100% { 
            opacity: 1; 
            transform: translateY(0) scale(var(--target-scale, 1));
          }
        }
      `}</style>
      {!isSmartTV && (
        <>
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100/50 blur-[150px] rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-yellow-100/30 blur-[150px] rounded-full translate-y-1/2 -translate-x-1/2" />
        </>
      )}

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
        {isShowcaseStep && (
          <SponsorsShowcase
            settings={settings}
            unitName={unitName}
            scale={showcaseScale}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="h-28 bg-white border-b border-slate-100 shadow-sm z-20 flex-shrink-0">
        <div className="max-w-[1440px] mx-auto w-full h-full px-12 md:px-20 flex items-center justify-between">
          <div className="flex items-center space-x-6">
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

          <div className="flex items-center space-x-6">
            <div className="text-right">
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none">Série em destaque</p>
              <div className="h-1.5 w-16 bg-blue-600 ml-auto mt-1.5 rounded-full" />
            </div>
            <h2 translate="no" className="text-4xl font-black text-[#001c3d] uppercase tracking-tighter ml-2 whitespace-nowrap">
              {currentGrade || 'Patrocinadores'}
            </h2>
          </div>
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
          <div className="w-full h-full flex items-center justify-center max-w-[1440px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentGrade}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex items-center justify-center gap-10 w-full"
              >
                {/* Score Cards Container */}
                <div
                  className="flex items-end space-x-8"
                  style={{
                    transform: `scale(${scaleFactor})`,
                    transformOrigin: 'center center'
                  }}
                >
                  {/* 2nd Place */}
                  {ranks[currentGrade]?.[1] && <RankCard student={ranks[currentGrade][1]} index={1} isSmartTV={isSmartTV} />}

                  {/* 1st Place */}
                  {ranks[currentGrade]?.[0] && <RankCard student={ranks[currentGrade][0]} index={0} isSmartTV={isSmartTV} />}

                  {/* 3rd Place */}
                  {ranks[currentGrade]?.[2] && <RankCard student={ranks[currentGrade][2]} index={2} isSmartTV={isSmartTV} />}
                </div>

                {/* Vertical Awards Legend */}
                <AwardsLegend config={currentGradeConfig || undefined} />
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </main>

      <footer className="h-28 bg-[#001c3d] border-t border-white/5 z-20 flex-shrink-0">
        <div className="max-w-[1440px] mx-auto w-full h-full px-12 md:px-20 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3 px-5 py-2.5 bg-blue-600/20 border border-blue-500/30 rounded-full">
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
            className="flex items-center space-x-8"
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
                      <p translate="no" className="text-2xl font-black text-white tracking-tighter leading-none uppercase">
                        {partnerName}
                      </p>
                    )}
                    {partnerInfo && (
                      <p translate="no" className="text-[10px] text-white/40 font-black uppercase mt-1">
                        {partnerInfo}
                      </p>
                    )}
                  </div>
                  <div className="px-8 py-4 bg-white rounded-[2rem] border border-white/10 shadow-xl flex items-center justify-center min-w-[180px] max-h-[90px]">
                    {partnerLogo ? (
                      <img
                        src={partnerLogo}
                        alt="Partner"
                        className="h-12 object-contain"
                        crossOrigin="anonymous"
                        loading="eager"
                        onError={(e) => {
                          console.log("Failed to load footer partner logo");
                          e.currentTarget.src = "https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png"; // Fallback to school logo
                          e.currentTarget.style.opacity = "0.2";
                        }}
                      />
                    ) : (
                      <Globe className="text-slate-200 h-8 w-8 opacity-20" />
                    )}
                  </div>
                </>
              );
            })()}
          </motion.div>
        </div>
      </footer>
    </div>
  );
}

export default App;
