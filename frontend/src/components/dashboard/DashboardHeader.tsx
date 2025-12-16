import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { 
  Coins, 
  LogOut, 
  User, 
  Settings, 
  ChevronDown
} from 'lucide-react';
import vibeLogo from '@/assets/vibelets-logo-unified.png';

export const DashboardHeader = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="h-16 flex-shrink-0 bg-background/95 backdrop-blur-sm shadow-lg shadow-foreground/5 px-4 flex items-center justify-between">
      {/* Left - Logo */}
      <div className="flex items-center gap-3">
        <img src={vibeLogo} alt="Vibelets" className="h-7" />
      </div>

      {/* Right - Theme Toggle, Credits & Profile */}
      <div className="flex items-center gap-3">
        {/* Theme Toggle */}
        <ThemeToggle />
        
        {/* Credits Badge - clean static design */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border/50 transition-all duration-300 hover:bg-muted cursor-pointer">
          <Coins className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm text-primary">{user.credits}</span>
          <span className="text-xs text-muted-foreground">credits</span>
        </div>

        {/* Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="flex items-center gap-2 px-2 py-1.5 h-auto hover:bg-muted/50 rounded-xl"
            >
              <Avatar className="h-8 w-8 border border-border">
                <AvatarImage src={user.avatar} />
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-sm font-medium text-foreground leading-tight">
                  {user.name}
                </span>
                <span className="text-xs text-muted-foreground leading-tight">
                  {user.plan}
                </span>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-3 py-2">
              <p className="text-sm font-medium text-foreground">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer">
              <User className="w-4 h-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">
              <Coins className="w-4 h-4 mr-2" />
              <span className="flex-1">Credits</span>
              <span className="text-xs text-primary font-medium">{user.credits}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
