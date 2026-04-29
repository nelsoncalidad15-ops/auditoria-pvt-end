import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { User as FirebaseUser } from "firebase/auth";
import { addDoc, collection, onSnapshot, orderBy, query, Timestamp } from "firebase/firestore";
import { AUDITORS } from "../constants";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { buildAuditSyncPayload, deleteAuditFromWebhook, fetchAuditHistoryFromWebhook, sendAuditToWebhook } from "../services/audit-sync";
import { AuditSession } from "../types";

const LOCAL_AUDIT_HISTORY_STORAGE_KEY = "localAuditHistory";
const DISMISSED_AUDIT_IDS_STORAGE_KEY = "dismissedAuditIds";

interface UseAuditSyncParams {
  isAuthReady: boolean;
  user: FirebaseUser | null;
  hasWebhookUrl: boolean;
  webhookUrl: string;
  hasSheetCsvUrl: boolean;
}

function mergeAuditHistory(audits: AuditSession[]) {
  return Array.from(
    audits
      .sort((left, right) => `${right.date}-${right.id}`.localeCompare(`${left.date}-${left.id}`))
      .reduce((acc, item) => {
        if (!acc.has(item.id)) {
          acc.set(item.id, item);
        }
        return acc;
      }, new Map<string, AuditSession>())
      .values()
  );
}

