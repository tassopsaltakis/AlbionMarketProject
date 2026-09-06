import fs from 'node:fs';
const path='components/terminal.tsx';let s=fs.readFileSync(path,'utf8');
s=s.replace("import { DEFAULT_SETTINGS", "import { PriceChart } from './price-chart';\nimport { ItemAnalysis,ArbitrageScanner,CityMarkets,Heatmap,Movers } from './market-views';\nimport { Gathering,Transport,Production } from './economy-tools';\nimport { usePersonalTools,Watchlists,SettingsView,SavedScreens } from './personal-tools';\nimport { DEFAULT_SETTINGS");
s=s.replace("const generation=useRef(0);", "const generation=useRef(0);const [toast,setToast]=useState('');const [previous,setPrevious]=useState<Quote[]>([]);const notify=useCallback((message:string)=>{setToast(message);setTimeout(()=>setToast(''),5000);},[]);");
s=s.replace('setQuotes(results.flatMap(r=>r.data));',`const next=results.flatMap(r=>r.data);const snapshotKey='amt:snapshot:'+settings.region+':'+settings.quality;const prev=readLocal<Quote[]>(snapshotKey,[]);const baselineKey=snapshotKey+':baseline';const baselines=readLocal<Quote[]>(baselineKey,[]);for(const q of next){const old=prev.find(r=>r.item_id===q.item_id&&r.city===q.city&&r.quality===q.quality);if(old&&old.sell_price_min_date!==q.sell_price_min_date){const i=baselines.findIndex(r=>r.item_id===q.item_id&&r.city===q.city&&r.quality===q.quality);if(i>=0)baselines[i]=old;else baselines.push(old);}}setPrevious(baselines);writeLocal(baselineKey,baselines);writeLocal(snapshotKey,next);setQuotes(next);`);
s=s.replace("setQuotes([]);setLast('');", "setQuotes([]);setPrevious([]);setLast('');");
s=s.replace("const openItem=(id:string)=>{setSelected(id);setView('Item Explorer');setPalette(false);};", "const openItem=(id:string)=>{setSelected(id);setView('Item Explorer');setPalette(false);};");
const before=' return <SidebarProvider';
s=s.replace(before,` const viewProps={quotes,settings,now,item,selected,openItem,tracked,setTracked,notify};const personal=usePersonalTools(viewProps);const addWatch=(id:string)=>{setTracked(t=>[...new Set([...t,id])]);personal.setWatchlists(w=>w.map((list,i)=>i===0?{...list,items:[...new Set([...list.items,id])]}:list));notify(item(id).name+' added to watchlist.');};
 useEffect(()=>{const context=(document as Document & {modelContext?:{registerTool:(tool:unknown,options:{signal:AbortSignal})=>void}}).modelContext;if(!context)return;const controller=new AbortController();try{context.registerTool({name:'open_market_item',description:'Open an Albion item analysis screen. Changes the selected item.',inputSchema:{type:'object',properties:{itemId:{type:'string'}},required:['itemId'],additionalProperties:false},annotations:{readOnlyHint:false},execute:(input:unknown)=>{const id=(input as {itemId?:string})?.itemId;if(!id||!/^T\\d_[A-Z0-9_]+(?:@[1-4])?$/.test(id))throw new Error('Invalid item ID');setSelected(id);setView('Item Explorer');return {selectedItem:id,view:'Item Explorer'};}},{signal:controller.signal});}catch{/* Experimental WebMCP is optional. */}return()=>controller.abort();},[]);
 return <SidebarProvider`);
