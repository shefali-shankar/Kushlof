import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";

import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/FormFields";

// Helpers for editing lists immutably.
export function replaceItemAt<Item>(items: Item[], itemIndex: number, newItem: Item): Item[] {
  return items.map((existingItem, currentIndex) => (currentIndex === itemIndex ? newItem : existingItem));
}

export function removeItemAt<Item>(items: Item[], itemIndex: number): Item[] {
  return items.filter((_, currentIndex) => currentIndex !== itemIndex);
}

export function moveItem<Item>(items: Item[], fromIndex: number, toIndex: number): Item[] {
  if (toIndex < 0 || toIndex >= items.length) return items;
  const reorderedItems = [...items];
  const [movedItem] = reorderedItems.splice(fromIndex, 1);
  reorderedItems.splice(toIndex, 0, movedItem);
  return reorderedItems;
}

// Up / down / delete buttons shown on each list entry.
export function EntryActions({
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <button type="button" onClick={onMoveUp} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Move up">
        <ArrowUp className="h-4 w-4" />
      </button>
      <button type="button" onClick={onMoveDown} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Move down">
        <ArrowDown className="h-4 w-4" />
      </button>
      <button type="button" onClick={onRemove} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// An editable list of bullet points.
export function BulletListEditor({ bullets, onChange }: { bullets: string[]; onChange: (updatedBullets: string[]) => void }) {
  return (
    <div className="space-y-2">
      {bullets.map((bulletText, bulletIndex) => (
        <div key={bulletIndex} className="group flex items-start gap-2">
          <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
          <TextArea
            value={bulletText}
            rows={2}
            className="min-h-0 flex-1 resize-y"
            placeholder="Start with an action verb and include a measurable result"
            onChange={(changeEvent) => onChange(replaceItemAt(bullets, bulletIndex, changeEvent.target.value))}
          />
          <div className="opacity-60 transition group-hover:opacity-100">
            <EntryActions
              onMoveUp={() => onChange(moveItem(bullets, bulletIndex, bulletIndex - 1))}
              onMoveDown={() => onChange(moveItem(bullets, bulletIndex, bulletIndex + 1))}
              onRemove={() => onChange(removeItemAt(bullets, bulletIndex))}
            />
          </div>
        </div>
      ))}
      <Button variant="ghost" size="sm" onClick={() => onChange([...bullets, ""])}>
        <Plus className="h-4 w-4" /> Add bullet point
      </Button>
    </div>
  );
}

// Chips for short values such as skills. Press Enter or comma to add one.
export function TagInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (updatedTags: string[]) => void; placeholder?: string }) {
  const [draftTag, setDraftTag] = useState("");

  function addDraftTag() {
    const newTags = draftTag
      .split(",")
      .map((tagText) => tagText.trim())
      .filter((tagText) => tagText && !tags.includes(tagText));
    if (newTags.length) onChange([...tags, ...newTags]);
    setDraftTag("");
  }

  function handleKeyDown(keyEvent: KeyboardEvent<HTMLInputElement>) {
    if (keyEvent.key === "Enter" || keyEvent.key === ",") {
      keyEvent.preventDefault();
      addDraftTag();
    } else if (keyEvent.key === "Backspace" && !draftTag && tags.length) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5 shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
      {tags.map((tagText) => (
        <span key={tagText} className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-sm text-brand-700">
          {tagText}
          <button type="button" onClick={() => onChange(tags.filter((existingTag) => existingTag !== tagText))} className="text-brand-400 hover:text-brand-700" aria-label={`Remove ${tagText}`}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={draftTag}
        onChange={(changeEvent) => setDraftTag(changeEvent.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addDraftTag}
        placeholder={tags.length ? "" : placeholder}
        className="min-w-24 flex-1 border-0 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-slate-400"
      />
    </div>
  );
}
