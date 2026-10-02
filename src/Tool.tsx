// Findery: venues log found items with photos; owners describe what they lost and staff match and release it.
import { useEffect, useState } from "react";
import { idbGet, idbSet, shrinkImage } from "./lib/idb";
import { waLink } from "./lib/share";
import { uid, useStored } from "./lib/store";
import { useShared } from "./lib/useShared";
import { addDays, prettyDate, todayISO } from "./lib/time";
import { Section, ShareBox, Stat, Stats } from "./ui/kit";

const T = "findery";
const CATS = ["Phone", "Keys", "Wallet or cards", "Bag", "Clothing", "Glasses", "Jewellery", "Electronics", "Bottle", "Umbrella", "Documents", "Other"];
type Item = { id: string; cat: string; desc: string; colour: string; brand: string; where: string; date: string; photo: boolean; status: "held" | "returned" | "disposed"; returnedTo?: string; returnedOn?: string };
type Venue = { name: string; phone: string; holdDays: number; desk: string };
const SAMPLE: Item[] = [
  { id: "f1", cat: "Phone", desc: "Phone in a clear case with a sticker of a cat", colour: "Black", brand: "Samsung", where: "Changing room B", date: addDays(todayISO(), -2), photo: false, status: "held" },
  { id: "f2", cat: "Keys", desc: "Two keys and a car fob on a red lanyard", colour: "Red", brand: "Peugeot", where: "Reception", date: addDays(todayISO(), -5), photo: false, status: "held" },
  { id: "f3", cat: "Bottle", desc: "Steel water bottle, dented", colour: "Green", brand: "", where: "Spin studio", date: addDays(todayISO(), -40), photo: false, status: "held" },
  { id: "f4", cat: "Clothing", desc: "Grey hoodie size M", colour: "Grey", brand: "Nike", where: "Locker room A", date: addDays(todayISO(), -12), photo: false, status: "returned", returnedTo: "Aziz B.", returnedOn: addDays(todayISO(), -10) },
];
const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9À-ɏ]+/).filter(w => w.length > 2));

function Pic({ id }: { id: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => { idbGet(`${T}:${id}`).then(v => setSrc(v ?? "")); }, [id]);
  return src ? <img src={src} alt="" className="fd-pic" /> : <div className="fd-pic fd-none" />;
}

