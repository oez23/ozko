import { describe, expect, it } from "vitest";
import { buyerRequestInputSchema, propertyInputSchema, registrationSchema } from "@immo/core";
import { formattersFor, messagesFor } from "@/i18n";
import { de } from "@/i18n/de";
import { tr } from "@/i18n/tr";
import { fieldErrors, submittedValues } from "@/lib/form";

const m = messagesFor("tr");
const base = { title: "Deniz manzaralı daire", dealType: "sale", propertyType: "apartment", price: "4500000", city: "İzmir" };
const errorsFor = (patch: Record<string, unknown>) => {
  const parsed = propertyInputSchema.safeParse({ ...base, ...patch });
  return parsed.success ? {} : fieldErrors(parsed.error, m);
};

describe("validation messages", () => {
  it.each([
    [{ title: "ab" }, { title: "En az 3 karakter olmalı." }],
    [{ title: "" }, { title: "En az 3 karakter olmalı." }],
    [{ price: "abc" }, { price: "Geçersiz değer." }],
    [{ price: "" }, { price: "Sıfırdan büyük olmalı." }],
    [{ price: "-5" }, { price: "Sıfırdan büyük olmalı." }],
    [{ price: "1000.5" }, { price: "Tam sayı girin." }],
    [{ price: undefined }, { price: "Geçersiz değer." }],
    [{ city: "" }, { city: "Bu alan zorunlu." }],
    [{ dealType: "swap" }, { dealType: "Geçersiz değer." }],
    [{ livingRooms: "11" }, { livingRooms: "En fazla 10 olabilir." }],
    [{ mandateEndsOn: "31.12.2026" }, { mandateEndsOn: "Geçersiz değer." }],
  ])("%j -> %j", (patch, expected) => {
    expect(errorsFor(patch)).toEqual(expected);
  });

  it("translates e-mail, password and cross-field errors", () => {
    const registration = registrationSchema.safeParse({ email: "x", password: "kisa", fullName: "Ö", organizationName: "Ofis" });
    expect(registration.success ? {} : fieldErrors(registration.error, m)).toEqual({
      email: "Geçerli bir e-posta girin.", password: "En az 10 karakter olmalı.", fullName: "En az 2 karakter olmalı.",
    });
    const request = buyerRequestInputSchema.safeParse({
      contactId: "6f9619ff-8b86-4d11-b42d-00c04fc964ff", dealType: "sale", propertyTypes: [], city: "İzmir",
      minPrice: 9, maxPrice: 5,
    });
    expect(request.success ? {} : fieldErrors(request.error, m)).toEqual({
      propertyTypes: "En az birini seçin.", maxPrice: "Min. fiyat, maks. fiyattan büyük olamaz.",
    });
  });
});

describe("submittedValues", () => {
  it("never echoes passwords or files and joins repeated fields", () => {
    const form = new FormData();
    form.set("email", "a@b.test");
    form.set("password", "secret-secret");
    form.append("propertyTypes", "apartment");
    form.append("propertyTypes", "villa");
    form.set("file", new File(["x"], "x.csv"));
    form.set("$ACTION_ID", "internal");
    expect(submittedValues(form)).toEqual({ email: "a@b.test", propertyTypes: "apartment,villa" });
  });
});

describe("formatting", () => {
  it("shows the lira sign in both languages and rooms as 3+1", () => {
    expect(formattersFor("tr").price(4_800_000, "TRY")).toBe("₺4.800.000");
    expect(formattersFor("de").price(4_800_000, "TRY").replace(/\s/g, " ")).toBe("4.800.000 ₺");
    expect(formattersFor("tr").rooms(3, 1)).toBe("3+1");
    expect(formattersFor("tr").rooms(null, 1)).toBe("–");
  });
});

describe("dictionaries", () => {
  const placeholders = (value: unknown, path = ""): [string, string][] =>
    typeof value === "string"
      ? [[path, (value.match(/\{\w+\}/g) ?? []).sort().join()]]
      : Object.entries(value as object).flatMap(([key, child]) => placeholders(child, `${path}.${key}`));

  it("uses the same placeholders in German as in Turkish", () => {
    expect(Object.fromEntries(placeholders(de))).toEqual(Object.fromEntries(placeholders(tr)));
  });
});
