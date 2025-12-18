export type ShippingService = {
  code: string;
  name: string;
  carrier: string;
  etaDays: number;
  price: number;
  maxWeightKg: number;
};

export const shippingServices: ShippingService[] = [
  {
    code: "CORREIOS_PAC",
    name: "PAC",
    carrier: "Correios",
    etaDays: 7,
    price: 27.9,
    maxWeightKg: 30,
  },
  {
    code: "CORREIOS_SEDEX",
    name: "SEDEX",
    carrier: "Correios",
    etaDays: 3,
    price: 39.9,
    maxWeightKg: 30,
  },
  {
    code: "JADLOG_EXPRESS",
    name: "Express",
    carrier: "Jadlog",
    etaDays: 4,
    price: 34.5,
    maxWeightKg: 50,
  },
  {
    code: "LOGGI_NEXT",
    name: "Next Day",
    carrier: "Loggi",
    etaDays: 2,
    price: 36.2,
    maxWeightKg: 20,
  },
  {
    code: "JT_STANDARD",
    name: "Standard",
    carrier: "J&T",
    etaDays: 5,
    price: 29.4,
    maxWeightKg: 40,
  },
];
