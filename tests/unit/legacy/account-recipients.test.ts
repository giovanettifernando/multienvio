import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createRecipient,
  deleteRecipient,
  listRecipients,
  makeRecipientDefault,
  updateRecipient,
} from '@/modules/auth/application/account-recipients.service';
import {
  RecipientValidationError,
  validateRecipientCreateInput,
  validateRecipientUpdateInput,
} from '@/shared/validation/recipient';
import { ApiError } from '@/platform/api/errors';
import { FakeRecipientPrisma } from "./helpers/fake-recipient-prisma";

const logger = {
  info() {},
  warn() {},
  error() {},
  debug() {},
  audit() {},
} as const;

function deps(prisma: FakeRecipientPrisma) {
  return { prisma: prisma as unknown as any, logger };
}

function buildCreateInput(overrides: Record<string, unknown> = {}) {
  return validateRecipientCreateInput({
    name: "  Maria   Souza ",
    email: " MARIA@EXAMPLE.com ",
    document: "390.533.447-05",
    phone: "(11) 99999-0000",
    notes: " Entregar após as 18h ",
    cep: "01001-000",
    logradouro: "Praça da Sé",
    numero: " 100 ",
    complemento: " Ap 12 ",
    bairro: "Sé",
    cidade: "São Paulo",
    uf: "sp",
    ...overrides,
  });
}

function buildUpdateInput(overrides: Record<string, unknown>) {
  return validateRecipientUpdateInput({
    ...overrides,
  });
}

test("validateRecipientCreateInput normalizes and validates fields", () => {
  const normalized = buildCreateInput();

  assert.equal(normalized.name, "Maria Souza");
  assert.equal(normalized.email, "maria@example.com");
  assert.equal(normalized.document, "39053344705");
  assert.equal(normalized.phone, "+5511999990000");
  assert.equal(normalized.notes, "Entregar após as 18h");
  assert.equal(normalized.isDefault, false);
  assert.equal(normalized.cep, "01001000");
  assert.equal(normalized.logradouro, "Praça da Sé");
  assert.equal(normalized.numero, "100");
  assert.equal(normalized.complemento, "Ap 12");
  assert.equal(normalized.bairro, "Sé");
  assert.equal(normalized.cidade, "São Paulo");
  assert.equal(normalized.uf, "SP");
});

test("validateRecipientCreateInput rejects invalid CPF", () => {
  assert.throws(
    () =>
      validateRecipientCreateInput({
        name: "João da Silva",
        document: "123.456.789-00",
        cep: "01001-000",
        logradouro: "Rua A",
        numero: "10",
        bairro: "Centro",
        cidade: "São Paulo",
        uf: "SP",
      }),
    (error: unknown) =>
      error instanceof RecipientValidationError && error.code === "invalid_cpf",
  );
});

test("validateRecipientCreateInput rejects invalid CEP", () => {
  assert.throws(
    () =>
      validateRecipientCreateInput({
        name: "João da Silva",
        cep: "ABCDE-123",
        logradouro: "Rua A",
        numero: "10",
        bairro: "Centro",
        cidade: "São Paulo",
        uf: "SP",
      }),
    (error: unknown) =>
      error instanceof RecipientValidationError && error.code === "invalid_cep",
  );
});

test("validateRecipientUpdateInput requires at least one field", () => {
  assert.throws(
    () => validateRecipientUpdateInput({}),
    (error: unknown) =>
      error instanceof RecipientValidationError && error.code === "invalid_payload",
  );
});

test("createRecipient stores first record as default and strips sensitive data", async () => {
  const prisma = new FakeRecipientPrisma();
  const userId = "user-1";
  const created = await createRecipient(userId, buildCreateInput(), deps(prisma));

  assert.equal(created.isDefault, true);
  assert.equal(created.document, "39053344705");
  assert.equal(created.phone, "+5511999990000");

  const list = await listRecipients(userId, { page: 1, pageSize: 10 }, deps(prisma));
  assert.equal(list.total, 1);
  assert.equal(list.items[0].isDefault, true);
});

test("createRecipient prevents duplicates using document + CEP + name", async () => {
  const prisma = new FakeRecipientPrisma();
  const userId = "user-dup";

  await createRecipient(userId, buildCreateInput(), deps(prisma));

  await assert.rejects(
    () =>
      createRecipient(
        userId,
        buildCreateInput({ name: "maria souza", document: "39053344705" }),
        deps(prisma),
      ),
    (error: unknown) => error instanceof ApiError && error.code === "duplicate_recipient",
  );
});

test("createRecipient can mark a later record as default and demotes previous ones", async () => {
  const prisma = new FakeRecipientPrisma();
  const userId = "user-default";

  const first = await createRecipient(
    userId,
    buildCreateInput({ document: "39053344705" }),
    deps(prisma),
  );
  const second = await createRecipient(
    userId,
    buildCreateInput({
      name: "Carlos Alberto",
      email: "carlos@example.com",
      document: undefined,
      cep: "20040-020",
      cidade: "Rio de Janeiro",
      uf: "rj",
      isDefault: true,
    }),
    deps(prisma),
  );

  assert.equal(first.isDefault, true);
  assert.equal(second.isDefault, true);

  const list = await listRecipients(userId, { page: 1, pageSize: 10 }, deps(prisma));
  const firstStored = list.items.find((item) => item.id === first.id)!;
  const secondStored = list.items.find((item) => item.id === second.id)!;
  assert.equal(firstStored.isDefault, false);
  assert.equal(secondStored.isDefault, true);
});

