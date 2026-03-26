import { useState, useEffect } from "react";
import type { Page } from "@/shared/types";
import { getSettings } from "@/shared/storage";
import { useDailyTasks } from "./hooks/useDailyTasks";
import { Navigation } from "./components/Navigation";
import { Dashboard } from "./pages/Dashboard";
import { Reading } from "./pages/Reading";
import { Writing } from "./pages/Writing";
import { Vocabulary } from "./pages/Vocabulary";
import { Speaking } from "./pages/Speaking";
import { Listening } from "./pages/Listening";
import { PracticesHistory } from "./pages/PracticesHistory";
import { WeeklySummary } from "./pages/WeeklySummary";
import { Settings } from "./pages/Settings";

export function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const { record, loading, update } = useDailyTasks();
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      if (!s?.nytApiKey || !(s?.aiProvider?.apiKey || s?.claudeApiKey)) {
        setNeedsSetup(true);
      }
    });
  }, []);

  useEffect(() => {
    if (needsSetup && page === "dashboard") {
      setPage("settings");
    }
  }, [needsSetup, page]);

  if (loading || !record) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  function renderPage() {
    switch (page) {
      case "dashboard":
        return <Dashboard record={record!} onNavigate={setPage} />;
      case "reading":
        return <Reading record={record!} onUpdate={update} />;
      case "writing":
        return <Writing record={record!} onUpdate={update} />;
      case "vocabulary":
        return <Vocabulary record={record!} onUpdate={update} />;
      case "speaking":
        return <Speaking record={record!} onUpdate={update} />;
      case "history":
        return <PracticesHistory />;
      case "summary":
        return <WeeklySummary />;
      case "settings":
        return <Settings />;
      default:
        return <Dashboard record={record!} onNavigate={setPage} />;
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Navigation currentPage={page} onNavigate={setPage} />
      <main className="flex-1 overflow-y-auto p-8">
        {/* Keep Listening mounted to preserve state during generation */}
        <div style={{ display: page === "listening" ? "block" : "none" }}>
          <Listening record={record!} onUpdate={update} visible={page === "listening"} />
        </div>
        {page !== "listening" && renderPage()}
      </main>
    </div>
  );
}
