import { memo, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, CheckCircle2, History, Mic, MicOff, MinusCircle, Trash2, XCircle, HelpCircle, Info } from "lucide-react";
import { cn } from "../../lib/utils";
import { AuditItem, AuditItemPriority, OrResponsibleRole } from "../../types";

interface AuditItemRowProps {
  rowId?: string;
  question: string;
  index: number;
  item?: AuditItem;
  required?: boolean;
  block?: string;
  description?: string;
  responsibleRoles?: OrResponsibleRole[];
  scoreAreas?: string[];
  allowsNa?: boolean;
  priority?: AuditItemPriority;
  guidance?: string;
  requiresCommentOnFail?: boolean;
  emphasized?: boolean;
  showStructuredQuestion?: boolean;
  compactMeta?: boolean;
  quickMode?: boolean;
  isActive?: boolean;
  observationSuggestions?: string[];
  onActivate?: () => void;
  onStatusToggle: (status: "pass" | "fail" | "na") => void;
  onCommentUpdate: (comment: string) => void;
  onPhotoUpdate: (photoUrl?: string) => void;
  weight?: number;
}

async function compressImage(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo procesar la imagen seleccionada."));
    img.src = dataUrl;
  });

  const maxDimension = 1280;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    return dataUrl;
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.78);
}

