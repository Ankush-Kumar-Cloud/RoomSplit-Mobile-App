export const COLORS = {
  light: {
    bg:       '#F6F6F3', surface: '#FFFFFF', surface2: '#F0F0EC', surface3: '#E8E8E4',
    border:   '#E2E2DC', border2: '#CACAC3',
    text:     '#18181A', text2: '#65656A', text3: '#9A9A9E',
    accent:   '#1AAD7D', accentBg: '#E0F7EE', accentBd: '#9FE1C8',
    danger:   '#C53030', dangerBg: '#FEF0EE', dangerBd: '#F9A8A8',
    warn:     '#B45309', warnBg: '#FEF3CD', warnBd: '#F6CC6E',
    shadow:   'rgba(0,0,0,0.08)',
  },
  dark: {
    bg:       '#111113', surface: '#1C1C1F', surface2: '#242428', surface3: '#2C2C30',
    border:   '#303036', border2: '#48484E',
    text:     '#EBEBED', text2: '#9898A0', text3: '#5E5E66',
    accent:   '#1FD396', accentBg: '#0A2B1E', accentBd: '#0F5038',
    danger:   '#E05252', dangerBg: '#2A1010', dangerBd: '#6B2020',
    warn:     '#FBBF24', warnBg: '#2A1F06', warnBd: '#7A5208',
    shadow:   'rgba(0,0,0,0.4)',
  },
};

export const CATS = [
  { id:'food',      label:'Food',      icon:'🍛', color:'#1AAD7D', bg:'#E0F7EE', border:'#9FE1C8' },
  { id:'rent',      label:'Rent',      icon:'🏠', color:'#185FA5', bg:'#E6F1FB', border:'#B5D4F4' },
  { id:'util',      label:'Utilities', icon:'⚡', color:'#B45309', bg:'#FEF3CD', border:'#F6CC6E' },
  { id:'grocery',   label:'Grocery',   icon:'🛒', color:'#3B6D11', bg:'#EAF3DE', border:'#C0DD97' },
  { id:'transport', label:'Transport', icon:'🚌', color:'#534AB7', bg:'#EEEDFE', border:'#CECBF6' },
  { id:'health',    label:'Health',    icon:'💊', color:'#993556', bg:'#FBEAF0', border:'#F4C0D1' },
  { id:'fun',       label:'Fun',       icon:'🎬', color:'#993C1D', bg:'#FAECE7', border:'#F5C4B3' },
  { id:'other',     label:'Other',     icon:'📦', color:'#5F5E5A', bg:'#F1EFE8', border:'#D3D1C7' },
];
export const catOf = id => CATS.find(c => c.id === id) || CATS[CATS.length - 1];

export const PAL = [
  { bg:'#E1F5EE', mid:'#1D9E75', dark:'#085041', border:'#9FE1CB', av:'#0F6E56' },
  { bg:'#FAEEDA', mid:'#BA7517', dark:'#412402', border:'#FAC775', av:'#854F0B' },
  { bg:'#EEEDFE', mid:'#7F77DD', dark:'#26215C', border:'#CECBF6', av:'#534AB7' },
  { bg:'#FAECE7', mid:'#D85A30', dark:'#4A1B0C', border:'#F5C4B3', av:'#993C1D' },
  { bg:'#FBEAF0', mid:'#D4537E', dark:'#4B1528', border:'#F4C0D1', av:'#993556' },
  { bg:'#E6F1FB', mid:'#378ADD', dark:'#042C53', border:'#B5D4F4', av:'#185FA5' },
];
export const palOf = (members, uid) => {
  const idx = members.findIndex(m => (m._id||m.id) === (uid?._id||uid));
  return PAL[Math.max(idx,0) % PAL.length];
};
