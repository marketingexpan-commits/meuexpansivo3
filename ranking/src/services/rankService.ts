import { db } from "../firebaseConfig";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";

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
    gradeConfigs?: Record<string, GradeConfig>;
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
        let attendanceMap: Record<string, any[]> = {};

        const recompute = () => {
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
                const studentAttendance = attendanceMap[student.id] || [];

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

                // 2. Real Attendance Rate
                // Calculate based on attendance records (Presence vs Absence)
                // app-aluno uses "Presente" and "Faltou"
                let totalLessons = 0;
                let presentLessons = 0;

                studentAttendance.forEach(record => {
                    const lessonWeight = record.lessonCount || 1;
                    totalLessons += lessonWeight;
                    if (record.status === 'Presente') {
                        presentLessons += lessonWeight;
                    }
                });

                const attendanceRate = totalLessons > 0 ? (presentLessons / totalLessons) * 100 : 100;

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
                    // 3. Final: Alphabetical Order
                    return a.name.localeCompare(b.name);
                });
                groupedRanks[grade] = groupedRanks[grade].slice(0, 3).map((item, idx) => ({ ...item, rankPosition: idx + 1 }));
            });

            onUpdate(groupedRanks);
        };

        const unsubStudents = onSnapshot(studentsQuery, (snap) => {
            studentsMap = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
            recompute();
        });

        const unsubAttendance = onSnapshot(query(collection(db, "attendance"), where("unit", "==", unitId)), (snap) => {
            const temp: Record<string, any[]> = {};
            snap.docs.forEach(d => {
                const data = d.data();
                if (data.studentStatus) {
                    Object.keys(data.studentStatus).forEach(sId => {
                        if (!temp[sId]) temp[sId] = [];
                        temp[sId].push({
                            status: data.studentStatus[sId],
                            lessonCount: data.lessonCount || 1
                        });
                    });
                }
            });
            attendanceMap = temp;
            recompute();
        });

        return () => {
            unsubStudents();
            unsubGrades();
            unsubOccurrences();
            unsubAttendance();
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
