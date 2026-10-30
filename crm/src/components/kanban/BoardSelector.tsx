'use client';

import React, { useState } from 'react';
import type { Board } from '@/types';
import { Layers, Plus, Check, X, Trash2 } from 'lucide-react';

interface BoardSelectorProps {
  boards: Board[];
  selectedBoardId: string;
  onSelectBoard: (boardId: string) => void;
  onBoardCreated: () => void;
  onDeleteBoard?: (boardId: string) => void;
}

export function BoardSelector({
  boards,
  selectedBoardId,
  onSelectBoard,
  onBoardCreated,
  onDeleteBoard,
}: BoardSelectorProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<'leads' | 'tasks'>('leads');
  const [loading, setLoading] = useState(false);

  async function handleCreateBoard(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), type: newType }),
      });

      if (res.ok) {
        const data = await res.json();
        setNewTitle('');
        setIsCreating(false);
        onBoardCreated();
        if (data.board?.id) {
          onSelectBoard(data.board.id);
        }
      }
    } catch (err) {
      console.error('Error creating board:', err);
    } finally {
      setLoading(false);
    }
  }

  const selectedBoard = boards.find((b) => b.id === selectedBoardId);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
          <Layers className="w-4 h-4 text-blue-600" />
          <span>Quadro:</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {boards.map((b) => (
            <button
              key={b.id}
              onClick={() => onSelectBoard(b.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedBoardId === b.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {b.title}
            </button>
          ))}

          {/* Delete active board button if more than 1 board exists */}
          {onDeleteBoard && boards.length > 1 && selectedBoard && (
            <button
              onClick={() => onDeleteBoard(selectedBoard.id)}
              title={`Excluir quadro "${selectedBoard.title}"`}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div>
        {!isCreating ? (
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo Quadro
          </button>
        ) : (
          <form onSubmit={handleCreateBoard} className="flex items-center gap-2">
            <input
              type="text"
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Nome do quadro..."
              className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 w-40"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as any)}
              className="px-2 py-1 text-xs border border-slate-300 rounded-lg outline-none"
            >
              <option value="leads">Funil Leads</option>
              <option value="tasks">Tarefas</option>
            </select>
            <button
              type="submit"
              disabled={loading || !newTitle.trim()}
              className="p-1 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
