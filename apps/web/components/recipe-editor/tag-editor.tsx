"use client";

import { XIcon } from "@phosphor-icons/react";
import {
  TAG_KINDS,
  type TagInput,
  type TagKind,
} from "@workspace-template/data/recipe/schema";
import { Badge } from "@workspace-template/ui/components/badge";
import { Button } from "@workspace-template/ui/components/button";
import { Input } from "@workspace-template/ui/components/input";
import { type KeyboardEvent, useId, useState } from "react";

export const TAG_KIND_LABELS: Record<TagKind, string> = {
  COURSE: "Course",
  CUISINE: "Cuisine",
  DIET: "Diet",
  GENERAL: "Other",
};

/**
 * Tags grouped by kind. Suggestions come from existing tags; typing a new name
 * creates it on save.
 */
export function TagEditor({
  onChange,
  suggestions,
  tags,
}: {
  onChange: (tags: TagInput[]) => void;
  suggestions: TagInput[];
  tags: TagInput[];
}) {
  const listId = useId();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<TagKind>("GENERAL");

  function add() {
    const trimmed = name.trim();
    if (
      !trimmed ||
      tags.some((tag) => tag.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      setName("");
      return;
    }
    const existing = suggestions.find(
      (tag) => tag.name.toLowerCase() === trimmed.toLowerCase()
    );
    onChange([...tags, existing ?? { kind, name: trimmed }]);
    setName("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      add();
    }
  }

  return (
    <fieldset className="space-y-3">
      <legend className="mb-3 font-heading text-2xl">Tags</legend>
      {TAG_KINDS.map((tagKind) => {
        const group = tags.filter((tag) => tag.kind === tagKind);
        if (!group.length) {
          return null;
        }
        return (
          <div className="flex flex-wrap items-center gap-2" key={tagKind}>
            <span className="w-16 text-muted-foreground text-sm">
              {TAG_KIND_LABELS[tagKind]}
            </span>
            {group.map((tag) => (
              <Badge className="gap-1 pr-1" key={tag.name} variant="secondary">
                {tag.name}
                <button
                  aria-label={`Remove ${tag.name}`}
                  className="rounded-full p-0.5 hover:bg-foreground/10"
                  onClick={() => onChange(tags.filter((item) => item !== tag))}
                  type="button"
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label="Tag name"
          className="max-w-56"
          list={listId}
          maxLength={50}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a tag"
          value={name}
        />
        <datalist id={listId}>
          {suggestions.map((tag) => (
            <option key={`${tag.kind}-${tag.name}`} value={tag.name}>
              {TAG_KIND_LABELS[tag.kind]}
            </option>
          ))}
        </datalist>
        <select
          aria-label="Tag kind"
          className="h-8 rounded-2xl border border-input bg-transparent px-3 text-sm"
          onChange={(event) => setKind(event.target.value as TagKind)}
          value={kind}
        >
          {TAG_KINDS.map((tagKind) => (
            <option key={tagKind} value={tagKind}>
              {TAG_KIND_LABELS[tagKind]}
            </option>
          ))}
        </select>
        <Button onClick={add} variant="outline">
          Add tag
        </Button>
      </div>
    </fieldset>
  );
}
