/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from "react";
import { 
  ClipboardCheck, 
  MapPin, 
  User, 
  Calendar as CalendarIcon, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  XCircle, 
  MinusCircle,
  Camera,
  Save,
  History,
  Plus,
  ArrowLeft,
  Search,
  Check,
  LogOut,
  LogIn,
  UserCheck,
  Wrench,
  ShieldCheck,
  Droplets,
  FileCheck,
  Package,
  Truck,
  ClipboardList,
  ChevronDown,
  FileText,
  BarChart3,
  Settings,
  LayoutDashboard,
  TrendingUp,
  Users,
  Target,
  TrendingDown,
  AlertCircle,
  Clock,
  Download,
  Filter,
  MoreVertical
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  Cell 
} from 'recharts';
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";
import { 
  LOCATIONS, 
  AUDITORS, 
  STAFF, 
  AUDIT_QUESTIONS 
} from "./constants";
import { Role, AuditItem, AuditSession, Location } from "./types";
import { 
  auth, 
  db, 
  googleProvider, 
  handleFirestoreError, 
  OperationType 
} from "./firebase";
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from "firebase/auth";
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  Timestamp 
} from "firebase/firestore";
import Papa from "papaparse";

function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [error, setError] = React.useState<any>(null);

  React.useEffect(() => {
    const handleError = (e: ErrorEvent) => setError(e.error);
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (error) {
    let errorMessage = "Ocurrió un error inesperado.";
    try {
      const parsed = JSON.parse(error.message);
      if (parsed.error && parsed.error.includes("insufficient permissions")) {
        errorMessage = "Error de permisos: No tienes autorización para realizar esta operación.";
      }
    } catch (e) {
      errorMessage = error.message || errorMessage;
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-red-50 text-center">
        <div className="space-y-4 max-w-sm">
          <XCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="text-xl font-bold text-red-900">Algo salió mal</h1>
          <p className="text-red-700 text-sm">{errorMessage}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-red-600 text-white px-6 py-2 rounded-xl font-bold"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

interface AuditItemRowProps {
  question: string;
  index: number;
  item?: AuditItem;
  onStatusToggle: (status: "pass" | "fail" | "na") => void;
  onCommentUpdate: (comment: string) => void;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl space-y-6"
          >
            <div className="space-y-2 text-center">
              <h3 className="text-xl font-black text-gray-900 leading-tight">{title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{message}</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={onClose}
                className="flex-1 py-4 rounded-2xl font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className="flex-1 py-4 rounded-2xl font-black text-white bg-blue-600 shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
              >
                Confirmar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const AuditItemRow: React.FC<AuditItemRowProps> = ({ 
  question, 
  index, 
  item, 
  onStatusToggle, 
  onCommentUpdate 
}) => {
  const [showComment, setShowComment] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "bg-white rounded-3xl p-6 shadow-sm border transition-all duration-300 space-y-4",
        item?.status ? "border-gray-200" : "border-gray-100 ring-1 ring-gray-50"
      )}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md uppercase tracking-tighter">
              #{index + 1}
            </span>
            {item?.status && (
              <motion.span 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={cn(
                  "w-2 h-2 rounded-full",
                  item.status === "pass" ? "bg-green-500" : 
                  item.status === "fail" ? "bg-red-500" : "bg-gray-400"
                )}
              />
            )}
          </div>
          <p className="font-bold text-gray-800 leading-snug text-sm md:text-base">{question}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => onStatusToggle("pass")}
          className={cn(
            "flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-2xl border-2 transition-all active:scale-95",
            item?.status === "pass" 
              ? "bg-green-500 border-green-500 text-white shadow-lg shadow-green-100" 
              : "bg-white border-gray-100 text-gray-400 hover:border-green-200 hover:text-green-500"
          )}
        >
          <CheckCircle2 className={cn("w-5 h-5", item?.status === "pass" ? "text-white" : "")} />
          <span className="text-[10px] font-black uppercase tracking-tight">Cumple</span>
        </button>
        <button
          onClick={() => onStatusToggle("fail")}
          className={cn(
            "flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-2xl border-2 transition-all active:scale-95",
            item?.status === "fail" 
              ? "bg-red-500 border-red-500 text-white shadow-lg shadow-red-100" 
              : "bg-white border-gray-100 text-gray-400 hover:border-red-200 hover:text-red-500"
          )}
        >
          <XCircle className={cn("w-5 h-5", item?.status === "fail" ? "text-white" : "")} />
          <span className="text-[10px] font-black uppercase tracking-tight">No Cumple</span>
        </button>
        <button
          onClick={() => onStatusToggle("na")}
          className={cn(
            "flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-2xl border-2 transition-all active:scale-95",
            item?.status === "na" 
              ? "bg-gray-800 border-gray-800 text-white shadow-lg shadow-gray-200" 
              : "bg-white border-gray-100 text-gray-400 hover:border-gray-300 hover:text-gray-600"
          )}
        >
          <MinusCircle className={cn("w-5 h-5", item?.status === "na" ? "text-white" : "")} />
          <span className="text-[10px] font-black uppercase tracking-tight">N/A</span>
        </button>
      </div>

      <div className="flex gap-2 pt-2">
        <button 
          onClick={() => setShowComment(!showComment)}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all",
            item?.comment || showComment 
              ? "bg-blue-50 text-blue-600 ring-1 ring-blue-100" 
              : "bg-gray-50 text-gray-400 hover:bg-gray-100"
          )}
        >
          <History className="w-3.5 h-3.5" />
          {item?.comment ? "Ver Observación" : "Agregar Nota"}
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-50 text-gray-400 text-[10px] font-bold uppercase tracking-wider hover:bg-gray-100 transition-all">
          <Camera className="w-3.5 h-3.5" />
          Adjuntar Foto
        </button>
      </div>

      <AnimatePresence>
        {(showComment || item?.comment) && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-2">
              <textarea 
                value={item?.comment || ""}
                onChange={(e) => onCommentUpdate(e.target.value)}
                placeholder="Escribe aquí las observaciones para este ítem..."
                className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-xs focus:ring-0 focus:border-blue-200 h-24 resize-none transition-all"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

function AuditApp() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [view, setView] = useState<"dashboard" | "home" | "setup" | "audit" | "history" | "reports">("dashboard");
  const [isSyncing, setIsSyncing] = useState(false);
  const [session, setSession] = useState<Partial<AuditSession>>({
    date: new Date().toISOString().split("T")[0],
    items: []
  });
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [history, setHistory] = useState<AuditSession[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAudit, setSelectedAudit] = useState<AuditSession | null>(null);
  const [reportFilter, setReportFilter] = useState({
    role: "Ordenes" as Role,
    staff: "",
    month: new Date().toISOString().slice(0, 7) // YYYY-MM
  });
  const [webhookUrl, setWebhookUrl] = useState<string>(localStorage.getItem("webhookUrl") || "https://script.google.com/macros/s/AKfycbxUbxbHYP4UIiyajM_6IVNfsFMgXEpxsvMmwyisqoo4_8lBxNzcMiPyXftxheyh7Q04/exec");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Mock data for charts if no history exists
  const chartData = history.length > 0 
    ? history.slice(-7).map(h => ({ name: h.date.split("-")[2], score: h.totalScore }))
    : [
        { name: '01', score: 85 },
        { name: '05', score: 92 },
        { name: '10', score: 78 },
        { name: '15', score: 88 },
        { name: '20', score: 95 },
        { name: '25', score: 90 },
        { name: '30', score: 94 },
      ];

  const categoryData = [
    { name: 'Mecánica', value: 92, color: '#3B82F6' },
    { name: 'Lavadero', value: 88, color: '#10B981' },
    { name: 'Ordenes', value: 95, color: '#F59E0B' },
  ];

  const exportToCSV = () => {
    if (history.length === 0) return;
    
    const data = history.flatMap(session => 
      session.items.map(item => ({
        Fecha: session.date,
        Ubicacion: session.location,
        Auditor: AUDITORS.find(a => a.id === session.auditorId)?.name || "N/A",
        Puesto: session.role || item.category,
        Personal: session.staffName || "N/A",
        OR: session.orderNumber || "N/A",
        Pregunta: item.question,
        Estado: item.status === "pass" ? "Cumple" : item.status === "fail" ? "No Cumple" : "N/A",
        Observacion: item.comment || "",
        PuntajeTotal: session.totalScore + "%",
        NotasGenerales: session.notes || ""
      }))
    );

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `auditorias_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Firestore History Listener
  useEffect(() => {
    if (!user || !isAuthReady) return;

    const q = query(collection(db, "audits"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const audits = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as AuditSession[];
      setHistory(audits);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "audits");
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error.code !== 'auth/cancelled-popup-request' && error.code !== 'auth/popup-closed-by-user') {
        console.error("Login failed:", error);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setView("home");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const saveToFirestore = async (newSession: AuditSession) => {
    try {
      await addDoc(collection(db, "audits"), {
        ...newSession,
        createdAt: Timestamp.now(),
        userEmail: user?.email
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "audits");
    }
  };

  const startNewAudit = () => {
    setSession({
      id: crypto.randomUUID(),
      date: new Date().toISOString().split("T")[0],
      items: []
    });
    setView("setup");
  };

  const handleSetupSubmit = () => {
    if (session.auditorId && session.location) {
      setView("audit");
    }
  };

  const calculateCurrentScore = () => {
    if (!session.items || session.items.length === 0) return 0;
    const validItems = session.items.filter(i => i.status !== "na");
    if (validItems.length === 0) return 0;
    const passItems = validItems.filter(i => i.status === "pass");
    return Math.round((passItems.length / validItems.length) * 100);
  };

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleAuditSubmit = () => {
    if (!selectedRole) return;
    
    if (session.items.length < AUDIT_QUESTIONS[selectedRole].length) {
      setShowConfirmModal(true);
      return;
    }
    submitAudit();
  };

  const submitAudit = () => {
    if (session.items && session.items.length > 0) {
      const validItems = session.items.filter(i => i.status !== "na");
      const totalScore = validItems.length > 0 
        ? (session.items.filter(i => i.status === "pass").length / validItems.length) * 100 
        : 0;
      
      const completeSession: AuditSession = {
        ...session as AuditSession,
        staffName: selectedStaff,
        role: selectedRole!,
        totalScore: Math.round(totalScore)
      };
      
      saveToFirestore(completeSession);
      
      // Sync with Google Sheets if webhook is configured
      if (webhookUrl) {
        fetch(webhookUrl, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(completeSession)
        }).catch(err => console.error("Sync error:", err));
      }

      setView("home");
      setSelectedRole(null);
      setSelectedStaff("");
    }
  };

  const toggleItemStatus = (question: string, status: "pass" | "fail" | "na") => {
    const existingIndex = session.items?.findIndex(i => i.question === question) ?? -1;
    const newItems = [...(session.items ?? [])];
    
    if (existingIndex >= 0) {
      newItems[existingIndex] = { ...newItems[existingIndex], status };
    } else {
      newItems.push({
        id: crypto.randomUUID(),
        question,
        category: selectedRole!,
        status,
        comment: ""
      });
    }
    
    setSession({ ...session, items: newItems });
  };

  const updateItemComment = (question: string, comment: string) => {
    const existingIndex = session.items?.findIndex(i => i.question === question) ?? -1;
    const newItems = [...(session.items ?? [])];
    
    if (existingIndex >= 0) {
      newItems[existingIndex] = { ...newItems[existingIndex], comment };
    } else {
      newItems.push({
        id: crypto.randomUUID(),
        question,
        category: selectedRole!,
        status: "na",
        comment
      });
    }
    
    setSession({ ...session, items: newItems });
  };

  const syncData = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vTEM5qFE2lZaFjep7bEG2uAlP4QcALYW2F7HZGqc-SEVk0_-VG6ojhZy3N1LcveK9qYhC3dOMZYtiWS/pub?output=csv");
      const csvText = await response.text();
      Papa.parse(csvText, {
        complete: (results) => {
          console.log("Parsed CSV:", results.data);
          setTimeout(() => setIsSyncing(false), 1000);
        }
      });
    } catch (error) {
      console.error("Sync failed:", error);
      setIsSyncing(false);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-[#1A1A1A] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans flex overflow-hidden">
      {/* Sidebar - Desktop Only */}
      <aside className={cn(
        "hidden flex-col w-72 bg-slate-900 text-white h-screen sticky top-0 z-50 shadow-2xl transition-all duration-500",
        (view === "dashboard" || view === "history" || view === "reports") ? "lg:flex" : "lg:hidden"
      )}>
        <div className="p-8 flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-2xl shadow-lg shadow-blue-500/20">
            <ClipboardCheck className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-black text-lg tracking-tight leading-none">AUDIT<span className="text-blue-500">PRO</span></h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Postventa v2.0</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          {[
            { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { id: "home", label: "Nueva Auditoría", icon: Plus },
            { id: "history", label: "Historial", icon: History },
            { id: "reports", label: "Reportes KPI", icon: BarChart3 },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id as any)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all group",
                view === item.id 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 transition-transform group-hover:scale-110",
                view === item.id ? "text-white" : "text-slate-500"
              )} />
              {item.label}
              {view === item.id && (
                <motion.div 
                  layoutId="activeTab"
                  className="ml-auto w-1.5 h-1.5 bg-white rounded-full"
                />
              )}
            </button>
          ))}
          
          <div className="pt-8 pb-4 px-4">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Administración</p>
          </div>
          
          <button className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-all opacity-50 cursor-not-allowed">
            <Users className="w-5 h-5 text-slate-500" />
            Gestión Personal
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-all opacity-50 cursor-not-allowed">
            <Settings className="w-5 h-5 text-slate-500" />
            Configuración
          </button>
        </nav>

        <div className="p-6 mt-auto">
          {user ? (
            <div className="bg-slate-800/50 rounded-3xl p-4 border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-sm shadow-lg shadow-blue-600/20">
                  {user.displayName?.charAt(0) || "U"}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-black text-white truncate">{user.displayName}</p>
                  <p className="text-[10px] font-bold text-slate-500 truncate">{user.email}</p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-700 hover:bg-red-500/10 hover:text-red-500 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              >
                <LogOut className="w-4 h-4" />
                Cerrar Sesión
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 transition-all active:scale-95"
            >
              Iniciar Sesión
            </button>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Header - Mobile & Desktop Top Bar */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 sticky top-0 z-40">
          <div className={cn(
            "mx-auto flex items-center justify-between",
            view === "dashboard" ? "max-w-7xl" : 
            (view === "home" || view === "audit" || view === "setup") ? "max-w-md" :
            "max-w-md lg:max-w-none"
          )}>
            <div className={cn(
              "flex items-center gap-3",
              (view === "home" || view === "audit" || view === "setup") ? "flex" : "lg:hidden flex"
            )}>
              <div className="bg-blue-600 p-2 rounded-xl">
                <ClipboardCheck className="text-white w-5 h-5" />
              </div>
              <h1 className="font-black text-sm tracking-tight leading-none uppercase">AuditPro</h1>
            </div>
            
            <div className={cn(
              "hidden",
              (view === "dashboard" || view === "history" || view === "reports") ? "lg:block" : "lg:hidden"
            )}>
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                {view === "dashboard" && "Resumen Ejecutivo"}
                {view === "home" && "Nueva Inspección"}
                {view === "history" && "Registro de Auditorías"}
                {view === "reports" && "Análisis de Datos"}
              </h2>
            </div>

            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-[10px] font-black">
                    {user.displayName?.charAt(0)}
                  </div>
                  <span className="text-xs font-bold text-slate-600 hidden sm:block">{user.displayName?.split(" ")[0]}</span>
                </div>
              )}
              <div className={cn(
                "w-px h-6 bg-slate-200",
                (view === "home" || view === "audit" || view === "setup") ? "flex" : "lg:hidden flex"
              )} />
              {!user && (
                <button 
                  onClick={handleLogin}
                  className={cn(
                    "p-2 text-slate-400 hover:text-blue-600 transition-colors",
                    (view === "home" || view === "audit" || view === "setup") ? "flex" : "lg:hidden flex"
                  )}
                >
                  <LogIn className="w-6 h-6" />
                </button>
              )}
            </div>
          </div>
        </header>

        <main className={cn(
          "p-4 md:p-8 transition-all duration-500",
          view === "dashboard" ? "max-w-7xl mx-auto w-full" : 
          (view === "home" || view === "audit" || view === "setup") ? "max-w-md mx-auto w-full pb-32" :
          "max-w-md mx-auto w-full lg:max-w-4xl lg:mx-0"
        )}>
          <AnimatePresence mode="wait">
          {view === "dashboard" && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8 pt-4"
            >
              {/* Desktop Header Section */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-2">
                  <h2 className="text-4xl font-black text-slate-900 leading-tight tracking-tight">Quality Control</h2>
                  <p className="text-slate-500 font-medium text-lg">Panel de Gestión de Calidad Postventa</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setView("home")}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
                  >
                    <Plus className="w-5 h-5" />
                    Nueva Auditoría
                  </button>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: "Total Auditorías", value: history.length, icon: ClipboardList, color: "blue" },
                  { label: "Promedio General", value: `${Math.round(history.reduce((acc, h) => acc + h.totalScore, 0) / (history.length || 1))}%`, icon: TrendingUp, color: "emerald" },
                  { label: "Personal Activo", value: "12", icon: Users, color: "indigo" },
                  { label: "Meta Mensual", value: "95%", icon: Target, color: "amber" },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg",
                      stat.color === "blue" && "bg-blue-50 text-blue-600 shadow-blue-50",
                      stat.color === "emerald" && "bg-emerald-50 text-emerald-600 shadow-emerald-50",
                      stat.color === "indigo" && "bg-indigo-50 text-indigo-600 shadow-indigo-50",
                      stat.color === "amber" && "bg-amber-50 text-amber-600 shadow-amber-50",
                    )}>
                      <stat.icon className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                      <p className="text-2xl font-black text-slate-900">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-slate-900">Tendencia de Calidad</h3>
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <div className="w-2 h-2 bg-blue-600 rounded-full" />
                      Puntaje %
                    </div>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#94A3B8', fontSize: 12, fontWeight: 600 }}
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#94A3B8', fontSize: 12, fontWeight: 600 }}
                          domain={[0, 100]}
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 800 }}
                        />
                        <Area type="monotone" dataKey="score" stroke="#3B82F6" strokeWidth={4} fillOpacity={1} fill="url(#colorScore)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                  <h3 className="text-xl font-black text-slate-900">Por Categoría</h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryData} layout="vertical">
                        <XAxis type="number" hide />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#1E293B', fontSize: 12, fontWeight: 800 }}
                          width={80}
                        />
                        <Tooltip 
                          cursor={{ fill: '#F8FAFC' }}
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 800 }}
                        />
                        <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={30}>
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-4">
                    {categoryData.map((cat, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                          <span className="text-sm font-bold text-slate-600">{cat.name}</span>
                        </div>
                        <span className="text-sm font-black text-slate-900">{cat.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-slate-200">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32" />
                  <div className="relative z-10 space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
                      <span className="text-xs font-black uppercase tracking-widest opacity-60">Sincronización en la Nube</span>
                    </div>
                    <h4 className="text-3xl font-black leading-tight">Gestión Profesional de Auditorías</h4>
                    <p className="text-slate-400 text-lg font-medium leading-relaxed max-w-md">
                      Tus datos se sincronizan automáticamente con Google Sheets para un análisis profundo de KPIs.
                    </p>
                    <div className="pt-4 flex items-center gap-4">
                      <div className="flex -space-x-3">
                        {[1,2,3].map(i => (
                          <div key={i} className="w-10 h-10 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[10px] font-bold">
                            U{i}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs font-bold text-slate-500">+12 auditores activos hoy</p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-600 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-blue-200">
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full -ml-32 -mb-32" />
                  <div className="relative z-10 space-y-6">
                    <LayoutDashboard className="w-12 h-12 text-white/40" />
                    <h4 className="text-3xl font-black leading-tight">Optimizado para Móvil</h4>
                    <p className="text-blue-100 text-lg font-medium leading-relaxed">
                      Realiza auditorías en el taller directamente desde tu celular con nuestra interfaz táctil optimizada.
                    </p>
                    <button 
                      onClick={() => setView("home")}
                      className="px-8 py-4 bg-white text-blue-600 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-900/20 hover:scale-105 transition-transform"
                    >
                      Comenzar Ahora
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === "home" && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >


              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] p-8 shadow-xl shadow-blue-100 text-center space-y-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                  <div className="absolute -top-10 -left-10 w-40 h-40 bg-white rounded-full blur-3xl" />
                  <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white rounded-full blur-3xl" />
                </div>
                
                <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto ring-1 ring-white/30">
                  <ClipboardCheck className="w-10 h-10 text-white" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-white tracking-tight">Nueva Auditoría</h2>
                  <p className="text-blue-100 text-sm font-medium">Control de calidad postventa rápido y eficiente.</p>
                </div>

                <div className="space-y-3 pt-2">
                  <button 
                    onClick={startNewAudit}
                    disabled={isLoggingIn}
                    className={cn(
                      "w-full bg-white text-blue-700 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-blue-50 transition-all active:scale-95 shadow-lg",
                      isLoggingIn && "opacity-70 cursor-not-allowed"
                    )}
                  >
                    <Plus className="w-5 h-5" />
                    Iniciar Ahora
                  </button>
                  
                  <button 
                    onClick={syncData}
                    disabled={isSyncing}
                    className="w-full bg-blue-800/30 text-white border border-white/10 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-800/50 transition-all active:scale-95 text-[10px] uppercase tracking-widest"
                  >
                    <div className={cn("w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin", !isSyncing && "hidden")} />
                    {isSyncing ? "Sincronizando..." : "Sincronizar Datos"}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="font-bold text-gray-900">Historial Reciente</h3>
                  <button 
                    onClick={() => setView("history")}
                    className="text-sm text-gray-500 font-medium"
                  >
                    Ver todo
                  </button>
                </div>
                
                {!user ? (
                  <div className="bg-white rounded-2xl p-6 border border-dashed border-gray-300 text-center">
                    <p className="text-gray-400 text-sm italic">Inicia sesión para ver tu historial.</p>
                  </div>
                ) : history.length === 0 ? (
                  <div className="bg-white rounded-2xl p-6 border border-dashed border-gray-300 text-center">
                    <p className="text-gray-400 text-sm">No hay auditorías registradas aún.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.slice(0, 3).map((item) => (
                      <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg",
                            item.totalScore >= 90 ? "bg-green-50 text-green-600" : 
                            item.totalScore >= 70 ? "bg-yellow-50 text-yellow-600" : "bg-red-50 text-red-600"
                          )}>
                            {item.totalScore}%
                          </div>
                          <div>
                            <p className="font-bold text-sm">{item.location} - {item.date}</p>
                            <p className="text-xs text-gray-500">{item.items.length} ítems auditados</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-300" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === "setup" && (
            <motion.div 
              key="setup"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="space-y-4">
                <h2 className="text-2xl font-bold">Configuración</h2>
                <p className="text-gray-500 text-sm">Define los parámetros básicos de la auditoría.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">Auditor</label>
                  <div className="grid grid-cols-1 gap-2">
                    {AUDITORS.map(auditor => (
                      <button
                        key={auditor.id}
                        onClick={() => setSession({ ...session, auditorId: auditor.id })}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-2xl border transition-all",
                          session.auditorId === auditor.id 
                            ? "border-[#1A1A1A] bg-[#1A1A1A] text-white" 
                            : "border-gray-200 bg-white text-gray-600"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <User className="w-5 h-5" />
                          <span className="font-semibold">{auditor.name}</span>
                        </div>
                        {session.auditorId === auditor.id && <Check className="w-5 h-5" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">Ubicación</label>
                  <div className="grid grid-cols-2 gap-2">
                    {LOCATIONS.map(loc => (
                      <button
                        key={loc}
                        onClick={() => setSession({ ...session, location: loc as Location })}
                        className={cn(
                          "flex items-center justify-center gap-2 p-4 rounded-2xl border transition-all",
                          session.location === loc 
                            ? "border-[#1A1A1A] bg-[#1A1A1A] text-white" 
                            : "border-gray-200 bg-white text-gray-600"
                        )}
                      >
                        <MapPin className="w-5 h-5" />
                        <span className="font-semibold">{loc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">Fecha</label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      type="date" 
                      value={session.date}
                      onChange={(e) => setSession({ ...session, date: e.target.value })}
                      className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl font-semibold focus:outline-none focus:ring-2 focus:ring-black/5"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">Número de Orden (OR)</label>
                  <div className="relative">
                    <ClipboardList className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Ej: 259132"
                      value={session.orderNumber || ""}
                      onChange={(e) => setSession({ ...session, orderNumber: e.target.value })}
                      className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl font-semibold focus:outline-none focus:ring-2 focus:ring-black/5"
                    />
                  </div>
                </div>
              </div>

              <button 
                onClick={handleSetupSubmit}
                disabled={!session.auditorId || !session.location}
                className="w-full bg-[#1A1A1A] text-white py-4 rounded-2xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed mt-8"
              >
                Continuar
              </button>
            </motion.div>
          )}

          {view === "audit" && (
            <motion.div 
              key="audit"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {!selectedRole ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold">Seleccionar Puesto</h2>
                    <p className="text-gray-500 text-sm">Elige el área o puesto que deseas auditar.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.keys(AUDIT_QUESTIONS).map((role) => (
                      <button
                        key={role}
                        onClick={() => setSelectedRole(role as Role)}
                        className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-3 group hover:border-blue-200 hover:shadow-md transition-all active:scale-95"
                      >
                        <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                          {role.includes("Asesor") && <UserCheck className="w-6 h-6 text-gray-400 group-hover:text-blue-500" />}
                          {role.includes("Técnico") && <Wrench className="w-6 h-6 text-gray-400 group-hover:text-blue-500" />}
                          {role.includes("Jefe") && <ShieldCheck className="w-6 h-6 text-gray-400 group-hover:text-blue-500" />}
                          {role.includes("Lavadero") && <Droplets className="w-6 h-6 text-gray-400 group-hover:text-blue-500" />}
                          {role.includes("Garantía") && <FileCheck className="w-6 h-6 text-gray-400 group-hover:text-blue-500" />}
                          {role.includes("Repuestos") && <Package className="w-6 h-6 text-gray-400 group-hover:text-blue-500" />}
                          {role.includes("Pre Entrega") && <Truck className="w-6 h-6 text-gray-400 group-hover:text-blue-500" />}
                          {role.includes("Ordenes") && <FileText className="w-6 h-6 text-gray-400 group-hover:text-blue-500" />}
                          {!["Asesor", "Técnico", "Jefe", "Lavadero", "Garantía", "Repuestos", "Pre Entrega", "Ordenes"].some(k => role.includes(k)) && (
                            <ClipboardList className="w-6 h-6 text-gray-400 group-hover:text-blue-500" />
                          )}
                        </div>
                        <span className="font-bold text-gray-800 text-xs text-center leading-tight">{role}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="sticky top-0 z-20 bg-[#F9F9F9] pt-4 pb-2 -mx-4 px-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setSelectedRole(null)}
                          className="p-2 -ml-2 text-gray-400 hover:text-gray-900 bg-white rounded-full shadow-sm border border-gray-100"
                        >
                          <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                          <h2 className="text-lg font-bold leading-tight">{selectedRole}</h2>
                          <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Auditoría en curso</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black text-gray-900 leading-none">
                          {Math.round((session.items.length / AUDIT_QUESTIONS[selectedRole].length) * 100)}%
                        </div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Progreso</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(session.items.length / AUDIT_QUESTIONS[selectedRole].length) * 100}%` }}
                          className="h-full bg-blue-500 rounded-full"
                        />
                      </div>
                      <div className="flex justify-between items-center px-1">
                        <div className="flex gap-3">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-[10px] font-bold text-gray-500">{session.items.filter(i => i.status === 'pass').length}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-[10px] font-bold text-gray-500">{session.items.filter(i => i.status === 'fail').length}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-gray-400" />
                            <span className="text-[10px] font-bold text-gray-500">{session.items.filter(i => i.status === 'na').length}</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">
                          {session.items.length} de {AUDIT_QUESTIONS[selectedRole].length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {STAFF[selectedRole] && STAFF[selectedRole].length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">Personal Auditado</label>
                        <div className="relative">
                          <select 
                            value={selectedStaff}
                            onChange={(e) => setSelectedStaff(e.target.value)}
                            className="w-full p-4 bg-white border border-gray-200 rounded-2xl font-bold text-sm appearance-none focus:outline-none shadow-sm"
                          >
                            <option value="">Seleccionar nombre...</option>
                            {STAFF[selectedRole].map(name => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">Número de OR / Referencia</label>
                        <input 
                          type="text"
                          placeholder="Ej: 259132"
                          value={session.orderNumber || ""}
                          onChange={(e) => setSession({ ...session, orderNumber: e.target.value })}
                          className="w-full p-4 bg-white border border-gray-200 rounded-2xl font-bold text-sm focus:outline-none shadow-sm"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 pb-32">
                    {selectedRole && AUDIT_QUESTIONS[selectedRole].map((q: string, idx: number) => (
                      <AuditItemRow 
                        key={`${selectedRole}-${idx}`}
                        question={q}
                        index={idx}
                        item={session.items?.find(i => i.question === q)}
                        onStatusToggle={(status) => toggleItemStatus(q, status)}
                        onCommentUpdate={(comment) => updateItemComment(q, comment)}
                      />
                    ))}
                    
                    <div className="space-y-2 mt-8">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">Observaciones Generales</label>
                      <textarea 
                        placeholder="Escribe aquí cualquier nota adicional sobre esta auditoría..."
                        value={session.notes || ""}
                        onChange={(e) => setSession({ ...session, notes: e.target.value })}
                        className="w-full p-6 bg-white border border-gray-200 rounded-3xl font-medium text-sm focus:outline-none shadow-sm min-h-[120px]"
                      />
                    </div>
                  </div>

                  {/* Sticky Bottom Bar */}
                  <div className="fixed bottom-0 left-0 right-0 z-30 p-4 bg-white/80 backdrop-blur-lg border-t border-gray-100 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
                    <div className="max-w-md mx-auto flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Puntaje Actual</span>
                          <span className={cn(
                            "text-lg font-black leading-none",
                            calculateCurrentScore() >= 90 ? "text-green-600" : 
                            calculateCurrentScore() >= 70 ? "text-yellow-600" : "text-red-600"
                          )}>
                            {calculateCurrentScore()}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${calculateCurrentScore()}%` }}
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              calculateCurrentScore() >= 90 ? "bg-green-500" : 
                              calculateCurrentScore() >= 70 ? "bg-yellow-500" : "bg-red-500"
                            )}
                          />
                        </div>
                      </div>
                      <button 
                        onClick={handleAuditSubmit}
                        disabled={session.items.length === 0}
                        className={cn(
                          "px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shadow-lg",
                          session.items.length > 0
                            ? "bg-blue-600 text-white shadow-blue-100"
                            : "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none"
                        )}
                      >
                        <Save className="w-4 h-4" />
                        Finalizar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {view === "reports" && (
            <motion.div 
              key="reports"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 pb-12"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Reportes</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      const url = prompt("Pega aquí la URL de tu Google Apps Script:", webhookUrl);
                      if (url !== null) {
                        setWebhookUrl(url);
                        localStorage.setItem("webhookUrl", url);
                      }
                    }}
                    className="p-2 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-blue-600"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Puesto</label>
                    <select 
                      value={reportFilter.role}
                      onChange={(e) => setReportFilter({ ...reportFilter, role: e.target.value as Role })}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold"
                    >
                      {Object.keys(AUDIT_QUESTIONS).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Personal</label>
                    <select 
                      value={reportFilter.staff}
                      onChange={(e) => setReportFilter({ ...reportFilter, staff: e.target.value })}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold"
                    >
                      <option value="">Todos</option>
                      {Array.from(new Set(Object.values(STAFF).flat())).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Mes</label>
                    <input 
                      type="month"
                      value={reportFilter.month}
                      onChange={(e) => setReportFilter({ ...reportFilter, month: e.target.value })}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Matrix Table */}
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[10px]">
                    <thead>
                      <tr className="bg-[#002060] text-white">
                        <th className="p-2 border border-white/20 text-left min-w-[200px]">
                          {new Date(reportFilter.month + "-02").toLocaleString('es-ES', { month: 'long' }).toUpperCase()}
                        </th>
                        {history
                          .filter(s => 
                            s.role === reportFilter.role && 
                            (!reportFilter.staff || s.staffName === reportFilter.staff) &&
                            s.date.startsWith(reportFilter.month)
                          )
                          .map(s => (
                            <th key={s.id} className="p-2 border border-white/20 text-center min-w-[60px]">
                              {s.orderNumber || "S/N"}
                            </th>
                          ))
                        }
                        <th className="p-2 border border-white/20 text-center min-w-[60px] bg-blue-900">PROM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {AUDIT_QUESTIONS[reportFilter.role]?.map((question, qIdx) => {
                        const sessions = history.filter(s => 
                          s.role === reportFilter.role && 
                          (!reportFilter.staff || s.staffName === reportFilter.staff) &&
                          s.date.startsWith(reportFilter.month)
                        );
                        
                        const scores = sessions.map(s => {
                          const item = s.items.find(i => i.question === question);
                          if (!item || item.status === "na") return null;
                          return item.status === "pass" ? 1 : 0;
                        });

                        const validScores = scores.filter(s => s !== null) as number[];
                        const avg = validScores.length > 0 
                          ? validScores.reduce((a, b) => a + b, 0) / validScores.length 
                          : 0;

                        return (
                          <tr key={qIdx} className={qIdx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="p-2 border border-gray-100 font-bold text-gray-700">
                              {question}
                            </td>
                            {scores.map((score, sIdx) => (
                              <td 
                                key={sIdx} 
                                className={cn(
                                  "p-2 border border-gray-100 text-center font-black",
                                  score === 1 ? "bg-green-50 text-green-600" : 
                                  score === 0 ? "bg-red-50 text-red-600" : "text-gray-300"
                                )}
                              >
                                {score === null ? "-" : score}
                              </td>
                            ))}
                            <td className={cn(
                              "p-2 border border-gray-100 text-center font-black",
                              avg >= 0.9 ? "text-green-600" : avg >= 0.7 ? "text-yellow-600" : "text-red-600"
                            )}>
                              {avg.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
          {view === "history" && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setView("home")}
                    className="p-2 -ml-2 text-gray-400 hover:text-gray-900"
                  >
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <h2 className="text-2xl font-bold">Historial</h2>
                </div>
                <button 
                  onClick={exportToCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-green-100 transition-all"
                >
                  <Save className="w-4 h-4" />
                  Exportar CSV
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Buscar por asesor, OR o ubicación..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none"
                />
              </div>

              <div className="space-y-3">
                {history
                  .filter(item => 
                    item.staffName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.items[0]?.category.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((item) => (
                  <div key={item.id} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl",
                          item.totalScore >= 90 ? "bg-green-50 text-green-600" : 
                          item.totalScore >= 70 ? "bg-yellow-50 text-yellow-600" : "bg-red-50 text-red-600"
                        )}>
                          {item.totalScore}%
                        </div>
                        <div>
                          <p className="font-black text-gray-900 leading-none mb-1">{item.location}</p>
                          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{item.date}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Auditado</p>
                        <p className="text-xs font-black text-gray-700">
                          {item.staffName || "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">
                          {item.items[0]?.category || "General"}
                        </span>
                        {item.orderNumber && (
                          <span className="text-xs font-black text-blue-600">OR: {item.orderNumber}</span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{item.items.length} ítems auditados</span>
                      <button 
                        onClick={() => setSelectedAudit(item)}
                        className="text-xs font-bold text-blue-600 underline"
                      >
                        Ver detalles
                      </button>
                    </div>
                    {item.notes && (
                      <div className="p-3 bg-gray-50 rounded-xl">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Notas</p>
                        <p className="text-xs text-gray-600 line-clamp-2 italic">"{item.notes}"</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Modal 
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={submitAudit}
        title="¿Finalizar Auditoría?"
        message={`Faltan ${selectedRole ? (AUDIT_QUESTIONS[selectedRole]?.length - session.items.length) : 0} ítems por auditar. ¿Estás seguro de que deseas finalizar ahora?`}
      />

      <AnimatePresence>
        {selectedAudit && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAudit(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-black text-gray-900 leading-tight">Detalles de Auditoría</h3>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">
                    {selectedAudit.role || selectedAudit.items[0]?.category} - {selectedAudit.date}
                  </p>
                </div>
                <div className={cn(
                  "px-4 py-2 rounded-xl font-black text-lg",
                  selectedAudit.totalScore >= 90 ? "bg-green-50 text-green-600" : 
                  selectedAudit.totalScore >= 70 ? "bg-yellow-50 text-yellow-600" : "bg-red-50 text-red-600"
                )}>
                  {selectedAudit.totalScore}%
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Personal</p>
                    <p className="text-sm font-bold text-gray-700">{selectedAudit.staffName || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ubicación</p>
                    <p className="text-sm font-bold text-gray-700">{selectedAudit.location}</p>
                  </div>
                  {selectedAudit.orderNumber && (
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Número de OR</p>
                      <p className="text-sm font-bold text-blue-600">{selectedAudit.orderNumber}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Resultados por Ítem</p>
                  {selectedAudit.items.map((item, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 rounded-2xl space-y-2">
                      <div className="flex justify-between items-start gap-4">
                        <p className="text-xs font-bold text-gray-700 leading-snug">{item.question}</p>
                        <span className={cn(
                          "text-[10px] font-black uppercase px-2 py-1 rounded-md shrink-0",
                          item.status === "pass" ? "bg-green-100 text-green-600" : 
                          item.status === "fail" ? "bg-red-100 text-red-600" : "bg-gray-200 text-gray-500"
                        )}>
                          {item.status === "pass" ? "Cumple" : item.status === "fail" ? "No Cumple" : "N/A"}
                        </span>
                      </div>
                      {item.comment && (
                        <p className="text-[10px] text-gray-500 italic">"{item.comment}"</p>
                      )}
                    </div>
                  ))}
                </div>

                {selectedAudit.notes && (
                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Notas Generales</p>
                    <p className="text-xs text-blue-700 leading-relaxed">{selectedAudit.notes}</p>
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-gray-100">
                <button 
                  onClick={() => setSelectedAudit(null)}
                  className="w-full py-4 rounded-2xl font-black text-white bg-gray-900 hover:bg-black transition-all"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation (Mobile Only & Audit View Desktop) */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-200 px-6 py-4 flex items-center justify-around z-50",
        (view === "home" || view === "audit" || view === "setup") ? "flex" : "lg:hidden flex"
      )}>
        <button 
          onClick={() => setView("dashboard")}
          className={cn(
            "flex flex-col items-center gap-1 transition-all active:scale-90",
            view === "dashboard" ? "text-blue-600" : "text-slate-400"
          )}
        >
          <LayoutDashboard className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">Panel</span>
        </button>
        <button 
          onClick={() => setView("home")}
          className={cn(
            "flex flex-col items-center gap-1 transition-all active:scale-90",
            view === "home" ? "text-blue-600" : "text-slate-400"
          )}
        >
          <Plus className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">Nuevo</span>
        </button>
        <button 
          onClick={() => setView("history")}
          className={cn(
            "flex flex-col items-center gap-1 transition-all active:scale-90",
            view === "history" ? "text-blue-600" : "text-slate-400"
          )}
        >
          <History className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">Historial</span>
        </button>
        <button 
          onClick={() => setView("reports")}
          className={cn(
            "flex flex-col items-center gap-1 transition-all active:scale-90",
            view === "reports" ? "text-blue-600" : "text-slate-400"
          )}
        >
          <BarChart3 className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">KPIs</span>
        </button>
      </nav>
    </div>
  </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuditApp />
    </ErrorBoundary>
  );
}


