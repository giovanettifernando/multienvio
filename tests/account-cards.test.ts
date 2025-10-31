import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "../lib/api/errors";
import {
  createUserCard,
  deleteUserCard,
  listUserCards,
  makeUserCardDefault,
} from "../lib/services/account-cards.service";
import {
  CardValidationError,
  validateCardCreateInput,
} from "../lib/validation/card";
import { FakePrisma } from "./helpers/fake-prisma";

const VAULT_KEY = Buffer.alloc(32, 1);

const logger = {
  info() {},
  warn() {},
  error() {},
  debug() {},
  audit() {},
} as const;

function futureYear(offset = 1) {
  return new Date().getFullYear() + offset;
}

test("validateCardCreateInput rejects invalid numbers", () => {
  assert.throws(
    () =>
      validateCardCreateInput({
        number: "4111 1111 1111 1110",
        holderName: "João da Silva",
        expMonth: 12,
        expYear: futureYear(),
      }),
    (error: unknown) =>
      error instanceof CardValidationError && error.code === "invalid_number",
  );
});

test("validateCardCreateInput rejects expired cards", () => {
  const lastYear = new Date().getFullYear() - 1;
  assert.throws(
    () =>
      validateCardCreateInput({
        number: "4111 1111 1111 1111",
        holderName: "João da Silva",
        expMonth: 1,
        expYear: lastYear,
      }),
    (error: unknown) =>
      error instanceof CardValidationError && error.code === "card_expired",
  );
});

test("validateCardCreateInput normalizes expiry string", () => {
  const result = validateCardCreateInput({
    number: "5555 5555 5555 4444",
    holderName: "Maria Souza",
    expiry: "12/30",
  });

  assert.equal(result.expMonth, 12);
  assert.equal(result.expYear, 2030);
});

test("validateCardCreateInput rejects invalid expiration month", () => {
  assert.throws(
    () =>
      validateCardCreateInput({
        number: "5555 5555 5555 4444",
        holderName: "Maria Souza",
        expMonth: "13",
        expYear: futureYear(),
      }),
    (error: unknown) =>
      error instanceof CardValidationError && error.code === "invalid_exp_month",
  );
});

test("validateCardCreateInput rejects invalid expiration year", () => {
  const twoYearsAgo = new Date().getFullYear() - 2;
  assert.throws(
    () =>
      validateCardCreateInput({
        number: "5555 5555 5555 4444",
        holderName: "Maria Souza",
        expMonth: "12",
        expYear: twoYearsAgo.toString(),
      }),
    (error: unknown) =>
      error instanceof CardValidationError && error.code === "invalid_exp_year",
  );
});

test("createUserCard stores first card as default without persisting CVV", async () => {
  const prisma = new FakePrisma();
  const normalized = validateCardCreateInput({
    number: "4242 4242 4242 4242",
    holderName: "João da Silva",
    expMonth: 9,
    expYear: futureYear(),
    cvv: "123",
  });

  const card = await createUserCard("user-1", normalized, {
    prisma: prisma as unknown as any,
    loadVaultKey: () => VAULT_KEY,
    appEnv: "development",
    logger,
  });

  assert.equal(card.isDefault, true);
  const stored = prisma.dumpCards();
  assert.equal(stored.length, 1);
  assert.equal(stored[0].isDefault, true);
  assert.equal(stored[0].last4, "4242");
  assert.ok(typeof stored[0].panCipher === "string");
  assert.equal(Object.prototype.hasOwnProperty.call(stored[0], "cvv"), false);
});

test("createUserCard prevents duplicates based on fingerprint", async () => {
  const prisma = new FakePrisma();
  const payload = {
    number: "5555 5555 5555 4444",
    holderName: "Maria Souza",
    expMonth: 5,
    expYear: futureYear(),
  };

  const normalized = validateCardCreateInput(payload);
  await createUserCard("user-1", normalized, {
    prisma: prisma as unknown as any,
    loadVaultKey: () => VAULT_KEY,
    appEnv: "development",
    logger,
  });

  await assert.rejects(
    () =>
      createUserCard("user-1", validateCardCreateInput(payload), {
        prisma: prisma as unknown as any,
        loadVaultKey: () => VAULT_KEY,
        appEnv: "development",
        logger,
      }),
    (error: unknown) => error instanceof ApiError && error.code === "duplicate_card",
  );
});

