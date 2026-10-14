import * as schema from "./schema";

type QueryMock = {
  findMany: () => Promise<unknown[]>;
  findFirst: () => Promise<unknown | null>;
  findUnique: () => Promise<unknown | null>;
  create: (d: { data?: unknown }) => Promise<unknown>;
  update: (d: { data?: unknown }) => Promise<unknown>;
  delete: () => Promise<Record<string, unknown>>;
};

const noOp: QueryMock = {
  findMany: async () => [],
  findFirst: async () => null,
  findUnique: async () => null,
  create: async (d) => d?.data ?? {},
  update: async (d) => d?.data ?? {},
  delete: async () => ({}),
};

export const db = new Proxy({}, {
  get: (_, prop) =>
    prop === "query" ? new Proxy({}, { get: () => noOp }) : async () => [],
});

export function getDb() {
  return db;
}

export { schema };