export function useAuditSync({ isAuthReady, user, hasWebhookUrl, webhookUrl, hasSheetCsvUrl }: UseAuditSyncParams) {
  const [firestoreHistory, setFirestoreHistory] = useState<AuditSession[]>([]);
  const [externalHistory, setExternalHistory] = useState<AuditSession[]>([]);
  const [dismissedAuditIds, setDismissedAuditIds] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const rawDismissedIds = window.localStorage.getItem(DISMISSED_AUDIT_IDS_STORAGE_KEY);
      if (!rawDismissedIds) {
        return [];
      }

      const parsed = JSON.parse(rawDismissedIds);
      return Array.isArray(parsed) ? parsed.map((id) => String(id)) : [];
    } catch {
      return [];
    }
  });
  const [localAuditHistory, setLocalAuditHistory] = useState<AuditSession[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const rawHistory = window.localStorage.getItem(LOCAL_AUDIT_HISTORY_STORAGE_KEY);
      if (!rawHistory) {
        return [];
      }

      const parsed = JSON.parse(rawHistory);
      return Array.isArray(parsed) ? parsed.map((audit) => ({ ...audit, source: "local" as const })) : [];
    } catch {
      return [];
    }
  });

  const syncingLocalAuditIdsRef = useRef<Set<string>>(new Set());
  const isUsingExternalHistory = externalHistory.length > 0;
  const sourceHistory = isUsingExternalHistory ? externalHistory : firestoreHistory;
  const dismissedAuditIdSet = useMemo(() => new Set(dismissedAuditIds), [dismissedAuditIds]);
  const history = useMemo(
    () => mergeAuditHistory([...localAuditHistory, ...sourceHistory]).filter((audit) => !dismissedAuditIdSet.has(audit.id)),
    [dismissedAuditIdSet, localAuditHistory, sourceHistory]
  );
  const historySyncModeLabel = hasWebhookUrl ? "Apps Script" : hasSheetCsvUrl ? "CSV" : "Pendiente";

  const persistDismissedAuditIds = useCallback((nextIdsOrUpdater: string[] | ((current: string[]) => string[])) => {
    setDismissedAuditIds((current) => {
      const nextIds = typeof nextIdsOrUpdater === "function"
        ? nextIdsOrUpdater(current)
        : nextIdsOrUpdater;

      if (typeof window !== "undefined") {
        window.localStorage.setItem(DISMISSED_AUDIT_IDS_STORAGE_KEY, JSON.stringify(nextIds));
      }

      return nextIds;
    });
  }, []);

  const persistLocalAuditHistory = useCallback((nextHistoryOrUpdater: AuditSession[] | ((current: AuditSession[]) => AuditSession[])) => {
    setLocalAuditHistory((current) => {
      const nextHistory = typeof nextHistoryOrUpdater === "function"
        ? nextHistoryOrUpdater(current)
        : nextHistoryOrUpdater;

      if (typeof window !== "undefined") {
        window.localStorage.setItem(LOCAL_AUDIT_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
      }

      return nextHistory;
    });
  }, []);

  const upsertLocalAuditHistory = useCallback((auditSession: AuditSession) => {
    persistDismissedAuditIds((current) => current.filter((id) => id !== auditSession.id));
    persistLocalAuditHistory((current) => [
      { ...auditSession, source: "local" as const },
      ...current.filter((item) => item.id !== auditSession.id),
    ]);
  }, [persistDismissedAuditIds, persistLocalAuditHistory]);

  const removeLocalAuditHistoryItem = useCallback((auditId: string) => {
    persistLocalAuditHistory((current) => current.filter((item) => item.id !== auditId));
  }, [persistLocalAuditHistory]);

  const dismissAuditHistoryItem = useCallback((auditId: string) => {
    persistDismissedAuditIds((current) => current.includes(auditId) ? current : [auditId, ...current]);
    persistLocalAuditHistory((current) => current.filter((item) => item.id !== auditId));
  }, [persistDismissedAuditIds, persistLocalAuditHistory]);

  const refreshExternalHistory = useCallback(async () => {
    if (!hasWebhookUrl) {
      setExternalHistory([]);
      return [] as AuditSession[];
    }

    const externalAudits = await fetchAuditHistoryFromWebhook(webhookUrl);
    const externalAuditIds = new Set(externalAudits.map((audit) => audit.id));
    persistDismissedAuditIds((current) => current.filter((id) => !externalAuditIds.has(id)));
    setExternalHistory((current) => mergeAuditHistory([...externalAudits, ...current]));
    return externalAudits;
  }, [hasWebhookUrl, persistDismissedAuditIds, webhookUrl]);

  const prependExternalAudit = useCallback((session: AuditSession) => {
    persistDismissedAuditIds((current) => current.filter((id) => id !== session.id));
    setExternalHistory((current) => mergeAuditHistory([session, ...current]));
  }, [persistDismissedAuditIds]);

  const deleteRemoteAudit = useCallback(async (auditId: string) => {
    if (!hasWebhookUrl) {
      throw new Error("No hay un Apps Script configurado para borrar en Sheets.");
    }

    await deleteAuditFromWebhook(webhookUrl, auditId);
    persistDismissedAuditIds((current) => current.filter((id) => id !== auditId));
    setExternalHistory((current) => current.filter((audit) => audit.id !== auditId));
    setFirestoreHistory((current) => current.filter((audit) => audit.id !== auditId));
  }, [hasWebhookUrl, persistDismissedAuditIds, webhookUrl]);

  const saveToFirestore = useCallback(async (newSession: AuditSession) => {
    if (!db) {
      throw new Error("Firebase no est? configurado.");
    }

    try {
      await addDoc(collection(db, "audits"), {
        ...newSession,
        createdAt: Timestamp.now(),
        userEmail: user?.email,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "audits");
    }
  }, [user?.email]);

  useEffect(() => {
    if (!db) {
      setFirestoreHistory([]);
      return;
    }

    if (!isAuthReady) {
      return;
    }

    if (!user) {
      setFirestoreHistory([]);
      return;
    }

    const q = query(collection(db, "audits"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const audits = snapshot.docs.map((doc) => ({
        ...(doc.data() as AuditSession),
        id: (doc.data().id as string) || doc.id,
        source: "firestore" as const,
      })) as AuditSession[];
      setFirestoreHistory(audits);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "audits");
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  useEffect(() => {
    if (!hasWebhookUrl) {
      setExternalHistory([]);
      return;
    }

    let cancelled = false;

    const loadExternalHistory = async () => {
      try {
        const externalAudits = await fetchAuditHistoryFromWebhook(webhookUrl);
        if (!cancelled) {
          const externalAuditIds = new Set(externalAudits.map((audit) => audit.id));
          persistDismissedAuditIds((current) => current.filter((id) => !externalAuditIds.has(id)));
          setExternalHistory(externalAudits);
        }
      } catch (error) {
        console.error("Initial external history load failed:", error);
      }
    };

    void loadExternalHistory();

    return () => {
      cancelled = true;
    };
  }, [hasWebhookUrl, persistDismissedAuditIds, webhookUrl]);

  useEffect(() => {
    if (!hasWebhookUrl || typeof window === "undefined") {
      return;
    }

    const refreshSilently = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      void refreshExternalHistory().catch((error) => {
        console.error("Automatic external history refresh failed:", error);
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshSilently();
      }
    };

    window.addEventListener("focus", refreshSilently);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const intervalId = window.setInterval(refreshSilently, 60000);

    return () => {
      window.removeEventListener("focus", refreshSilently);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [hasWebhookUrl, refreshExternalHistory]);

  useEffect(() => {
    if (localAuditHistory.length === 0) {
      return;
    }

    if (!hasWebhookUrl && (!user || !db)) {
      return;
    }

    const firestoreIds = new Set(firestoreHistory.map((audit) => audit.id));
    const pendingLocalAudits = localAuditHistory.filter(
      (audit) => !firestoreIds.has(audit.id) && !syncingLocalAuditIdsRef.current.has(audit.id)
    );

    if (pendingLocalAudits.length === 0) {
      return;
    }

    pendingLocalAudits.forEach((audit) => {
      syncingLocalAuditIdsRef.current.add(audit.id);

      const auditorName = AUDITORS.find((auditor) => auditor.id === audit.auditorId)?.name || "N/A";

      const syncPromise = hasWebhookUrl
        ? sendAuditToWebhook(
            webhookUrl,
            buildAuditSyncPayload({
              session: audit,
              auditorName,
              submittedByEmail: user?.email,
            })
          )
        : user
          ? saveToFirestore(audit)
          : Promise.reject(new Error("No sync target available"));

      void syncPromise
        .then(() => {
          removeLocalAuditHistoryItem(audit.id);
        })
        .catch((error) => {
          console.error("Local audit sync failed:", error);
        })
        .finally(() => {
          syncingLocalAuditIdsRef.current.delete(audit.id);
        });
    });
  }, [firestoreHistory, hasWebhookUrl, localAuditHistory, removeLocalAuditHistoryItem, saveToFirestore, user, webhookUrl]);

  return {
    history,
    localAuditHistory,
    isUsingExternalHistory,
    historySyncModeLabel,
    upsertLocalAuditHistory,
    dismissAuditHistoryItem,
    removeLocalAuditHistoryItem,
    deleteRemoteAudit,
    refreshExternalHistory,
    prependExternalAudit,
    saveToFirestore,
  };
}
