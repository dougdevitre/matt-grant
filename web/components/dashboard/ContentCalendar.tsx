"use client";

import { useActionState, useState } from "react";
import { POST_STATUS, POST_FORMAT } from "@/lib/social/calendar-options";
import type { CalendarPost, LinkOption } from "@/lib/social/content-calendar";
import { createPost, updatePost, removePost, type CalendarResult } from "@/app/dashboard/social/calendar/actions";

const STATUS_TONE: Record<string, string> = {
  Idea: "bg-slate/10 text-slate",
  Draft: "bg-yellow-100 text-yellow-900",
  Approved: "bg-blue-100 text-blue-800",
  Scheduled: "bg-purple-100 text-purple-800",
  Published: "bg-green-100 text-green-800",
};

type Options = { channels: LinkOption[]; pillars: LinkOption[]; campaigns: LinkOption[] };

const field = "rounded border border-slate/30 px-2 py-1 text-sm";

function LinkCheckboxes({ name, options, selected }: { name: string; options: LinkOption[]; selected: string[] }) {
  if (options.length === 0) return <p className="text-xs text-slate/60">None available.</p>;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {options.map((o) => (
        <label key={o.id} className="flex items-center gap-1 text-xs text-slate">
          <input type="checkbox" name={name} value={o.id} defaultChecked={selected.includes(o.id)} />
          {o.name}
        </label>
      ))}
    </div>
  );
}

