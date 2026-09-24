import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { AuditSession, AuditItem, Role, Location } from '../types';
import { createClientId } from '../lib/utils';

interface AuditContextType {
  // State
  session: Partial<AuditSession>;
  selectedRole: Role | null;
  selectedStaff: string;
  isSending: boolean;
  progress: number;
  compliance: number;
  isValid: boolean;
  errors: string[];
  
  // Actions
  startNewAudit: (location: Location, auditorId: string) => void;
  setRole: (role: Role | null) => void;
  setStaff: (staff: string) => void;
  updateItem: (question: string, status: AuditItem['status'], comment?: string, photoUrl?: string) => void;
  submitAudit: (webhookUrl: string, userEmail?: string | null) => Promise<void>;
  resetSession: () => void;
}

const AuditContext = createContext<AuditContextType | undefined>(undefined);

export const AuditProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Partial<AuditSession>>({});
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [isSending, setIsSending] = useState(false);

  // Persistence
  useEffect(() => {
    if (session.id) {
      localStorage.setItem('active_audit_session', JSON.stringify({ session, selectedRole, selectedStaff }));
    }
  }, [session, selectedRole, selectedStaff]);

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('active_audit_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSession(parsed.session);
        setSelectedRole(parsed.selectedRole);
        setSelectedStaff(parsed.selectedStaff);
      } catch (e) {
        console.error("Failed to restore session", e);
      }
    }
  }, []);

  const startNewAudit = useCallback((location: Location, auditorId: string) => {
    const newSession: Partial<AuditSession> = {
      id: createClientId(),
      date: new Date().toISOString().split('T')[0],
      location,
      auditorId,
      items: [],
      participants: {
        asesorServicio: '',
        tecnico: '',
        controller: '',
        lavador: '',
        repuestos: '',
      }
    };
    setSession(newSession);
    setSelectedRole(null);
    setSelectedStaff('');
    localStorage.removeItem('active_audit_session');
  }, []);

  const updateItem = useCallback((question: string, status: AuditItem['status'], comment?: string, photoUrl?: string) => {
    setSession(prev => {
      const items = [...(prev.items || [])];
      const index = items.findIndex(i => i.question === question);
      
      const updatedItem = index >= 0 
        ? { ...items[index], status, comment: comment ?? items[index].comment, photoUrl: photoUrl ?? items[index].photoUrl }
        : { 
            id: createClientId(), 
            question, 
            status, 
            category: selectedRole || 'General',
            comment: comment || '',
            photoUrl: photoUrl || '' 
          } as AuditItem;

      if (index >= 0) {
        items[index] = updatedItem;
      } else {
        items.push(updatedItem);
      }
      
      return { ...prev, items };
    });
  }, [selectedRole]);

  const compliance = useMemo(() => {
    const validItems = (session.items || []).filter(i => i.status && i.status !== 'na');
    if (validItems.length === 0) return 0;
    const passed = validItems.filter(i => i.status === 'pass').length;
    return Math.round((passed / validItems.length) * 100);
  }, [session.items]);

  const errors = useMemo(() => {
    const errs: string[] = [];
    if (!selectedRole) errs.push("Debe seleccionar un rol/puesto.");
    if (!selectedStaff) errs.push("Debe seleccionar el personal auditado.");
    
    const failWithoutComment = (session.items || []).filter(i => i.status === 'fail' && !i.comment?.trim());
    if (failWithoutComment.length > 0) {
      errs.push(`${failWithoutComment.length} desvíos no tienen observación.`);
    }
    
    return errs;
  }, [selectedRole, selectedStaff, session.items]);

  const isValid = errors.length === 0 && (session.items || []).length > 0;

  const submitAudit = async (webhookUrl: string, userEmail?: string | null) => {
    void webhookUrl;
    void userEmail;
    if (!isValid || isSending) return;
    
    setIsSending(true);
    try {
      const payload = {
        // payload building logic here...
      };
      
      // Simulación o llamada real a sendAuditToWebhook
      console.log("Submiting payload...", payload);
      
      // Una vez enviado con éxito:
      localStorage.removeItem('active_audit_session');
      // setSession({});
    } catch (error) {
      console.error("Submit failed", error);
      throw error;
    } finally {
      setIsSending(false);
    }
  };

  const value = {
    session,
    selectedRole,
    selectedStaff,
    isSending,
    progress: 0, // Implementar basado en template
    compliance,
    isValid,
    errors,
    startNewAudit,
    setRole: setSelectedRole,
    setStaff: setSelectedStaff,
    updateItem,
    submitAudit,
    resetSession: () => {
      setSession({});
      localStorage.removeItem('active_audit_session');
    },
  };

  return <AuditContext.Provider value={value}>{children}</AuditContext.Provider>;
};

export const useAudit = () => {
  const context = useContext(AuditContext);
  if (!context) throw new Error('useAudit must be used within an AuditProvider');
  return context;
};
