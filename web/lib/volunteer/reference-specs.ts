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

export type RefFieldType = "text" | "longtext" | "select";
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

export const refSpecById = (id: string): RefTableSpec | undefined =>
  REFERENCE_TABLES.find((t) => t.id === id);