function AuditItemRowBase({
  rowId,
  question,
  index,
  item,
  description,
  scoreAreas = [],
  allowsNa = true,
  priority,
  guidance,
  requiresCommentOnFail = false,
  emphasized = false,
  showStructuredQuestion = false,
  isActive = false,
  observationSuggestions = [],
  weight = 1,
  responsibleRoles = [],
  onActivate,
  onStatusToggle,
  onCommentUpdate,
  onPhotoUpdate,
}: AuditItemRowProps) {
  const [showComment, setShowComment] = useState(false);
  const [showGuidance, setShowGuidance] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [lastStatusChange, setLastStatusChange] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);

  const separatorIndex = question.indexOf(":");
  const hasStructuredCopy = showStructuredQuestion && separatorIndex > -1;
  const questionTitle = hasStructuredCopy ? question.slice(0, separatorIndex).trim() : question;
  const questionHint = hasStructuredCopy ? question.slice(separatorIndex + 1).trim() : "";
  const questionOrderMatch = questionTitle.match(/^(\d+)[.)\-\s]+(.+)$/);
  const questionOrder = questionOrderMatch?.[1] ?? String(index + 1);
  const questionMainCopy = questionOrderMatch?.[2] ?? questionTitle;
  
  const hasComment = Boolean(item?.comment?.trim());
  const hasPhoto = Boolean(item?.photoUrl);
  const linkedScoreAreas = scoreAreas.filter((area) => area.trim());

  useEffect(() => {
    if (item?.status === "fail" && requiresCommentOnFail && !item?.comment?.trim()) {
      setShowComment(true);
    }
  }, [item?.comment, item?.status, requiresCommentOnFail]);

  const toggleListening = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Tu navegador no soporta el reconocimiento de voz.");
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.lang = "es-AR";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join("");
        
        onCommentUpdate(transcript);
      };

      recognitionRef.current = recognition;
    }

    recognitionRef.current.start();
    setShowComment(true);
  };

  const applyObservationSuggestion = (suggestion: string) => {
    const currentComment = item?.comment?.trim() || "";
    const nextComment = currentComment
      ? `${currentComment}${/[.!?]$/.test(currentComment) ? "" : "."} ${suggestion}`
      : suggestion;

    onCommentUpdate(nextComment);
    setShowComment(true);
  };

  const handlePhotoSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsProcessingPhoto(true);
    try {
      const compressedImage = await compressImage(file);
      onPhotoUpdate(compressedImage);
      setShowComment(true);
    } catch {
      alert("No se pudo adjuntar la foto.");
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  return (
    <motion.div
      id={rowId}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onActivate}
      className={cn(
        "premium-card p-5 space-y-4 scroll-mt-32 transition-all duration-500",
        item?.status === "pass" ? "bg-emerald-500/5 border-emerald-500/20 shadow-emerald-500/5" :
        item?.status === "fail" ? "bg-red-500/5 border-red-500/20 shadow-red-500/5" :
        item?.status === "na" ? "bg-slate-500/5 border-slate-500/10 opacity-70" :
        "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800",
        emphasized && "ring-2 ring-blue-500 shadow-xl scale-[1.02]",
        isActive && !emphasized && "ring-1 ring-slate-400 dark:ring-slate-600 shadow-lg",
        item?.status === "fail" && !hasComment && requiresCommentOnFail && "animate-pulse border-red-500/40"
      )}
    >
      {item?.status === "fail" && (
        <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500 rounded-l-2xl opacity-50 z-10" />
      )}
      {item?.status === "pass" && (
        <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 rounded-l-2xl opacity-50 z-10" />
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 flex-1 min-w-0">
          <p className="text-[15px] font-black leading-tight text-slate-900 dark:text-white group-hover:text-[--accent-neon] transition-colors">
            <span className="text-blue-600 dark:text-blue-400 mr-1">{questionOrder}.</span> {questionMainCopy}
          </p>
          {(questionHint || description) && (
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2 border border-slate-100 dark:border-slate-800">
              {questionHint || description}
            </p>
          )}
          
          <AnimatePresence>
            {showGuidance && guidance && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-5 rounded-[1.5rem] bg-gradient-to-br from-blue-600/10 to-blue-600/5 border border-blue-500/20 text-xs font-medium text-blue-900 dark:text-blue-300 leading-relaxed shadow-inner">
                  <div className="flex items-start gap-3">
                    <div className="h-5 w-5 rounded-lg bg-blue-500 text-white flex items-center justify-center shrink-0">
                       <Info className="h-3 w-3" />
                    </div>
                    <span className="italic">{guidance}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {requiresCommentOnFail && item?.status === "fail" && !hasComment && (
            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest animate-pulse">Nota obligatoria</p>
          )}
        </div>

        <div className="flex flex-col gap-2 shrink-0 self-end md:self-center">
          {guidance && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowGuidance(!showGuidance); }}
              className={cn(
                "hidden md:flex items-center justify-center h-8 w-8 rounded-full transition-all",
                showGuidance ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          )}
          <div className="flex gap-2">
            {[
              { id: "pass", label: "OK", icon: CheckCircle2, bg: "bg-emerald-500", glow: "rgba(16, 185, 129, 0.4)" },
              { id: "fail", label: "NO", icon: XCircle, bg: "bg-red-500", glow: "rgba(239, 68, 68, 0.4)" },
              { id: "na", label: "N/A", icon: MinusCircle, bg: "bg-slate-500", glow: "rgba(100, 116, 139, 0.4)" },
            ].map((btn) => (
              <button
                key={btn.id}
                disabled={btn.id === "na" && !allowsNa}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onStatusToggle(btn.id as any);
                  setLastStatusChange(btn.id);
                  setTimeout(() => setLastStatusChange(null), 1000);
                }}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 h-14 w-16 md:w-20 rounded-2xl border-2 transition-all active:scale-95 relative overflow-hidden",
                  item?.status === btn.id
                    ? `${btn.bg} border-transparent text-white shadow-lg`
                    : "bg-white dark:bg-slate-900 border-white/5 text-slate-500 hover:border-white/10",
                  btn.id === "na" && !allowsNa && "opacity-20 cursor-not-allowed"
                )}
                style={{ boxShadow: item?.status === btn.id ? `0 10px 20px ${btn.glow}` : 'none' }}
              >
                <AnimatePresence>
                  {lastStatusChange === btn.id && (
                    <motion.div
                      initial={{ scale: 0, opacity: 1 }}
                      animate={{ scale: 3, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-white/40 rounded-full"
                    />
                  )}
                </AnimatePresence>
                <btn.icon className="h-4 w-4 relative z-10" />
                <span className="text-[9px] font-black uppercase tracking-widest relative z-10">{btn.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); setShowComment(!showComment); }}
          className={cn(
            "flex-1 h-12 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all",
            showComment || hasComment ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
          )}
        >
          <History className="h-4 w-4" />
          {hasComment ? "Nota" : "Añadir nota"}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          disabled={isProcessingPhoto}
          className={cn(
            "flex-1 h-12 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500",
            hasPhoto && "text-blue-600 dark:text-blue-400"
          )}
        >
          <Camera className="h-4 w-4" />
          {isProcessingPhoto ? "Procesando..." : hasPhoto ? "Foto lista" : "Foto"}
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelection} />

      <AnimatePresence>
        {showComment && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-4">
            {item?.photoUrl && (
              <div className="relative group rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                <img src={item.photoUrl} alt="Evidencia" className="w-full h-48 object-cover" />
                <button
                  onClick={(e) => { e.stopPropagation(); onPhotoUpdate(undefined); }}
                  className="absolute top-3 right-3 p-2 bg-red-500 text-white rounded-xl shadow-lg active:scale-90"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
            
            <div className="relative">
              <textarea
                value={item?.comment || ""}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onCommentUpdate(e.target.value)}
                placeholder="Escribe una observación o dictado por voz..."
                className="w-full h-24 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500/20 transition-all outline-none resize-none pr-12"
              />
              <button
                onClick={toggleListening}
                className={cn(
                  "absolute bottom-3 right-3 h-9 w-9 rounded-xl flex items-center justify-center transition-all shadow-md",
                  isListening ? "bg-red-500 text-white animate-pulse" : "bg-white dark:bg-slate-700 text-slate-500"
                )}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            </div>

            {observationSuggestions.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-blue-500" />
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Sugerencias rápidas</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {observationSuggestions.map((s, i) => (
                    <motion.button
                      key={s}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={(e) => { e.stopPropagation(); applyObservationSuggestion(s); }}
                      className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 border border-slate-200 dark:border-slate-700 hover:border-transparent text-[11px] font-bold text-slate-700 dark:text-slate-300 transition-all active:scale-95 shadow-sm"
                    >
                      {s}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export const AuditItemRow = memo(AuditItemRowBase);
