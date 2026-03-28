"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/services/apiClient";
import { GradeBadge } from "@/components/GradeBadge";
import { GradeEditor, GradeItem } from "@/components/GradeEditor";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";

interface GradeTemplate {
  id: string;
  name: string;
  grades: GradeItem[];
  createdAt: string;
}

const DEFAULT_GRADES: GradeItem[] = [
  { id: "1", name: "超神", displayOrder: 1, colorCode: "#FFD700", bgColorCode: "#FFF8E1" },
  { id: "2", name: "神", displayOrder: 2, colorCode: "#9C27B0", bgColorCode: "#F3E5F5" },
  { id: "3", name: "一般", displayOrder: 3, colorCode: "#2196F3", bgColorCode: "#E3F2FD" },
  { id: "4", name: "爛", displayOrder: 4, colorCode: "#9E9E9E", bgColorCode: "#F5F5F5" },
];

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function GradeTemplatesPage() {
  const [templates, setTemplates] = useState<GradeTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<GradeTemplate | null>(null);
  const [formName, setFormName] = useState("");
  const [formGrades, setFormGrades] = useState<GradeItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  function loadTemplates() {
    setIsLoading(true);
    apiClient
      .get<GradeTemplate[]>("/api/v1/admin/grade-templates")
      .then((data) => {
        setTemplates(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "載入失敗");
        setIsLoading(false);
      });
  }

  function openCreate() {
    setEditingTemplate(null);
    setFormName("");
    setFormGrades(DEFAULT_GRADES.map((g) => ({ ...g, id: genId() })));
    setModalOpen(true);
  }

  function openEdit(template: GradeTemplate) {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormGrades(template.grades);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingTemplate(null);
  }

  async function handleSave() {
    if (!formName.trim()) {
      alert("請輸入模板名稱");
      return;
    }
    setIsSaving(true);
    try {
      const body = { name: formName.trim(), grades: formGrades };
      if (editingTemplate) {
        const updated = await apiClient.put<GradeTemplate>(
          `/api/v1/admin/grade-templates/${editingTemplate.id}`,
          body,
        );
        setTemplates((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t)),
        );
      } else {
        const created = await apiClient.post<GradeTemplate>(
          "/api/v1/admin/grade-templates",
          body,
        );
        setTemplates((prev) => [...prev, created]);
      }
      closeModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(template: GradeTemplate) {
    if (!confirm(`確定要刪除模板「${template.name}」嗎？`)) return;
    try {
      await apiClient.delete(`/api/v1/admin/grade-templates/${template.id}`);
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "刪除失敗");
    }
  }

  const inputCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">等級模板</h1>
          <p className="text-sm text-slate-500">管理賞品等級樣式模板</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          <span>+</span> 建立模板
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <LoadingSkeleton rows={4} columns={3} />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon="🏷️"
          title="尚無等級模板"
          description="點擊「建立模板」新增第一個等級模板"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => {
            const sorted = [...template.grades].sort(
              (a, b) => a.displayOrder - b.displayOrder,
            );
            return (
              <div
                key={template.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-slate-900">{template.name}</h3>
                    <p className="text-xs text-slate-400">
                      {template.createdAt
                        ? new Date(template.createdAt).toLocaleDateString("zh-TW")
                        : "—"}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(template)}
                      className="rounded px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 border border-indigo-200 transition-colors"
                    >
                      編輯
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(template)}
                      className="rounded px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 transition-colors"
                    >
                      刪除
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sorted.map((grade) => (
                    <GradeBadge
                      key={grade.id}
                      name={grade.name}
                      colorCode={grade.colorCode}
                      bgColorCode={grade.bgColorCode}
                      size="sm"
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingTemplate ? "編輯模板" : "建立模板"}
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={closeModal}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
            >
              {isSaving ? "儲存中…" : "儲存"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              模板名稱
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="輸入模板名稱"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              等級設定
            </label>
            <GradeEditor grades={formGrades} onChange={setFormGrades} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
