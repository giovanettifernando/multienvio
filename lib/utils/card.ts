import { CardBrand } from "@prisma/client";

const ELO_PREFIXES = [
  "401178",
  "401179",
  "431274",
  "438935",
  "451416",
  "457393",
  "457631",
  "457632",
  "504175",
  "506699",
  "506770",
  "506771",
  "506772",
  "506773",
  "506774",
  "506775",
  "506776",
  "506777",
  "506778",
  "509000",
  "509001",
  "509002",
  "509003",
  "509004",
  "509005",
  "509006",
  "509007",
  "509008",
  "509009",
  "636297",
  "636368",
];

const HOLDER_NAME_REGEX = /^[\p{L}\s.'-]+$/u;

export function normalizeCardNumber(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidCardNumberLength(value: string): boolean {
  return value.length >= 13 && value.length <= 19;
}

export function luhnCheck(number: string): boolean {
  let sum = 0;
  let shouldDouble = false;

  for (let i = number.length - 1; i >= 0; i -= 1) {
    let digit = Number(number[i]);

    if (Number.isNaN(digit)) {
      return false;
    }

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

function matchesElo(bin: string): boolean {
  if (ELO_PREFIXES.includes(bin)) return true;
  const range = Number(bin.slice(0, 6));
  return range >= 506699 && range <= 506778;
}

export function detectCardBrand(number: string): CardBrand {
  if (/^4\d{12,18}$/u.test(number)) {
    return CardBrand.VISA;
  }
  if (/^(5[1-5]\d{14}|2[2-7]\d{14})$/u.test(number)) {
    return CardBrand.MASTERCARD;
  }
  if (/^3[47]\d{13}$/u.test(number)) {
    return CardBrand.AMEX;
  }
  if (matchesElo(number.slice(0, 6))) {
    return CardBrand.ELO;
  }
  if (/^(606282\d{10}|3841\d{11})$/u.test(number)) {
    return CardBrand.HIPERCARD;
  }
  return CardBrand.OTHER;
}

export function normalizeHolderName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function isValidHolderName(value: string): boolean {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > 120) return false;
  return HOLDER_NAME_REGEX.test(normalized);
}

export function isCardExpired(expMonth: number, expYear: number, referenceDate = new Date()): boolean {
  if (expMonth < 1 || expMonth > 12) return true;
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth() + 1;

  if (expYear < year) return true;
  if (expYear === year && expMonth < month) return true;
  return false;
}

export function assertExpirationWindow(expYear: number, expMonth: number): boolean {
  const now = new Date();
  const maxYear = now.getFullYear() + 15;
  if (expYear > maxYear) return false;
  return !isCardExpired(expMonth, expYear, now);
}

export function validateCvvFormat(cvv: string): boolean {
  return /^\d{3,4}$/u.test(cvv);
}
