import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { 
  LayoutDashboard, 
  Shuffle, 
  Users,
  Users2,
  Trophy, 
  Medal,
  Settings,
  Wifi,
  WifiOff,
  Swords,
  BarChart3,
  Gift,
  Calendar,
  MapPin,
  Church,
  Layers,
  FileText,
  LogOut,
  User
} from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useDatabase';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/sorteio', icon: Shuffle, label: 'Sorteio' },
  { to: '/inscritos', icon: Users, label: 'Inscritos' },
  { to: '/equipes', icon: Users2, label: 'Equipes' },
  { to: '/gincanas', icon: Trophy, label: 'Gincanas' },
  { to: '/competicoes', icon: Swords, label: 'Competições' },
  { to: '/premiacao', icon: Gift, label: 'Premiação' },
  { to: '/pontuacao', icon: Medal, label: 'Pontuação' },
  { to: '/podio', icon: Trophy, label: 'Pódio' },
  { to: '/relatorio', icon: BarChart3, label: 'Relatório Pontuação' },
  { to: '/eventos', icon: Calendar, label: 'Eventos' },
  { to: '/distritos', icon: MapPin, label: 'Distritos' },
  { to: '/igrejas', icon: Church, label: 'Igrejas' },
  { to: '/igrejas-inscritas', icon: Church, label: 'Igrejas com inscrições' },
  { to: '/lotes', icon: Layers, label: 'Lotes' },
  { to: '/relatorios-eventos', icon: FileText, label: 'Relatórios' },
  { to: '/configuracoes', icon: Settings, label: 'Configurações' },
];

export function Sidebar() {
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const { user, profile, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
  };

  const userInitials = profile?.nome 
    ? profile.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() || 'U';

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-20 items-center justify-center border-b border-border px-6">
          <div className="flex items-center gap-3">
            <Trophy className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Gincanas</h1>
              <p className="text-xs text-muted-foreground">Sistema de Eventos</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-primary text-primary-foreground glow-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User & Status */}
        <div className="border-t border-border p-4 space-y-3">
          {/* User Info */}
          {user && (
            <div className="flex items-start gap-3 rounded-lg bg-secondary/50 px-3 py-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/20 text-primary text-xs">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-sm font-medium text-foreground break-words leading-tight">
                  {profile?.nome || 'Usuário'}
                </p>
                <p className="text-[11px] text-muted-foreground break-words leading-tight tracking-tight">
                  {user.email}
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleLogout}
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive self-start"
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Online Status */}
          <div className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-3 text-sm',
            isOnline ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
          )}>
            {isOnline ? (
              <>
                <Wifi className="h-4 w-4" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4" />
                <span>Offline</span>
              </>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}




