"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Panel, Group } from "@/components/ig-ui";

export function PeopleScreen({
  title,
  description,
  emptyLabel = "No results found.",
}: {
  title: string;
  description: string;
  emptyLabel?: string;
}) {
  const [q, setQ] = useState("");
  return (
    <Panel title={title}>
      <p className="mb-6 text-[15px] leading-relaxed text-muted">{description}</p>
      <div className="mb-5 flex h-10 items-center gap-2.5 rounded-xl bg-faint px-3.5">
        <Search className="size-4 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search"
          placeholder="Search"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
        />
      </div>
      {q ? (
        <Group>
          <div className="px-5 py-4 text-[15px] text-muted">{emptyLabel}</div>
        </Group>
      ) : null}
    </Panel>
  );
}
