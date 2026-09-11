"use client";

import { useId, useState } from "react";

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
}

export function Tabs({ tabs, defaultTab }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);
  const tabId = useId();
  const selected = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  if (!selected)
    return (
      <p role="status" className="py-12 text-center text-gray-400">
        No data matches the selected filters.
      </p>
    );

  return (
    <div className="w-full">
      {/* Tab Navigation */}
      <div
        role="tablist"
        aria-label="Billing views"
        className="flex flex-wrap border-b border-gray-700 mb-6"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${tabId}-${tab.id}`}
            aria-controls={`${tabId}-panel-${tab.id}`}
            aria-selected={selected.id === tab.id}
            tabIndex={selected.id === tab.id ? 0 : -1}
            onKeyDown={(event) => {
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % tabs.length
                  : event.key === "ArrowLeft"
                    ? (index - 1 + tabs.length) % tabs.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? tabs.length - 1
                        : undefined;
              if (next === undefined) return;
              event.preventDefault();
              setActiveTab(tabs[next].id);
              document.getElementById(`${tabId}-${tabs[next].id}`)?.focus();
            }}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium rounded-t-lg transition-colors focus-visible:outline-2 focus-visible:outline-sky-400 ${
              selected.id === tab.id
                ? "bg-gray-800 text-white border-b-2 border-green-400"
                : "text-gray-400 hover:text-white hover:bg-gray-800/50"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-2 px-2 py-1 text-xs rounded-full bg-gray-700 text-gray-300">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div
        key={selected.id}
        role="tabpanel"
        id={`${tabId}-panel-${selected.id}`}
        aria-labelledby={`${tabId}-${selected.id}`}
        className="min-w-0 min-h-[400px]"
      >
        {selected.content}
      </div>
    </div>
  );
}
