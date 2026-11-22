/**
 * TransferRoutesGrid - Client component wrapper for transfer cards
 * 
 * Manages the details modal state and renders all transfer route cards.
 * Passes the build-time activity data to the modal as its fallback.
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

    const activityDetailsMap = useMemo(() => {
        const map = new Map<string, { activity: TransferVehicle; variants: TransferVehicle[] }>();
        for (const route of routes) {
            for (const variants of [route.vehicles, route.reverseActivityIds]) {
                for (const activity of variants) {
                    if (activity.activityId) map.set(activity.activityId, { activity, variants });
                }
            }
        }
        return map;
    }, [routes]);
    const selection = activityDetailsMap.get(selectedActivityId);

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
                activity={selection?.activity}
                variants={selection?.variants}
                onSelectActivity={setSelectedActivityId}
                lang={lang}
            />
        </>
    );
}
