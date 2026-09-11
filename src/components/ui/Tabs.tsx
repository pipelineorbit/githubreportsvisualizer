"use client";

import { useState } from "react";

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

  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content;

  return (
    <div className="w-full">
      {/* Tab Navigation */}
      <div className="flex flex-wrap border-b border-gray-700 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.id
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
      <div key={activeTab} className="min-h-[400px]">
        {activeTabContent}
      </div>
    </div>
  );
}