const stats='<div className="stats-grid"><Stat label="TRACKED ITEMS"';
s=s.replace(stats,`{['Market Overview','Item Explorer','Price History'].includes(view)&&<><div className="instrument-tabs">{tracked.slice(0,7).map(id=><button className={selected===id?'active':''} key={id} onClick={()=>setSelected(id)}>{item(id).name}<Num value={eligible.filter(q=>q.item_id===id).sort((a,b)=>a.sell_price_min-b.sell_price_min)[0]?.sell_price_min}/></button>)}</div><div className="finance-grid"><PriceChart key={selected+settings.region+view} item={item(selected)} quotes={quotes} settings={settings} now={now} onWatch={addWatch}/><Panel title="Quote summary" tag="SELECTED ITEM"><div className="quote-facts">{(()=>{const qs=eligible.filter(q=>q.item_id===selected);const ask=qs.toSorted((a,b)=>a.sell_price_min-b.sell_price_min)[0];const bid=quotes.filter(q=>q.item_id===selected&&valid(q,'buy',settings.maxAge||Infinity,now)).sort((a,b)=>b.buy_price_max-a.buy_price_max)[0];return <><div><span>Best ask</span><Num value={ask?.sell_price_min}/></div><div><span>Buy in</span>{ask?<CityBadge city={ask.city}/>:<span>—</span>}</div><div><span>Ask observed</span><FreshnessBadge date={ask?.sell_price_min_date} now={now}/></div><div><span>Best bid</span><Num value={bid?.buy_price_max}/></div><div><span>Sell in</span>{bid?<CityBadge city={bid.city}/>:<span>—</span>}</div><div><span>Bid observed</span><FreshnessBadge date={bid?.buy_price_max_date} now={now}/></div><div><span>Cross-city spread</span><Num value={ask&&bid?bid.buy_price_max-ask.sell_price_min:null}/></div><div><span>Eligible ask cities</span><span>{qs.length} / 8</span></div><div><span>Quality</span><span>{settings.quality}</span></div></>;})()}</div><p className="footnote">A price is an observation, not a promise. Compare the age of both sides before trading.</p><div className="form-actions"><button onClick={()=>addWatch(selected)}><Star size={13}/> Add to watchlist</button></div></Panel></div></>}
 {view==='Item Explorer'&&<ItemAnalysis {...viewProps}/>}
 {view==='Price History'&&<ItemAnalysis {...viewProps}/>}
 {view==='Arbitrage Scanner'&&<ArbitrageScanner {...viewProps}/>}
 {view==='City Markets'&&<CityMarkets {...viewProps}/>}
 {view==='Gathering'&&<Gathering {...viewProps}/>}
 {view==='Transport'&&<Transport {...viewProps}/>}
 {view==='Crafting'&&<Production {...viewProps}/>}
 {view==='Refining'&&<Production {...viewProps} refining/>}
 {view==='Movers'&&<Movers {...viewProps} previous={previous}/>}
 {view==='Liquidity'&&<Movers {...viewProps} previous={previous} liquidity/>}
 {view==='Heatmap'&&<Heatmap {...viewProps}/>}
 {view==='Watchlist'&&<Watchlists {...viewProps} personal={personal}/>}
 {view==='Settings'&&<SettingsView settings={settings} setSettings={setSettings} notify={notify}/>}
 {view==='Saved Screens'&&<SavedScreens {...viewProps} setSettings={setSettings} setView={setView}/>}
 {view==='Gold'&&<><PriceChart item={item(selected)} quotes={quotes} settings={settings} now={now} gold/><GoldEstimator settings={settings}/></>}
 {view==='Market Overview'&&<><div className="stats-grid"><Stat label="TRACKED ITEMS"`);
s=s.replace(' </main><footer',` <div className="two-column"><Movers {...viewProps} previous={previous}/><Heatmap {...viewProps}/></div></>}
 </main><footer`);
s=s.replace(' <CommandDialog open=',` {toast&&<div role="status" className="notification">{toast}</div>}
 <CommandDialog open=`);
s=s.replace('<CommandGroup heading="Items">',`<CommandGroup heading="Cities">{CITIES.filter(city=>city.toLowerCase().includes(search.toLowerCase())).map(city=><CommandItem key={city} onSelect={()=>{setSettings(s=>({...s,city}));setView('City Markets');setPalette(false);}}>Open {city} market</CommandItem>)}</CommandGroup><CommandGroup heading="Items">`);
s=s.replace("import { Gathering,Transport,Production }", "import { Gathering,Transport,Production,GoldEstimator }");
fs.writeFileSync(path,s);
