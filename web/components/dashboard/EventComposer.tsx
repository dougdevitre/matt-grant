"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EVENT_TYPES, EVENT_TYPE_LABELS, type EventRow, type EventType } from "@/lib/events/types";
import { isoToCentralLocal } from "@/lib/events/time";
import { saveEvent, parsePastedEmail, type EventState, type ParseState } from "@/app/dashboard/events/actions";
import { AREA_SUGGESTIONS } from "@/lib/actions";

type Fields = {
  title: string;
  type: EventType;
  start: string;
  end: string;
  allDay: string; // "true" | "false" (kept a string so the FormData loop stays simple)
  locName: string;
  locAddress: string;
  locCity: string;
  locCounty: string;
  lat: string;
  lng: string;
  description: string;
  capacity: string;
};

function fromRow(e?: EventRow): Fields {
  return {
    title: e?.title ?? "",
    type: e?.type ?? "rally",
    start: e ? isoToCentralLocal(e.start) : "",
    end: e?.end ? isoToCentralLocal(e.end) : "",
    allDay: e?.allDay ? "true" : "false",
    locName: e?.location.name ?? "",
    locAddress: e?.location.address ?? "",
    locCity: e?.location.city ?? "",
    locCounty: e?.location.county ?? "",
    lat: e?.lat != null ? String(e.lat) : "",
    lng: e?.lng != null ? String(e.lng) : "",
    description: e?.description ?? "",
    capacity: e?.capacity != null ? String(e.capacity) : "",
  };
}

const input = "w-full rounded-sm border border-line bg-paper px-3 py-2 text-sm text-ink";
const label = "block text-xs font-semibold text-slate";

