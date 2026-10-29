'use client';

import React from 'react';
import { Search, Filter, ArrowUpDown, X, Globe, Layers } from 'lucide-react';
import type { LeadStatus } from '@/types';

interface LeadFiltersProps {
  search: string;
  onSearchChange: (val: string) => void;
  nicho: string;
  onNichoChange: (val: string) => void;
  availableNiches: string[];
  status: string;
  onStatusChange: (val: string) => void;
  hasWebsite: string;
  onHasWebsiteChange: (val: string) => void;
  sortBy: string;
  onSortByChange: (val: string) => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderChange: (val: 'asc' | 'desc') => void;
  onReset: () => void;
}

export function LeadFilters({
  search,
  onSearchChange,
  nicho,
  onNichoChange,
  availableNiches,
  status,
  onStatusChange,
  hasWebsite,
  onHasWebsiteChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  onReset,
}: LeadFiltersProps) {
  const isFiltered = search || nicho || status || hasWebsite || sortBy !== 'created_at' || sortOrder !== 'desc';

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nome, telefone ou cidade..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Niche Filter */}
        <div className="w-full sm:w-44">
          <select
            value={nicho}
            onChange={(e) => onNichoChange(e.target.value)}
            className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-700"
          >
            <option value="">Todos os Nichos</option>
            {availableNiches.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="w-full sm:w-40">
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-700"
          >
            <option value="">Todos os Status</option>
            <option value="novo">Novo</option>
            <option value="em_contato">Em Contato</option>
            <option value="convertido">Convertido</option>
            <option value="perdido">Perdido</option>
          </select>
        </div>

        {/* Website Existence Filter */}
        <div className="w-full sm:w-36">
          <select
            value={hasWebsite}
            onChange={(e) => onHasWebsiteChange(e.target.value)}
            className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-700"
          >
            <option value="">Website (Todos)</option>
            <option value="1">Com Website</option>
            <option value="0">Sem Website</option>
          </select>
        </div>
      </div>

      {/* Sorting row & reset */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" /> Ordenar por:
          </span>

          <button
            onClick={() => {
              if (sortBy === 'created_at') {
                onSortOrderChange(sortOrder === 'desc' ? 'asc' : 'desc');
              } else {
                onSortByChange('created_at');
                onSortOrderChange('desc');
              }
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              sortBy === 'created_at'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            Data {sortBy === 'created_at' && (sortOrder === 'desc' ? '↓' : '↑')}
          </button>

          <button
            onClick={() => {
              if (sortBy === 'name') {
                onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc');
              } else {
                onSortByChange('name');
                onSortOrderChange('asc');
              }
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              sortBy === 'name'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            Nome A-Z {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>

          <button
            onClick={() => {
              if (sortBy === 'nicho') {
                onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc');
              } else {
                onSortByChange('nicho');
                onSortOrderChange('asc');
              }
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              sortBy === 'nicho'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            Nicho {sortBy === 'nicho' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
        </div>

        {isFiltered && (
          <button
            onClick={onReset}
            className="text-xs text-red-600 hover:text-red-700 font-medium hover:underline flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Limpar Filtros
          </button>
        )}
      </div>
    </div>
  );
}
