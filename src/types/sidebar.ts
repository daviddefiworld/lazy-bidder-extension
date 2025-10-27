export interface ExtensionState {
  isActive: boolean;
  currentUrl: string;
  socketConnected: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isAuthenticated: boolean;
}

export type ViewMode = 'login' | 'register' | 'main';

export interface LoginProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: () => void;
}

export interface RegisterProps {
  onRegister: (name: string, email: string, password: string, confirmPassword: string) => Promise<void>;
  onBackToLogin: () => void;
}

export interface HeaderProps {
  userName: string;
}

export interface StatusPanelProps {
  isActive: boolean;
  socketConnected: boolean;
}

export interface ControlPanelProps {
  isActive: boolean;
  onToggle: () => void;
}

export interface UrlNavigationProps {
  currentUrl: string;
  onUrlChange: (url: string) => void;
}

export interface FooterProps {
  onLogout: () => void;
}
