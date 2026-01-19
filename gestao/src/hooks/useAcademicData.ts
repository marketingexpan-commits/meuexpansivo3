import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';
import type { AcademicSegment, AcademicGrade, AcademicSubject } from '../types';
import { ACADEMIC_SEGMENTS, ACADEMIC_GRADES, SUBJECTS_DATA } from '../utils/academicDefaults';

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
                    segmentsData = Object.values(ACADEMIC_SEGMENTS).map((seg, index) => ({
                        id: seg.id,
                        name: seg.label,
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
                    gradesData = Object.values(ACADEMIC_GRADES).map((grade, index) => ({
                        id: grade.id,
                        segmentId: grade.segmentId,
                        name: grade.label, // In TeacherForm/StudentForm we might need "Grade - Segment", but the Hook should provide the raw label
                        isActive: true,
                        order: (index + 1) * 10
                    }));
                } else {
                    gradesData = gradeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademicGrade));
                }
                setGrades(gradesData);

                // Fetch Subjects
                const subSnap = await getDocs(collection(db, 'academic_subjects'));
                if (subSnap.empty) {
                    subjectsData = Object.values(SUBJECTS_DATA).map((sub, index) => ({
                        id: sub.id,
                        name: sub.label,
                        shortName: sub.label.substring(0, 3).toUpperCase(),
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
                setSegments(Object.values(ACADEMIC_SEGMENTS).map((seg, idx: number) => ({
                    id: seg.id,
                    name: seg.label,
                    order: idx * 10,
                    isActive: true
                })));
                setGrades(Object.values(ACADEMIC_GRADES).map((grade, idx: number) => ({
                    id: grade.id,
                    name: grade.label,
                    segmentId: grade.segmentId,
                    isActive: true,
                    order: idx * 10
                })));
                setSubjects(Object.values(SUBJECTS_DATA).map((s, idx: number) => ({
                    id: s.id,
                    name: s.label,
                    shortName: s.label.substring(0, 3).toUpperCase(),
                    isActive: true,
                    order: idx * 10
                })));
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    return { segments, grades, subjects, loading };
}