test("updateRecipient allows toggling default off and promotes the most recent record", async () => {
  const prisma = new FakeRecipientPrisma();
  const userId = "user-update";
  const first = await createRecipient(userId, buildCreateInput(), deps(prisma));
  const second = await createRecipient(
    userId,
    buildCreateInput({
      name: "Carlos Pereira",
      document: undefined,
      cep: "20040-020",
      cidade: "Rio de Janeiro",
      uf: "rj",
    }),
    deps(prisma),
  );

  const updatePayload = buildUpdateInput({ isDefault: false });
  const updated = await updateRecipient(userId, first.id, updatePayload, deps(prisma));

  assert.equal(updated.isDefault, false);

  const list = await listRecipients(userId, { page: 1, pageSize: 10 }, deps(prisma));
  const secondStored = list.items.find((item) => item.id === second.id)!;
  assert.equal(secondStored.isDefault, true);
});

test("updateRecipient rejects cross-user access", async () => {
  const prisma = new FakeRecipientPrisma();
  const ownerId = "owner";
  const recipient = await createRecipient(ownerId, buildCreateInput(), deps(prisma));

  await assert.rejects(
    () => updateRecipient("other-user", recipient.id, buildUpdateInput({ name: "Outros" }), deps(prisma)),
    (error: unknown) => error instanceof ApiError && error.code === "recipient_not_found",
  );
});

test("deleteRecipient removes record and promotes the newest when default is removed", async () => {
  const prisma = new FakeRecipientPrisma();
  const userId = "user-delete";

  const first = await createRecipient(userId, buildCreateInput(), deps(prisma));
  const second = await createRecipient(
    userId,
    buildCreateInput({
      name: "Carlos Pereira",
      document: undefined,
      cep: "20040-020",
      cidade: "Rio de Janeiro",
      uf: "rj",
    }),
    deps(prisma),
  );
  const third = await createRecipient(
    userId,
    buildCreateInput({
      name: "Ana Lima",
      document: undefined,
      cep: "30130-010",
      cidade: "Belo Horizonte",
      uf: "MG",
    }),
    deps(prisma),
  );

  assert.ok(first.isDefault);
  await deleteRecipient(userId, first.id, deps(prisma));

  const list = await listRecipients(userId, { page: 1, pageSize: 10 }, deps(prisma));
  assert.equal(list.total, 2);
  const promoted = list.items.find((item) => item.isDefault)!;
  assert.equal(promoted.id, third.id);

  await assert.rejects(
    () => deleteRecipient("other-user", second.id, deps(prisma)),
    (error: unknown) => error instanceof ApiError && error.code === "recipient_not_found",
  );
});

test("makeRecipientDefault switches default flag correctly", async () => {
  const prisma = new FakeRecipientPrisma();
  const userId = "user-make-default";
  const first = await createRecipient(userId, buildCreateInput(), deps(prisma));
  const second = await createRecipient(
    userId,
    buildCreateInput({
      name: "João da Silva",
      document: undefined,
      cep: "20040-020",
      cidade: "Rio de Janeiro",
      uf: "rj",
    }),
    deps(prisma),
  );

  assert.equal(first.isDefault, true);
  const updated = await makeRecipientDefault(userId, second.id, deps(prisma));
  assert.equal(updated.isDefault, true);

  const list = await listRecipients(userId, { page: 1, pageSize: 10 }, deps(prisma));
  const firstStored = list.items.find((item) => item.id === first.id)!;
  const secondStored = list.items.find((item) => item.id === second.id)!;
  assert.equal(firstStored.isDefault, false);
  assert.equal(secondStored.isDefault, true);

  await assert.rejects(
    () => makeRecipientDefault("intruder", second.id, deps(prisma)),
    (error: unknown) => error instanceof ApiError && error.code === "recipient_not_found",
  );
});

test("listRecipients applies search filters and pagination", async () => {
  const prisma = new FakeRecipientPrisma();
  const userId = "user-list";

  await createRecipient(
    userId,
    buildCreateInput({
      name: "Felipe Santos",
      email: "felipe@example.com",
      document: undefined,
      cep: "30130-010",
      cidade: "Belo Horizonte",
      uf: "mg",
    }),
    deps(prisma),
  );
  await createRecipient(
    userId,
    buildCreateInput({
      name: "Ana Maria",
      email: "ana@example.com",
      document: undefined,
      cep: "22231-040",
      cidade: "Rio de Janeiro",
      uf: "rj",
      isDefault: true,
    }),
    deps(prisma),
  );
  await createRecipient(
    userId,
    buildCreateInput({
      name: "Carlos Eduardo",
      email: "carlos@example.com",
      document: undefined,
      cep: "88010-400",
      cidade: "Florianópolis",
      uf: "sc",
    }),
    deps(prisma),
  );

  const searchResult = await listRecipients(
    userId,
    { q: "felipe", page: 1, pageSize: 10 },
    deps(prisma),
  );
  assert.equal(searchResult.total, 1);
  assert.equal(searchResult.items[0].name, "Felipe Santos");

  const cityFilterResult = await listRecipients(
    userId,
    { city: "rio de janeiro", page: 1, pageSize: 10 },
    deps(prisma),
  );
  assert.equal(cityFilterResult.total, 1);
  assert.equal(cityFilterResult.items[0].cidade, "Rio de Janeiro");

  const ufFilterResult = await listRecipients(
    userId,
    { uf: "SC", page: 1, pageSize: 10 },
    deps(prisma),
  );
  assert.equal(ufFilterResult.total, 1);
  assert.equal(ufFilterResult.items[0].uf, "SC");

  const paginated = await listRecipients(userId, { page: 2, pageSize: 1 }, deps(prisma));
  assert.equal(paginated.page, 2);
  assert.equal(paginated.pageSize, 1);
  assert.equal(paginated.total, 3);
  assert.equal(paginated.totalPages, 3);
  assert.equal(paginated.items.length, 1);
});
