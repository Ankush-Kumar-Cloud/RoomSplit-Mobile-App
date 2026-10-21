export const today  = () => new Date().toISOString().split('T')[0];
export const nowISO = () => new Date().toISOString();

export const monthKey = (offset = 0) => {
  const d = new Date(); d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
};

export const fmtDate = d =>
  new Date(d+'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short' });

export const fmtDateFull = d =>
  new Date(d+'T00:00:00').toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' });

export const fmtTime = iso =>
  new Date(iso).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });

export const fmtMonth = (offset = 0) => {
  const d = new Date(); d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString('en-IN', { month:'short', year:'2-digit' }).replace(' ', " '");
};

export const relTime = iso => {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
};

export const calcSettlement = (memberIds, nameMap, totals) => {
  const total = memberIds.reduce((s,id) => s + (totals[id]||0), 0);
  const share = total / Math.max(memberIds.length, 1);
  const balances = memberIds.map(id => ({ id, name: nameMap[id]||'?', bal:(totals[id]||0)-share, spent:totals[id]||0 }));
  const pos = balances.filter(b=>b.bal>0.5).map(x=>({...x})).sort((a,b)=>b.bal-a.bal);
  const neg = balances.filter(b=>b.bal<-0.5).map(x=>({...x})).sort((a,b)=>a.bal-b.bal);
  const txns=[]; let pi=0,ni=0;
  while(pi<pos.length&&ni<neg.length){
    const amt=Math.min(pos[pi].bal,-neg[ni].bal);
    if(amt>0.5) txns.push({ from:neg[ni].name, fromId:neg[ni].id, to:pos[pi].name, toId:pos[pi].id, amount:Math.round(amt) });
    pos[pi].bal-=amt; neg[ni].bal+=amt;
    if(pos[pi].bal<0.5)pi++; if(neg[ni].bal>-0.5)ni++;
  }
  return { txns, share:Math.round(share), total:Math.round(total), balances };
};

export const filterExpenses = (expenses, { date='', cat='', search='' }={}) =>
  expenses.filter(e => {
    if (date && e.date !== date) return false;
    if (cat  && (e.category||'other') !== cat) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.item?.toLowerCase().includes(q) && !(e.note||'').toLowerCase().includes(q)) return false;
    }
    return true;
  });
