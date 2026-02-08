import { useState, useEffect } from 'react';
import { Rematricula } from '../components/Rematricula';
import { studentService } from '../services/studentService';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { Student, GradeEntry } from '../types';
import { Loader2 } from 'lucide-react';

export function RematriculaPage() {
    const [students, setStudents] = useState<Student[]>([]);
    const [grades, setGrades] = useState<GradeEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load all students
            const studentData = await studentService.getStudents();
            setStudents(studentData);

            // Load all grades for 2025 to determine status
            const gradesSnap = await getDocs(query(collection(db, 'grades'), where('year', '==', 2025)));
            const gradesData = gradesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GradeEntry));
            setGrades(gradesData);
        } catch (error) {
            console.error("Error loading rematricula data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-blue-950" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Rematricula
                students={students}
                grades={grades}
                onRefresh={loadData}
            />
        </div>
    );
}
