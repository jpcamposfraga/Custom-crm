'use client';

import React from 'react';
import type { Card, Column, Lead } from '@/types';
import {
  Globe,
  ExternalLink,
  MessageCircle,
  Phone,
  Trash2,
} from 'lucide-react';

interface KanbanCardProps {
  card: Card;
  columns: Column[];
  onMoveCard: (cardId: string, targetColId: string) => void;
  onDeleteCard: (cardId: string) => void;
  onOpenWhatsApp: (lead: Lead) => void;
}

export function KanbanCard({
  card,
  columns,
  onMoveCard,
  onDeleteCard,
  onOpenWhatsApp,
}: KanbanCardProps) {
  const lead = card.lead;
  const hasPhone = Boolean(lead && lead.phone && lead.phone.trim() && lead.phone.toLowerCase() !== 'null');

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('text/plain', card.id);
  }

  const otherColumns = columns.filter((c) => c.id !== card.column_id);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="group bg-white rounded-xl border border-slate-200/90 hover:border-blue-400 p-3.5 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing space-y-2.5 relative"
    >
      {/* Title & Delete */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-xs font-bold text-slate-800 group-hover:text-blue-700 transition-colors leading-snug">
          {card.title}
        </h4>
        <button
          onClick={() => onDeleteCard(card.id)}
          title="Excluir card"
          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition-opacity p-0.5 rounded"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Description / Subtitle */}
      {card.description && (
        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
          {card.description}
        </p>
      )}

      {/* Lead details if present */}
      {lead && (
        <div className="space-y-2 pt-1 border-t border-slate-100 text-[11px]">
          {/* Phone & WhatsApp Action */}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
              {hasPhone ? (
                <span className="text-slate-600 font-medium">{lead.phone}</span>
              ) : (
                <span className="text-slate-400 italic">Telefone não encontrado</span>
              )}
            </span>

            {/* Botão de WhatsApp exibido SOMENTE se o telefone existir */}
            {hasPhone ? (
              <button
                onClick={() => onOpenWhatsApp(lead)}
                title="Conversar no WhatsApp"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-semibold text-[10px] transition-colors"
              >
                <MessageCircle className="w-3 h-3" />
                WhatsApp
              </button>
            ) : null}
          </div>

          {/* Website & Niche badges */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium">
              {lead.nicho}
            </span>

            {lead.has_website === 1 && lead.website ? (
              <a
                href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] hover:underline"
              >
                <Globe className="w-2.5 h-2.5" />
                Site
                <ExternalLink className="w-2 h-2" />
              </a>
            ) : (
              <span className="px-1.5 py-0.5 bg-slate-50 text-slate-400 border border-slate-200 rounded text-[10px]">
                Sem site
              </span>
            )}
          </div>
        </div>
      )}

      {/* Quick Move Dropdown */}
      <div className="pt-1.5 flex items-center justify-between text-[10px] text-slate-400">
        <span>Mover:</span>
        <select
          value={card.column_id}
          onChange={(e) => onMoveCard(card.id, e.target.value)}
          className="text-[10px] bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-600 outline-none hover:border-slate-300"
        >
          <option value={card.column_id} disabled>
            Selecionar etapa...
          </option>
          {otherColumns.map((c) => (
            <option key={c.id} value={c.id}>
              → {c.title}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
