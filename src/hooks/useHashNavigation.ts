import { useCallback, useEffect, useRef } from "react";
import { AppView, Role } from "../types";

interface UseHashNavigationParams {
  view: AppView;
  selectedRole: Role | null;
  setView: (view: AppView) => void;
  clearSelectedRole: () => void;
}

export function useHashNavigation({ view, selectedRole, setView, clearSelectedRole }: UseHashNavigationParams) {
  const isApplyingHashRef = useRef(false);
  const initialHashRef = useRef<string | null>(null);
  const previousEntryRef = useRef<{ view: AppView } | null>(null);
  const navigationHistoryRef = useRef<Array<{ view: AppView }>>([]);
  const isGoingBackRef = useRef(false);

  const applyNavigationFromHash = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const rawHash = window.location.hash.replace(/^#\/?/, "").trim();
    const [section] = rawHash.split("/");

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
  }, [setView]);

  const buildHashForView = useCallback(() => {
    if (view === "setup") {
      return "#/nueva";
    }

    if (view === "audit") {
      return "#/auditoria";
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
  }, [view]);

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
