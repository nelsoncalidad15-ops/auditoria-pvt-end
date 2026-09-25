import { memo, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, CheckCircle2, Mic, MicOff, MinusCircle, Trash2, XCircle, Info, Sparkles, MessageSquare } from "lucide-react";
import { cn } from "../../lib/utils";
import { AuditItem, AuditItemPriority, CalculatedItemResult, OrResponsibleRole } from "../../types";

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
  compact?: boolean;
  isActive?: boolean;
  observationSuggestions?: string[];
  onActivate?: () => void;
  onStatusToggle: (status: "pass" | "fail" | "na") => void;
  onCommentUpdate: (comment: string) => void;
  onPhotoUpdate: (photoUrl?: string) => void;
  weight?: number;
  isCalculated?: boolean;
  calculatedResult?: CalculatedItemResult;
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
  if (!context) return dataUrl;

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.78);
}

function AuditItemRowBase({
  rowId,
  question,
  index,
  item,
  description,
  allowsNa = true,
  guidance,
  requiresCommentOnFail = false,
  emphasized = false,
  showStructuredQuestion = false,
  isActive = false,
  observationSuggestions = [],
  onActivate,
  onStatusToggle,
  onCommentUpdate,
  onPhotoUpdate,
  compact = false,
  isCalculated = false,
  calculatedResult,
}: AuditItemRowProps) {
  const [showComment, setShowComment] = useState(Boolean(item?.comment || item?.photoUrl));
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);

  const separatorIndex = question.indexOf(":");
  const hasStructuredCopy = showStructuredQuestion && separatorIndex > -1;
  const questionTitle = hasStructuredCopy ? question.slice(0, separatorIndex).trim() : question;
  const questionHint = hasStructuredCopy ? question.slice(separatorIndex + 1).trim() : "";
  const match = questionTitle.trim().match(/^(\d+)[.)]?\s*(.*)$/);
  const questionOrder = match ? match[1] : String(index + 1);
  const questionMainCopy = match ? match[2] : questionTitle;
  const hasComment = Boolean(item?.comment?.trim());
  const hasPhoto = Boolean(item?.photoUrl);

  useEffect(() => {
    if (typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "es-AR";

      recognitionRef.current.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript;
          }
        }
        if (transcript) {
          const currentComment = item?.comment?.trim() || "";
          const nextComment = currentComment ? `${currentComment} ${transcript}` : transcript;
          onCommentUpdate(nextComment);
        }
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, [item?.comment, onCommentUpdate]);

  const toggleListening = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!recognitionRef.current) {
      alert("El dictado por voz no es compatible con este navegador.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setShowComment(true);
      recognitionRef.current.start();
      setIsListening(true);
    }
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

  if (isCalculated) {
    const state = calculatedResult?.state ?? "pending";
    const stateLabel = state === "complete"
      ? "Calculado"
      : state === "provisional"
        ? "Provisorio"
        : state === "not_applicable"
          ? "Sin dato"
          : "Pendiente";
    const scoreLabel = typeof calculatedResult?.score === "number"
      ? `${calculatedResult.score.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`
      : "—";

    return (
      <motion.div
        id={rowId}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.02 }}
        className={cn(
          "rounded-2xl border p-4.5 space-y-3 bg-blue-50/20 border-blue-200/70 shadow-xs",
          state === "pending" && "bg-amber-50/20 border-amber-200/70",
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-blue-700">
              <Sparkles className="h-3.5 w-3.5" />
              Automático · {stateLabel}
            </div>
            <p className="text-sm font-black leading-snug text-slate-900">
              <span className="text-blue-600 mr-1">{questionOrder}.</span> {questionMainCopy}
            </p>
            <p className="text-xs font-medium text-slate-500">
              {calculatedResult?.detail || "Calculado según las reglas del ciclo."}
            </p>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-3 rounded-xl border border-blue-200 bg-white px-3.5 py-2 text-right shadow-xs sm:min-w-28">
            <span className="text-[10px] font-bold uppercase text-slate-400">Score</span>
            <span className="text-xl font-black text-blue-700">{scoreLabel}</span>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      id={rowId}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      onClick={onActivate}
      className={cn(
        "relative rounded-2xl border bg-white transition-all duration-200 shadow-xs hover:shadow-sm",
        compact ? "p-3.5 space-y-3" : "p-4.5 space-y-3.5",
        item?.status === "pass" && "border-emerald-200 bg-emerald-50/15",
        item?.status === "fail" && "border-rose-200 bg-rose-50/15",
        item?.status === "na" && "border-slate-200 bg-slate-50/40 opacity-80",
        !item?.status && "border-slate-200",
        emphasized && "ring-2 ring-blue-500 shadow-md",
        isActive && !emphasized && "border-slate-400"
      )}
    >
      {/* Indicador sutil de estado lateral */}
      {item?.status === "pass" && <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 rounded-l-2xl" />}
      {item?.status === "fail" && <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500 rounded-l-2xl" />}
      {item?.status === "na" && <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-400 rounded-l-2xl" />}

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        {/* Pregunta y descripción */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-[13.5px] font-black leading-snug text-slate-900">
            <span className="text-blue-600 mr-1">{questionOrder}.</span> {questionMainCopy}
          </p>
          {(questionHint || description) && (
            <p className="text-xs font-medium leading-relaxed text-slate-500 bg-slate-50/80 rounded-xl px-3 py-2 border border-slate-100">
              {questionHint || description}
            </p>
          )}

          {guidance && (
            <p className="text-[11px] font-semibold text-blue-700 bg-blue-50/60 rounded-xl px-3 py-1.5 border border-blue-100 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span>{guidance}</span>
            </p>
          )}

          {requiresCommentOnFail && item?.status === "fail" && !hasComment && (
            <span className="inline-block text-[10px] font-black text-rose-600 uppercase tracking-wider">
              * Requiere observación obligatoria
            </span>
          )}
        </div>

        {/* Botones de respuesta Sí / No / N/A simples y estándar */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onStatusToggle("pass"); }}
            className={cn(
              "h-10 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 border",
              item?.status === "pass"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                : "bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border-slate-200"
            )}
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Sí</span>
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onStatusToggle("fail"); }}
            className={cn(
              "h-10 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 border",
              item?.status === "fail"
                ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                : "bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border-slate-200"
            )}
          >
            <XCircle className="h-4 w-4" />
            <span>No</span>
          </button>

          {allowsNa && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onStatusToggle("na"); }}
              className={cn(
                "h-10 px-3.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 border",
                item?.status === "na"
                  ? "bg-slate-600 text-white border-slate-600 shadow-sm"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-500 border-slate-200"
              )}
            >
              <MinusCircle className="h-4 w-4" />
              <span>N/A</span>
            </button>
          )}
        </div>
      </div>

      {/* Barra de herramientas para Nota y Foto */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowComment(!showComment); }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors",
              hasComment ? "bg-blue-50 text-blue-700 border border-blue-200" : "text-slate-500 hover:bg-slate-100"
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{hasComment ? "Editar nota" : "Agregar nota"}</span>
          </button>

          <button
            type="button"
            disabled={isProcessingPhoto}
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors",
              hasPhoto ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "text-slate-500 hover:bg-slate-100"
            )}
          >
            <Camera className="h-3.5 w-3.5" />
            <span>{isProcessingPhoto ? "Cargando..." : hasPhoto ? "Foto adjunta" : "Foto"}</span>
          </button>
        </div>

        {hasComment && !showComment && (
          <span className="text-[11px] text-slate-400 italic truncate max-w-[260px]">
            "{item?.comment}"
          </span>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelection} />

      {/* Desplegable de Observaciones y Foto */}
      <AnimatePresence>
        {showComment && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: "auto", opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }} 
            className="overflow-hidden space-y-3 pt-1"
          >
            {item?.photoUrl && (
              <div className="relative group rounded-xl overflow-hidden border border-slate-200 max-h-48">
                <img src={item.photoUrl} alt="Evidencia" className="w-full h-44 object-cover" />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onPhotoUpdate(undefined); }}
                  className="absolute top-2 right-2 p-1.5 bg-rose-600 text-white rounded-lg shadow-sm hover:bg-rose-500"
                  title="Eliminar foto"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            
            <div className="relative">
              <textarea
                value={item?.comment || ""}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onCommentUpdate(e.target.value)}
                placeholder="Escribe un comentario u observación para el informe..."
                className="w-full h-20 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:border-blue-400 focus:bg-white transition-all outline-none resize-none pr-10"
              />
              <button
                type="button"
                onClick={toggleListening}
                className={cn(
                  "absolute bottom-2.5 right-2.5 h-7 w-7 rounded-lg flex items-center justify-center transition-all shadow-xs",
                  isListening ? "bg-rose-500 text-white animate-pulse" : "bg-white text-slate-500 hover:text-slate-800 border border-slate-200"
                )}
                title={isListening ? "Detener dictado" : "Dictar por voz"}
              >
                {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              </button>
            </div>

            {observationSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {observationSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); applyObservationSuggestion(s); }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 text-[10px] font-semibold text-slate-600 transition-colors"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export const AuditItemRow = memo(AuditItemRowBase);
