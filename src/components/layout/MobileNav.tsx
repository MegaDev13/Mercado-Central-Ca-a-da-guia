import { LayoutDashboard, ScrollText, Users, Package, Coins, PenLine, Boxes } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const bottomAdmin = [
  { id:'dashboard', icon: LayoutDashboard, label:'Mesa' },
  { id:'sales', icon: ScrollText, label:'Vendas' },
  { id:'stock', icon: Boxes, label:'Estoque' },
  { id:'merchants', icon: Users, label:'Merc.' },
  { id:'treasury', icon: Coins, label:'Tesouro' },
];
const bottomMerchant = [
  { id:'dashboard', icon: LayoutDashboard, label:'Painel' },
  { id:'newficha', icon: PenLine, label:'Nova' },
  { id:'sales', icon: ScrollText, label:'Vendas' },
  { id:'stock', icon: Package, label:'Estoque' },
];

export function MobileNav({current, onNavigate}:{current:string, onNavigate:(id:string)=>void}) {
  const { isAdmin } = useAuth();
  const items = isAdmin ? bottomAdmin : bottomMerchant;
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-sidebar)] border-t border-[var(--border)] flex justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
      {items.map(it=>{
        const active = current===it.id;
        return (
          <button key={it.id} onClick={()=>onNavigate(it.id)} className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg ${active?'text-[#d4af37] bg-[var(--bg-card)]': 'text-[var(--text-muted)]'}`}>
            <it.icon className="w-5 h-5"/>
            <span className="text-[10px] tracking-widest uppercase">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
