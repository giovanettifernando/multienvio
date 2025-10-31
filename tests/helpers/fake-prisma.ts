import { CardBrand } from "@prisma/client";

type OrderByInput = { createdAt?: "asc" | "desc" };

type CardRecord = {
  id: string;
  userId: string;
  brand: CardBrand;
  holderName: string;
  last4: string;
  expMonth: number;
  expYear: number;
  fingerprint: string;
  isDefault: boolean;
  billingAddressId: string | null;
  vaultToken: string;
  panCipher: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type AddressRecord = {
  id: string;
  userId: string;
  label: string | null;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type CardWhereInput = {
  id?: string;
  userId?: string;
  fingerprint?: string;
  isDefault?: boolean;
  NOT?: CardWhereInput;
};

function cloneCard(card: CardRecord): CardRecord {
  return { ...card };
}

function cloneAddress(address: AddressRecord): AddressRecord {
  return { ...address };
}

export class FakePrisma {
  private cardSeq = 1;
  private addressSeq = 1;
  private timestamp = Date.now();
  private cards: CardRecord[] = [];
  private addresses: AddressRecord[] = [];

  card = {
    count: async ({ where }: { where?: CardWhereInput }) => this.filterCards(where).length,

    findMany: async ({
      where,
      orderBy,
      skip = 0,
      take,
    }: {
      where?: CardWhereInput;
      orderBy?: OrderByInput;
      skip?: number;
      take?: number;
    }) => {
      const filtered = this.sortCards(this.filterCards(where), orderBy);
      const slice = filtered.slice(skip, take ? skip + take : undefined);
      return slice.map(cloneCard);
    },

    findFirst: async ({
      where,
      orderBy,
    }: {
      where?: CardWhereInput;
      orderBy?: OrderByInput;
    }) => {
      const filtered = this.sortCards(this.filterCards(where), orderBy);
      const record = filtered[0];
      return record ? cloneCard(record) : null;
    },

    findUnique: async ({ where }: { where: { id: string } }) => {
      const record = this.cards.find((card) => card.id === where.id);
      return record ? cloneCard(record) : null;
    },

    findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
      const record = await this.card.findUnique({ where });
      if (!record) {
        throw new Error(`Card ${where.id} not found`);
      }
      return record;
    },

    create: async ({ data }: { data: Record<string, unknown> }) => {
      const id = `card_${this.cardSeq++}`;
      const now = this.nextDate();
      const record: CardRecord = {
        id,
        userId: String(data.userId),
        brand: data.brand as CardBrand,
        holderName: String(data.holderName),
        last4: String(data.last4),
        expMonth: Number(data.expMonth),
        expYear: Number(data.expYear),
        fingerprint: String(data.fingerprint),
        isDefault: Boolean(data.isDefault),
        billingAddressId: (data.billingAddressId as string | null | undefined) ?? null,
        vaultToken: String(data.vaultToken),
        panCipher: (data.panCipher as string | null | undefined) ?? null,
        createdAt: now,
        updatedAt: now,
      };
      this.cards.push(record);
      return cloneCard(record);
    },

    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const record = this.cards.find((card) => card.id === where.id);
      if (!record) {
        throw new Error(`Card ${where.id} not found`);
      }
      if (data.holderName !== undefined) {
        record.holderName = String(data.holderName);
      }
      if (data.expMonth !== undefined) {
        record.expMonth = Number(data.expMonth);
      }
      if (data.expYear !== undefined) {
        record.expYear = Number(data.expYear);
      }
      if (data.fingerprint !== undefined) {
        record.fingerprint = String(data.fingerprint);
      }
      if (data.isDefault !== undefined) {
        record.isDefault = Boolean(data.isDefault);
      }
      if (data.billingAddressId !== undefined) {
        record.billingAddressId = (data.billingAddressId as string | null | undefined) ?? null;
      }
      record.updatedAt = this.nextDate();
      return cloneCard(record);
    },

    updateMany: async ({
      where,
      data,
    }: {
      where?: CardWhereInput;
      data: Record<string, unknown>;
    }) => {
      const records = this.filterCards(where);
      records.forEach((record) => {
        if (data.isDefault !== undefined) {
          record.isDefault = Boolean(data.isDefault);
        }
        record.updatedAt = this.nextDate();
      });
      return { count: records.length };
    },

    delete: async ({ where }: { where: { id: string } }) => {
      const index = this.cards.findIndex((card) => card.id === where.id);
      if (index < 0) {
        throw new Error(`Card ${where.id} not found`);
      }
      const [removed] = this.cards.splice(index, 1);
      return cloneCard(removed);
    },
  };

  address = {
    findUnique: async ({ where }: { where: { id: string } }) => {
      const record = this.addresses.find((address) => address.id === where.id);
      return record ? cloneAddress(record) : null;
    },

    create: async ({ data }: { data: Record<string, unknown> }) => {
      const id = `addr_${this.addressSeq++}`;
      const now = this.nextDate();
      const record: AddressRecord = {
        id,
        userId: String(data.userId),
        label: (data.label as string | null | undefined) ?? null,
        cep: String(data.cep),
        logradouro: String(data.logradouro),
        numero: String(data.numero),
        complemento: (data.complemento as string | null | undefined) ?? null,
        bairro: String(data.bairro),
        cidade: String(data.cidade),
        uf: String(data.uf),
        isDefault: Boolean(data.isDefault ?? false),
        createdAt: now,
        updatedAt: now,
      };
      this.addresses.push(record);
      return { id: record.id };
    },
  };

  async $transaction<T>(fn: (tx: this) => Promise<T>): Promise<T> {
    return fn(this);
  }

  dumpCards(): CardRecord[] {
    return this.cards.map(cloneCard);
  }

  private nextDate(): Date {
    return new Date(this.timestamp++);
  }

  private filterCards(where?: CardWhereInput): CardRecord[] {
    if (!where) {
      return this.cards.slice();
    }
    return this.cards.filter((card) => this.matchesCardWhere(card, where));
  }

  private matchesCardWhere(card: CardRecord, where: CardWhereInput | undefined): boolean {
    if (!where) return true;

    if (where.id !== undefined && card.id !== where.id) {
      return false;
    }
    if (where.userId !== undefined && card.userId !== where.userId) {
      return false;
    }
    if (where.fingerprint !== undefined && card.fingerprint !== where.fingerprint) {
      return false;
    }
    if (where.isDefault !== undefined && card.isDefault !== where.isDefault) {
      return false;
    }
    if (where.NOT && this.matchesCardWhere(card, where.NOT)) {
      return false;
    }
    return true;
  }

  private sortCards(cards: CardRecord[], orderBy?: OrderByInput): CardRecord[] {
    if (!orderBy || !orderBy.createdAt) {
      return cards.slice();
    }
    const direction = orderBy.createdAt;
    return cards
      .slice()
      .sort((a, b) =>
        direction === "desc"
          ? b.createdAt.getTime() - a.createdAt.getTime()
          : a.createdAt.getTime() - b.createdAt.getTime(),
      );
  }
}
