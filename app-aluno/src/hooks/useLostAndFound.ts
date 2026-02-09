import { useState, useEffect } from 'react';
import { db, storage } from '../firebaseConfig';
import { LostAndFoundItem, LostAndFoundStatus, SchoolUnit } from '../types';
import { compressImage } from '../utils/imageUtils';

/**
 * Hook to manage Lost and Found (Achados e Perdidos) items.
 * Handles fetching, adding, claiming, delivering, and auto-cleanup.
 */
export function useLostAndFound(unit?: SchoolUnit | string) {
    const [items, setItems] = useState<LostAndFoundItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!unit) {
            setLoading(false);
            return;
        }

        // Real-time synchronization for the specific unit
        const unsubscribe = db.collection('lost_and_found')
            .where('unit', '==', unit)
            .onSnapshot(snapshot => {
                const newItems = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as LostAndFoundItem[];

                // Sort by timestamp desc (newest first)
                newItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

                setItems(newItems);
                setLoading(false);

                // Auto-cleanup for items delivered more than 48 hours ago
                cleanupDeliveredItems(newItems);
            }, error => {
                console.error("Error fetching lost and found:", error);
                setLoading(false);
            });

        return () => unsubscribe();
    }, [unit]);

    /**
     * Deletes items that were marked as 'delivered' more than 48 hours ago.
     */
    const cleanupDeliveredItems = async (currentItems: LostAndFoundItem[]) => {
        const now = new Date();
        const twoDaysAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));

        const itemsToDelete = currentItems.filter(item =>
            item.status === 'delivered' &&
            item.deliveredAt &&
            new Date(item.deliveredAt) < twoDaysAgo
        );

        for (const item of itemsToDelete) {
            try {
                // Delete photo from storage if it exists
                if (item.photoUrl && item.photoUrl.includes('firebasestorage')) {
                    try {
                        const fileRef = storage.refFromURL(item.photoUrl);
                        await fileRef.delete();
                    } catch (storageErr) {
                        // Silent fail for storage deletion (might already be deleted or URL invalid)
                        console.warn("Could not delete photo from storage during cleanup:", storageErr);
                    }
                }
                // Delete document from Firestore
                await db.collection('lost_and_found').doc(item.id).delete();
                console.log(`[Cleanup] Deleted item ${item.id} (delivered > 48h ago)`);
            } catch (err) {
                console.error(`[Cleanup] Error deleting item ${item.id}:`, err);
            }
        }
    };

    /**
     * Uploads a photo to Firebase Storage and returns the download URL.
     */
    const uploadPhoto = async (file: File): Promise<string> => {
        const compressedBlob = await compressImage(file);
        const filename = `${Date.now()}_${file.name.replace(/\s+/g, '_')}.jpg`;
        const storageRef = storage.ref(`lost_and_found/${filename}`);
        const snapshot = await storageRef.put(compressedBlob);
        return await snapshot.ref.getDownloadURL();
    };

    /**
     * Registers a new lost item.
     */
    const addItem = async (item: Omit<LostAndFoundItem, 'id' | 'timestamp' | 'status'>) => {
        try {
            const newItemData = {
                ...item,
                status: 'active' as LostAndFoundStatus,
                timestamp: new Date().toISOString()
            };
            await db.collection('lost_and_found').add(newItemData);
        } catch (error) {
            console.error("Error adding lost item:", error);
            throw error;
        }
    };

    /**
     * Marks an item as claimed by a student ("É meu").
     */
    const claimItem = async (itemId: string, studentId: string, studentName: string, grade: string, schoolClass: string, shift: string) => {
        try {
            await db.collection('lost_and_found').doc(itemId).update({
                status: 'claimed' as LostAndFoundStatus,
                claimedByStudentId: studentId,
                claimedByStudentName: studentName,
                claimedByStudentGrade: grade,
                claimedByStudentClass: schoolClass,
                claimedByStudentShift: shift,
                claimedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error("Error claiming item:", error);
            throw error;
        }
    };

    /**
     * Officially delivers the item (handover by coordinator).
     */
    const deliverItem = async (itemId: string) => {
        try {
            await db.collection('lost_and_found').doc(itemId).update({
                status: 'delivered' as LostAndFoundStatus,
                deliveredAt: new Date().toISOString()
            });
        } catch (error) {
            console.error("Error delivering item:", error);
            throw error;
        }
    };

    /**
     * Deletes a specific item and its associated photo.
     */
    const deleteItem = async (itemId: string, photoUrl?: string) => {
        try {
            // Delete photo from storage if it exists
            if (photoUrl && photoUrl.includes('firebasestorage')) {
                try {
                    const fileRef = storage.refFromURL(photoUrl);
                    await fileRef.delete();
                } catch (storageErr) {
                    console.warn("Could not delete photo from storage:", storageErr);
                }
            }
            // Delete document from Firestore
            await db.collection('lost_and_found').doc(itemId).delete();
        } catch (error) {
            console.error("Error deleting item:", error);
            throw error;
        }
    };

    return { items, loading, addItem, claimItem, deliverItem, deleteItem, uploadPhoto };
}
