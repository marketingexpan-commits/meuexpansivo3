import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { AcademicSegment, AcademicGrade, AcademicSubject, ClassSchedule, CurriculumMatrix } from '../types';
import { EDUCATION_LEVELS, GRADES_BY_LEVEL, DEFAULT_SUBJECTS } from '../src/utils/academicDefaults';

export function useAcademicData() {
    const [segments, setSegments] = useState<AcademicSegment[]>([]);
    const [grades, setGrades] = useState<AcademicGrade[]>([]);
    const [subjects, setSubjects] = useState<AcademicSubject[]>([]);
    const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
    const [matrices, setMatrices] = useState<CurriculumMatrix[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                let segmentsData: AcademicSegment[] = [];
                let gradesData: AcademicGrade[] = [];
                let subjectsData: AcademicSubject[] = [];

                // Fetch Segments
                const segSnap = await db.collection('academic_segments').get();
                if (segSnap.empty) {
                    segmentsData = EDUCATION_LEVELS.map((levelName, index) => ({
                        id: `fallback_seg_${index}`,
                        name: levelName,
                        isActive: true,
                        order: (index + 1) * 10
                    }));
                } else {
                    segmentsData = segSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademicSegment));
                }
                segmentsData.sort((a, b) => (a.order || 0) - (b.order || 0));
                setSegments(segmentsData);

                // Fetch Grades
                const gradeSnap = await db.collection('academic_grades').get();
                if (gradeSnap.empty) {
                    // Reconstruct from GRADES_BY_LEVEL
                    EDUCATION_LEVELS.forEach((levelName, sIdx) => {
                        const segmentId = segmentsData[sIdx]?.id || `fallback_seg_${sIdx}`;
                        const levelMatches = GRADES_BY_LEVEL.find(l => l.level === levelName);
                        const levelGrades = levelMatches ? levelMatches.grades : [];

                        levelGrades.forEach((gName, gIdx) => {
                            const fullName = `${gName} - ${levelName}`;
                            gradesData.push({
                                id: `fallback_grade_${sIdx}_${gIdx}`,
                                segmentId: segmentId,
                                name: fullName,
                                isActive: true,
                                order: (gIdx + 1) * 10
                            });
                        });
                    });
                } else {
                    gradesData = gradeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademicGrade));
                }

                // Hierarchical sort: Segment Order first, then Grade Order
                const segmentOrderMap = new Map(segmentsData.map(s => [s.id, s.order || 0]));
                gradesData.sort((a, b) => {
                    const orderA = segmentOrderMap.get(a.segmentId) || 0;
                    const orderB = segmentOrderMap.get(b.segmentId) || 0;
                    if (orderA !== orderB) return orderA - orderB;
                    return (a.order || 0) - (b.order || 0);
                });
                setGrades(gradesData);

                // Fetch Subjects
                const subSnap = await db.collection('academic_subjects').get();
                if (subSnap.empty) {
                    subjectsData = DEFAULT_SUBJECTS.map((name, index) => ({
                        id: `fallback_sub_${index}`,
                        name: name,
                        shortName: name.substring(0, 3).toUpperCase(),
                        isActive: true,
                        order: (index + 1) * 10,
                        weeklyHours: {}
                    }));
                } else {
                    subjectsData = subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademicSubject));
                }
                subjectsData.sort((a, b) => (a.order || 0) - (b.order || 0));
                setSubjects(subjectsData);

                // Fetch Class Schedules (NEW)
                const scheduleSnap = await db.collection('class_schedules').get();
                if (!scheduleSnap.empty) {
                    const schedulesData = scheduleSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassSchedule));
                    setSchedules(schedulesData);
                }

                // Fetch Academic Matrices (NEW)
                const matrixSnap = await db.collection('academic_matrices').get();
                if (!matrixSnap.empty) {
                    const matricesData = matrixSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CurriculumMatrix));
                    setMatrices(matricesData);
                }

            } catch (error) {
                console.error("Error loading academic data:", error);

                // Final Emergency Fallbacks
                setSegments(EDUCATION_LEVELS.map((name, idx) => ({ id: `err-seg-${idx}`, name, order: idx, isActive: true })));
                setGrades(GRADES_BY_LEVEL.flatMap((level, idx) =>
                    level.grades.map((g, gIdx) => ({
                        id: `err-grade-${idx}-${gIdx}`,
                        name: `${g} - ${level.level}`,
                        segmentId: `err-seg-${idx}`,
                        isActive: true,
                        order: gIdx
                    }))
                ));
                setSubjects(DEFAULT_SUBJECTS.map((s, idx) => ({
                    id: `err-sub-${idx}`,
                    name: s,
                    shortName: s.substring(0, 3).toUpperCase(),
                    isActive: true,
                    order: idx,
                    weeklyHours: {}
                })));
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    return { segments, grades, subjects, schedules, matrices, loading };
}