test("makeUserCardDefault promotes target card and demotes others", async () => {
  const prisma = new FakePrisma();
  const first = await createUserCard(
    "user-1",
    validateCardCreateInput({
      number: "4242 4242 4242 4242",
      holderName: "João da Silva",
      expMonth: 9,
      expYear: futureYear(),
    }),
    { prisma: prisma as unknown as any, loadVaultKey: () => VAULT_KEY, appEnv: "development", logger },
  );
  const second = await createUserCard(
    "user-1",
    validateCardCreateInput({
      number: "5555 5555 5555 4444",
      holderName: "Maria Souza",
      expMonth: 5,
      expYear: futureYear(2),
    }),
    { prisma: prisma as unknown as any, loadVaultKey: () => VAULT_KEY, appEnv: "development", logger },
  );

  assert.equal(first.isDefault, true);
  assert.equal(second.isDefault, false);

  const promoted = await makeUserCardDefault("user-1", second.id, {
    prisma: prisma as unknown as any,
    loadVaultKey: () => VAULT_KEY,
    appEnv: "development",
    logger,
  });

  assert.equal(promoted.id, second.id);
  const records = prisma.dumpCards();
  const cardOne = records.find((card) => card.id === first.id)!;
  const cardTwo = records.find((card) => card.id === second.id)!;
  assert.equal(cardOne.isDefault, false);
  assert.equal(cardTwo.isDefault, true);
});

test("deleteUserCard promotes a replacement default when needed", async () => {
  const prisma = new FakePrisma();
  const first = await createUserCard(
    "user-1",
    validateCardCreateInput({
      number: "4242 4242 4242 4242",
      holderName: "João da Silva",
      expMonth: 9,
      expYear: futureYear(),
    }),
    { prisma: prisma as unknown as any, loadVaultKey: () => VAULT_KEY, appEnv: "development", logger },
  );
  await createUserCard(
    "user-1",
    validateCardCreateInput({
      number: "6011 0009 9013 9424",
      holderName: "Maria Souza",
      expMonth: 5,
      expYear: futureYear(2),
    }),
    { prisma: prisma as unknown as any, loadVaultKey: () => VAULT_KEY, appEnv: "development", logger },
  );

  await deleteUserCard("user-1", first.id, {
    prisma: prisma as unknown as any,
    loadVaultKey: () => VAULT_KEY,
    appEnv: "development",
    logger,
  });

  const cards = prisma.dumpCards();
  assert.equal(cards.length, 1);
  assert.equal(cards[0].isDefault, true);
});

test("listUserCards returns paginated results", async () => {
  const prisma = new FakePrisma();
  const numbers = [
    "4242424242424242",
    "5555555555554444",
    "6011111111111117",
  ];

  for (const pan of numbers) {
    await createUserCard(
      "user-1",
      validateCardCreateInput({
        number: pan,
        holderName: "João da Silva",
        expMonth: 9,
        expYear: futureYear(3),
      }),
      { prisma: prisma as unknown as any, loadVaultKey: () => VAULT_KEY, appEnv: "development", logger },
    );
  }

  const page1 = await listUserCards("user-1", { page: 1, pageSize: 2 }, {
    prisma: prisma as unknown as any,
  });
  assert.equal(page1.items.length, 2);
  assert.equal(page1.total, 3);
  assert.equal(page1.totalPages, 2);

  const page2 = await listUserCards("user-1", { page: 2, pageSize: 2 }, {
    prisma: prisma as unknown as any,
  });
  assert.equal(page2.items.length, 1);
});
