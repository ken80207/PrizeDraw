"use client";

import { GradeBadge } from "./GradeBadge";

export interface GradeItem {
  id: string;
  name: string;
  displayOrder: number;
  colorCode: string;
  bgColorCode: string;
}

interface GradeEditorProps {
  grades: GradeItem[];
  onChange: (grades: GradeItem[]) => void;
}

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

export function GradeEditor({ grades, onChange }: GradeEditorProps) {
  const sorted = [...grades].sort((a, b) => a.displayOrder - b.displayOrder);

  const updateGrade = (id: string, field: keyof GradeItem, value: unknown) => {
    onChange(grades.map((g) => (g.id === id ? { ...g, [field]: value } : g)));
  };

  const addGrade = () => {
    const maxOrder = grades.length > 0 ? Math.max(...grades.map((g) => g.displayOrder)) : 0;
    onChange([
      ...grades,
      {
        id: genId(),
        name: "",
        displayOrder: maxOrder + 1,
        colorCode: "#6B7280",
        bgColorCode: "#F3F4F6",
      },
    ]);
  };

  const removeGrade = (id: string) => {
    onChange(grades.filter((g) => g.id !== id));
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    const newGrades = [...sorted];
    const prevOrder = newGrades[index - 1].displayOrder;
    newGrades[index - 1] = { ...newGrades[index - 1], displayOrder: newGrades[index].displayOrder };
    newGrades[index] = { ...newGrades[index], displayOrder: prevOrder };
    onChange(newGrades);
  };

  const moveDown = (index: number) => {
    if (index >= sorted.length - 1) return;
    const newGrades = [...sorted];
    const nextOrder = newGrades[index + 1].displayOrder;
    newGrades[index + 1] = { ...newGrades[index + 1], displayOrder: newGrades[index].displayOrder };
    newGrades[index] = { ...newGrades[index], displayOrder: nextOrder };
    onChange(newGrades);
  };

  const inputCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

  return (
    <div className="space-y-4">
      {sorted.map((grade, idx) => (
        <div key={grade.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-col gap-0.5">
            <button type="button" onClick={() => moveUp(idx)} disabled={idx === 0} className="text-xs text-slate-400 hover:text-slate-600 disabled:opacity-30">▲</button>
            <button type="button" onClick={() => moveDown(idx)} disabled={idx === sorted.length - 1} className="text-xs text-slate-400 hover:text-slate-600 disabled:opacity-30">▼</button>
          </div>
          <input type="text" value={grade.name} onChange={(e) => updateGrade(grade.id, "name", e.target.value)} placeholder="等級名稱" className={`${inputCls} w-32`} />
          <label className="flex items-center gap-1 text-xs text-slate-500">
            字色
            <input type="color" value={grade.colorCode} onChange={(e) => updateGrade(grade.id, "colorCode", e.target.value)} className="h-8 w-8 cursor-pointer rounded border border-slate-300" />
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-500">
            底色
            <input type="color" value={grade.bgColorCode} onChange={(e) => updateGrade(grade.id, "bgColorCode", e.target.value)} className="h-8 w-8 cursor-pointer rounded border border-slate-300" />
          </label>
          <GradeBadge name={grade.name || "預覽"} colorCode={grade.colorCode} bgColorCode={grade.bgColorCode} />
          <button type="button" onClick={() => removeGrade(grade.id)} className="ml-auto text-sm text-red-500 hover:text-red-700">刪除</button>
        </div>
      ))}
      <button type="button" onClick={addGrade} className="rounded-lg border-2 border-dashed border-slate-300 px-4 py-2 text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600">+ 新增等級</button>
      {sorted.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 text-xs font-medium text-slate-500">預覽</p>
          <div className="flex flex-wrap gap-2">
            {sorted.map((g) => (
              <GradeBadge key={g.id} name={g.name || "未命名"} colorCode={g.colorCode} bgColorCode={g.bgColorCode} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
