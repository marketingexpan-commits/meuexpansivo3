import { db } from "../firebaseConfig";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import { calculateGeneralFrequency } from "../utils/frequency";

export interface StudentRank {
    id: string;
    name: string;
    photoUrl?: string;
    gradeLevel: string;
    schoolClass: string;
    shift: string;
    avgGrade: number;
    attendanceRate: number;
    behaviorScore: number;
    totalScore: number;
    rankPosition?: number;
}

export interface GradeConfig {
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

export interface RankSettings {
    isEnabled: boolean;
    sponsorName?: string;
    sponsorLogoUrl?: string;
    sponsorInfo?: string;
    sponsorPhone?: string;
    sponsorAddress?: string;
    showcaseEnabled?: boolean;
    regulationUrl?: string;
    regulationText?: string;
    gradeConfigs?: Record<string, GradeConfig>;
    globalFontSizeMode?: 'auto' | 'manual';
    globalManualFontSize?: number;
    lastUpdated?: string;
}

const CALCULATE_BEHAVIOR_SCORE = (occurrences: any[]) => {
    let score = 100;
    occurrences.forEach(occ => {
        if (occ.category === 'Disciplinar') score -= 10;
        if (occ.category === 'Elogio/Positiva') score += 5;
    });
    return Math.max(0, Math.min(100, score));
};

export const rankService = {
    listenToRank(unitId: string, onUpdate: (ranks: Record<string, StudentRank[]>) => void) {
        // 1. Listen to Students
        const studentsQuery = query(collection(db, "students"), where("unit", "==", unitId), where("status", "==", "CURSANDO"));

        // We'll need to nest snapshot listeners or use a more complex aggregation.
        // Given the real-time requirement, we'll watch multiple collections.

        let studentsMap: any[] = [];
        let gradesMap: Record<string, any[]> = {};
        let occurrencesMap: Record<string, any[]> = {};
        let allAttendanceRecords: any[] = [];
        let subjectsList: any[] = [];
        let academicSettings: any = null;
        let calendarEventsList: any[] = [];
        let classSchedulesList: any[] = [];
        let matricesList: any[] = [];

        // Tracks initial loads
        let studentsLoaded = false;
        let gradesLoaded = false;
        let occurrencesLoaded = false;
        let attendanceLoaded = false;
        let subjectsLoaded = false;
        let settingsLoaded = false;
        let eventsLoaded = false;
        let schedulesLoaded = false;
        let matricesLoaded = false;

        const recompute = () => {
            if (!studentsLoaded || !gradesLoaded || !occurrencesLoaded || !attendanceLoaded ||
                !subjectsLoaded || !settingsLoaded || !eventsLoaded || !schedulesLoaded || !matricesLoaded) {
                return;
            }

            if (studentsMap.length === 0) return;

            const groupedRanks: Record<string, StudentRank[]> = {};

            studentsMap.forEach(student => {
                // Filter: Only Fundamental II (6º-9º) and Ensino Médio
                const level = student.gradeLevel || '';
                const isFund2 = /6º|7º|8º|9º/.test(level);
                const isMedia = /Médio/.test(level);

                if (!isFund2 && !isMedia) return;

                const studentGrades = gradesMap[student.id] || [];
                const studentOccurrences = occurrencesMap[student.id] || [];

                // 1. Academic Average (Dynamic)
                // If mediaAnual is 0 or -1, look at individual bimester averages
                let totalMedias = 0;
                let subjectsCount = 0;

                studentGrades.forEach(gradeEntry => {
                    let subjectSum = 0;
                    let bimestersCount = 0;

                    // Check if mediaAnual is valid (> 0)
                    if (gradeEntry.mediaAnual > 0) {
                        subjectSum = gradeEntry.mediaAnual;
                        bimestersCount = 1;
                    } else if (gradeEntry.bimesters) {
                        // Fallback to active bimesters
                        const bKeys = ['bimester1', 'bimester2', 'bimester3', 'bimester4'];
                        bKeys.forEach(k => {
                            const bData = gradeEntry.bimesters[k];
                            if (bData && bData.media > 0) {
                                subjectSum += bData.media;
                                bimestersCount++;
                            }
                        });
                    }

                    if (bimestersCount > 0) {
                        totalMedias += (subjectSum / bimestersCount);
                        subjectsCount++;
                    }
                });

                const avgGrade = subjectsCount > 0 ? (totalMedias / subjectsCount) : 0;

                // 2. Real Attendance Rate using Student App's dynamic calculation
                const freqStr = calculateGeneralFrequency(
                    [],
                    allAttendanceRecords,
                    student.id,
                    student.gradeLevel || "",
                    subjectsList,
                    academicSettings,
                    calendarEventsList,
                    student.unit,
                    classSchedulesList,
                    student.schoolClass,
                    student.shift,
                    matricesList
                );
                const attendanceRate = freqStr === '-' ? 100 : parseFloat(freqStr.replace('%', ''));

                // 3. Behavior Score
                const behaviorScore = CALCULATE_BEHAVIOR_SCORE(studentOccurrences);

                // 4. Total Combined Score
                // Profile: 60% Grades (x10 to normalize 0-10 to 0-100), 30% Attendance, 10% Behavior
                const totalScore = (avgGrade * 10) * 0.6 + (attendanceRate * 0.3) + (behaviorScore * 0.1);

                const rankItem: StudentRank = {
                    id: student.id,
                    name: student.name,
                    photoUrl: student.photoUrl,
                    gradeLevel: student.gradeLevel,
                    schoolClass: student.schoolClass,
                    shift: student.shift,
                    avgGrade,
                    attendanceRate,
                    behaviorScore,
                    totalScore
                };

                if (!groupedRanks[student.gradeLevel]) {
                    groupedRanks[student.gradeLevel] = [];
                }
                groupedRanks[student.gradeLevel].push(rankItem);
            });

            Object.keys(groupedRanks).forEach(grade => {
                groupedRanks[grade].sort((a, b) => {
                    // 1. Primary: Total Score
                    if (Math.abs(b.totalScore - a.totalScore) > 0.001) {
                        return b.totalScore - a.totalScore;
                    }
                    // 2. Secondary: Academic Average (Média Geral)
                    if (Math.abs(b.avgGrade - a.avgGrade) > 0.001) {
                        return b.avgGrade - a.avgGrade;
                    }
                    // 3. Tertiary: Attendance Rate (Frequência)
                    if (Math.abs(b.attendanceRate - a.attendanceRate) > 0.001) {
                        return b.attendanceRate - a.attendanceRate;
                    }
                    // 4. Quaternary: Behavior Score (Comportamento)
                    if (Math.abs(b.behaviorScore - a.behaviorScore) > 0.001) {
                        return b.behaviorScore - a.behaviorScore;
                    }
                    // 5. Final: Alphabetical Order
                    return a.name.localeCompare(b.name);
                });
                // Mapeia a posição de todos os alunos classificados na série
                groupedRanks[grade] = groupedRanks[grade].map((item, idx) => ({ ...item, rankPosition: idx + 1 }));
            });

            onUpdate(groupedRanks);
        };

        const unsubStudents = onSnapshot(studentsQuery, (snap) => {
            studentsMap = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            studentsLoaded = true;
            recompute();
        });

        const unsubGrades = onSnapshot(query(collection(db, "grades")), (snap) => {
            const temp: Record<string, any[]> = {};
            snap.docs.forEach(d => {
                const data = d.data();
                if (!temp[data.studentId]) temp[data.studentId] = [];
                temp[data.studentId].push(data);
            });
            gradesMap = temp;
            gradesLoaded = true;
            recompute();
        });

        const unsubOccurrences = onSnapshot(query(collection(db, "occurrences")), (snap) => {
            const temp: Record<string, any[]> = {};
            snap.docs.forEach(d => {
                const data = d.data();
                if (!temp[data.studentId]) temp[data.studentId] = [];
                temp[data.studentId].push(data);
            });
            occurrencesMap = temp;
            occurrencesLoaded = true;
            recompute();
        });

        const unsubAttendance = onSnapshot(query(collection(db, "attendance"), where("unit", "==", unitId)), (snap) => {
            allAttendanceRecords = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            attendanceLoaded = true;
            recompute();
        });

        const unsubSubjects = onSnapshot(collection(db, "academic_subjects"), (snap) => {
            subjectsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            subjectsLoaded = true;
            recompute();
        });

        const unsubSettings = onSnapshot(query(collection(db, "academic_settings"), where("year", "==", 2026)), (snap) => {
            const allSettings = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            academicSettings = allSettings.find(s => s.unit === unitId) || allSettings.find(s => s.unit === 'all') || null;
            settingsLoaded = true;
            recompute();
        });

        const unsubEvents = onSnapshot(query(collection(db, "calendar_events"), where("units", "array-contains-any", [unitId, "all"])), (snap) => {
            calendarEventsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            eventsLoaded = true;
            recompute();
        });

        const unsubSchedules = onSnapshot(query(collection(db, "class_schedules"), where("schoolId", "==", unitId)), (snap) => {
            classSchedulesList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            schedulesLoaded = true;
            recompute();
        });

        const unsubMatrices = onSnapshot(collection(db, "academic_matrices"), (snap) => {
            matricesList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            matricesLoaded = true;
            recompute();
        });

        return () => {
            unsubStudents();
            unsubGrades();
            unsubOccurrences();
            unsubAttendance();
            unsubSubjects();
            unsubSettings();
            unsubEvents();
            unsubSchedules();
            unsubMatrices();
        };
    },

    listenToSettings(unitId: string, onUpdate: (settings: RankSettings) => void) {
        return onSnapshot(doc(db, "rank_settings", unitId), async (snap) => {
            if (snap.exists()) {
                onUpdate(snap.data() as RankSettings);
            } else {
                // FALLBACK: If unit config doesn't exist, try global once
                try {
                    const globalSnap = await getDoc(doc(db, 'rank_settings', 'global'));
                    if (globalSnap.exists()) {
                        onUpdate(globalSnap.data() as RankSettings);
                    } else {
                        onUpdate({ isEnabled: false });
                    }
                } catch (e) {
                    onUpdate({ isEnabled: false });
                }
            }
        });
    }
};
