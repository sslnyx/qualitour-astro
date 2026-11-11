/** Build-time reader for the last successful manual sync. No live API or disk cache. */
import savedSnapshot from '../../data/zaui-transfer-routes.json' with { type: 'json' };
import { validateTransferSnapshot, type TransferSnapshot, type TransferRoute } from './transfer-snapshot.ts';

export type { TransferRoute, TransferVehicle, TransferSnapshot } from './transfer-snapshot.ts';

export function getTransferSnapshot(): TransferSnapshot {
    return validateTransferSnapshot(savedSnapshot);
}

export async function getPrivateTransfersWithPricing(): Promise<TransferRoute[]> {
    return getTransferSnapshot().routes;
}
