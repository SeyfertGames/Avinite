import { Kind, type TObject } from "@sinclair/typebox";
import {
  createInsertSchema,
  createSelectSchema,
  type BuildSchema,
} from "drizzle-typebox";
import type { Table } from "drizzle-orm";
import { table } from "./schema";

type Spread<
  T extends TObject | Table,
  Mode extends "select" | "insert" | undefined,
> =
  T extends TObject<infer Fields>
    ? {
        [K in keyof Fields]: Fields[K];
      }
    : T extends Table
      ? Mode extends "select"
        ? BuildSchema<"select", T["_"]["columns"], undefined>["properties"]
        : Mode extends "insert"
          ? BuildSchema<"insert", T["_"]["columns"], undefined>["properties"]
          : Record<string, never>
      : Record<string, never>;

export const spread = <
  T extends TObject | Table,
  Mode extends "select" | "insert" | undefined,
>(
  schema: T,
  mode?: Mode,
): Spread<T, Mode> => {
  const newSchema: Record<string, unknown> = {};
  let resolved: TObject;

  switch (mode) {
    case "insert":
    case "select":
      if (Kind in schema) {
        resolved = schema as TObject;
        break;
      }
      resolved =
        mode === "insert"
          ? createInsertSchema(schema as Table)
          : createSelectSchema(schema as Table);
      break;
    default:
      if (!(Kind in schema)) throw new Error("Expected a TObject schema");
      resolved = schema as TObject;
  }

  for (const key of Object.keys(resolved.properties)) {
    newSchema[key] = resolved.properties[key];
  }

  return newSchema as Spread<T, Mode>;
};

export const spreads = <
  T extends Record<string, TObject | Table>,
  Mode extends "select" | "insert" | undefined,
>(
  models: T,
  mode?: Mode,
): { [K in keyof T]: Spread<T[K], Mode> } => {
  const newSchema: Record<string, unknown> = {};
  for (const key of Object.keys(models)) {
    newSchema[key] = spread(models[key]!, mode);
  }
  return newSchema as { [K in keyof T]: Spread<T[K], Mode> };
};

const _avatarInsert = createInsertSchema(table.avatars);
const _avatarSelect = createSelectSchema(table.avatars);

export const avatarInsertFields = spread(_avatarInsert);
export const avatarSelectFields = spread(_avatarSelect);
