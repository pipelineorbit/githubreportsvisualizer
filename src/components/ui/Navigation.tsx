import { DollarSign, Github } from "lucide-react";

export function Navigation() {
  return (
    <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center gap-4 min-h-16 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="w-8 h-8 shrink-0 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <span className="min-w-0 text-base sm:text-xl font-semibold">
              GitHub Billing Visualizer
            </span>
          </div>
          <div className="flex shrink-0 items-center">
            <a
              href="https://github.com/wechuli/githubreportsvisualizer"
              aria-label="GitHub repository"
              title="GitHub repository"
              className="flex min-h-9 items-center gap-2 rounded text-gray-300 hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-sky-400"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="w-5 h-5" aria-hidden="true" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
