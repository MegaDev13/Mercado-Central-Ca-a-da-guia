import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { DataProvider, useData } from './contexts/DataContext';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { SalesPage } from './pages/Sales';
import { NewFichaPage } from './pages/NewFicha';
import { ApprovalsPage } from './pages/Approvals';
import { MerchantsPage } from './pages/Merchants';
import { BuyersPage } from './pages/Buyers';
import { ProductsPage } from './pages/Products';
import { TreasuryPage } from './pages/Treasury';
import { ReportsPage } from './pages/Reports';
import { ArchivePage } from './pages/Archive';
import { SettingsPage } from './pages/Settings';
import { StockPage } from './pages/Stock';
import { Sidebar } from './components/layout/Sidebar';
import { MobileNav } from './components/layout/MobileNav';

function MainApp() {
  const { user, loading } = useAuth();
  const { syncError } = useData();
  const [current, setCurrent] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)]">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#d4af37] to-[#8a6d16] animate-pulse mx-auto mb-4"/>
        <div className="font-display tracking-widest">Abrindo Livro...</div>
      </div>
    </div>;
  }

  if (!user) return <LoginPage />;

  const renderPage = ()=>{
    switch(current) {
      case 'dashboard': return <DashboardPage onNavigate={setCurrent}/>;
      case 'sales': return <SalesPage/>;
      case 'newficha': return <NewFichaPage/>;
      case 'approvals': return <ApprovalsPage/>;
      case 'stock': return <StockPage/>;
      case 'merchants': return <MerchantsPage/>;
      case 'buyers': return <BuyersPage/>;
      case 'products': return <ProductsPage/>;
      case 'treasury': return <TreasuryPage/>;
      case 'reports': return <ReportsPage/>;
      case 'archive': return <ArchivePage/>;
      case 'settings': return <SettingsPage/>;
      default: return <DashboardPage onNavigate={setCurrent}/>;
    }
  };

  return (
    <div className="min-h-screen flex bg-[var(--bg-app)] text-[var(--text-primary)]">
      <Sidebar current={current} onNavigate={(id)=>{setCurrent(id); setMobileMenu(false);}} collapsed={collapsed} onToggleCollapse={()=>setCollapsed(!collapsed)} />

      {mobileMenu && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setMobileMenu(false)}/>
          <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-[var(--bg-sidebar)] border-r border-[var(--border)] p-4 overflow-auto">
            <div className="flex justify-between items-center mb-6">
              <div className="font-display font-bold">RAVENPORT</div>
              <button onClick={()=>setMobileMenu(false)} className="w-8 h-8 rounded-lg border border-[var(--border)]">✕</button>
            </div>
            <nav className="space-y-1">
              {[
                {id:'dashboard', label:'Mesa do Tesoureiro'},
                {id:'sales', label:'Livro de Vendas'},
                {id:'approvals', label:'Aprovações'},
                {id:'stock', label:'Almoxarifado (Estoque)'},
                {id:'newficha', label:'Nova Ficha'},
                {id:'merchants', label:'Mercadores'},
                {id:'buyers', label:'Compradores'},
                {id:'products', label:'Mercadorias'},
                {id:'treasury', label:'Tesouraria'},
                {id:'reports', label:'Relatórios PDF'},
                {id:'archive', label:'Arquivo'},
                {id:'settings', label:'Configurações'},
              ].map(it=>(
                <button key={it.id} onClick={()=>{setCurrent(it.id); setMobileMenu(false);}} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm ${current===it.id?'bg-[var(--bg-card)] border border-[var(--border-brass)]':'text-[var(--text-secondary)]'}`}>{it.label}</button>
              ))}
            </nav>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="lg:hidden sticky top-0 z-30 bg-[var(--bg-sidebar)] border-b border-[var(--border)] flex items-center justify-between px-4 h-14">
          <button onClick={()=>setMobileMenu(true)} className="w-9 h-9 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center">☰</button>
          <div className="font-display font-bold tracking-widest text-sm">RAVENPORT • {current.toUpperCase()}</div>
          <div className="w-9 h-9 rounded-full bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-xs font-bold">{user.merchant_name?.[0]}</div>
        </div>

        {syncError && (
          <div className="mx-4 mt-3 lg:mx-8 p-3 rounded-lg border border-red-900/60 bg-red-950/40 text-red-200 text-xs flex items-start gap-2">
            <span className="shrink-0">⚠️</span>
            <span><b>Falha ao sincronizar com o banco de dados:</b> {syncError} — os dados podem estar temporariamente indisponíveis. Veja Configurações → Sincronização.</span>
          </div>
        )}

        <main className="flex-1 pb-[80px] lg:pb-0">
          {renderPage()}
        </main>

        <MobileNav current={current} onNavigate={setCurrent} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DataProvider>
          <MainApp/>
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
