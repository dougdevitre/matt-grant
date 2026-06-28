// Declarative specs for the volunteer "reference data" tables (Roles, Skills, Commitment Levels,
// Geo Hierarchy) — the small lookup tables that power task matching. One spec per table drives a
// GENERIC spec-driven CRUD editor (lib/airtable/reference-data.ts + ReferenceDataManager), so
// adding/adjusting a reference table is a data edit here, not new bespoke code.
//
// Client-safe: only data + types, no server-only imports (the client editor imports these for
// rendering). Field `field` values MUST match the Airtable column names AND the dashboard
// Editable Fields list in each base's Front-End Access control table. Linked-record and
// attachment fields are intentionally omitted — those stay curated in Airtable.
import { AIRTABLE_BASES, type BaseKey } from "@/lib/airtable/registry";

export type RefFieldType = "text" | "longtext" | "select" | "number" | "percent";
export type RefField = {
  key: string; // form field name + row value key
  field: string; // Airtable column name
  label: string;
  type: RefFieldType;
  required?: boolean;
  options?: readonly string[]; // for type "select"
};
export type RefTableSpec = {
  id: string; // url-safe id used by the actions to resolve the spec
  base: BaseKey;
  tableId: string;
  tableName: string; // MUST match the control-table "Table" cell
  label: string; // section heading
  blurb: string;
  fields: RefField[]; // first field is the title/primary
};

const V = AIRTABLE_BASES.volunteer.tables;

export const REFERENCE_TABLES: RefTableSpec[] = [
  {
    id: "roles",
    base: "volunteer",
    tableId: V.roles,
    tableName: "Roles",
    label: "Roles",
    blurb: "Volunteer roles — each bundles a set of tasks.",
    fields: [
      { key: "name", field: "Name", label: "Name", type: "text", required: true },
      {
        key: "category",
        field: "Role Category",
        label: "Role Category",
        type: "select",
        options: [
          "Field / Canvass", "Phone / Digital", "Events", "Data / Office",
          "Leadership", "Surrogate / Coalition", "Election Day", "Finance",
        ],
      },
      { key: "status", field: "Status", label: "Status", type: "select", options: ["Todo", "In progress", "Done"] },
      { key: "notes", field: "Notes", label: "Notes", type: "longtext" },
    ],
  },
  {
    id: "skills",
    base: "volunteer",
    tableId: V.skills,
    tableName: "Skills",
    label: "Skills",
    blurb: "Volunteer skills catalog — match tasks to a volunteer's strengths.",
    fields: [
      { key: "name", field: "Skill", label: "Skill", type: "text", required: true },
      { key: "description", field: "Description", label: "Description", type: "longtext" },
    ],
  },
  {
    id: "commitment",
    base: "volunteer",
    tableId: V.commitmentLevels,
    tableName: "Commitment Levels",
    label: "Commitment Levels",
    blurb: "Commitment tiers — match tasks to how much time a volunteer can give.",
    fields: [
      { key: "name", field: "Level", label: "Level", type: "text", required: true },
      { key: "hours", field: "Typical Hours", label: "Typical Hours", type: "text" },
      { key: "description", field: "Description", label: "Description", type: "longtext" },
    ],
  },
  {
    id: "geo",
    base: "volunteer",
    tableId: V.geoHierarchy,
    tableName: "Geo Hierarchy",
    label: "Geo Hierarchy",
    blurb: "MO-02 geographic targeting lookup (ZIP → county → school district → city → precinct).",
    fields: [
      { key: "name", field: "Area Name", label: "Area Name", type: "text", required: true },
      {
        key: "level",
        field: "Geo Level",
        label: "Geo Level",
        type: "select",
        options: ["District-wide", "County", "School District", "City/Town", "Precinct", "Neighborhood"],
      },
      { key: "parent", field: "Parent Area", label: "Parent Area", type: "text" },
      { key: "notes", field: "Notes", label: "Notes", type: "longtext" },
    ],
  },
];

// Field-ops assignment tables (the canvass + phone/text assignment units). Same generic editor;
// their linked `Area` (→ Geo Hierarchy) stays curated in Airtable, so it is NOT in the spec/Editable
// Fields — consistent with how Task Templates / reference tables leave linked fields to Airtable.
export const FIELDOPS_TABLES: RefTableSpec[] = [
  {
    id: "canvassTurf",
    base: "volunteer",
    tableId: V.canvassTurf,
    tableName: "Canvass Turf",
    label: "Canvass Turf",
    blurb: "Walkable turf packets for door-to-door canvassing (link the Area in Airtable).",
    fields: [
      { key: "name", field: "Turf Name", label: "Turf Name", type: "text", required: true },
      { key: "passType", field: "Pass Type", label: "Pass Type", type: "select", options: ["Voter ID", "Persuasion", "GOTV", "Literature drop", "Re-knock / Not-home"] },
      { key: "doors", field: "Doors", label: "Doors", type: "number" },
      { key: "registered", field: "Registered Voters", label: "Registered Voters", type: "number" },
      { key: "turnout", field: "Turnout %", label: "Turnout %", type: "percent" },
      { key: "gotv", field: "GOTV Target", label: "GOTV Target", type: "number" },
      { key: "priority", field: "Priority", label: "Priority", type: "select", options: ["High", "Medium", "Low"] },
      { key: "walkStatus", field: "Walk Status", label: "Walk Status", type: "select", options: ["Unassigned", "Assigned", "In progress", "Walked", "Needs re-knock"] },
      { key: "captain", field: "Assigned Captain", label: "Assigned Captain", type: "text" },
      { key: "notes", field: "Notes", label: "Notes", type: "longtext" },
    ],
  },
  {
    id: "contactLists",
    base: "volunteer",
    tableId: V.contactLists,
    tableName: "Contact Lists",
    label: "Contact Lists",
    blurb: "Phone & text call lists — the assignment unit for phone/text banking (link the Area in Airtable).",
    fields: [
      { key: "name", field: "List Name", label: "List Name", type: "text", required: true },
      { key: "channel", field: "Channel", label: "Channel", type: "select", options: ["Phone", "Text"] },
      { key: "passType", field: "Pass Type", label: "Pass Type", type: "select", options: ["Voter ID", "Persuasion", "GOTV", "Ballot chase", "Donor thank-you"] },
      { key: "records", field: "Records", label: "Records", type: "number" },
      { key: "attempts", field: "Attempts", label: "Attempts", type: "number" },
      { key: "contacted", field: "Contacted", label: "Contacted", type: "number" },
      { key: "target", field: "Target", label: "Target", type: "number" },
      { key: "priority", field: "Priority", label: "Priority", type: "select", options: ["High", "Medium", "Low"] },
      { key: "status", field: "Status", label: "Status", type: "select", options: ["Unassigned", "Assigned", "In progress", "Complete"] },
      { key: "assignedTo", field: "Assigned To", label: "Assigned To", type: "text" },
      { key: "notes", field: "Notes", label: "Notes", type: "longtext" },
    ],
  },
];

// Every spec-driven table, across pages — so the shared actions can resolve any specId.
export const ALL_SPEC_TABLES: RefTableSpec[] = [...REFERENCE_TABLES, ...FIELDOPS_TABLES];

export const refSpecById = (id: string): RefTableSpec | undefined =>
  ALL_SPEC_TABLES.find((t) => t.id === id);
