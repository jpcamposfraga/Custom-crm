'use client';

import React from 'react';
import type { Lead, LeadStatus } from '@/types';
import {
  Globe,
  ExternalLink,
  MessageCircle,
  CheckCircle,
  Trash2,
  MapPin,
  Phone,
} from 'lucide-react';

interface LeadsTableProps {
  leads: Lead[];
  loading: boolean;
  onStatusChange: (leadId: string, newStatus: LeadStatus) => void;
  onDeleteLead: (leadId: string) => void;
  onOpenWhatsApp: (lead: Lead) => void;
}

export function LeadsTable({
  leads,
  loading,
  onStatusChange,
  onDeleteLead,
  onOpenWhatsApp,
}: LeadsTableProps) {
  const statusBadgeStyles: Record<LeadStatus, { label: string; bg: string; text: string }> = {
    novo: { label: 'Novo', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
    em_contato: { label: 'Em Contato', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
    convertido: { label: 'Convertido', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
    perdido: { label: 'Perdido', bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700' },
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
        <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
        <p className="text-xs">Carregando leads...</p>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
        <p className="text-sm font-semibold text-slate-700 mb-1">Nenhum lead encontrado</p>
        <p className="text-xs text-slate-400">Tente ajustar os filtros ou importar novos leads via CSV.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3.5 px-4">Empresa / Contato</th>
              <th className="py-3.5 px-4">Nicho</th>
              <th className="py-3.5 px-4">Website</th>
              <th className="py-3.5 px-4">Localização</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-center">Ações Rápidas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => {
              const currentStatus = lead.status || 'novo';
              const badge = statusBadgeStyles[currentStatus] || statusBadgeStyles.novo;
              const isConverted = currentStatus === 'convertido';
              const hasPhone = Boolean(lead.phone && lead.phone.trim() && lead.phone.toLowerCase() !== 'null');

              return (
                <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Empresa / Contato com Telefone sempre exibido abaixo do nome */}
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900 text-sm">{lead.name}</div>
                    <div className="flex items-center gap-1.5 text-xs mt-0.5">
                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                      {hasPhone ? (
                        <span className="text-slate-600 font-medium">{lead.phone}</span>
                      ) : (
                        <span className="text-slate-400 italic">Telefone não encontrado</span>
                      )}
                    </div>
                    {lead.notes && (
                      <div className="text-[11px] text-slate-400 italic mt-0.5 max-w-xs truncate">
                        {lead.notes}
                      </div>
                    )}
                  </td>

                  {/* Nicho */}
                  <td className="py-3.5 px-4">
                    <span className="inline-block px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                      {lead.nicho}
                    </span>
                  </td>

                  {/* Website */}
                  <td className="py-3.5 px-4">
                    {lead.has_website === 1 && lead.website ? (
                      <a
                        href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 font-medium transition-colors"
                      >
                        <Globe className="w-3 h-3" />
                        <span className="max-w-[130px] truncate">{lead.website.replace(/^https?:\/\//, '')}</span>
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-slate-400 bg-slate-50 border border-slate-200">
                        Sem site
                      </span>
                    )}
                  </td>

                  {/* Localização */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1 text-slate-600">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[150px]">{lead.location || 'Não informada'}</span>
                    </div>
                  </td>

                  {/* Status Dropdown */}
                  <td className="py-3.5 px-4">
                    <select
                      value={currentStatus}
                      onChange={(e) => onStatusChange(lead.id, e.target.value as LeadStatus)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${badge.bg} ${badge.text} outline-none cursor-pointer`}
                    >
                      <option value="novo">Novo</option>
                      <option value="em_contato">Em Contato</option>
                      <option value="convertido">Convertido</option>
                      <option value="perdido">Perdido</option>
                    </select>
                  </td>

                  {/* Quick Actions */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-center gap-2">
                      {/* Botão de WhatsApp exibido SOMENTE se o telefone existir */}
                      {hasPhone ? (
                        <button
                          onClick={() => onOpenWhatsApp(lead)}
                          title="Enviar mensagem WhatsApp"
                          className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      ) : null}

                      {/* Quick Convert Toggle */}
                      <button
                        onClick={() =>
                          onStatusChange(lead.id, isConverted ? 'em_contato' : 'convertido')
                        }
                        title={isConverted ? 'Desmarcar como convertido' : 'Marcar como Convertido!'}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          isConverted
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-50 text-slate-400 hover:text-emerald-600 hover:border-emerald-300'
                        }`}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => onDeleteLead(lead.id)}
                        title="Excluir Lead"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
