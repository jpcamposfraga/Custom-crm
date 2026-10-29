'use client';

import React, { useState } from 'react';
import type { Column, Card, Lead } from '@/types';
import { KanbanColumn } from './KanbanColumn';
import { Plus, Check, X } from 'lucide-react';

interface KanbanBoardProps {
  boardId: string;
  columns: Column[];
  cards: Card[];
  onMoveCard: (cardId: string, targetColId: string) => void;
  onDeleteCard: (cardId: string) => void;
  onDeleteColumn: (columnId: string) => void;
  onAddColumn: (boardId: string, title: string, isConverted: boolean, isLost: boolean) => void;
  onAddCard: (columnId: string, title: string, description?: string) => void;
  onOpenWhatsApp: (lead: Lead) => void;
}

export function KanbanBoard({
  boardId,
  columns,
  cards,
  onMoveCard,
  onDeleteCard,
  onDeleteColumn,
  onAddColumn,
  onAddCard,
  onOpenWhatsApp,
}: KanbanBoardProps) {
  const [isAddingCol, setIsAddingCol] = useState(false);
  const [colTitle, setColTitle] = useState('');
  const [isConverted, setIsConverted] = useState(false);
  const [isLost, setIsLost] = useState(false);

  function handleCreateColumn(e: React.FormEvent) {
    e.preventDefault();
    if (!colTitle.trim()) return;

    onAddColumn(boardId, colTitle.trim(), isConverted, isLost);
    setColTitle('');
    setIsConverted(false);
    setIsLost(false);
    setIsAddingCol(false);
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-6 pt-2 items-start">
      {columns.map((col) => {
        const columnCards = cards.filter((c) => c.column_id === col.id);
        return (
          <KanbanColumn
            key={col.id}
            column={col}
            allColumns={columns}
            cards={columnCards}
            onMoveCard={onMoveCard}
            onDeleteCard={onDeleteCard}
            onDeleteColumn={onDeleteColumn}
            onAddCard={onAddCard}
            onOpenWhatsApp={onOpenWhatsApp}
          />
        );
      })}

      {/* Add Column Button / Form */}
      <div className="w-80 shrink-0">
        {!isAddingCol ? (
          <button
            onClick={() => setIsAddingCol(true)}
            className="w-full py-4 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50/50 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nova Coluna / Estágio
          </button>
        ) : (
          <form
            onSubmit={handleCreateColumn}
            className="bg-white p-4 rounded-2xl border border-blue-400 shadow-sm space-y-3"
          >
            <h4 className="text-xs font-bold text-slate-800">Criar Novo Estágio</h4>
            <input
              type="text"
              autoFocus
              value={colTitle}
              onChange={(e) => setColTitle(e.target.value)}
              placeholder="Ex: Proposta Enviada..."
              className="w-full text-xs border border-slate-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="space-y-1.5 text-xs text-slate-600">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isConverted}
                  onChange={(e) => {
                    setIsConverted(e.target.checked);
                    if (e.target.checked) setIsLost(false);
                  }}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Marcar como Estágio Ganho (Convertido)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isLost}
                  onChange={(e) => {
                    setIsLost(e.target.checked);
                    if (e.target.checked) setIsConverted(false);
                  }}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <span>Marcar como Estágio Perdido</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddingCol(false)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!colTitle.trim()}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm"
              >
                Adicionar Estágio
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
