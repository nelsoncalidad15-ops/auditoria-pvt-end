import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, CheckCircle2, History, MinusCircle, Trash2, XCircle } from "lucide-react";
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

export function AuditItemRow({
  rowId,
  question,
  index,
  item,
  required: _required = false,
  block: _block,
  description,
  responsibleRoles: _responsibleRoles = [],
  allowsNa = true,
  priority: _priority = "medium",
  guidance: _guidance,
  requiresCommentOnFail = false,
  emphasized = false,
  showStructuredQuestion = false,
  compactMeta = false,
  quickMode = false,
  isActive = false,
  observationSuggestions = [],
  onActivate,
  onStatusToggle,
  onCommentUpdate,
  onPhotoUpdate,
}: AuditItemRowProps) {
  const [showComment, setShowComment] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const separatorIndex = question.indexOf(":");
  const hasStructuredCopy = showStructuredQuestion && separatorIndex > -1;
  const questionTitle = hasStructuredCopy ? question.slice(0, separatorIndex).trim() : question;
  const questionHint = hasStructuredCopy ? question.slice(separatorIndex + 1).trim() : "";
  const questionOrderMatch = questionTitle.match(/^(\d+)[.)\-\s]+(.+)$/);
  const questionOrder = questionOrderMatch?.[1] ?? String(index + 1);
  const questionMainCopy = questionOrderMatch?.[2] ?? questionTitle;
  const isOrdersStyle = showStructuredQuestion;
  const isCalmStyle = compactMeta && !isOrdersStyle;
  const normalizedDescription = description?.trim() || "";
  const hasComment = Boolean(item?.comment?.trim());
  const hasPhoto = Boolean(item?.photoUrl);
  const isAuxPanelOpen = showComment;
  const notePreview = item?.comment?.trim().slice(0, 72) || "";
  const shouldShowExpandedContent = !quickMode || isActive || hasComment || hasPhoto || item?.status === "fail";
  const shortStatusLabels = { pass: "OK", fail: "No", na: "N/A" } as const;

  useEffect(() => {
    if (item?.status === "fail" && requiresCommentOnFail && !item?.comment?.trim()) {
      setShowComment(true);
    }
  }, [item?.comment, item?.status, requiresCommentOnFail]);

  useEffect(() => {
    if (quickMode && !isActive) {
      setShowComment(false);
    }
  }, [isActive, quickMode]);

  const applyObservationSuggestion = (suggestion: string) => {
    const currentComment = item?.comment?.trim() || "";
    if (!suggestion.trim()) {
      return;
    }

    if (currentComment.toLowerCase().includes(suggestion.toLowerCase())) {
      return;
    }

    const nextComment = currentComment
      ? `${currentComment}${/[.!?]$/.test(currentComment) ? "" : "."} ${suggestion}`
      : suggestion;

    onCommentUpdate(nextComment);
    setShowComment(true);
  };

  const handlePhotoSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsProcessingPhoto(true);
    try {
      const compressedImage = await compressImage(file);
      onPhotoUpdate(compressedImage);
      setShowComment(true);
    } catch {
      alert("No se pudo adjuntar la foto seleccionada.");
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
        "border transition-all duration-300 space-y-3 scroll-mt-32",
        isOrdersStyle
          ? "bg-white rounded-[1.5rem] p-3.5 shadow-[0_12px_28px_rgba(15,23,42,0.05)] border-slate-200/80"
          : isCalmStyle
            ? "bg-white rounded-[1.45rem] p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)] border-slate-200"
            : "bg-white rounded-[1.5rem] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]",
        onActivate && "cursor-pointer",
        emphasized && (isOrdersStyle
          ? "ring-2 ring-offset-2 ring-blue-500 shadow-[0_18px_50px_rgba(59,130,246,0.16)]"
          : "ring-2 ring-offset-2 ring-blue-300"),
        isActive && !emphasized && "ring-2 ring-offset-2 ring-slate-300 shadow-[0_10px_30px_rgba(15,23,42,0.08)]",
        item?.status
          ? (isOrdersStyle ? "border-slate-300" : isCalmStyle ? "border-slate-200" : "border-gray-200")
          : (isOrdersStyle ? "border-slate-200 ring-1 ring-slate-100" : isCalmStyle ? "border-slate-200/90" : "border-gray-100 ring-1 ring-gray-50")
      )}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="space-y-1 flex-1">
          <div className="space-y-1.5">
            <p className={cn(
              "leading-snug",
              isOrdersStyle ? "font-black text-slate-900 text-[0.96rem] md:text-[1rem] tracking-[-0.02em]" : isCalmStyle ? "font-black text-slate-900 text-[0.98rem] md:text-[1.02rem] tracking-[-0.02em]" : "font-black text-slate-900 text-[0.98rem] md:text-[1.02rem] tracking-[-0.02em]"
            )}>
              {questionOrder}. {questionMainCopy}
            </p>
            {questionHint && shouldShowExpandedContent && (
              <p className={cn(
                "text-[11px] leading-snug rounded-xl px-3 py-2 border",
                isOrdersStyle
                  ? "text-slate-600 bg-slate-50 border-slate-200"
                  : isCalmStyle ? "text-slate-500 bg-slate-50/80 border-slate-100" : "text-gray-500 bg-slate-50 border-slate-100"
              )}>
                {questionHint}
              </p>
            )}
            {normalizedDescription && !questionHint && shouldShowExpandedContent && (
              <p className={cn(
                "text-[11px] leading-snug rounded-xl px-3 py-2 border",
                isOrdersStyle
                  ? "text-slate-600 bg-slate-50 border-slate-200"
                  : isCalmStyle ? "text-slate-500 bg-slate-50/80 border-slate-100" : "text-gray-500 bg-slate-50 border-slate-100"
              )}>
                {normalizedDescription}
              </p>
            )}
            {requiresCommentOnFail && (
              <p className="text-[11px] font-bold text-amber-700">Nota obligatoria en desvíos.</p>
            )}
          </div>
        </div>
        {item?.status && (
          <span className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
            item.status === "pass"
              ? "bg-emerald-50 text-emerald-700"
              : item.status === "fail"
                ? "bg-rose-50 text-rose-700"
                : "bg-slate-100 text-slate-600"
          )}>
            {shortStatusLabels[item.status]}
          </span>
        )}
      </div>

      <div className={cn("grid grid-cols-3 gap-2", quickMode && "hidden lg:grid")}>
        <button
          onClick={(event) => {
            event.stopPropagation();
            onStatusToggle("pass");
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-1 rounded-[1rem] border-2 transition-all active:scale-95 px-2 sm:min-h-[64px]",
            isCalmStyle ? "py-2.5 min-h-[66px]" : "py-3 min-h-[68px]",
            item?.status === "pass"
              ? (isOrdersStyle ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100" : "bg-green-500 border-green-500 text-white shadow-lg shadow-green-100")
              : (isOrdersStyle ? "bg-white border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-700" : "bg-white border-gray-100 text-gray-400 hover:border-green-200 hover:text-green-500")
          )}
        >
          <CheckCircle2 className={cn("h-5 w-5", item?.status === "pass" && "text-white")} />
          <span className={cn("font-black uppercase tracking-[0.16em]", isCalmStyle ? "text-[13px]" : "text-sm")}>Si</span>
        </button>

        <button
          onClick={(event) => {
            event.stopPropagation();
            onStatusToggle("fail");
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-1 rounded-[1rem] border-2 transition-all active:scale-95 px-2 sm:min-h-[64px]",
            isCalmStyle ? "py-2.5 min-h-[66px]" : "py-3 min-h-[68px]",
            item?.status === "fail"
              ? (isOrdersStyle ? "bg-red-600 border-red-600 text-white shadow-lg shadow-red-100" : "bg-red-500 border-red-500 text-white shadow-lg shadow-red-100")
              : (isOrdersStyle ? "bg-white border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-700" : "bg-white border-gray-100 text-gray-400 hover:border-red-200 hover:text-red-500")
          )}
        >
          <XCircle className={cn("h-5 w-5", item?.status === "fail" && "text-white")} />
          <span className={cn("font-black uppercase tracking-[0.16em]", isCalmStyle ? "text-[13px]" : "text-sm")}>No</span>
          
        </button>

        {allowsNa ? (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onStatusToggle("na");
            }}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-[1.1rem] border-2 transition-all active:scale-95 px-2 sm:min-h-[64px]",
              isCalmStyle ? "py-2.5 min-h-[66px]" : "py-3 min-h-[74px]",
              item?.status === "na"
                ? (isOrdersStyle ? "bg-slate-700 border-slate-700 text-white shadow-lg shadow-slate-200" : "bg-gray-800 border-gray-800 text-white shadow-lg shadow-gray-200")
                : (isOrdersStyle ? "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700" : "bg-white border-gray-100 text-gray-400 hover:border-gray-300 hover:text-gray-600")
            )}
          >
            <MinusCircle className={cn("h-5 w-5", item?.status === "na" && "text-white")} />
            <span className={cn("font-black uppercase tracking-[0.16em]", isCalmStyle ? "text-[13px]" : "text-sm")}>N/A</span>
            
          </button>
        ) : (
          <div className={cn(
            "flex flex-col items-center justify-center gap-1 rounded-[1.1rem] border-2 px-2 sm:min-h-[64px] opacity-60",
            isCalmStyle ? "py-2.5 min-h-[66px]" : "py-3 min-h-[74px]",
            isOrdersStyle ? "bg-slate-50 border-slate-200 text-slate-400" : "bg-gray-50 border-gray-200 text-gray-400"
          )}>
            <MinusCircle className="h-5 w-5" />
            <span className="text-sm font-black uppercase tracking-[0.16em]">N/A</span>
            
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoSelection}
      />

      <div className={cn(
        "flex gap-2 pt-1",
        isOrdersStyle && "border-t border-slate-100 pt-3",
        isCalmStyle && "pt-0",
        quickMode && !isActive && "hidden lg:flex"
      )}>
        <button
          onClick={() => setShowComment(!showComment)}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 rounded-[1rem] text-[10px] font-bold uppercase tracking-wider transition-all",
            isCalmStyle ? "py-3 border" : "py-3.5",
            item?.comment || showComment
              ? (isOrdersStyle ? "bg-slate-900 text-white ring-1 ring-slate-900" : isCalmStyle ? "border-slate-200 bg-slate-100 text-slate-700" : "bg-blue-50 text-blue-600 ring-1 ring-blue-100")
              : (isOrdersStyle ? "bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200" : isCalmStyle ? "border-slate-200 bg-white text-slate-500 hover:bg-slate-50" : "bg-gray-50 text-gray-400 hover:bg-gray-100")
          )}
        >
          <History className="w-3.5 h-3.5" />
          {hasComment ? "Nota" : requiresCommentOnFail ? "Evidencia" : "Nota"}
        </button>
        <button
          onClick={() => {
            if (isCalmStyle && hasPhoto) {
              setShowComment(true);
              return;
            }

            fileInputRef.current?.click();
          }}
          disabled={isProcessingPhoto}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 rounded-[1rem] text-[10px] font-bold uppercase tracking-wider transition-all",
            isCalmStyle ? "py-3 border" : "py-3.5",
            isOrdersStyle
              ? "bg-slate-50 text-slate-400 border border-slate-200 hover:bg-slate-100"
              : isCalmStyle ? "border-slate-200 bg-white text-slate-500 hover:bg-slate-50" : "bg-gray-50 text-gray-400 hover:bg-gray-100"
          )}
        >
          <Camera className="w-3.5 h-3.5" />
          {isProcessingPhoto ? "Procesando" : isCalmStyle ? "Foto" : item?.photoUrl ? "Foto" : "Adjuntar"}
        </button>
      </div>

      {isCalmStyle && (hasComment || hasPhoto) && !isAuxPanelOpen && (!quickMode || isActive) && (
        <button
          type="button"
          onClick={() => setShowComment(true)}
          className="flex w-full items-start justify-between gap-3 rounded-[0.95rem] border border-slate-200 bg-slate-50/80 px-3 py-2 text-left transition hover:border-slate-300 hover:bg-slate-50"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
              {hasComment && hasPhoto ? "Nota + foto" : hasComment ? "Nota" : "Foto"}
            </p>
            {hasComment && (
              <p className="mt-1 truncate text-[11px] font-medium text-slate-600">
                {notePreview}{item?.comment && item.comment.trim().length > 72 ? "..." : ""}
              </p>
            )}
          </div>
          <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Ver</span>
        </button>
      )}

      <AnimatePresence>
        {isAuxPanelOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className={cn(
              "pt-1",
              isCalmStyle && "pt-0"
            )}>
              <div className={cn(
                "space-y-3 rounded-[1rem] border p-3",
                isCalmStyle ? "border-slate-200 bg-slate-50/70" : "border-slate-200 bg-slate-50"
              )}>
                {item?.photoUrl && (
                  <div className="space-y-2">
                    <img src={item.photoUrl} alt="Foto del item" className="h-40 w-full rounded-xl object-cover" />
                    <div className="flex gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 transition-all hover:border-slate-300"
                      >
                        Cambiar
                      </button>
                      <button
                        onClick={() => onPhotoUpdate(undefined)}
                        className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-3 py-2 text-red-600 transition-all hover:border-red-300"
                        aria-label="Quitar foto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {(showComment || item?.comment || requiresCommentOnFail) && (
                  <textarea
                    value={item?.comment || ""}
                    onChange={(e) => onCommentUpdate(e.target.value)}
                    placeholder="Escribe una nota..."
                    className={cn(
                      "w-full rounded-[1.2rem] text-xs resize-none transition-all focus:ring-0",
                      isOrdersStyle
                        ? "h-20 border-2 border-gray-100 bg-gray-50 p-3 focus:border-blue-200"
                        : isCalmStyle
                          ? "h-20 border border-slate-200 bg-white p-3 text-slate-700 focus:border-slate-300"
                          : "h-22 border-2 border-gray-100 bg-gray-50 p-3.5 focus:border-blue-200"
                    )}
                  />
                )}

                {observationSuggestions.length > 0 && (item?.status === "fail" || hasComment || isActive) && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Sugeridas</p>
                    <div className="flex flex-wrap gap-2">
                      {observationSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => applyObservationSuggestion(suggestion)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(hasComment || hasPhoto) && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowComment(false)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 transition hover:border-slate-300"
                    >
                      Ocultar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
