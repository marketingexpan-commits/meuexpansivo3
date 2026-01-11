import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';
import { AcademicSegment, AcademicGrade, AcademicSubject } from '../types';
import { EDUCATION_LEVELS, GRADES_BY_LEVEL, DEFAULT_SUBJECTS } from '../src/utils/academicDefaults';

export function useAcademicData() {
    const [segments, setSegments] = useState<AcademicSegment[]>([]);
    const [grades, setGrades] = useState<AcademicGrade[]>([]);
    const [subjects, setSubjects] = useState<AcademicSubject[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                let segmentsData: AcademicSegment[] = [];
                let gradesData: AcademicGrade[] = [];
                let subjectsData: AcademicSubject[] = [];

                // Fetch Segments
                const segSnap = await getDocs(collection(db, 'academic_segments'));
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
                const gradeSnap = await getDocs(collection(db, 'academic_grades'));
                if (gradeSnap.empty) {
                    // Reconstruct from GRADES_BY_LEVEL
                    EDUCATION_LEVELS.forEach((levelName, sIdx) => {
                        const segmentId = segmentsData[sIdx]?.id || `fallback_seg_${sIdx}`;
                        const levelMatches = GRADES_BY_LEVEL.find(l => l.level === levelName);
                        const levelGrades = levelMatches ? levelMatches.grades : [];

                        levelGrades.forEach((gName, gIdx) => {
                            gradesData.push({
                                id: `fallback_grade_${sIdx}_${gIdx}`,
                                segmentId: segmentId,
                                name: gName,
                                isActive: true,
                                order: (gIdx + 1) * 10
                            });
                        });
                    });
                } else {
                    gradesData = gradeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademicGrade));
                }
                gradesData.sort((a, b) => (a.order || 0) - (b.order || 0));
                setGrades(gradesData);

                // Fetch Subjects
                const subSnap = await getDocs(collection(db, 'academic_subjects'));
                if (subSnap.empty) {
                    subjectsData = DEFAULT_SUBJECTS.map((name, index) => ({
                        id: `fallback_sub_${index}`,
                        name: name,
                        shortName: name.substring(0, 3).toUpperCase(),
                        isActive: true,
                        order: (index + 1) * 10
                    }));
                } else {
                    subjectsData = subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademicSubject));
                }
                subjectsData.sort((a, b) => (a.order || 0) - (b.order || 0));
                setSubjects(subjectsData);

            } catch (error) {
                console.error("Error loading academic data:", error);

                // Final Emergency Fallbacks
                setSegments(EDUCATION_LEVELS.map((name, idx) => ({ id: `err-seg-${idx}`, name, order: idx, isActive: true })));
                setGrades(GRADES_BY_LEVEL.flatMap((level, idx) =>
                    level.grades.map((g, gIdx) => ({
                        id: `err-grade-${idx}-${gIdx}`,
                        name: g,
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
                    order: idx
                })));
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    return { segments, grades, subjects, loading };
}
