import test from "node:test";
import assert from "node:assert/strict";
import { vacancyTitle } from "../lib/vacancy-title";

void test("the same position in two cities gets two titles", () => {
  const a = vacancyTitle({
    title: "ავტო სესხის ოფიცერი",
    company: "ლიდერ კრედიტი",
    city: "გორი",
  });
  const b = vacancyTitle({
    title: "ავტო სესხის ოფიცერი",
    company: "ლიდერ კრედიტი",
    city: "თბილისი",
  });
  assert.notEqual(a, b);
  assert.equal(a, "ავტო სესხის ოფიცერი, გორი — ლიდერ კრედიტი | ჯობიქსი");
});

void test("long titles stay within the visible length, keeping the city", () => {
  const long = vacancyTitle({
    title:
      "ბავშვთა გასართობი ცენტრის ადმინისტრატორი და მომხმარებელთა მომსახურების მენეჯერი",
    company: "ბავშვთა გასართობი ცენტრი ლაბირინთი",
    city: "ბათუმი",
  });
  assert.ok(long.length <= 70, long);
  const medium = vacancyTitle({
    title: "გაყიდვების მენეჯერი",
    company: "ხელური სუპერმარკეტი კარფური მაჯიდ ალ ფუტაიმ ჰიპერმარკეტს ჯორჯია",
    city: "თბილისი",
  });
  assert.equal(medium, "გაყიდვების მენეჯერი, თბილისი");
});

void test("a city already named in the position is not repeated", () => {
  assert.equal(
    vacancyTitle({ title: "კურიერი ბათუმში", company: "X", city: "ბათუმი" }),
    "კურიერი ბათუმში — X | ჯობიქსი",
  );
});
