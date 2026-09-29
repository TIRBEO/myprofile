"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SearchField } from "@/components/ig-ui";
import {
  Helper,
  LinkRow,
  PageSkeleton,
  Panel,
  SettingsPage,
  StaticRow,
} from "@/components/settings-shell";
import { formatDate } from "@/lib/dates";
import { ARTICLES, DOC_CATEGORIES, searchDocs, type DocArticle } from "@/lib/docs";
import { POLICIES } from "@/lib/help-policies";
import { haptic } from "@/lib/haptics";
import { MAX_REQUESTS, readRequests, type SupportRequest } from "@/lib/support-requests";

/* ═══════════════════════════════════════════════════════════════════
   The documentation

   One article per thing you can do, per thing that can go wrong, each one
   ending on the page where it's actually done. They're written against
   this build rather than against the app it will become, which is why
   several of them say plainly that nothing leaves the device.

   The search reads the whole article — the steps, the captions, the
   questions at the bottom — not just the titles, so "where did that code
   go" finds the backup codes article rather than nothing.

   The index is a stack of boxes, one per category, each named above its own
   panel. Forty links in one undivided column reads as one long scroll; forty
   links in six panels reads as six subjects, which is what they are.
   ═══════════════════════════════════════════════════════════════════ */

const MIN_QUERY = 2;

/** `Privacy and safety` → `privacy-and-safety`, used as the anchor the jump
    chips scroll to. */
function categoryId(id: string) {
  return id.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function jumpTo(id: string) {
  haptic("light");
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Where a search hit came from, in the words a reader trusts. */
const WHERE: Record<string, string> = {
  title: "In the title",
  body: "In the introduction",
  step: "In one of the steps",
  note: "In the questions at the bottom",
};

/** One article as a row. No date on it: every article in this build was
    reviewed together, so forty identical dates say nothing a reader can use,
    and the article itself carries the one that matters. */
function DocRow({ article }: { article: DocArticle }) {
  return (
    <LinkRow href={`/settings/help/${article.slug}`} title={article.title} sub={article.sub} />
  );
}

export default function HelpPage() {
  const [requests, setRequests] = useState<SupportRequest[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setRequests(readRequests());
  }, []);

  if (!requests) return <PageSkeleton title="Help and documentation" sections={3} />;

  const needle = query.trim();
  const searching = needle.length >= MIN_QUERY;
  const hits = searching ? searchDocs(needle) : [];

  return (
    <SettingsPage title="Help and documentation" wide>
      <p className="max-w-[62ch] text-[14px] leading-relaxed text-muted">
        {ARTICLES.length} articles about what these settings do, and the pages to do it from.
        Everything here describes this build, so where something can&apos;t happen yet, the article
        says so rather than hinting.
      </p>

      <div className="mt-5 [&_input]:h-12 [&_input]:rounded-full [&_input]:border-transparent [&_input]:bg-surface-2">
        <SearchField value={query} onChange={setQuery} placeholder="Search the documentation" />
        {query.trim() && !searching ? (
          <p className="mt-2 px-1 text-[13px] text-muted">Type one more character to search.</p>
        ) : null}
      </div>

      {searching ? null : (
        <div className="mt-3.5 flex flex-wrap gap-2">
          {DOC_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => jumpTo(categoryId(category.id))}
 className="min-h-10 rounded-full border border-border bg-surface px-3.5 py-1.5 text-[13.5px] font-medium outline-none transition-colors hover:bg-surface-2"
            >
              {category.id}
            </button>
          ))}
        </div>
      )}

      {searching ? (
        hits.length ? (
          <div className="mt-8">
            <Panel
              title={`${hits.length} ${hits.length === 1 ? "article" : "articles"} for “${needle}”`}
              sub="Ordered by where the words turned up — an article named for your search comes before one that merely mentions it."
            >
              {hits.map((hit) => (
                <LinkRow
                  key={hit.article.slug}
                  href={`/settings/help/${hit.article.slug}`}
                  title={hit.article.title}
                  sub={`${WHERE[hit.where]} · ${hit.article.category}`}
                />
              ))}
            </Panel>
          </div>
        ) : (
          <Helper className="mt-8">
            Nothing found for “{needle}”. The search reads the whole article, so try something
            plain — “password”, “codes”, “email”, “deleted”, “cookies” or “points”.
          </Helper>
        )
      ) : (
        <div className="mt-10 flex flex-col gap-10">
          {DOC_CATEGORIES.map((category) => (
            <Panel
              key={category.id}
              id={categoryId(category.id)}
              title={category.id}
              sub={category.sub}
            >
              {ARTICLES.filter((article) => article.category === category.id).map((article) => (
                <DocRow key={article.slug} article={article} />
              ))}
            </Panel>
          ))}

          <Panel title="Policies" sub="The long versions, written for the same build.">
            {POLICIES.map((policy) => (
              <LinkRow
                key={policy.slug}
                href={`/settings/help/policy/${policy.slug}`}
                title={policy.title}
                sub={policy.sub}
              />
            ))}
          </Panel>

          <Panel
            title="Your requests"
            sub="A request is saved with its date and stays on this device — there's no message server in this build, so nothing is sent and no one is waiting on the other end."
          >
            {requests.length ? (
              requests.map((request) => (
                <StaticRow
                  key={request.id}
                  title={request.topic}
                  sub={
                    request.origin
                      ? `${request.message} — filed from ${request.origin.title}`
                      : request.message
                  }
                  right={formatDate(request.at)}
                />
              ))
            ) : (
              <p className="px-4 py-5 text-[13.5px] leading-relaxed text-muted sm:px-5">
                Nothing has been asked yet. Anything you save appears here with its date, on this
                device only.
              </p>
            )}
          </Panel>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/settings/help/support"
              onClick={() => haptic("light")}
 className="min-h-10 rounded-full bg-surface-3 px-4 py-2 text-[13.5px] font-semibold outline-none transition-colors hover:brightness-110"
            >
              Write to support
            </Link>
            <span className="text-[12.5px] text-muted">
              This browser keeps the {MAX_REQUESTS} most recent.
            </span>
          </div>
        </div>
      )}

      <Helper className="mt-10">
        Anything you type is searched on this device, against the text of the articles. Nothing is
        recorded and nothing is sent.
      </Helper>
    </SettingsPage>
  );
}
