'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { Board, Column, Card, Lead } from '@/types';
import { BoardSelector } from '@/components/kanban/BoardSelector';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { WhatsAppModal } from '@/components/whatsapp/WhatsAppModal';
import { LayoutGrid, CheckCircle2 } from 'lucide-react';

export default function KanbanPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');
  const [columns, setColumns] = useState<Column[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  // WhatsApp modal state
  const [selectedWhatsAppLead, setSelectedWhatsAppLead] = useState<Lead | null>(null);

  const fetchBoards = useCallback(async () => {
    try {
      const res = await fetch('/api/boards');
      if (res.ok) {
        const data = await res.json();
        const bList: Board[] = data.boards || [];
        setBoards(bList);
        if (bList.length > 0) {
          if (!selectedBoardId || !bList.some((b) => b.id === selectedBoardId)) {
            setSelectedBoardId(bList[0].id);
            setColumns((bList[0] as any).columns || []);
          } else {
            const current = bList.find((b) => b.id === selectedBoardId) as any;
            if (current) {
              setColumns(current.columns || []);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching boards:', err);
    }
  }, [selectedBoardId]);

  const fetchCards = useCallback(async (boardId: string) => {
    if (!boardId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cards?board_id=${encodeURIComponent(boardId)}`);
      if (res.ok) {
        const data = await res.json();
        setCards(data.cards || []);
      }
    } catch (err) {
      console.error('Error fetching cards:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  useEffect(() => {
    if (selectedBoardId) {
      const board = boards.find((b) => b.id === selectedBoardId) as any;
      if (board) {
        setColumns(board.columns || []);
      }
      fetchCards(selectedBoardId);
    }
  }, [selectedBoardId, boards, fetchCards]);

  async function handleMoveCard(cardId: string, targetColId: string) {
    // optimistic update
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, column_id: targetColId } : c))
    );

    try {
      await fetch('/api/cards', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cardId, column_id: targetColId }),
      });
      // Refresh to ensure any lead status updates sync properly
      fetchCards(selectedBoardId);
    } catch (err) {
      console.error('Failed to move card:', err);
      fetchCards(selectedBoardId);
    }
  }

  async function handleDeleteCard(cardId: string) {
    if (!confirm('Deseja excluir este card?')) return;
    setCards((prev) => prev.filter((c) => c.id !== cardId));

    try {
      await fetch(`/api/cards?id=${encodeURIComponent(cardId)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Failed to delete card:', err);
      fetchCards(selectedBoardId);
    }
  }

  async function handleDeleteBoard(boardId: string) {
    const boardToDelete = boards.find((b) => b.id === boardId);
    if (
      !confirm(
        `Deseja realmente excluir o quadro "${boardToDelete?.title || 'selecionado'}" e todos os cards contidos nele?`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/boards?id=${encodeURIComponent(boardId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erro ao excluir quadro');
        return;
      }
      const remaining = boards.filter((b) => b.id !== boardId);
      if (remaining.length > 0) {
        setSelectedBoardId(remaining[0].id);
      }
      fetchBoards();
    } catch (err) {
      console.error('Failed to delete board:', err);
    }
  }

  async function handleAddCard(columnId: string, title: string, description?: string) {
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board_id: selectedBoardId,
          column_id: columnId,
          title,
          description,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.card) {
          setCards((prev) => [...prev, data.card]);
        }
      }
    } catch (err) {
      console.error('Failed to add card:', err);
    }
  }

  async function handleAddColumn(
    boardId: string,
    title: string,
    isConverted: boolean,
    isLost: boolean
  ) {
    try {
      const res = await fetch('/api/columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board_id: boardId,
          title,
          is_converted_stage: isConverted,
          is_lost_stage: isLost,
        }),
      });

      if (res.ok) {
        fetchBoards();
      }
    } catch (err) {
      console.error('Failed to add column:', err);
    }
  }

  async function handleDeleteColumn(columnId: string) {
    if (!confirm('Deseja excluir esta coluna e todos os cards contidos nela?')) return;
    try {
      await fetch(`/api/columns?id=${encodeURIComponent(columnId)}`, {
        method: 'DELETE',
      });
      fetchBoards();
      fetchCards(selectedBoardId);
    } catch (err) {
      console.error('Failed to delete column:', err);
    }
  }

  const convertedCount = cards.filter((card) => {
    const col = columns.find((c) => c.id === card.column_id);
    return col?.is_converted_stage === 1;
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-blue-600" /> Funis & Kanban
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Arraste cards entre estágios para avançar negociações e converter oportunidades.
          </p>
        </div>

        {/* Metrics */}
        <div className="flex items-center gap-3 text-xs">
          <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm flex items-center gap-2">
            <span className="text-slate-500">Cards no Quadro:</span>
            <span className="font-bold text-slate-800">{cards.length}</span>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-slate-500">Ganhos / Convertidos:</span>
            <span className="font-bold text-emerald-700">{convertedCount}</span>
          </div>
        </div>
      </div>

      {/* Board Selector com suporte a Excluir Quadro */}
      <BoardSelector
        boards={boards}
        selectedBoardId={selectedBoardId}
        onSelectBoard={(id) => setSelectedBoardId(id)}
        onBoardCreated={fetchBoards}
        onDeleteBoard={handleDeleteBoard}
      />

      {/* Kanban Board */}
      {selectedBoardId && (
        <KanbanBoard
          boardId={selectedBoardId}
          columns={columns}
          cards={cards}
          onMoveCard={handleMoveCard}
          onDeleteCard={handleDeleteCard}
          onDeleteColumn={handleDeleteColumn}
          onAddColumn={handleAddColumn}
          onAddCard={handleAddCard}
          onOpenWhatsApp={(lead) => setSelectedWhatsAppLead(lead)}
        />
      )}

      {/* WhatsApp Modal */}
      {selectedWhatsAppLead && (
        <WhatsAppModal
          isOpen={!!selectedWhatsAppLead}
          lead={selectedWhatsAppLead}
          onClose={() => setSelectedWhatsAppLead(null)}
          onSent={() => fetchCards(selectedBoardId)}
        />
      )}
    </div>
  );
}
