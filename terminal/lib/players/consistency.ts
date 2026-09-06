import { timestamp } from '../market/analytics.ts';
import type { PublicIdentity } from './source';

export function validateProfileUpdate(
  incoming: PublicIdentity,
  expectedId: string,
  previous?: PublicIdentity,
  now = Date.now(),
) {
  if (incoming.Id !== expectedId)
    throw new Error(
      'The source returned a different player. The previous record was retained.',
    );
  const nextTime = timestamp(
    typeof incoming.LifetimeStatistics?.Timestamp === 'string'
      ? incoming.LifetimeStatistics.Timestamp
      : '',
  );
  const oldTime = timestamp(
    typeof previous?.LifetimeStatistics?.Timestamp === 'string'
      ? previous.LifetimeStatistics.Timestamp
      : '',
  );
  if (nextTime > now + 60000)
    throw new Error(
      'The source returned a future update timestamp. Please retry later.',
    );
  if (
    Number.isFinite(oldTime) &&
    (!Number.isFinite(nextTime) || nextTime < oldTime)
  )
    throw new Error(
      'The source returned an older or undated profile. Your newer saved record was retained.',
    );
}
