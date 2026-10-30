'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Table, UploadCloud, Calendar, Settings } from 'lucide-react';
import { PhoneChecker } from '../search/PhoneChecker';
import { CsvImportModal } from '../import/CsvImportModal';

export function Navbar() {
  const pathname = usePathname();
  const [isImportOpen, setIsImportOpen] = useState(false);

  const navItems = [
    { label: 'Tabela de Leads', href: '/leads', icon: Table },
    { label: 'Kanban Funil', href: '/kanban', icon: LayoutGrid },
    { label: 'Agendamentos', href: '/scheduled', icon: Calendar },
    { label: 'Configurações', href: '/settings', icon: Settings },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Navigation */}
          <div className="flex items-center gap-6">
            <Link href="/leads" className="flex items-center gap-2 font-bold text-slate-900 tracking-tight text-base">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
                CF
              </div>
              <span className="hidden sm:inline">CRM Prospecção</span>
            </Link>

            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      active
                        ? 'bg-blue-50 text-blue-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Quick Phone Checker & Actions */}
          <div className="flex items-center gap-3 flex-1 justify-end max-w-xl">
            <PhoneChecker />

            <button
              onClick={() => setIsImportOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all whitespace-nowrap shrink-0"
            >
              <UploadCloud className="w-4 h-4" />
              <span className="hidden md:inline">Importar CSV</span>
            </button>
          </div>
        </div>
      </header>

      <CsvImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={() => {
          window.location.reload();
        }}
      />
    </>
  );
}
