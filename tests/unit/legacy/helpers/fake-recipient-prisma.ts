import type { Recipient } from "@prisma/client";

type RecipientRecord = Recipient;

type WhereInput = {
  userId?: string;
  cep?: string;
  document?: string | null;
  nameSearch?: string;
  id?: string;
  isDefault?: boolean;
  cidade?: { equals: string; mode?: string } | string;
  city?: { equals: string; mode?: string } | string;
  uf?: string;
  name?: { contains: string; mode?: string };
  email?: { contains: string; mode?: string };
  OR?: WhereInput[];
  NOT?: WhereInput;
};

type OrderByInput = { [key: string]: "asc" | "desc" };
type OrderBy = OrderByInput | OrderByInput[];

type UpdateManyArgs = { where?: WhereInput; data: Record<string, unknown> };

type UpdateArgs = { where: { id: string }; data: Record<string, unknown> };

type FindManyArgs = {
  where?: WhereInput;
  orderBy?: OrderBy;
  skip?: number;
  take?: number;
};

type FindUniqueArgs = { where: { id: string } };

type CreateArgs = { data: Omit<RecipientRecord, "createdAt" | "updatedAt"> & Partial<Pick<RecipientRecord, "createdAt" | "updatedAt">> };

type CountArgs = { where?: WhereInput };

type FindFirstArgs = {
  where?: WhereInput;
  orderBy?: OrderBy;
};

type PrismaLike = {
  recipient: {
    count: (args: CountArgs) => Promise<number>;
    findMany: (args: FindManyArgs) => Promise<RecipientRecord[]>;
    findFirst: (args: FindFirstArgs) => Promise<RecipientRecord | null>;
    findUnique: (args: FindUniqueArgs) => Promise<RecipientRecord | null>;
    create: (args: CreateArgs) => Promise<RecipientRecord>;
    update: (args: UpdateArgs) => Promise<RecipientRecord>;
    updateMany: (args: UpdateManyArgs) => Promise<{ count: number }>;
    delete: (args: FindUniqueArgs) => Promise<RecipientRecord>;
  };
  $transaction: <T>(fn: (tx: PrismaLike) => Promise<T>) => Promise<T>;
};

function normalizeValue(value: unknown) {
  if (value && typeof value === "object" && "set" in (value as Record<string, unknown>)) {
    return (value as { set: unknown }).set;
  }
  return value;
}

function cloneRecord(record: RecipientRecord): RecipientRecord {
  return { ...record };
}

function matchesWhere(record: RecipientRecord, where?: WhereInput): boolean {
  if (!where) return true;

  if (where.userId && record.userId !== where.userId) return false;
  if (where.cep && record.cep !== where.cep) return false;
  if (where.document !== undefined && record.document !== where.document) return false;
  if (where.nameSearch && record.nameSearch !== where.nameSearch) return false;
  if (where.id && record.id !== where.id) return false;
  if (where.isDefault !== undefined && record.isDefault !== where.isDefault) return false;

  const cityFilter = (where as any).cidade ?? where.city;
  if (cityFilter) {
    const target = typeof cityFilter === "string" ? cityFilter : cityFilter.equals;
    if (!record.cidade.toLowerCase().includes(target.toLowerCase())) return false;
  }

  if (where.uf) {
    if (record.uf.toUpperCase() !== where.uf.toUpperCase()) return false;
  }

  if (where.name?.contains) {
    const term = where.name.contains.toLowerCase();
    if (!record.name.toLowerCase().includes(term)) return false;
  }

  if (where.email?.contains) {
    const term = where.email.contains.toLowerCase();
    if (!((record.email ?? "").toLowerCase().includes(term))) return false;
  }

  if (where.OR && where.OR.length > 0) {
    const orMatch = where.OR.some((clause) => matchesWhere(record, clause));
    if (!orMatch) return false;
  }

  if (where.NOT) {
    if (matchesWhere(record, where.NOT)) return false;
  }

  return true;
}

function normalizeOrderBy(orderBy?: OrderBy): OrderByInput[] {
  if (!orderBy) return [];
  return Array.isArray(orderBy) ? orderBy : [orderBy];
}

function applyOrder(records: RecipientRecord[], orderBy?: OrderBy) {
  const clauses = normalizeOrderBy(orderBy);
  if (clauses.length === 0) return records;
  return [...records].sort((a, b) => {
    for (const order of clauses) {
      const [[field, direction]] = Object.entries(order);
      const dir = direction === "desc" ? -1 : 1;
      const av = (a as any)[field];
      const bv = (b as any)[field];
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
    }
    return 0;
  });
}

export class FakeRecipientPrisma implements PrismaLike {
  private data: RecipientRecord[] = [];
  private sequence = 1;

  recipient = {
    count: async (args: CountArgs) => this.data.filter((record) => matchesWhere(record, args.where)).length,
    findMany: async (args: FindManyArgs) => {
      const filtered = this.data.filter((record) => matchesWhere(record, args.where));
      const ordered = applyOrder(filtered, args.orderBy);
      const start = args.skip ?? 0;
      const end = args.take ? start + args.take : ordered.length;
      return ordered.slice(start, end).map(cloneRecord);
    },
    findFirst: async (args: FindFirstArgs) => {
      const filtered = this.data.filter((record) => matchesWhere(record, args.where));
      const ordered = applyOrder(filtered, args.orderBy);
      return ordered[0] ? cloneRecord(ordered[0]) : null;
    },
    findUnique: async (args: FindUniqueArgs) => {
      const record = this.data.find((rec) => rec.id === args.where.id);
      return record ? cloneRecord(record) : null;
    },
    create: async (args: CreateArgs) => {
      const now = new Date(Date.now() + this.sequence);
      const record: RecipientRecord = {
        ...args.data,
        id: args.data.id ?? `rec_${this.sequence++}`,
        createdAt: args.data.createdAt ?? now,
        updatedAt: args.data.updatedAt ?? now,
      } as RecipientRecord;
      this.data.push(record);
      return record;
    },
    update: async (args: UpdateArgs) => {
      const record = this.data.find((item) => item.id === args.where.id);
      if (!record) throw new Error("Recipient not found");
      Object.entries(args.data).forEach(([key, value]) => {
        (record as any)[key] = normalizeValue(value);
      });
      record.updatedAt = new Date(Date.now() + this.sequence++);
      return record;
    },
    updateMany: async (args: UpdateManyArgs) => {
      let count = 0;
      this.data.forEach((record) => {
        if (matchesWhere(record, args.where)) {
          Object.entries(args.data).forEach(([key, value]) => {
            (record as any)[key] = normalizeValue(value);
          });
          record.updatedAt = new Date(Date.now() + this.sequence++);
          count += 1;
        }
      });
      return { count };
    },
    delete: async (args: FindUniqueArgs) => {
      const index = this.data.findIndex((record) => record.id === args.where.id);
      if (index < 0) throw new Error("Recipient not found");
      const [removed] = this.data.splice(index, 1);
      return removed;
    },
  } as PrismaLike["recipient"];

  $transaction = async <T>(fn: (tx: PrismaLike) => Promise<T>): Promise<T> => fn(this);
}

export default FakeRecipientPrisma;