// Shared create/edit form. `post` undefined = create mode.
function PostForm({
  post,
  options,
  onDone,
}: {
  post?: CalendarPost;
  options: Options;
  onDone: () => void;
}) {
  const action = post ? updatePost : createPost;
  const [res, formAction, busy] = useActionState<CalendarResult | null, FormData>(action, null);
  return (
    <form action={formAction} className="grid gap-3 p-4 sm:grid-cols-2">
      {post && <input type="hidden" name="id" value={post.id} />}
      <label className="text-xs text-slate sm:col-span-2">
        Title
        <input name="title" defaultValue={post?.title} required className={`mt-1 block w-full ${field}`} />
      </label>
      <label className="text-xs text-slate">
        Status
        <select name="status" defaultValue={post?.status ?? "Idea"} className={`mt-1 block w-full ${field}`}>
          {POST_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label className="text-xs text-slate">
        Format
        <select name="format" defaultValue={post?.format ?? ""} className={`mt-1 block w-full ${field}`}>
          <option value="">—</option>
          {POST_FORMAT.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label className="text-xs text-slate">
        Publish Date
        <input type="date" name="publishDate" defaultValue={post?.publishDate} className={`mt-1 block w-full ${field}`} />
      </label>
      <label className="text-xs text-slate">
        Approver
        <input name="approver" defaultValue={post?.approver} className={`mt-1 block w-full ${field}`} />
      </label>
      <div className="text-xs text-slate sm:col-span-2">
        <span className="mb-1 block">Channel</span>
        <LinkCheckboxes name="channelIds" options={options.channels} selected={post?.channelIds ?? []} />
      </div>
      <div className="text-xs text-slate">
        <span className="mb-1 block">Pillar</span>
        <LinkCheckboxes name="pillarIds" options={options.pillars} selected={post?.pillarIds ?? []} />
      </div>
      <div className="text-xs text-slate">
        <span className="mb-1 block">Campaign</span>
        <LinkCheckboxes name="campaignIds" options={options.campaigns} selected={post?.campaignIds ?? []} />
      </div>
      <label className="text-xs text-slate sm:col-span-2">
        Hook
        <textarea name="hook" defaultValue={post?.hook} rows={2} className={`mt-1 block w-full ${field}`} />
      </label>
      <label className="text-xs text-slate sm:col-span-2">
        Body / Caption
        <textarea name="body" defaultValue={post?.body} rows={3} className={`mt-1 block w-full ${field}`} />
      </label>
      <label className="text-xs text-slate">
        CTA
        <input name="cta" defaultValue={post?.cta} className={`mt-1 block w-full ${field}`} />
      </label>
      <label className="text-xs text-slate">
        Hashtags
        <input name="hashtags" defaultValue={post?.hashtags} className={`mt-1 block w-full ${field}`} />
      </label>
      <label className="text-xs text-slate sm:col-span-2">
        Notes
        <textarea name="notes" defaultValue={post?.notes} rows={2} className={`mt-1 block w-full ${field}`} />
      </label>
      <div className="flex items-center gap-2 sm:col-span-2">
        <button type="submit" disabled={busy} className="btn-ghost px-3 py-1 text-xs disabled:opacity-50">
          {busy ? "Saving…" : post ? "Save" : "Add post"}
        </button>
        <button type="button" onClick={onDone} className="btn-ghost px-3 py-1 text-xs">
          {post ? "Cancel" : "Close"}
        </button>
        {res && <span className={`text-xs ${res.ok ? "text-emerald-700" : "text-red-600"}`}>{res.message}</span>}
      </div>
    </form>
  );
}

function DeleteForm({ id }: { id: string }) {
  const [res, action, busy] = useActionState<CalendarResult | null, FormData>(removePost, null);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <button disabled={busy} className="btn-ghost px-2.5 py-1 text-xs text-red-600 disabled:opacity-50">
        {busy ? "…" : "Delete"}
      </button>
      {res && !res.ok && <span className="ml-2 text-xs text-red-600">{res.message}</span>}
    </form>
  );
}

function PostCard({ post, options, editable }: { post: CalendarPost; options: Options; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const nameOf = (ids: string[], opts: LinkOption[]) =>
    ids.map((id) => opts.find((o) => o.id === id)?.name).filter(Boolean).join(", ");
  if (editing) {
    return (
      <div className="card bg-slate/5">
        <PostForm post={post} options={options} onDone={() => setEditing(false)} />
      </div>
    );
  }
  return (
    <div className="card p-4">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="font-medium text-ink">{post.title}</h3>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[post.status] ?? "bg-slate/10 text-slate"}`}>
          {post.status || "—"}
        </span>
      </div>
      <p className="text-xs text-slate">
        {[post.publishDate || "Unscheduled", post.format, nameOf(post.channelIds, options.channels)]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {post.hook && <p className="mt-2 text-sm text-slate">{post.hook}</p>}
      {post.body && <p className="mt-1 whitespace-pre-wrap text-sm text-slate/80">{post.body}</p>}
      <p className="mt-2 text-xs text-slate/70">
        {[nameOf(post.pillarIds, options.pillars), nameOf(post.campaignIds, options.campaigns), post.cta, post.hashtags]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {editable && (
        <div className="mt-3 flex items-center gap-2">
          <button onClick={() => setEditing(true)} className="btn-ghost px-2.5 py-1 text-xs">Edit</button>
          <span className="ml-auto"><DeleteForm id={post.id} /></span>
        </div>
      )}
    </div>
  );
}

export function ContentCalendar({
  posts,
  options,
  editable,
}: {
  posts: CalendarPost[];
  options: Options;
  editable: boolean;
}) {
  const [creating, setCreating] = useState(false);
  return (
    <div>
      {editable && (
        <div className="mb-4">
          {creating ? (
            <div className="card bg-slate/5">
              <PostForm options={options} onDone={() => setCreating(false)} />
            </div>
          ) : (
            <button onClick={() => setCreating(true)} className="btn-ghost px-3 py-1.5 text-sm">+ New post</button>
          )}
        </div>
      )}
      {posts.length === 0 ? (
        <div className="card p-8 text-center text-slate">
          No planned posts yet.{editable ? " Use “New post” to start the calendar." : ""}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} options={options} editable={editable} />
          ))}
        </div>
      )}
    </div>
  );
}
