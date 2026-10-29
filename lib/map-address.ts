import { streetAddresses, tbilisiDistricts } from './street-address';

/** A district belongs to the address beside it, never every branch in a multi-address ad. */
export function workplaceDistricts(
  text: string,
  city: string,
): Record<string, string> {
  const result: Record<string, string> = {};
  const parts = [text, ...text.split(/[;\n]+/)];
  for (const part of parts) {
    const addresses = streetAddresses(part, city);
    if (addresses.length !== 1) continue;
    const named = tbilisiDistricts.filter((district) =>
      new RegExp(`(^|[^ა-ჰ])${district}(?:ში|ს)?(?=$|[^ა-ჰ])`, 'u').test(part),
    );
    if (named.length !== 1) continue;
    result[addresses[0].query] = named[0];
  }
  return result;
}
