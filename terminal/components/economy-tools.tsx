'use client';
import { useEffect, useState } from 'react';
import {
  CITIES,
  type Recipe,
  type Settings,
  type GoldPoint,
} from '@/lib/market/types';
import {
  gathering,
  transport,
  production,
  valid,
  stats,
} from '@/lib/market/analytics';
import { readLocal, writeLocal, marketRequest } from '@/lib/market/client';
import {
  Panel,
  Stat,
  Num,
  CityBadge,
  FreshnessBadge,
  MarketTable,
  ItemLabel,
  SelectBox,
  NumberField,
  Toggle,
  Empty,
} from './market-ui';
import type { ViewProps } from './market-views';
import { materialFamily, resourceVariant } from '@/lib/market/materials';
export function GoldEstimator({ settings }: { settings: Settings }) {
  const [quantity, setQuantity] = useState(1000),
    [held, setHeld] = useState(0),
    [basis, setBasis] = useState(0);
  const [data, setData] = useState<GoldPoint[]>([]);
  useEffect(() => {
    let active = true;
    marketRequest<GoldPoint[]>(
      new URLSearchParams({ kind: 'gold', server: settings.region }).toString(),
    )
      .then((r) => {
        if (active)
          setData(
            r.data.toSorted(
              (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
            ),
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [settings.region]);
  const price = data[0]?.price;
  const s = stats(data.map((p) => p.price));
  return (
    <Panel title="Gold purchase estimator" tag="SEPARATE GOLD MARKET">
      <div className="form-grid">
        <NumberField
          label="Gold to purchase"
          value={quantity}
          onChange={setQuantity}
        />
        <NumberField
          label="Gold already held"
          value={held}
          onChange={setHeld}
        />
        <NumberField
          label="Average historical cost / gold"
          value={basis}
          onChange={setBasis}
        />
      </div>
      <div className="stats-grid">
        <Stat
          label="ESTIMATED PURCHASE COST"
          value={<Num value={price ? price * quantity : null} />}
          note="Silver · quoted gold price"
        />
        <Stat
          label="BLENDED COST / GOLD"
          value={
            <Num
              value={
                price && held + quantity > 0
                  ? (held * basis + price * quantity) / (held + quantity)
                  : null
              }
            />
          }
          note="Weighted by quantities"
        />
        <Stat
          label="OBSERVED MEAN"
          value={<Num value={s?.mean} />}
          note="Available source observations"
        />
        <Stat
          label="PRICE DISPERSION"
          value={<Num value={s?.cv} suffix="%" />}
          note="Standard deviation / mean"
        />
      </div>
      <p className="footnote">
        Gold is priced in silver per gold. Item market tax and setup fees are
        not applied. Estimates omit slippage and available depth.
      </p>
    </Panel>
  );
}
export function Gathering(
  p: ViewProps & { materials: import('@/lib/market/types').Item[] },
) {
  const [kind, setKind] = useState('ORE'),
    [tier, setTier] = useState('4'),
    [enchant, setEnchant] = useState('0'),
    [rate, setRate] = useState(500),
    [bonus, setBonus] = useState(0),
    [premiumBonus, setPremiumBonus] = useState(0),
    [travel, setTravel] = useState(15),
    [load, setLoad] = useState(999),
    [city, setCity] = useState(p.settings.city);
  const availableEnchantments = [
    ...new Set(
      p.materials
        .filter(
          (i) => materialFamily(i.id)?.key === kind && i.tier === Number(tier),
        )
        .map((i) => String(i.enchantment)),
    ),
  ].sort();
  const effectiveEnchantment = availableEnchantments.includes(enchant)
    ? enchant
    : '0';
  const id =
    resourceVariant(
      p.materials,
      kind,
      Number(tier),
      Number(effectiveEnchantment),
    )?.id || `T${tier}_${kind}`;
  useEffect(() => {
    if (!p.tracked.includes(id)) p.setTracked([...p.tracked, id]);
  }, [id, p]);
  const qs = p.quotes
    .filter(
      (q) =>
        q.item_id === id &&
        valid(q, 'buy', p.settings.maxAge || Infinity, p.now),
    )
    .sort((a, b) => b.buy_price_max - a.buy_price_max);
  const q = qs.find((q) => q.city === city);
  const result = q
    ? gathering(
        q.buy_price_max,
        rate,
        bonus + (p.settings.premium ? premiumBonus : 0),
        travel,
        load,
        p.settings.tax,
      )
    : null;
  const best = qs[0];
  return (
    <>
      <Panel title="Gathering profitability" tag="SELL INTO BUY ORDERS">
        <div className="toolbar">
          <SelectBox
            label="Resource"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'ORE', label: 'Ore' },
              { value: 'WOOD', label: 'Wood' },
              { value: 'FIBER', label: 'Fiber' },
              { value: 'HIDE', label: 'Hide' },
              { value: 'ROCK', label: 'Stone' },
            ]}
          />
          <SelectBox
            label="Resource tier"
            value={tier}
            onChange={(v) => {
              setTier(v);
              if (Number(v) < 4) setEnchant('0');
            }}
            options={['2', '3', '4', '5', '6', '7', '8']}
          />
          <SelectBox
            label="Resource enchantment"
            value={effectiveEnchantment}
            onChange={setEnchant}
            options={
              availableEnchantments.length ? availableEnchantments : ['0']
            }
          />
          <SelectBox
            label="Preferred sell city"
            value={city}
            onChange={setCity}
            options={CITIES}
          />
          <ItemLabel item={p.item(id)} onClick={() => p.openItem(id)} />
        </div>
        <div className="form-grid">
          <NumberField
            label="Base resources gathered / hour"
            value={rate}
            onChange={setRate}
          />
          <NumberField
            label="Gathering yield bonus %"
            value={bonus}
            onChange={setBonus}
          />
          <NumberField
            label={`Premium bonus % (${p.settings.premium ? 'enabled' : 'disabled in settings'})`}
            value={premiumBonus}
            onChange={setPremiumBonus}
          />
          <NumberField
            label="Travel minutes per trip"
            value={travel}
            onChange={setTravel}
          />
          <NumberField
            label="Inventory load (resource units)"
            value={load}
            onChange={setLoad}
            min={1}
          />
        </div>
        <div className="stats-grid">
          <Stat
            label="GROSS SILVER / HOUR"
            value={<Num value={result?.gross} />}
            note="Includes entered travel time"
          />
          <Stat
            label="NET SILVER / HOUR"
            value={<Num value={result?.net} />}
            note={`${p.settings.tax}% configured tax`}
            tone="positive"
          />
          <Stat
            label="NET SILVER / TRIP"
            value={<Num value={result?.trip} />}
            note={`${load} units per load`}
          />
          <Stat
            label="TRANSPORT OPPORTUNITY"
            value={
              <Num
                value={
                  q && best
                    ? (best.buy_price_max - q.buy_price_max) *
                      load *
                      (1 - p.settings.tax / 100)
                    : null
                }
              />
            }
            note={
              best
                ? `Before extra travel · ${best.city}`
                : 'No eligible buy quotes'
            }
          />
        </div>
        <MarketTable
          rows={qs}
          rowKey={(q) => q.city}
          columns={[
            { label: 'CITY', render: (q) => <CityBadge city={q.city} /> },
            {
              label: 'BUY ORDER',
              render: (q) => <Num value={q.buy_price_max} />,
            },
            {
              label: 'GROSS STACK (999)',
              render: (q) => <Num value={q.buy_price_max * 999} />,
            },
            {
              label: 'GROSS INVENTORY',
              render: (q) => <Num value={q.buy_price_max * load} />,
            },
            {
              label: 'VS CITY AVERAGE',
              render: (q) => (
                <Num
                  value={
                    (q.buy_price_max /
                      stats(qs.map((q) => q.buy_price_max))!.mean -
                      1) *
                    100
                  }
                  suffix="%"
                />
              ),
            },
            {
              label: 'RANK',
              render: (_, i) =>
                i === 0
                  ? 'Best sell city'
                  : i === qs.length - 1
                    ? 'Lowest buy offer'
                    : `#${i + 1}`,
            },
            {
              label: 'OBSERVATION',
              render: (q) => (
                <FreshnessBadge date={q.buy_price_max_date} now={p.now} />
              ),
            },
          ]}
        />
        <p className="footnote">
          Enter yield and premium bonuses from your character. No game mechanics
          are inferred. Proceeds assume the quoted buy order can fill the
          entered quantity; order depth is unknown.
        </p>
      </Panel>
    </>
  );
}
export function Transport(p: ViewProps) {
  const [origin, setOrigin] = useState('Bridgewatch'),
    [dest, setDest] = useState('Thetford'),
    [quantity, setQuantity] = useState(100),
    [capacity, setCapacity] = useState(999),
    [minutes, setMinutes] = useState(15),
    [loss, setLoss] = useState(0),
    [extraRisk, setExtraRisk] = useState(0);
  const buy = p.quotes.find(
    (q) =>
      q.item_id === p.selected &&
      q.city === origin &&
      valid(q, 'sell', p.settings.maxAge || Infinity, p.now),
  );
  const sell = p.quotes.find(
    (q) =>
      q.item_id === p.selected &&
      q.city === dest &&
      valid(q, 'buy', p.settings.maxAge || Infinity, p.now),
  );
  const result =
    buy && sell
      ? transport(
          buy.sell_price_min,
          sell.buy_price_max,
          quantity,
          capacity,
          minutes,
          loss,
          p.settings.tax,
        )
      : null;
  const expected = result
    ? result.expected - (result.cargo * extraRisk) / 100
    : null;
  return (
    <Panel title="Transport calculator" tag="USER-DEFINED RISK">
      <div className="toolbar">
        <ItemLabel
          item={p.item(p.selected)}
          onClick={() => p.openItem(p.selected)}
        />
        <SelectBox
          label="Origin"
          value={origin}
          onChange={setOrigin}
          options={CITIES}
        />
        <span>→</span>
        <SelectBox
          label="Destination"
          value={dest}
          onChange={setDest}
          options={CITIES}
        />
        {buy && <FreshnessBadge date={buy.sell_price_min_date} now={p.now} />} /{' '}
        {sell && <FreshnessBadge date={sell.buy_price_max_date} now={p.now} />}
      </div>
      <div className="form-grid">
        <NumberField
          label="Cargo quantity"
          value={quantity}
          onChange={setQuantity}
          min={1}
        />
        <NumberField
          label="Mount capacity (units of this item)"
          value={capacity}
          onChange={setCapacity}
          min={1}
        />
        <NumberField
          label="Minutes per trip"
          value={minutes}
          onChange={setMinutes}
          min={1}
        />
        <NumberField
          label="Full cargo loss probability % / trip"
          value={loss}
          onChange={setLoss}
          max={100}
          step={0.1}
        />
        <NumberField
          label="Other risk cost % of cargo"
          value={extraRisk}
          onChange={setExtraRisk}
          max={100}
          step={0.1}
        />
      </div>
      {!result ? (
        <Empty
          text="Both route quotes are required"
          detail="Select an item and cities with eligible sell and buy observations. Quotes outside your age limit are excluded."
        />
      ) : (
        <>
          <div className="stats-grid">
            <Stat
              label="CARGO VALUE"
              value={<Num value={result.cargo} />}
              note={`${quantity} units purchased`}
            />
            <Stat
              label="NET PROFIT, NO LOSS"
              value={<Num value={result.profit} />}
              note={`${p.settings.tax}% sales tax`}
            />
            <Stat
              label="EXPECTED NET PROFIT"
              value={<Num value={expected} />}
              tone={(expected || 0) >= 0 ? 'positive' : 'negative'}
              note="Includes entered risk costs"
            />
            <Stat
              label="EXPECTED PROFIT / MIN"
              value={<Num value={(expected || 0) / (result.trips * minutes)} />}
              note={`${result.trips} trips × ${minutes} minutes`}
            />
          </div>
          <div className="quote-facts">
            <div>
              <span>Expected revenue lost to cargo loss</span>
              <Num value={result.expectedLoss} />
            </div>
            <div>
              <span>Expected sunk purchase cost on lost cargo</span>
              <Num value={(result.cargo * loss) / 100} />
            </div>
            <div>
              <span>Expected profit per trip</span>
              <Num value={(expected || 0) / result.trips} />
            </div>
            <div>
              <span>Break-even loss probability</span>
              <Num
                value={
                  result.revenue
                    ? ((result.profit - (result.cargo * extraRisk) / 100) /
                        result.revenue) *
                      100
                    : null
                }
                suffix="%"
              />
            </div>
          </div>
        </>
      )}
      {[origin, dest].some((c) =>
        ['Caerleon', 'Black Market', 'Brecilien'].includes(c),
      ) && (
        <p className="danger-note">
          This destination may require lethal or variable routes. Verify your
          route in game.
        </p>
      )}
      <div className="formula">
        Expected profit = (1 − loss probability) × after-tax sale proceeds −
        purchase cost − other risk cost. Probabilities are your estimates, not
        game telemetry. Capacity is expressed in item units; no mount weight is
        assumed.
      </div>
    </Panel>
  );
}
const EXAMPLE: Recipe = {
  name: 'Your verified recipe',
  output: 'T4_METALBAR',
  outputQuantity: 1,
  ingredients: [{ item: 'T4_ORE', quantity: 1 }],
  source:
    'Replace with your verified recipe source; quantities here are a schema example only',
};
export function Production(p: ViewProps & { refining?: boolean }) {
  const [recipes, setRecipes] = useState<Recipe[]>([]),
    [selected, setSelected] = useState(''),
    [text, setText] = useState(''),
    [error, setError] = useState(''),
    [city, setCity] = useState(p.settings.city),
    [quantity, setQuantity] = useState(1),
    [returns, setReturns] = useState(0),
    [cityBonus, setCityBonus] = useState(0),
    [focus, setFocus] = useState(false),
    [focusReturn, setFocusReturn] = useState(0),
    [focusCost, setFocusCost] = useState(0),
    [station, setStation] = useState(0);
  useEffect(() => {
    const saved = readLocal<Recipe[]>('amt:recipes', []);
    setRecipes(saved);
    setSelected(saved[0]?.name || '');
  }, []);
  const recipe = recipes.find((r) => r.name === selected);
  useEffect(() => {
    if (recipe) {
      const ids = [recipe.output, ...recipe.ingredients.map((i) => i.item)];
      if (ids.some((id) => !p.tracked.includes(id)))
        p.setTracked([...new Set([...p.tracked, ...ids])]);
    }
  }, [recipe, p]);
  const ingredientRows =
    recipe?.ingredients.map((i) => {
      const qs = p.quotes
        .filter(
          (q) =>
            q.item_id === i.item &&
            valid(q, 'sell', p.settings.maxAge || Infinity, p.now),
        )
        .sort((a, b) => a.sell_price_min - b.sell_price_min);
      return { ...i, q: qs.find((q) => q.city === city), cheapest: qs[0] };
    }) || [];
  const prices = Object.fromEntries(
    ingredientRows.map((i) => [i.item, i.q?.sell_price_min || 0]),
  );
  const output = p.quotes.find(
    (q) =>
      q.item_id === recipe?.output &&
      q.city === city &&
      valid(q, 'sell', p.settings.maxAge || Infinity, p.now),
  );
  const effectiveReturn = Math.min(
    99,
    returns + cityBonus + (focus ? focusReturn : 0),
  );
  const result =
    recipe && output
      ? production(
          recipe,
          prices,
          output.sell_price_min,
          quantity,
          effectiveReturn,
          station,
          p.settings.tax,
          p.settings.setupFee,
        )
      : null;
  const noFocus =
    recipe && output
      ? production(
          recipe,
          prices,
          output.sell_price_min,
          quantity,
          Math.min(99, returns + cityBonus),
          station,
          p.settings.tax,
          p.settings.setupFee,
        )
      : null;
  function importRecipes() {
    try {
      const raw = JSON.parse(text);
      const list = Array.isArray(raw) ? raw : [raw];
      if (!list.length || list.length > 100)
        throw new Error('Import between 1 and 100 recipes.');
      for (const r of list) {
        if (
          !r.name ||
          typeof r.source !== 'string' ||
          !r.source.trim() ||
          !/^T\d_[A-Z0-9_]+(?:@[1-4])?$/.test(r.output) ||
          !Number.isFinite(r.outputQuantity) ||
          r.outputQuantity <= 0 ||
          !Array.isArray(r.ingredients) ||
          !r.ingredients.length ||
          r.ingredients.some(
            (i: { item: string; quantity: number }) =>
              !/^T\d_[A-Z0-9_]+(?:@[1-4])?$/.test(i.item) ||
              !Number.isFinite(i.quantity) ||
              i.quantity <= 0,
          )
        )
          throw new Error(
            'Each recipe needs a name, source, output ID, positive output quantity, and positive ingredient quantities.',
          );
      }
      const merged = [
        ...recipes.filter((r) => !list.some((n) => n.name === r.name)),
        ...list,
      ];
      setRecipes(merged);
      setSelected(list[0].name);
      writeLocal('amt:recipes', merged);
      setError('');
      setText('');
      p.notify('Verified recipe import saved locally.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }
  return (
    <>
      <Panel
        title={p.refining ? 'Refining workbench' : 'Crafting workbench'}
        tag="VERIFIED RECIPE ENGINE"
      >
        <p className="settings-help" style={{ paddingTop: 18 }}>
          Import a recipe you have verified. The market API provides prices, not
          authoritative recipes or live return mechanics.{' '}
          {p.refining
            ? 'Supported output families: ore → bars, wood → planks, fiber → cloth, hide → leather, and stone → blocks.'
            : ''}
        </p>
        {recipes.length > 0 && (
          <>
            <div className="toolbar">
              <SelectBox
                label="Recipe"
                value={selected}
                onChange={setSelected}
                options={recipes.map((r) => r.name)}
              />
              <SelectBox
                label="Crafting city"
                value={city}
                onChange={setCity}
                options={CITIES}
              />
              <Toggle checked={focus} onChange={setFocus}>
                Use focus
              </Toggle>
            </div>
            <div className="form-grid">
              <NumberField
                label="Recipe executions"
                value={quantity}
                onChange={setQuantity}
                min={1}
              />
              <NumberField
                label="Base resource return %"
                value={returns}
                onChange={setReturns}
                max={99}
                step={0.1}
              />
              <NumberField
                label="City / crafting return increment (pp)"
                value={cityBonus}
                onChange={setCityBonus}
                max={99}
                step={0.1}
              />
              <NumberField
                label="Focus return increment (pp)"
                value={focusReturn}
                onChange={setFocusReturn}
                max={99}
                step={0.1}
              />
              <NumberField
                label="Focus cost / recipe execution"
                value={focusCost}
                onChange={setFocusCost}
              />
              <NumberField
                label="Station silver / recipe execution"
                value={station}
                onChange={setStation}
              />
            </div>
            <MarketTable
              rows={ingredientRows}
              rowKey={(r) => r.item}
              columns={[
                {
                  label: 'INGREDIENT',
                  render: (r) => (
                    <ItemLabel
                      item={p.item(r.item)}
                      onClick={() => p.openItem(r.item)}
                    />
                  ),
                },
                { label: 'UNITS / RECIPE', render: (r) => r.quantity },
                {
                  label: 'LOCAL ASK',
                  render: (r) => (
                    <>
                      <Num value={r.q?.sell_price_min} />
                      <br />
                      <FreshnessBadge
                        date={r.q?.sell_price_min_date}
                        now={p.now}
                      />
                    </>
                  ),
                },
                {
                  label: 'CHEAPEST SOURCE',
                  render: (r) =>
                    r.cheapest ? (
                      <>
                        <CityBadge city={r.cheapest.city} />{' '}
                        <Num value={r.cheapest.sell_price_min} />
                        <br />
                        <FreshnessBadge
                          date={r.cheapest.sell_price_min_date}
                          now={p.now}
                        />
                      </>
                    ) : (
                      '—'
                    ),
                },
              ]}
            />
            <div className="stats-grid">
              <Stat
                label="EFFECTIVE COST / RECIPE"
                value={<Num value={result?.cost} />}
                note={`${effectiveReturn}% entered return`}
              />
              <Stat
                label="TOTAL PROFIT"
                value={<Num value={result?.profit} />}
                tone={(result?.profit || 0) >= 0 ? 'positive' : 'negative'}
                note={`${quantity} recipe executions`}
              />
              <Stat
                label="BREAK-EVEN SALE / UNIT"
                value={<Num value={result?.breakEven} />}
                note="Includes tax and setup fee"
              />
              <Stat
                label="SILVER / FOCUS"
                value={
                  <Num
                    value={
                      focus && focusCost > 0 && result && noFocus
                        ? (result.profit - noFocus.profit) /
                          (quantity * focusCost)
                        : null
                    }
                  />
                }
                note="Savings relative to no focus"
              />
            </div>
            <div className="quote-facts">
              <div>
                <span>Output sell listing / observation</span>
                <span>
                  <Num value={output?.sell_price_min} />{' '}
                  <FreshnessBadge
                    date={output?.sell_price_min_date}
                    now={p.now}
                  />
                </span>
              </div>
              <div>
                <span>Profit per output unit</span>
                <Num value={result?.perItem} />
              </div>
              <div>
                <span>Margin on cost</span>
                <Num value={result?.margin} suffix="%" />
              </div>
            </div>
            <p className="footnote">
              Recipe source: {recipe?.source}. Entered return increments are
              added and capped at 99%; enter effective game values, not
              unconverted production bonuses. Sale assumes listing at the
              observed ask; execution is not guaranteed.
            </p>
          </>
        )}
        {!recipes.length && (
          <Empty
            text="Add your first verified recipe"
            detail="Import recipe quantities and a source below. We do not ship invented recipes."
          />
        )}
      </Panel>
      <Panel title="Import verified recipes" tag="JSON">
        <div className="recipe-import">
          <p>
            JSON fields: name, source, output (item ID), outputQuantity, and
            ingredients (item / quantity pairs). The schema example is not an
            Albion recipe.
          </p>
          <details>
            <summary>Show schema example</summary>
            <pre>{JSON.stringify(EXAMPLE, null, 2)}</pre>
          </details>
          <textarea
            aria-label="Recipe JSON"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your verified recipe JSON here"
          />
          {error && <span className="negative">{error}</span>}
          <button disabled={!text.trim()} onClick={importRecipes}>
            Validate & import recipes
          </button>
        </div>
      </Panel>
    </>
  );
}
