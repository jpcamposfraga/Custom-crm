'use client';

import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, X, Check, Loader2, FileText, AlertCircle } from 'lucide-react';
import type { ImportAnalysisResult, Board, Column } from '@/types';
import { ImportPreview } from './ImportPreview';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CsvImportModal({ isOpen, onClose, onSuccess }: CsvImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [analysis, setAnalysis] = useState<ImportAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [boards, setBoards] = useState<Board[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');
  const [selectedColumnId, setSelectedColumnId] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchBoardsAndColumns();
    } else {
      // reset state on close
      setFile(null);
      setCsvContent('');
      setAnalysis(null);
      setError(null);
    }
  }, [isOpen]);

  async function fetchBoardsAndColumns() {
    try {
      const res = await fetch('/api/boards');
      if (res.ok) {
        const data = await res.json();
        setBoards(data.boards || []);
        if (data.boards && data.boards.length > 0) {
          const defaultBoard = data.boards[0];
          setSelectedBoardId(defaultBoard.id);
          setColumns(defaultBoard.columns || []);
          if (defaultBoard.columns && defaultBoard.columns.length > 0) {
            setSelectedColumnId(defaultBoard.columns[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching boards', err);
    }
  }

  function handleBoardChange(boardId: string) {
    setSelectedBoardId(boardId);
    const board = boards.find(b => b.id === boardId) as any;
    if (board && board.columns && board.columns.length > 0) {
      setColumns(board.columns);
      setSelectedColumnId(board.columns[0].id);
    } else {
      setColumns([]);
      setSelectedColumnId('');
    }
  }

  async function processFile(selectedFile: File) {
    setFile(selectedFile);
    setError(null);
    setAnalyzing(true);

    try {
      const text = await selectedFile.text();
      setCsvContent(text);

      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: text, analyzeOnly: true }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao analisar arquivo');
      }

      const data: ImportAnalysisResult = await res.json();
      setAnalysis(data);
    } catch (err: any) {
      setError(err.message || 'Falha ao processar arquivo CSV');
      setAnalysis(null);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleConfirmImport() {
    if (!analysis || analysis.newLeads.length === 0) return;
    setImporting(true);
    setError(null);

    try {
      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadsToInsert: analysis.newLeads,
          options: {
            boardId: selectedBoardId || undefined,
            columnId: selectedColumnId || undefined,
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao importar leads');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Falha ao executar importação');
    } finally {
      setImporting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Importar Leads via CSV</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Faça upload do CSV gerado pelo extrator com detecção automática de duplicados.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Upload Dropzone */}
          {!analysis && (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  processFile(e.dataTransfer.files[0]);
                }
              }}
              className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-blue-50/30"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    processFile(e.target.files[0]);
                  }
                }}
              />
              <UploadCloud className="w-12 h-12 text-slate-400 mb-3" />
              <p className="text-sm font-semibold text-slate-700">
                Clique para selecionar ou arraste o arquivo CSV aqui
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Suporta formato do scraper: nome, telefone, nicho, website, localização...
              </p>
              {analyzing && (
                <div className="mt-4 flex items-center gap-2 text-xs text-blue-600 font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" /> Analisando duplicados...
                </div>
              )}
            </div>
          )}

          {/* Analysis Preview */}
          {analysis && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-100 p-2.5 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span className="font-semibold text-slate-700">{file?.name}</span>
                </div>
                <button
                  onClick={() => {
                    setFile(null);
                    setAnalysis(null);
                  }}
                  className="text-blue-600 hover:underline font-medium"
                >
                  Trocar arquivo
                </button>
              </div>

              <ImportPreview analysis={analysis} />

              {/* Target Board & Column Selector */}
              {boards.length > 0 && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Destino: Kanban Board
                    </label>
                    <select
                      value={selectedBoardId}
                      onChange={(e) => handleBoardChange(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      {boards.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Estágio Inicial (Coluna)
                    </label>
                    <select
                      value={selectedColumnId}
                      onChange={(e) => setSelectedColumnId(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      {columns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={importing}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          {analysis && (
            <button
              onClick={handleConfirmImport}
              disabled={importing || analysis.newLeads.length === 0}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all flex items-center gap-1.5"
            >
              {importing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Importando...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Importar {analysis.newLeads.length} Novos Leads
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
