/** Public transfer snapshot contract. This module has no credentials, IO or API calls. */
export interface TransferVehicle {
  seater: '11' | '14';
  activityId: string;
  price: string;
  currency: string;
  priceDate: string;
  details: { activityName: string; description: string; imageUrl: string };
}

export interface TransferRoute {
  id: string;
  name: string;
  fromLocation: string;
  toLocation: string;
  imageUrl: string;
  currency: string;
  priceDate: string;
  vehicles: TransferVehicle[];
  reverseActivityIds: TransferVehicle[];
}

export interface TransferSnapshot {
  schemaVersion: 1;
  source: 'zaui';
  fetchedAt: string;
  priceDate: string;
  timezone: string;
  currency: string;
  activityCount: number;
  routes: TransferRoute[];
}

export function validPriceDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function validateTransferSnapshot(value: unknown): TransferSnapshot {
  const fail = (reason: string): never => { throw new Error('Invalid transfer snapshot: ' + reason); };
  const object = (v: any, keys: string[]) => {
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(k => !keys.includes(k))) fail('unexpected fields');
  };
  const text = (v: unknown) => typeof v === 'string' && !!v.trim();
  const image = (v: unknown) => typeof v === 'string' && (v === '' || /^https:\/\//i.test(v));
  const v = value as TransferSnapshot;
  object(v, ['schemaVersion', 'source', 'fetchedAt', 'priceDate', 'timezone', 'currency', 'activityCount', 'routes']);
  if (v.schemaVersion !== 1 || v.source !== 'zaui') fail('schema/source');
  if (!text(v.fetchedAt) || !Number.isFinite(Date.parse(v.fetchedAt))) fail('fetchedAt');
  if (!validPriceDate(v.priceDate)) fail('price date');
  if (typeof v.currency !== 'string' || !/^[A-Z]{3}$/.test(v.currency)) fail('currency');
  try { new Intl.DateTimeFormat('en', { timeZone: v.timezone }).format(); } catch { fail('timezone'); }
  if (!text(v.timezone) || !Array.isArray(v.routes) || v.routes.length !== 9 || v.activityCount !== 32) fail('routes/timezone/count');
  const routes = new Set<string>();
  const activities = new Map<string, string>();
  for (const route of v.routes) {
    object(route, ['id', 'name', 'fromLocation', 'toLocation', 'imageUrl', 'currency', 'priceDate', 'vehicles', 'reverseActivityIds']);
    if (![route.id, route.name, route.fromLocation, route.toLocation].every(text) || routes.has(route.id)) fail('route identity');
    routes.add(route.id);
    if (!image(route.imageUrl) || route.currency !== v.currency || route.priceDate !== v.priceDate) fail('route metadata');
    for (const vehicles of [route.vehicles, route.reverseActivityIds]) {
      if (!Array.isArray(vehicles) || !vehicles.length) fail('empty vehicles');
      const seats = new Set<string>();
      for (const vehicle of vehicles) {
        object(vehicle, ['seater', 'activityId', 'price', 'currency', 'priceDate', 'details']);
        if (!['11', '14'].includes(vehicle.seater) || seats.has(vehicle.seater) || typeof vehicle.activityId !== 'string' || !/^\d+$/.test(vehicle.activityId)) fail('vehicle identity');
        seats.add(vehicle.seater);
        if (vehicle.currency !== v.currency || vehicle.priceDate !== v.priceDate) fail('vehicle metadata');
        if (typeof vehicle.price !== 'string' || (vehicle.price !== 'Contact for price' && !/^\d+(?:\.\d{1,2})?$/.test(vehicle.price))) fail('vehicle price');
        object(vehicle.details, ['activityName', 'description', 'imageUrl']);
        if (!text(vehicle.details.activityName) || typeof vehicle.details.description !== 'string' || !image(vehicle.details.imageUrl)) fail('vehicle details');
        const prior = activities.get(vehicle.activityId);
        if (prior && prior !== JSON.stringify(vehicle)) fail('inconsistent shared activity');
        activities.set(vehicle.activityId, JSON.stringify(vehicle));
      }
    }
  }
  if (!Number.isInteger(v.activityCount) || v.activityCount !== activities.size) fail('activity count');
  return v;
}