export default function Findery() {
  const shared = useShared<Venue>();
  const [venue, setVenue] = useStored<Venue>(T, "venue", { name: "FitLife Ennasr", phone: "", holdDays: 30, desk: "Reception, ground floor" });
  const [items, setItems] = useStored<Item[]>(T, "items", SAMPLE);
  const [d, setD] = useState({ cat: "Phone", desc: "", colour: "", brand: "", where: "" });
  const [file, setFile] = useState<File | null>(null);
  const [claim, setClaim] = useState("black samsung phone with a cat sticker, lost it Tuesday near the changing rooms");
  const [release, setRelease] = useState<{ id: string; who: string; idChecked: boolean } | null>(null);
  const [lost, setLost] = useState({ what: "", when: "", name: "" });

  if (shared.data) {
    const v = shared.data;
    return (
      <section className="panel stack" style={{ gap: 12, maxWidth: 560 }}>
        <p className="eyebrow">Lost property</p><h2>Lost something at {v.name}?</h2>
        <label className="field"><span>Describe it: what, colour, brand, anything special</span><textarea className="input" rows={3} value={lost.what} onChange={e => setLost({ ...lost, what: e.target.value })} /></label>
        <div className="row"><label className="field"><span>When and where you think you lost it</span><input className="input" value={lost.when} onChange={e => setLost({ ...lost, when: e.target.value })} /></label><label className="field"><span>Your name</span><input className="input" value={lost.name} onChange={e => setLost({ ...lost, name: e.target.value })} /></label></div>
        <a className="btn primary" style={{ alignSelf: "flex-start" }} aria-disabled={!lost.what.trim()} href={lost.what.trim() ? waLink(`Lost property request for ${v.name}: ${lost.what}. Lost: ${lost.when}. Name: ${lost.name}`, v.phone) : undefined} target="_blank" rel="noreferrer">Send to {v.name}</a>
        <p className="note">We keep found items for {v.holdDays} days at {v.desk}. Bring ID when you collect.</p>
      </section>
    );
  }

  const held = items.filter(i => i.status === "held");
  const expiring = held.filter(i => addDays(i.date, venue.holdDays) <= todayISO());
  const cw = words(claim);
  const matches = claim.trim().length > 3 ? held.map(i => { const iw = words(`${i.cat} ${i.desc} ${i.colour} ${i.brand} ${i.where}`); const hit = [...cw].filter(w => iw.has(w) || [...iw].some(x => x.startsWith(w.slice(0, 5)) && w.length >= 5)); return { i, score: hit.length, hit }; }).filter(m => m.score > 0).sort((a, b) => b.score - a.score).slice(0, 4) : [];
  const add = async (e: React.FormEvent) => { e.preventDefault(); if (!d.desc.trim()) return; const id = uid(); let photo = false; if (file) { await idbSet(`${T}:${id}`, await shrinkImage(file, 800)); photo = true; } setItems([{ id, ...d, desc: d.desc.trim(), date: todayISO(), photo, status: "held" }, ...items]); setD({ ...d, desc: "", colour: "", brand: "" }); setFile(null); };

  return (
    <div className="stack">
      <Section title={`Lost property at ${venue.name}`}>
        <Stats><Stat value={held.length} label="Items held" /><Stat value={items.filter(i => i.status === "returned").length} label="Returned to owners" tone="good" /><Stat value={expiring.length} label={`Held over ${venue.holdDays} days`} tone={expiring.length ? "warn" : undefined} /></Stats>
      </Section>
      <div className="grid2">
        <Section title="Log a found item">
          <form className="stack" style={{ gap: 10 }} onSubmit={add}>
            <div className="row"><label className="field"><span>Type</span><select className="input" value={d.cat} onChange={e => setD({ ...d, cat: e.target.value })}>{CATS.map(c => <option key={c}>{c}</option>)}</select></label><label className="field"><span>Where found</span><input className="input" value={d.where} onChange={e => setD({ ...d, where: e.target.value })} /></label></div>
            <label className="field"><span>Description</span><input className="input" value={d.desc} onChange={e => setD({ ...d, desc: e.target.value })} placeholder="Blue umbrella with a wooden handle" /></label>
            <div className="row" style={{ alignItems: "flex-end" }}><label className="field"><span>Colour</span><input className="input" value={d.colour} onChange={e => setD({ ...d, colour: e.target.value })} /></label><label className="field"><span>Brand</span><input className="input" value={d.brand} onChange={e => setD({ ...d, brand: e.target.value })} /></label><label className="btn small">{file ? "Photo added" : "Photo"}<input type="file" accept="image/*" capture="environment" hidden onChange={e => setFile(e.target.files?.[0] ?? null)} /></label><button className="btn primary" type="submit">Log it</button></div>
          </form>
        </Section>
        <Section title="Someone is asking">
          <label className="field"><span>What they describe</span><textarea className="input" rows={3} value={claim} onChange={e => setClaim(e.target.value)} /></label>
          <div className="stack" style={{ gap: 8, marginTop: 10 }}>{claim.trim() && !matches.length && <p className="empty-note">Nothing matching is being held.</p>}{matches.map(m => <div key={m.i.id} className="fd-match"><strong>{m.i.desc}</strong><span className="note">{m.i.cat} · {m.i.colour} {m.i.brand} · {m.i.where} · {prettyDate(m.i.date)}</span><span className="pill good">Matches: {m.hit.join(", ")}</span><button className="btn small" onClick={() => setRelease({ id: m.i.id, who: "", idChecked: false })}>Release to owner</button></div>)}</div>
          <p className="note" style={{ marginTop: 8 }}>Ask the owner a detail you can see but did not mention, such as the lock screen or what's inside, before releasing.</p>
        </Section>
      </div>
      {release && <Section title="Release">
        <div className="row" style={{ alignItems: "flex-end" }}><label className="field"><span>Owner's full name</span><input className="input" value={release.who} onChange={e => setRelease({ ...release, who: e.target.value })} /></label><label className="check" style={{ paddingBottom: 10 }}><input type="checkbox" checked={release.idChecked} onChange={e => setRelease({ ...release, idChecked: e.target.checked })} />ID checked</label>
          <button className="btn primary" disabled={!release.who.trim() || !release.idChecked} onClick={() => { setItems(items.map(i => i.id === release.id ? { ...i, status: "returned", returnedTo: release.who.trim(), returnedOn: todayISO() } : i)); setRelease(null); }}>Confirm handover</button><button className="btn ghost" onClick={() => setRelease(null)}>Cancel</button></div>
      </Section>}
      <Section title="On the shelf">
        <div className="fd-grid">{held.map(i => <article key={i.id} className="fd-card">{i.photo ? <Pic id={i.id} /> : <div className="fd-pic fd-none"><span>{i.cat}</span></div>}<strong>{i.desc}</strong><span className="note">{i.where} · {prettyDate(i.date)}</span>{addDays(i.date, venue.holdDays) <= todayISO() && <span className="pill warn">Over {venue.holdDays} days</span>}<div className="row" style={{ gap: 4 }}><button className="btn ghost small" onClick={() => setRelease({ id: i.id, who: "", idChecked: false })}>Release</button>{addDays(i.date, venue.holdDays) <= todayISO() && <button className="btn ghost small danger" onClick={() => setItems(items.map(x => x.id === i.id ? { ...x, status: "disposed" } : x))}>Donated</button>}</div></article>)}</div>
      </Section>
      <div className="grid2">
        <Section title="Public “lost something?” page"><ShareBox slug={T} data={venue} label="Copy link for your website" message={`Lost something at ${venue.name}? Tell us here:`} /></Section>
        <Section title="Venue">
          <div className="stack" style={{ gap: 10 }}><div className="row"><label className="field"><span>Venue</span><input className="input" value={venue.name} onChange={e => setVenue({ ...venue, name: e.target.value })} /></label><label className="field"><span>WhatsApp for requests</span><input className="input" value={venue.phone} onChange={e => setVenue({ ...venue, phone: e.target.value })} /></label></div>
            <div className="row"><label className="field"><span>Keep items for (days)</span><input className="input num" value={venue.holdDays} onChange={e => setVenue({ ...venue, holdDays: parseInt(e.target.value) || 30 })} /></label><label className="field"><span>Collect from</span><input className="input" value={venue.desk} onChange={e => setVenue({ ...venue, desk: e.target.value })} /></label></div></div>
        </Section>
      </div>
      <Section title="Returned">{items.filter(i => i.status === "returned").map(i => <p key={i.id} className="note">{i.desc} → {i.returnedTo}, {i.returnedOn && prettyDate(i.returnedOn)}</p>)}</Section>
      <style>{`.fd-match{display:grid;gap:4px;padding:10px;border:1px solid var(--line);border-radius:10px}.fd-match .pill,.fd-match .btn{justify-self:start}.fd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}.fd-card{border:1px solid var(--line);border-radius:10px;padding:10px;display:grid;gap:4px;align-content:start}
      .fd-pic{width:100%;height:110px;object-fit:cover;border-radius:6px}.fd-none{background:var(--sunk);display:grid;place-items:center;font-family:var(--mono);font-size:12px;color:var(--muted)}`}</style>
    </div>
  );
}
