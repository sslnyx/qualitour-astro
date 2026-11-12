/**
 * TransferRoutesGrid - Client component wrapper for transfer cards
 * 
 * Manages the details modal state and renders all transfer route cards.
 * Activity details are fetched at build time and passed to modal (no runtime fetch).
 */

import { useState, useMemo } from 'react';
import TransferRouteCard from './TransferRouteCard';
import TransferDetailsModal from './TransferDetailsModal';
import type { TransferRoute, TransferVehicle } from '../lib/zaui/zaui';

interface TransferRoutesGridProps {
    routes: TransferRoute[];
    lang: 'en' | 'zh';
    localePrefix: string;
}

export default function TransferRoutesGrid({
    routes,
    lang,
    localePrefix,
}: TransferRoutesGridProps) {
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedActivityId, setSelectedActivityId] = useState<string>('');

    // Build a lookup map of all activity details from routes (build-time data)
    const activityDetailsMap = useMemo(() => {
        const map = new Map<string, TransferVehicle>();
        routes.forEach(route => {
            route.vehicles?.forEach(v => {
                if (v.activityId) map.set(v.activityId, v);
            });
            route.reverseActivityIds?.forEach(v => {
                if (v.activityId) map.set(v.activityId, v);
            });
        });
        return map;
    }, [routes]);

    // Get the selected activity's cached details
    const selectedActivity = activityDetailsMap.get(selectedActivityId);

    const handleDetailsClick = (activityId: string) => {
        setSelectedActivityId(activityId);
        setDetailsModalOpen(true);
    };

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {routes.map((route) => (
                    <TransferRouteCard
                        key={route.id}
                        route={route}
                        lang={lang}
                        localePrefix={localePrefix}
                        onDetailsClick={handleDetailsClick}
                    />
                ))}
            </div>

            <TransferDetailsModal
                isOpen={detailsModalOpen}
                onClose={() => setDetailsModalOpen(false)}
                activity={selectedActivity}
                lang={lang}
            />
        </>
    );
}
