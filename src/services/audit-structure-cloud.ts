import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { db, handleFirestoreError, OperationType } from "../firebase";
import { AuditCategory, AuditStructureScope } from "../types";
import { normalizeAuditCategories } from "./audit-structure";

function getAuditStructureDocPath(scope: AuditStructureScope) {
  return ["appConfig", `auditStructure-${scope}`] as const;
}

export async function loadAuditCategoriesFromCloud(scope: AuditStructureScope = "global") {
  if (!db) {
    return null;
  }

  const docPath = getAuditStructureDocPath(scope);
  try {
    const snapshot = await getDoc(doc(db, ...docPath));
    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    return normalizeAuditCategories((data?.categories ?? []) as AuditCategory[]);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath.join("/"));
  }
}

export async function saveAuditCategoriesToCloud(
  categories: AuditCategory[],
  scope: AuditStructureScope = "global",
  updatedByEmail?: string | null
) {
  if (!db) {
    throw new Error("Firebase no est? configurado para guardar estructura en la nube.");
  }

  const docPath = getAuditStructureDocPath(scope);
  try {
    await setDoc(
      doc(db, ...docPath),
      {
        categories: normalizeAuditCategories(categories),
        scope,
        updatedAt: serverTimestamp(),
        updatedByEmail: updatedByEmail ?? "",
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath.join("/"));
  }
}
