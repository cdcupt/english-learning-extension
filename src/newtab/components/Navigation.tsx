import { useState } from "react";
import type { Page } from "@/shared/types";

const PRIMARY_ITEMS: { page: Page; label: string; icon: string }[] = [
  { page: "dashboard", label: "Dashboard", icon: "📊" },
  { page: "reading", label: "Reading", icon: "📰" },
  { page: "writing", label: "Writing", icon: "✍️" },
  { page: "vocabulary", label: "Vocabulary", icon: "📚" },
  { page: "speaking", label: "Speaking", icon: "🎙️" },
  { page: "listening", label: "Listening", icon: "🎧" },
];

const MORE_ITEMS: { page: Page; label: string; icon: string }[] = [
  { page: "history", label: "History", icon: "📅" },
  { page: "summary", label: "Weekly Summary", icon: "📈" },
  { page: "settings", label: "Settings", icon: "⚙️" },
];

const MORE_PAGES = new Set(MORE_ITEMS.map((i) => i.page));

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export function Navigation({ currentPage, onNavigate }: Props) {
  const [moreOpen, setMoreOpen] = useState(() => MORE_PAGES.has(currentPage));

  function navButton(item: { page: Page; label: string; icon: string }) {
    const active = currentPage === item.page;
    return (
      <li key={item.page}>
        <button
          onClick={() => onNavigate(item.page)}
          className={`w-full text-left px-5 py-3 flex items-center gap-3 text-sm transition-colors ${
            active
              ? "bg-blue-50 text-blue-700 font-medium border-r-2 border-blue-700"
              : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          <span>{item.icon}</span>
          {item.label}
        </button>
      </li>
    );
  }

  return (
    <nav className="w-56 bg-white border-r border-gray-200 flex flex-col h-screen">
      <div className="p-5 border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-900">English Tracker</h1>
      </div>

      {/* Primary nav */}
      <ul className="flex-1 py-2">
        {PRIMARY_ITEMS.map(navButton)}
      </ul>

      {/* More section */}
      <div className="border-t border-gray-200">
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          className="w-full text-left px-5 py-3 flex items-center justify-between text-sm text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-3">
            <span>···</span>
            More
          </span>
          <span
            className={`text-xs transition-transform duration-200 ${
              moreOpen ? "rotate-180" : ""
            }`}
          >
            ▼
          </span>
        </button>
        {moreOpen && (
          <ul className="pb-2">{MORE_ITEMS.map(navButton)}</ul>
        )}
      </div>
    </nav>
  );
}
