'use client';
import { useState, type ReactNode } from 'react';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ageLabel, freshness, csv } from '@/lib/market/analytics';
import { CITIES, CITY_COLORS, type Item } from '@/lib/market/types';
import { Download, Database, ArrowUpRight } from 'lucide-react';
export function SelectBox({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: (string | { value: string; label: string })[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => v !== null && onChange(v)}>
      <SelectTrigger aria-label={label}>
        <SelectValue>
          {options
            .map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
            .find((o) => o.value === value)?.label || value}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options
          .map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
          .map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
export function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="check">
      <Checkbox checked={checked} onCheckedChange={onChange} />
      {children}
    </label>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 1e12,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) =>
          onChange(Math.min(max, Math.max(min, Number(e.target.value) || 0)))
        }
      />
    </label>
  );
}
export function Num({
  value,
  exact = false,
  suffix = '',
}: {
  value?: number | null;
  exact?: boolean;
  suffix?: string;
}) {
  return (
    <span
      className="num"
      title={
        value == null || !Number.isFinite(value)
          ? 'Unavailable'
          : value.toLocaleString('en-US', { maximumFractionDigits: 6 })
      }
    >
      {value == null || !Number.isFinite(value)
        ? '—'
        : new Intl.NumberFormat('en-US', {
            notation: exact ? 'standard' : 'compact',
            maximumFractionDigits: 2,
          }).format(value)}
      {value != null && suffix}
    </span>
  );
}
export function FreshnessBadge({
  date,
  now = Date.now(),
  compact = false,
}: {
  date?: string;
  now?: number;
  compact?: boolean;
}) {
  const f = freshness(date, now);
  return (
    <span
      className={`freshness ${f.toLowerCase().replaceAll(' ', '-')}`}
      title={`${date || 'No timestamp'} UTC · Price last observed ${ageLabel(date, now)} ago · Albion Online Data Project`}
    >
      <i />
      {compact ? ageLabel(date, now) : f}
      <span className="badge-age">
        {!compact && f !== 'NO DATA' ? ' ' + ageLabel(date, now) : ''}
      </span>
    </span>
  );
}
export function CityBadge({ city }: { city: string }) {
  return (
    <span className="city">
      <i
        style={{ background: CITY_COLORS[CITIES.indexOf(city)] || '#8a93a5' }}
      />
      {city}
    </span>
  );
}
export function ItemLabel({
  item,
  onClick,
}: {
  item: Item;
  onClick?: () => void;
}) {
  return (
    <button className="item-label" onClick={onClick}>
      <img
        src={`https://render.albiononline.com/v1/item/${encodeURIComponent(item.id)}.png?size=64`}
        alt=""
        width={36}
        height={36}
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.visibility = 'hidden';
        }}
      />
      <span>
        <strong>{item.name}</strong>
        <small>
          T{item.tier}
          {item.enchantment ? `.${item.enchantment}` : ''}{' '}
          <span>· {item.category}</span>
        </small>
      </span>
    </button>
  );
}
export function Panel({
  title,
  tag,
  actions,
  children,
  className = '',
}: {
  title: string;
  tag?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <h2>{title}</h2>
        {tag && <span className="tag">{tag}</span>}
        <div className="panel-actions">{actions}</div>
      </div>
      {children}
    </section>
  );
}
export function Empty({
  text = 'No eligible market observations',
  detail = 'Try a different item, region, or maximum quote age.',
}: {
  text?: string;
  detail?: string;
}) {
  return (
    <div className="empty">
      <Database size={25} />
      <strong>{text}</strong>
      <span>{detail}</span>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
export function Stat({
  label,
  value,
  note,
  tone = '',
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: string;
}) {
  return (
    <div className="stat">
      <span className="eyebrow">{label}</span>
      <strong className={tone}>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
export function ExportButton({
  rows,
  name = 'market',
}: {
  rows: Record<string, unknown>[];
  name?: string;
}) {
  return (
    <button
      className="quiet"
      disabled={!rows.length}
      onClick={() => {
        const url = URL.createObjectURL(
          new Blob([csv(rows)], { type: 'text/csv;charset=utf-8;' }),
        );
        const a = document.createElement('a');
        a.href = url;
        a.download = `albion-${name}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }}
    >
      <Download size={14} /> Export CSV
    </button>
  );
}
export function MarketTable<T>({
  rows,
  columns,
  rowKey,
  limit = 50,
}: {
  rows: T[];
  columns: { label: string; render: (row: T, index: number) => ReactNode }[];
  rowKey: (row: T) => string;
  limit?: number;
}) {
  const [page, setPage] = useState(0);
  const current = Math.min(
    page,
    Math.max(0, Math.ceil(rows.length / limit) - 1),
  );
  if (!rows.length) return <Empty />;
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c.label}>{c.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(current * limit, (current + 1) * limit).map((r, i) => (
            <TableRow key={rowKey(r)}>
              {columns.map((c) => (
                <TableCell key={c.label}>
                  {c.render(r, current * limit + i)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length > limit && (
        <div className="pagination">
          <button disabled={!current} onClick={() => setPage(current - 1)}>
            Previous
          </button>
          <span>
            {current * limit + 1}–{Math.min((current + 1) * limit, rows.length)}{' '}
            of {rows.length}
          </span>
          <button
            disabled={(current + 1) * limit >= rows.length}
            onClick={() => setPage(current + 1)}
          >
            Next <ArrowUpRight size={12} />
          </button>
        </div>
      )}
    </>
  );
}
