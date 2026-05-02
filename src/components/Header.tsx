import React from 'react';
import { Leaf, Wifi } from 'lucide-react';
export function Header() {
  return (
    <header className="w-full bg-white border-b border-green-100 px-6 py-4 shadow-sm">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 p-2 rounded-lg text-green-600">
            <Leaf size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-green-900 tracking-tight">
              Greenhouse
            </h1>
            <p className="text-xs font-medium text-green-600/70 uppercase tracking-wider">
              Monitor Dashboard
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full border border-green-100">
          <div className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </div>
          <span className="text-sm font-medium text-green-700 flex items-center gap-1.5">
            <Wifi size={14} />
            Connected
          </span>
        </div>
      </div>
    </header>);

}