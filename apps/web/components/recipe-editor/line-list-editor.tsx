"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  DotsSixVerticalIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { Button } from "@workspace-template/ui/components/button";
import { Input } from "@workspace-template/ui/components/input";
import { Textarea } from "@workspace-template/ui/components/textarea";
import { cn } from "@workspace-template/ui/lib/utils";
import {
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { type EditorRow, moveRow, newRow, splitPastedLines } from "./rows";

interface LineListEditorProps {
  addLabel: string;
  itemPlaceholder: string;
  label: string;
  maxLength: number;
  /** Steps are multi-line; ingredients are one line each. */
  multiline?: boolean;
  onChange: (rows: EditorRow[]) => void;
  /** Extra content under an item row, e.g. the parsed ingredient preview. */
  renderDetail?: (row: EditorRow) => ReactNode;
  rowClassName?: (row: EditorRow) => string | undefined;
  rows: EditorRow[];
}

/**
 * One row per line. Enter adds a row below, Backspace on an empty row removes
 * it, pasting several lines splits them into rows, rows reorder by drag or the
 * arrow buttons, and section headings group the rows after them.
 */
export function LineListEditor({
  addLabel,
  itemPlaceholder,
  label,
  maxLength,
  multiline = false,
  onChange,
  renderDetail,
  rowClassName,
  rows,
}: LineListEditorProps) {
  const inputs = useRef(
    new Map<string, HTMLInputElement | HTMLTextAreaElement>()
  );
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);

  useEffect(() => {
    if (focusKey) {
      inputs.current.get(focusKey)?.focus();
      setFocusKey(null);
    }
  }, [focusKey]);

  function update(key: string, text: string) {
    onChange(rows.map((row) => (row.key === key ? { ...row, text } : row)));
  }

  function insertAfter(index: number, inserted: EditorRow[]) {
    const next = [...rows];
    next.splice(index + 1, 0, ...inserted);
    onChange(next);
    setFocusKey(inserted.at(-1)?.key ?? null);
  }

  function remove(index: number) {
    const previous = rows[index - 1] ?? rows[index + 1];
    onChange(rows.filter((_, position) => position !== index));
    setFocusKey(previous?.key ?? null);
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    row: EditorRow,
    index: number
  ) {
    const newLineInStep = multiline && event.shiftKey;
    if (
      event.key === "Enter" &&
      !newLineInStep &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      insertAfter(index, [newRow("item")]);
    } else if (
      event.key === "Backspace" &&
      row.text === "" &&
      rows.length > 1
    ) {
      event.preventDefault();
      remove(index);
    }
  }

  function handlePaste(
    event: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    row: EditorRow,
    index: number
  ) {
    const lines = splitPastedLines(event.clipboardData.getData("text"));
    if (lines.length < 2 || row.kind === "section") {
      return;
    }
    event.preventDefault();
    const [first = "", ...rest] = lines;
    const next = rows.map((item) =>
      item.key === row.key ? { ...item, text: `${item.text}${first}` } : item
    );
    const inserted = rest.map((line) => newRow("item", line));
    next.splice(index + 1, 0, ...inserted);
    onChange(next);
    setFocusKey(inserted.at(-1)?.key ?? null);
  }

  function handleDrop(index: number) {
    const from = rows.findIndex((row) => row.key === dragKey);
    setDragKey(null);
    if (from >= 0) {
      onChange(moveRow(rows, from, index));
    }
  }

  return (
    <fieldset className="space-y-3">
      <legend className="mb-3 font-heading text-2xl">{label}</legend>
      <ol className="space-y-2">
        {rows.map((row, index) => {
          const Field = multiline && row.kind === "item" ? Textarea : Input;
          return (
            // biome-ignore lint/a11y/noNoninteractiveElementInteractions: pointer drop target only; keyboard users reorder with the move buttons.
            <li
              className={cn(
                "flex items-start gap-1 rounded-2xl p-1 transition-colors",
                dragKey === row.key && "opacity-50",
                rowClassName?.(row)
              )}
              key={row.key}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDrop(index)}
            >
              <button
                aria-label="Drag to reorder"
                className="mt-2 cursor-grab text-muted-foreground active:cursor-grabbing"
                draggable
                onDragEnd={() => setDragKey(null)}
                onDragStart={() => setDragKey(row.key)}
                tabIndex={-1}
                type="button"
              >
                <DotsSixVerticalIcon className="size-5" />
              </button>
              <div className="min-w-0 flex-1 space-y-1">
                <Field
                  aria-label={
                    row.kind === "section"
                      ? `${label} section heading`
                      : `${label} ${index + 1}`
                  }
                  className={cn(row.kind === "section" && "font-medium")}
                  maxLength={row.kind === "section" ? 100 : maxLength}
                  onChange={(event) => update(row.key, event.target.value)}
                  onKeyDown={(event) => handleKeyDown(event, row, index)}
                  onPaste={(event) => handlePaste(event, row, index)}
                  placeholder={
                    row.kind === "section"
                      ? "Section heading, e.g. For the sauce"
                      : itemPlaceholder
                  }
                  ref={(
                    element: HTMLInputElement | HTMLTextAreaElement | null
                  ) => {
                    if (element) {
                      inputs.current.set(row.key, element);
                    } else {
                      inputs.current.delete(row.key);
                    }
                  }}
                  value={row.text}
                />
                {row.kind === "item" && renderDetail?.(row)}
              </div>
              <Button
                aria-label="Move up"
                disabled={index === 0}
                onClick={() => onChange(moveRow(rows, index, index - 1))}
                size="icon-sm"
                variant="ghost"
              >
                <ArrowUpIcon />
              </Button>
              <Button
                aria-label="Move down"
                disabled={index === rows.length - 1}
                onClick={() => onChange(moveRow(rows, index, index + 1))}
                size="icon-sm"
                variant="ghost"
              >
                <ArrowDownIcon />
              </Button>
              <Button
                aria-label="Remove"
                onClick={() => remove(index)}
                size="icon-sm"
                variant="ghost"
              >
                <TrashIcon />
              </Button>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => insertAfter(rows.length - 1, [newRow("item")])}
          variant="outline"
        >
          <PlusIcon data-icon="inline-start" />
          {addLabel}
        </Button>
        <Button
          onClick={() =>
            insertAfter(rows.length - 1, [newRow("section"), newRow("item")])
          }
          variant="ghost"
        >
          Add section heading
        </Button>
      </div>
    </fieldset>
  );
}
