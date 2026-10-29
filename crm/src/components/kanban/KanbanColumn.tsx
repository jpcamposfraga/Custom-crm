'use client';

import React, { useState } from 'react';
import type { Column, Card, Lead } from '@/types';
import { KanbanCard } from './KanbanCard';
import { Plus, Trash2, CheckCircle2, XCircle, Check, X } from 'lucide-react';

interface KanbanColumnProps {
  column: Column;
  allColumns: Column[];
  cards: Card[];
  onMoveCard: (cardId: string, targetColId: string) => void;
  onDeleteCard: (cardId: string) => void;
  onDeleteColumn: (columnId: string) => void;
  onAddCard: (columnId: string, title: string, description?: string) => void;
  onOpenWhatsApp: (lead: Lead) => void;
}

export function KanbanColumn({
  column,
  allColumns,
  cards,
  onMoveCard,
  onDeleteCard,
  onDeleteColumn,
  onAddCard,
  onOpenWhatsApp,
}: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardDesc, setNewCardDesc] = useState('');

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const cardId = e.dataTransfer.getData('text/plain');
    if (cardId) {
      onMoveCard(cardId, column.id);
    }
  }

  function handleCreateCard(e: React.FormEvent) {
    e.preventDefault();
    if (!newCardTitle.trim()) return;
    onAddCard(column.id, newCardTitle.trim(), newCardDesc.trim() || undefined);
    setNewCardTitle('');
    setNewCardDesc('');
    setIsAddingCard(false);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`flex flex-col w-80 shrink-0 bg-slate-100/80 rounded-2xl border transition-all max-h-[calc(100vh-190px)] ${
        isDragOver
          ? 'border-blue-500 bg-blue-50/50 shadow-md ring-2 ring-blue-400/20'
          : 'border-slate-200/80'
      }`}
    >
      {/* Column Header */}
      <div className="p-3.5 border-b border-slate-200/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800 text-xs tracking-wide">
            {column.title}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white text-slate-600 border border-slate-200 shadow-2xs">
            {cards.length}
          </span>
          {column.is_converted_stage === 1 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-0.5">
              <CheckCircle2 className="w-2.5 h-2.5" /> Ganho
            </span>
          )}
          {column.is_lost_stage === 1 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 flex items-center gap-0.5">
              <XCircle className="w-2.5 h-2.5" /> Perdido
            </span>
          )}
        </div>

        <button
          onClick={() => onDeleteColumn(column.id)}
          title="Excluir coluna"
          className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-200/50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Cards List */}
      <div className="p-3 overflow-y-auto space-y-2.5 flex-1 min-h-[150px]">
        {cards.map((card) => (
          <KanbanCard
            key={card.id}
            card={card}
            columns={allColumns}
            onMoveCard={onMoveCard}
            onDeleteCard={onDeleteCard}
            onOpenWhatsApp={onOpenWhatsApp}
          />
        ))}

        {cards.length === 0 && !isAddingCard && (
          <div className="h-28 border-2 border-dashed border-slate-200/80 rounded-xl flex items-center justify-center text-[11px] text-slate-400">
            Arraste um card para cá
          </div>
        )}

        {/* Add Card Inline Form */}
        {isAddingCard && (
          <form
            onSubmit={handleCreateCard}
            className="bg-white p-3 rounded-xl border border-blue-400 shadow-sm space-y-2"
          >
            <input
              type="text"
              autoFocus
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              placeholder="Título do card / lead..."
              className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-blue-500"
            />
            <textarea
              rows={2}
              value={newCardDesc}
              onChange={(e) => setNewCardDesc(e.target.value)}
              placeholder="Descrição ou observação rápida..."
              className="w-full text-xs border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingCard(false)}
                className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!newCardTitle.trim()}
                className="px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded"
              >
                Adicionar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Footer: Quick Add Card Button */}
      {!isAddingCard && (
        <div className="p-2.5 border-t border-slate-200/60">
          <button
            onClick={() => setIsAddingCard(true)}
            className="w-full py-1.5 px-3 rounded-xl text-xs font-semibold text-slate-600 hover:text-blue-700 hover:bg-white/80 transition-all flex items-center justify-center gap-1.5 border border-transparent hover:border-slate-200"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar Card
          </button>
        </div>
      )}
    </div>
  );
}
