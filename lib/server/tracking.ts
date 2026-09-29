import { db } from './db';
import { trackingSchema, type TrackingRecord } from '../tracking';

export async function trackingSettings(): Promise<TrackingRecord> {
  const { rows } = await db().query(
    'SELECT settings, version FROM tracking_settings WHERE id=true',
  );
  if (!rows[0]) throw new Error('Tracking settings have not been initialized');
  return {
    settings: trackingSchema.parse(rows[0].settings),
    version: rows[0].version,
  };
}
