export type Region = 'americas' | 'europe' | 'asia';
export const REGIONS: Record<Region, string> = {
  americas: 'west',
  europe: 'europe',
  asia: 'east',
};
export const CITIES = [
  'Bridgewatch',
  'Martlock',
  'Lymhurst',
  'Thetford',
  'Fort Sterling',
  'Caerleon',
  'Brecilien',
  'Black Market',
];
export const CITY_COLORS = [
  '#e3ab56',
  '#778eea',
  '#62c79a',
  '#b58eea',
  '#99c8e0',
  '#e77878',
  '#ce92cf',
  '#9299a8',
];
export interface Item {
  id: string;
  name: string;
  tier: number;
  enchantment: number;
  category: string;
}
export interface Quote {
  item_id: string;
  city: string;
  quality: number;
  sell_price_min: number;
  sell_price_min_date: string;
  sell_price_max: number;
  sell_price_max_date: string;
  buy_price_min: number;
  buy_price_min_date: string;
  buy_price_max: number;
  buy_price_max_date: string;
}
export interface HistoryPoint {
  timestamp: string;
  avg_price: number;
  item_count: number;
}
export interface HistorySeries {
  item_id: string;
  location: string;
  quality: number;
  data: HistoryPoint[];
}
export interface GoldPoint {
  timestamp: string;
  price: number;
}
export interface Envelope<T> {
  data: T;
  source: string;
  fetchedAt: string;
  cached: boolean;
  sourceCors?: string;
  error?: string;
}
export interface Settings {
  playerProxy?: string;
  region: Region;
  interval: number;
  maxAge: number;
  tax: number;
  setupFee: number;
  premium: boolean;
  city: string;
  density: string;
  exact: boolean;
  quality: number;
}
export const DEFAULT_SETTINGS: Settings = {
  region: 'americas',
  interval: 30000,
  maxAge: 86400000,
  tax: 8,
  setupFee: 2.5,
  premium: false,
  city: 'Thetford',
  density: 'compact',
  exact: false,
  quality: 1,
};
export interface Watchlist {
  id: string;
  name: string;
  items: string[];
  city: string;
}
export type AlertKind =
  | 'sell below'
  | 'sell above'
  | 'buy above'
  | 'margin above'
  | 'spread above'
  | 'becomes fresh'
  | 'change above';
export interface AlertRule {
  id: string;
  item: string;
  city: string;
  kind: AlertKind;
  value: number;
  baseline?: number;
  triggered?: boolean;
  region: Region;
}
export interface Recipe {
  name: string;
  output: string;
  outputQuantity: number;
  ingredients: { item: string; quantity: number; returnable?: boolean }[];
  source: string;
}
