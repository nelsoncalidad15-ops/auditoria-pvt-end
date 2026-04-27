import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { User as FirebaseUser } from "firebase/auth";
import { addDoc, collection, onSnapshot, orderBy, query, Timestamp } from "firebase/firestore";
import { AUDITORS } from "../constants";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { buildAuditSyncPayload, fetchAuditHistoryFromWebhook, sendAuditToWebhook } from "../services/audit-sync";
import { AuditSession } from "../types";

const LOCAL_AUDIT_HISTORY_STORAGE_KEY = "localAuditHistory";

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
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const syncingLocalAuditIdsRef = useRef<Set<string>>(new Set());
  const isUsingExternalHistory = externalHistory.length > 0;
  const sourceHistory = isUsingExternalHistory ? externalHistory : firestoreHistory;
  const history = useMemo(() => mergeAuditHistory([...localAuditHistory, ...sourceHistory]), [localAuditHistory, sourceHistory]);
  const historySyncModeLabel = hasWebhookUrl ? "Apps Script" : hasSheetCsvUrl ? "CSV" : "Pendiente";

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
    persistLocalAuditHistory((current) => [
      auditSession,
      ...current.filter((item) => item.id !== auditSession.id),
    ]);
  }, [persistLocalAuditHistory]);

  const removeLocalAuditHistoryItem = useCallback((auditId: string) => {
    persistLocalAuditHistory((current) => current.filter((item) => item.id !== auditId));
  }, [persistLocalAuditHistory]);

  const refreshExternalHistory = useCallback(async () => {
    if (!hasWebhookUrl) {
      setExternalHistory([]);
      return [] as AuditSession[];
    }

    const externalAudits = await fetchAuditHistoryFromWebhook(webhookUrl);
    setExternalHistory((current) => mergeAuditHistory([...externalAudits, ...current]));
    return externalAudits;
  }, [hasWebhookUrl, webhookUrl]);

  const prependExternalAudit = useCallback((session: AuditSession) => {
    setExternalHistory((current) => mergeAuditHistory([session, ...current]));
  }, []);

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
  }, [hasWebhookUrl, webhookUrl]);

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
    removeLocalAuditHistoryItem,
    refreshExternalHistory,
    prependExternalAudit,
    saveToFirestore,
  };
}
