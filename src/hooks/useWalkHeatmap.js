import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const getIsoWeekId = (date) => {
    const utcDate = new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate()
    ));
    const day = utcDate.getUTCDay() || 7;
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
    return `${utcDate.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

const getVisiblePeriodIds = () => {
    const current = new Date();
    const previous = new Date(current);
    previous.setUTCDate(previous.getUTCDate() - 7);
    return [...new Set([getIsoWeekId(current), getIsoWeekId(previous)])];
};

/** 3人以上が記録した週・約250mセルだけを購読する。 */
export const useWalkHeatmap = () => {
    const [cells, setCells] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const periodSnapshots = new Map();
        const periodIds = getVisiblePeriodIds();

        const syncCells = () => {
            const merged = new Map();
            periodSnapshots.forEach((periodCells) => {
                periodCells.forEach((cell) => {
                    const previous = merged.get(cell.cellId);
                    merged.set(cell.cellId, {
                        ...cell,
                        actionCount: (previous?.actionCount || 0) + cell.actionCount,
                    });
                });
            });
            setCells([...merged.values()]);
            setIsLoading(periodSnapshots.size < periodIds.length);
        };

        const unsubscribes = periodIds.map((periodId) => {
            const cellsQuery = collection(db, 'walkHeatmapPeriods', periodId, 'cells');
            return onSnapshot(cellsQuery, (snapshot) => {
                periodSnapshots.set(periodId, snapshot.docs
                    .map((docSnap) => ({
                        id: `${periodId}-${docSnap.id}`,
                        ...docSnap.data(),
                    }))
                    .filter((cell) => cell.contributorCount >= 3));
                syncCells();
            }, (error) => {
                console.error('お散歩の気配取得エラー:', error);
                periodSnapshots.set(periodId, []);
                syncCells();
            });
        });

        return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
    }, []);

    return { cells, isLoading };
};
