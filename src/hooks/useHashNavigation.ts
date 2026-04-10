import { useCallback, useEffect, useRef } from "react";
import { AppView, Role } from "../types";

interface UseHashNavigationParams {
  view: AppView;
  selectedRole: Role | null;
  setView: (view: AppView) => void;
  setSelectedRole: (role: Role | null) => void;
  clearSelectedRole: () => void;
}

export function useHashNavigation({ view, selectedRole, setView, setSelectedRole, clearSelectedRole }: UseHashNavigationParams) {
  const isApplyingHashRef = useRef(false);
  const initialHashRef = useRef<string | null>(null);
  const previousEntryRef = useRef<{ view: AppView } | null>(null);
  const navigationHistoryRef = useRef<Array<{ view: AppView }>>([]);
  const isGoingBackRef = useRef(false);

  const AUDIT_SELECTION_SEGMENT = "seleccion";

  const encodeAuditRole = useCallback((role: string) => (
    role
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  ), []);

  const decodeAuditRole = useCallback((segment: string) => {
    const normalizedSegment = segment
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (normalizedSegment === "ordenes") {
      return "Ordenes";
    }

    if (normalizedSegment === "asesores-de-servicio") {
      return "Asesores de servicio";
    }

    if (normalizedSegment === "tecnicos") {
      return "Técnicos";
    }

    if (normalizedSegment === "pre-entrega") {
      return "Pre Entrega";
    }

    if (normalizedSegment === "lavadero") {
      return "Lavadero";
    }

    if (normalizedSegment === "garantia") {
      return "Garantía";
    }

    if (normalizedSegment === "repuestos") {
      return "Repuestos";
    }

    if (normalizedSegment === "jefe") {
      return "Jefe";
    }

    return null;
  }, []);

  const applyNavigationFromHash = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const rawHash = window.location.hash.replace(/^#\/?/, "").trim();
    const [section, subSection] = rawHash.split("/");

    isApplyingHashRef.current = true;

    if (!section || section === "dashboard" || section === "inicio") {
      setView("dashboard");
      return;
    }

    if (section === "setup" || section === "nueva") {
      setView("setup");
      return;
    }

    if (section === "audit" || section === "auditoria") {
      setView("audit");
      if (!subSection || subSection === AUDIT_SELECTION_SEGMENT) {
        clearSelectedRole();
        return;
      }

      const resolvedRole = decodeAuditRole(subSection);
      if (resolvedRole) {
        setSelectedRole(resolvedRole);
        return;
      }

      clearSelectedRole();
      return;
    }

    if (section === "history" || section === "historial") {
      setView("history");
      return;
    }

    if (section === "estructura" || section === "structure") {
      setView("structure");
      return;
    }

    if (section === "integraciones" || section === "integrations") {
      setView("integrations");
      return;
    }

    if (section === "continuar" || section === "continue") {
      setView("continuar");
      return;
    }

    if (section === "home") {
      setView("home");
      return;
    }

    setView("dashboard");
  }, [AUDIT_SELECTION_SEGMENT, clearSelectedRole, decodeAuditRole, setSelectedRole, setView]);

  const buildHashForView = useCallback(() => {
    if (view === "setup") {
      return "#/nueva";
    }

    if (view === "audit") {
      if (selectedRole) {
        return `#/auditoria/${encodeAuditRole(selectedRole)}`;
      }

      return "#/auditoria/seleccion";
    }

    if (view === "history") {
      return "#/historial";
    }

    if (view === "structure") {
      return "#/estructura";
    }

    if (view === "integrations") {
      return "#/integraciones";
    }

    if (view === "continuar") {
      return "#/continuar";
    }

    if (view === "home") {
      return "#/home";
    }

    return "#/inicio";
  }, [encodeAuditRole, selectedRole, view]);

  if (initialHashRef.current === null) {
    initialHashRef.current = buildHashForView();
  }

  useEffect(() => {
    const currentEntry = { view };
    const previousEntry = previousEntryRef.current;

    if (!previousEntry) {
      previousEntryRef.current = currentEntry;
      return;
    }

    if (isApplyingHashRef.current) {
      previousEntryRef.current = currentEntry;
      return;
    }

    const hasChanged = previousEntry.view !== currentEntry.view;

    if (!hasChanged) {
      return;
    }

    if (isGoingBackRef.current) {
      isGoingBackRef.current = false;
      previousEntryRef.current = currentEntry;
      return;
    }

    navigationHistoryRef.current.push(previousEntry);
    previousEntryRef.current = currentEntry;
  }, [view]);

  const handleTopbarBack = useCallback(() => {
    if (view === "audit" && selectedRole) {
      clearSelectedRole();
      return;
    }

    const previousEntry = navigationHistoryRef.current.pop();
    if (previousEntry) {
      isGoingBackRef.current = true;
      setView(previousEntry.view);
      return;
    }

    if (view === "audit") {
      setView("setup");
      return;
    }

    if (view === "setup" || view === "history" || view === "home" || view === "structure" || view === "integrations" || view === "continuar") {
      setView("dashboard");
    }
  }, [clearSelectedRole, selectedRole, setView, view]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!window.location.hash) {
      window.history.replaceState(null, "", initialHashRef.current || "#/inicio");
    }

    applyNavigationFromHash();
    const handleHashChange = () => applyNavigationFromHash();
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [applyNavigationFromHash]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (isApplyingHashRef.current) {
      isApplyingHashRef.current = false;
      return;
    }

    const nextHash = buildHashForView();
    if (window.location.hash !== nextHash.replace(/^#/, "#")) {
      window.location.hash = nextHash;
    }
  }, [buildHashForView]);

  return {
    handleTopbarBack,
  };
}
