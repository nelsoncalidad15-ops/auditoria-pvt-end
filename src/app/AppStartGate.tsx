import React from "react";

import { LoginView } from "../components/views/LoginView";
import { AuditUserProfile } from "../types";

interface AppStartGateProps {
  isAuthReady: boolean;
  isSessionStarted: boolean;
  appTitle: string;
  isLoggingIn: boolean;
  firebaseEnabled: boolean;
  user: { displayName?: string | null; email?: string | null } | null;
  onSelectProfile: (profile: AuditUserProfile) => void;
  onLogin: () => void;
  children: React.ReactNode;
}

export function AppStartGate({
  isAuthReady,
  isSessionStarted,
  appTitle,
  isLoggingIn,
  firebaseEnabled,
  user,
  onSelectProfile,
  onLogin,
  children,
}: AppStartGateProps) {
  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="w-7 h-7 border-[3px] border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSessionStarted) {
    return (
      <LoginView
        appTitle={appTitle}
        isLoggingIn={isLoggingIn}
        firebaseEnabled={firebaseEnabled}
        user={user}
        onSelectProfile={onSelectProfile}
        onLogin={onLogin}
      />
    );
  }

  return <>{children}</>;
}
