'use client';
import type { Quote } from '@/lib/market/types';
import { age, ageLabel } from '@/lib/market/analytics';
import { Num, CityBadge } from './market-ui';

export function QuoteCoverage({
  quotes,
  city,
  now,
  checkedAt,
  busy,
  onCity,
}: {
  quotes: Quote[];
  city: string;
  now: number;
  checkedAt: string;
  busy: boolean;
  onCity: (city: string) => void;
}) {
  const observed = quotes
    .filter(
      (q) =>
        q.sell_price_min > 0 &&
        Number.isFinite(age(q.sell_price_min_date, now)),
    )
    .sort(
      (a, b) =>
        age(a.sell_price_min_date, now) - age(b.sell_price_min_date, now),
    );
  const current = observed.find((q) => q.city === city);
  const newest = observed[0];
  const recent = observed.filter(
    (q) => age(q.sell_price_min_date, now) <= 1800000,
  ).length;
  return (
    <section
      className="quote-coverage"
      aria-label="Market observation coverage"
    >
      <div className="coverage-summary">
        <div>
          <span className="eyebrow">API CHECK</span>
          <strong>
            {busy
              ? 'Checking source…'
              : checkedAt
                ? ageLabel(checkedAt, now) + ' ago'
                : 'Waiting for source'}
          </strong>
          <small>Request time, not price age</small>
        </div>
        <div>
          <span className="eyebrow">{city.toUpperCase()} PRICE OBSERVED</span>
          <strong>
            {current
              ? ageLabel(current.sell_price_min_date, now) + ' ago'
              : 'No sell observation'}
          </strong>
          <small>
            {recent} of {quotes.length} city quotes observed within 30m
          </small>
        </div>
        <div>
          <span className="eyebrow">NEWEST CITY OBSERVATION</span>
          {newest ? (
            <>
              <strong>
                <CityBadge city={newest.city} />{' '}
                <Num value={newest.sell_price_min} />
              </strong>
              <small>
                {ageLabel(newest.sell_price_min_date, now)} ago · same item and
                quality
              </small>
            </>
          ) : (
            <strong>No observations available</strong>
          )}
        </div>
        {newest &&
          newest.city !== city &&
          (!current ||
            age(newest.sell_price_min_date, now) <
              age(current.sell_price_min_date, now)) && (
            <button onClick={() => onCity(newest.city)}>
              View {newest.city}
            </button>
          )}
      </div>
      <details>
        <summary>Why can a refreshed price still be old?</summary>
        <p>
          The public market feed updates when players scan that item and city
          with an upload client. Refreshing retrieves the latest uploaded
          observation; it cannot request a new scan inside the game. Different
          cities and order sides can have very different ages.{' '}
          <a
            href="https://www.albion-online-data.com/client"
            target="_blank"
            rel="noreferrer"
          >
            Help update public prices with the data client ↗
          </a>
        </p>
      </details>
    </section>
  );
}