export function EventComposer({ initial }: { initial?: EventRow }) {
  const router = useRouter();
  const [f, setF] = useState<Fields>(fromRow(initial));
  const set = (k: keyof Fields, v: string) => setF((p) => ({ ...p, [k]: v }));

  const [saveState, setSaveState] = useState<EventState | null>(null);
  const [parseState, setParseState] = useState<ParseState | null>(null);
  const [emailText, setEmailText] = useState("");
  const [showPaste, setShowPaste] = useState(!initial);
  const [savePending, startSave] = useTransition();
  const [parsePending, startParse] = useTransition();

  const onParse = () =>
    startParse(async () => {
      const fd = new FormData();
      fd.set("emailText", emailText);
      const res = await parsePastedEmail(fd);
      setParseState(res);
      if (res.ok && res.draft) {
        const d = res.draft;
        setF((p) => ({
          ...p,
          title: d.title || p.title,
          type: d.type,
          start: d.start ? isoToCentralLocal(d.start) : p.start,
          end: d.end ? isoToCentralLocal(d.end) : p.end,
          locName: d.location.name || p.locName,
          locAddress: d.location.address || p.locAddress,
          locCity: d.location.city || p.locCity,
          locCounty: d.location.county || p.locCounty,
          description: d.description || p.description,
        }));
        setShowPaste(false);
      }
    });

  const onSave = () =>
    startSave(async () => {
      const fd = new FormData();
      if (initial) fd.set("id", initial.id);
      for (const [k, v] of Object.entries(f)) fd.set(k, v);
      const res = await saveEvent(fd);
      setSaveState(res);
      if (res.ok && res.id) {
        if (!initial) router.push(`/dashboard/events/${res.id}`);
        else router.refresh();
      }
    });

  return (
    <div className="card p-6">
      {/* Paste-an-email → AI prefill (Phase 1; no inbound infra needed) */}
      {showPaste ? (
        <div className="mb-6 rounded-sm border border-dashed border-line bg-paper/60 p-4">
          <p className="text-xs font-semibold text-slate">Paste a forwarded event email — we&apos;ll fill the form</p>
          <textarea
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
            rows={4}
            placeholder="Paste the full email here (subject + body). Then click Parse."
            className={`${input} mt-2`}
          />
          <div className="mt-2 flex items-center gap-3">
            <button onClick={onParse} disabled={parsePending} className="btn-ghost text-xs disabled:opacity-50">
              {parsePending ? "Reading…" : "Parse email"}
            </button>
            <button onClick={() => setShowPaste(false)} className="text-xs text-field underline">Enter by hand</button>
            {parseState && <span className={`text-xs ${parseState.ok ? "text-field" : "text-brick"}`}>{parseState.message}</span>}
          </div>
        </div>
      ) : (
        !initial && (
          <button onClick={() => setShowPaste(true)} className="mb-4 text-xs text-field underline">
            ↑ Paste an event email instead
          </button>
        )
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label} htmlFor="ev-title">Title</label>
          <input id="ev-title" className={input} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Town hall in Chesterfield" />
        </div>
        <div>
          <label className={label} htmlFor="ev-type">Type</label>
          <select id="ev-type" className={input} value={f.type} onChange={(e) => set("type", e.target.value)}>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="ev-cap">Volunteer capacity (optional)</label>
          <input id="ev-cap" type="number" min={0} className={input} value={f.capacity} onChange={(e) => set("capacity", e.target.value)} placeholder="e.g. 10" />
        </div>
        <div>
          <label className={label} htmlFor="ev-start">Start (Central time)</label>
          <input id="ev-start" type="datetime-local" className={input} value={f.start} onChange={(e) => set("start", e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="ev-end">End (optional)</label>
          <input id="ev-end" type="datetime-local" className={input} value={f.end} onChange={(e) => set("end", e.target.value)} />
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            id="ev-allday"
            type="checkbox"
            checked={f.allDay === "true"}
            onChange={(e) => set("allDay", e.target.checked ? "true" : "false")}
            className="h-4 w-4 rounded border-line"
          />
          <label htmlFor="ev-allday" className="text-xs font-semibold text-slate">All-day event (the calendar download uses the date only)</label>
        </div>
        <div>
          <label className={label} htmlFor="ev-locname">Venue name</label>
          <input id="ev-locname" className={input} value={f.locName} onChange={(e) => set("locName", e.target.value)} placeholder="Chesterfield Library" />
        </div>
        <div>
          <label className={label} htmlFor="ev-locaddr">Address</label>
          <input id="ev-locaddr" className={input} value={f.locAddress} onChange={(e) => set("locAddress", e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="ev-loccity">City / town</label>
          <input id="ev-loccity" list="mo02-areas" className={input} value={f.locCity} onChange={(e) => set("locCity", e.target.value)} placeholder="Chesterfield" />
          <datalist id="mo02-areas">
            {AREA_SUGGESTIONS.map((a) => <option key={a} value={a} />)}
          </datalist>
        </div>
        <div>
          <label className={label} htmlFor="ev-loccounty">County (optional)</label>
          <input id="ev-loccounty" className={input} value={f.locCounty} onChange={(e) => set("locCounty", e.target.value)} placeholder="St. Louis County" />
        </div>
        <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="ev-lat">Latitude (optional)</label>
            <input id="ev-lat" type="number" step="any" className={input} value={f.lat} onChange={(e) => set("lat", e.target.value)} placeholder="auto from address" />
          </div>
          <div>
            <label className={label} htmlFor="ev-lng">Longitude (optional)</label>
            <input id="ev-lng" type="number" step="any" className={input} value={f.lng} onChange={(e) => set("lng", e.target.value)} placeholder="auto from address" />
          </div>
          <p className="text-xs text-slate sm:col-span-2">Leave blank to auto-locate from the address (US Census geocoder). Set both to pin the map marker manually.</p>
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="ev-desc">Description</label>
          <textarea id="ev-desc" rows={4} className={input} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="What to expect; how volunteers can help." />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button onClick={onSave} disabled={savePending} className="btn-primary disabled:opacity-50">
          {savePending ? "Saving…" : initial ? "Save changes" : "Create draft"}
        </button>
        {saveState && <span className={`text-sm ${saveState.ok ? "text-field" : "text-brick"}`}>{saveState.message}</span>}
        <span className="ml-auto text-xs text-slate">Dates are Central time. Publishing notifies captains &amp; volunteers.</span>
      </div>
    </div>
  );
}
