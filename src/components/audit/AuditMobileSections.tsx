import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";
import { AuditItem, AuditTemplateItem } from "../../types";
import { AuditItemRow } from "./AuditItemRow";

interface AuditMobileSection {
  id: string;
  title: string;
  description: string;
  items: AuditTemplateItem[];
}

interface AuditMobileSectionsProps {
  sections: AuditMobileSection[];
  openSections: Record<string, boolean>;
  selectedAuditItems: AuditTemplateItem[];
  sessionItems: AuditItem[];
  showStructuredQuestion: boolean;
  focusedItemId?: string | null;
  onToggleSection: (sectionId: string) => void;
  onStatusToggle: (question: string, status: "pass" | "fail" | "na") => void;
  onCommentUpdate: (question: string, comment: string) => void;
  onPhotoUpdate: (question: string, photoUrl?: string) => void;
}

export function AuditMobileSections({
  sections,
  openSections,
  selectedAuditItems,
  sessionItems,
  showStructuredQuestion,
  focusedItemId,
  onToggleSection,
  onStatusToggle,
  onCommentUpdate,
  onPhotoUpdate,
}: AuditMobileSectionsProps) {
  return (
    <div className="space-y-3 lg:hidden">
      {sections.map((section) => {
        const isOpen = openSections[section.id];
        return (
          <div key={section.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-3">
            <button
              onClick={() => onToggleSection(section.id)}
              className="flex w-full items-center justify-between gap-3 rounded-[1.1rem] bg-white px-4 py-4 text-left shadow-sm"
            >
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Bloque</p>
                <p className="mt-1 text-sm font-black text-slate-900">{section.title}</p>
                <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{section.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                  {section.items.length}
                </span>
                <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", isOpen && "rotate-180")} />
              </div>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 pt-3">
                    {section.items.length > 0 ? section.items.map((auditItem) => (
                      <AuditItemRow
                        key={`${section.id}-${auditItem.id}`}
                        rowId={`audit-item-${auditItem.id}`}
                        question={auditItem.text}
                        index={selectedAuditItems.findIndex((item) => item.id === auditItem.id)}
                        item={sessionItems.find((item) => item.id === auditItem.id || item.question === auditItem.text)}
                        required={auditItem.required}
                        block={auditItem.block}
                        priority={auditItem.priority}
                        guidance={auditItem.guidance}
                        requiresCommentOnFail={auditItem.requiresCommentOnFail}
                        emphasized={focusedItemId === auditItem.id}
                        showStructuredQuestion={showStructuredQuestion}
                        onStatusToggle={(status) => onStatusToggle(auditItem.text, status)}
                        onCommentUpdate={(comment) => onCommentUpdate(auditItem.text, comment)}
                        onPhotoUpdate={(photoUrl) => onPhotoUpdate(auditItem.text, photoUrl)}
                      />
                    )) : (
                      <div className="rounded-[1.2rem] border border-dashed border-slate-300 bg-white px-4 py-6 text-center">
                        <p className="text-sm font-bold text-slate-500">Sin ?tems en este bloque.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
