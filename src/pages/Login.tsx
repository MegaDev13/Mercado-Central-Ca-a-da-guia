import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Input, Label } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon, Coins, Scroll, Shield, Lock, Mail } from 'lucide-react';

export function LoginPage() {
  const { login, register } = useAuth();
  const { theme, toggle } = useTheme();
  const [mode, setMode] = useState<'login'|'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'merchant'|'admin'>('merchant');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async(e:React.FormEvent)=>{
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (mode==='login') {
        await login(email, password);
      } else {
        if (!name) throw new Error('Informe o nome de mercador');
        await register(email, password, name, role);
      }
    } catch (err:any) {
      setError(err.message || 'Erro');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen w-full flex bg-[var(--bg-app)]">
      {/* Left - medieval art */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-[#0a0a0b] items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(212,175,55,0.15),_transparent_60%),linear-gradient(180deg,#1a1a1e,#0a0a0b)]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`}}/>
        <div className="relative z-10 max-w-lg p-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brass-400 to-brass-600 flex items-center justify-center font-deco text-black text-xl font-bold">R</div>
            <div>
              <div className="font-display text-2xl font-bold tracking-widest text-[#f5f3ef]">RAVENPORT</div>
              <div className="text-[11px] tracking-[0.3em] uppercase text-[#d4af37]/80">Companhia Mercante • 847 E.L.</div>
            </div>
          </div>
          <h1 className="font-display text-4xl leading-[1.1] text-[#f5f3ef] mb-4">O Livro Contábil que sustenta reinos.</h1>
          <p className="text-[#9a9aa0] leading-relaxed mb-8">
            Registre cada moeda. Rastreie cada rota. Audite cada mercador.
            Sistema oficial da companhia que move o comércio de Westeros às Terras Geladas.
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div className="merchant-card p-4">
              <Coins className="w-6 h-6 text-[#d4af37] mb-2"/>
              <div className="text-xs text-[#9a9aa0] uppercase tracking-widest">Receita</div>
              <div className="font-display font-bold">12.4k ouro</div>
            </div>
            <div className="merchant-card p-4">
              <Scroll className="w-6 h-6 text-[#5a7a52] mb-2"/>
              <div className="text-xs text-[#9a9aa0] uppercase tracking-widest">Fichas</div>
              <div className="font-display font-bold">1.842</div>
            </div>
            <div className="merchant-card p-4">
              <Shield className="w-6 h-6 text-[#3d5a73] mb-2"/>
              <div className="text-xs text-[#9a9aa0] uppercase tracking-widest">Mercadores</div>
              <div className="font-display font-bold">23 ativos</div>
            </div>
          </div>

          <div className="mt-10 flex items-center gap-3 text-xs text-[#6a6a70]">
            <div className="h-px flex-1 bg-[#2a2a30]"/>
            <span className="tracking-widest uppercase">Selado com cera vermelha</span>
            <div className="h-px flex-1 bg-[#2a2a30]"/>
          </div>
        </div>

        {/* decorative */}
        <div className="absolute bottom-10 right-10 w-20 h-20 rounded-full bg-gradient-to-br from-red-900 to-[#5d1f2a] shadow-xl flex items-center justify-center border border-[#8b2e3f] animate-wax-stamp">
          <span className="font-deco text-[#f7ecd8] text-xl">✦</span>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex flex-col">
        <div className="flex justify-between items-center p-4 lg:p-6">
          <div className="lg:hidden flex items-center gap-2 font-display font-bold tracking-widest">RAVENPORT</div>
          <button onClick={toggle} className="ml-auto w-9 h-9 rounded-lg border border-[var(--border)] flex items-center justify-center">
            {theme==='dark'?<Sun className="w-4 h-4"/>:<Moon className="w-4 h-4"/>}
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="parchment rounded-[16px] border border-[var(--border)] shadow-2xl overflow-hidden">
              <div className="h-1 w-full bg-gradient-to-r from-[#d4af37] via-[#8a6d16] to-[#d4af37]"/>
              <div className="p-8">
                <h2 className="font-display text-2xl font-bold mb-1">{mode==='login' ? 'Acesso ao Escritório' : 'Registro de Mercador'}</h2>
                <p className="text-sm text-[var(--text-secondary)] mb-6">
                  {mode==='login' ? 'Insira seu selo e chave para abrir o livro.' : 'Solicite um novo selo mercante. O Tesoureiro aprovará.'}
                </p>

                <form onSubmit={submit} className="space-y-4">
                  {mode==='register' && (
                    <div className="space-y-1.5">
                      <Label>Nome de Mercador</Label>
                      <Input value={name} onChange={e=>setName(e.target.value)} placeholder="ex: Bran Crowley" required />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label>Email do Corvo</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]"/>
                      <Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="bran@ravenport.com" className="pl-10" required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Chave (Senha)</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]"/>
                      <Input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" className="pl-10" required />
                    </div>
                  </div>

                  {mode==='register' && (
                    <div className="space-y-1.5">
                      <Label>Tipo de Selo</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={()=>setRole('merchant')} className={`h-10 rounded-lg border text-sm ${role==='merchant' ? 'bg-[var(--bg-card)] border-[var(--border-brass)] text-[var(--text-primary)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>Mercador</button>
                        <button type="button" onClick={()=>setRole('admin')} className={`h-10 rounded-lg border text-sm ${role==='admin' ? 'bg-[var(--bg-card)] border-[var(--border-brass)] text-[var(--text-primary)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>Tesoureiro (Admin)</button>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)]">Admin pode aprovar fichas e ver tesouraria completa.</p>
                    </div>
                  )}

                  {error && <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg p-3">{error}</div>}

                  <Button type="submit" variant="gold" className="w-full h-11" disabled={loading}>
                    {loading ? 'Selando...' : mode==='login' ? 'Abrir Livro Contábil' : 'Solicitar Selo'}
                  </Button>
                </form>

                <div className="mt-6 text-center text-sm">
                  <button onClick={()=>setMode(mode==='login'?'register':'login')} className="text-[var(--text-secondary)] hover:text-[var(--brass)] underline decoration-dotted">
                    {mode==='login' ? 'Não tem selo? Registrar mercador' : 'Já possui selo? Entrar'}
                  </button>
                </div>

                <div className="mt-8 pt-6 border-t border-[var(--border)]">
                  <div className="text-[11px] tracking-widest uppercase text-[var(--text-muted)] mb-2">Acesso rápido (modo local)</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={()=>{setEmail('admin@ravenport.com'); setPassword('admin'); setMode('login');}} className="text-xs p-2 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-card)] text-left">
                      <div className="font-bold">Lorde Tesoureiro</div>
                      <div className="text-[var(--text-muted)]">admin@ravenport.com</div>
                    </button>
                    <button onClick={()=>{setEmail('bran@ravenport.com'); setPassword('bran'); setMode('login');}} className="text-xs p-2 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-card)] text-left">
                      <div className="font-bold">Bran Crowley</div>
                      <div className="text-[var(--text-muted)]">bran@ravenport.com</div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 text-center text-[11px] text-[var(--text-muted)] tracking-widest uppercase">
              Companhia Ravenport • Ano 847 da Era Longa • Código limpo, arquitetura escalável
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
