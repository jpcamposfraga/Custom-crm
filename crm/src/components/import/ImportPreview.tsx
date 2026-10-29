import React from 'react';
import type { ImportAnalysisResult } from '@/types';
import { CheckCircle2, AlertTriangle, Users, Globe, ExternalLink } from 'lucide-react';

interface ImportPreviewProps {
  analysis: ImportAnalysisResult;
}

export function ImportPreview({ analysis }: ImportPreviewProps) {
  const { totalRows, newLeads, duplicateLeads } = analysis;

  return (
    <div className="space-y-4">
      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-slate-500 mb-1 text-xs font-medium">
            <Users className="w-3.5 h-3.5" />
            Total no CSV
          </div>
          <span className="text-xl font-bold text-slate-800">{totalRows}</span>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-emerald-700 mb-1 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Novos Leads
          </div>
          <span className="text-xl font-bold text-emerald-700">{newLeads.length}</span>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-amber-700 mb-1 text-xs font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            Duplicados
          </div>
          <span className="text-xl font-bold text-amber-700">{duplicateLeads.length}</span>
        </div>
      </div>

      {/* Preview Table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <div className="bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 border-b border-slate-200 flex justify-between items-center">
          <span>Prévia dos Primeiros Leads (mostrando até 10)</span>
          <span className="text-slate-400 font-normal">Total: {totalRows}</span>
        </div>
        <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
          {newLeads.slice(0, 5).map((lead, idx) => (
            <div key={`new-${idx}`} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800 truncate">{lead.name}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                    Novo
                  </span>
                </div>
                <div className="text-slate-500 text-[11px] flex items-center gap-2 mt-0.5">
                  <span>{lead.phone}</span>
                  <span>•</span>
                  <span>{lead.nicho}</span>
                  {lead.location && (
                    <>
                      <span>•</span>
                      <span className="truncate">{lead.location}</span>
                    </>
                  )}
                </div>
              </div>
              <div>
                {lead.has_website === 1 ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 border border-blue-200">
                    <Globe className="w-2.5 h-2.5" /> Com site
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600">
                    Sem site
                  </span>
                )}
              </div>
            </div>
          ))}

          {duplicateLeads.slice(0, 5).map((dup, idx) => (
            <div key={`dup-${idx}`} className="p-2.5 flex items-center justify-between bg-amber-50/50 hover:bg-amber-50">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-700 truncate">{dup.lead.name}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                    {dup.reason === 'db_duplicate' ? 'Já no CRM' : 'Repetido no Arquivo'}
                  </span>
                </div>
                <div className="text-slate-500 text-[11px] flex items-center gap-2 mt-0.5">
                  <span>{dup.lead.phone}</span>
                  <span>•</span>
                  <span>{dup.lead.nicho}</span>
                </div>
              </div>
              <span className="text-[10px] text-amber-700 italic">Ignorado na importação</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
