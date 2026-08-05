import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useTheme } from '../../contexts/ThemeContext';
import { LayoutDashboard, ScrollText, Users, Crown, Package, Coins, FileBarChart, Archive, Settings, LogOut, Sun, Moon, ClipboardCheck, PenLine, Shield, Boxes, BoxesIcon } from 'lucide-react';

const menuAdmin = [
  { id:'dashboard', label:'Mesa do Tesoureiro', icon: LayoutDashboard },
  { id:'sales', label:'Livro de Vendas', icon: ScrollText },
  { id:'approvals', label:'Aprovações', icon: ClipboardCheck, badge: true },
  { id:'stock', label:'Almoxarifado (Estoque)', icon: Boxes },
  { id:'merchants', label:'Mercadores', icon: Users },
  { id:'buyers', label:'Compradores', icon: Crown },
  { id:'products', label:'Mercadorias', icon: Package },
  { id:'treasury', label:'Tesouraria', icon: Coins },
  { id:'reports', label:'Relatórios PDF', icon: FileBarChart },
  { id:'archive', label:'Arquivo da Companhia', icon: Archive },
  { id:'settings', label:'Configurações', icon: Settings },
];

const menuMerchant = [
  { id:'dashboard', label:'Meu Painel', icon: LayoutDashboard },
  { id:'newficha', label:'Nova Ficha', icon: PenLine },
  { id:'sales', label:'Minhas Vendas', icon: ScrollText },
  { id:'stock', label:'Estoque', icon: BoxesIcon },
  { id:'treasury', label:'Minha Carteira', icon: Coins },
  { id:'archive', label:'Arquivo', icon: Archive },
];

export function Sidebar({current, onNavigate, collapsed, onToggleCollapse}:{current:string, onNavigate:(id:string)=>void, collapsed:boolean, onToggleCollapse:()=>void}) {
  const { user, logout, isAdmin } = useAuth();
  const { pendingSales, stockStats } = useData();
  const { theme, toggle } = useTheme();
  const menu = isAdmin ? menuAdmin : menuMerchant;

  return (
    <aside className={`${collapsed?'w-[72px]':'w-[280px]'} hidden lg:flex flex-col h-screen sticky top-0 bg-[var(--bg-sidebar)] border-r border-[var(--border)] transition-all duration-300`}>
      <div className="p-5 border-b border-[var(--border)] flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#d4af37] to-[#8a6d16] flex items-center justify-center font-deco text-black font-bold text-lg shadow-lg">R</div>
        {!collapsed && (
          <div className="flex-1 overflow-hidden">
            <div className="font-display font-bold tracking-widest text-sm">RAVENPORT</div>
            <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-muted)]">Companhia Mercante</div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {menu.map(item=>{
          const active = current===item.id;
          const lowStockBadge = item.id==='stock' && stockStats.lowStock.length+stockStats.outOfStock.length>0;
          return (
            <button key={item.id} onClick={()=>onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
                ${active ? 'bg-[var(--bg-card)] border border-[var(--border-brass)] text-[var(--text-primary)] shadow' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]'} 
                ${collapsed?'justify-center':''}`}>
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
              {!collapsed && (item as any).badge && pendingSales.length>0 && (
                <span className="bg-red-900 text-red-100 text-[10px] px-2 py-0.5 rounded-full font-bold">{pendingSales.length}</span>
              )}
              {!collapsed && lowStockBadge && (
                <span className="bg-amber-900 text-amber-100 text-[10px] px-2 py-0.5 rounded-full font-bold">{stockStats.lowStock.length+stockStats.outOfStock.length}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[var(--border)] space-y-2">
        <div className={`flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--bg-card)] ${collapsed?'justify-center':' '}`}>
          <div className="w-8 h-8 rounded-full bg-[var(--bg-input)] flex items-center justify-center font-bold text-xs border border-[var(--border)]">
            {user?.merchant_name?.[0] || user?.email[0].toUpperCase()}
          </div>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <div className="text-sm font-medium truncate">{user?.merchant_name || 'Mercador'}</div>
              <div className="text-[11px] text-[var(--text-muted)] truncate flex items-center gap-1">
                {isAdmin ? <Shield className="w-3 h-3" /> : null} {user?.role} • {user?.email}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={toggle} className="flex-1 h-9 rounded-lg border border-[var(--border)] flex items-center justify-center hover:border-[var(--border-brass)]">
            {theme==='dark' ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
          </button>
          <button onClick={()=>{onToggleCollapse()}} className="flex-1 h-9 rounded-lg border border-[var(--border)] text-xs">
            {collapsed?'→':'←'}
          </button>
          <button onClick={()=>logout()} className="flex-1 h-9 rounded-lg border border-[var(--border)] flex items-center justify-center text-red-300 hover:bg-red-950/30">
            <LogOut className="w-4 h-4"/>
          </button>
        </div>
      </div>
    </aside>
  );
}
