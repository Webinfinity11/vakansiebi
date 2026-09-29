import { z } from 'zod';

export const trackingSchema = z
  .object({
    googleId: z
      .string()
      .trim()
      .regex(/^$|^G-[A-Z0-9]+$/, 'Google ID უნდა იწყებოდეს G-ით'),
    googleEnabled: z.boolean(),
    yandexId: z
      .string()
      .trim()
      .regex(/^$|^[1-9]\d{0,14}$/, 'Yandex ID უნდა იყოს რიცხვი'),
    yandexEnabled: z.boolean(),
    topGeId: z
      .string()
      .trim()
      .regex(/^$|^[1-9]\d{0,14}$/, 'Top.ge ID უნდა იყოს რიცხვი'),
    topGeEnabled: z.boolean(),
    customHtml: z.string().max(50000, 'კოდი მაქსიმუმ 50 000 სიმბოლო უნდა იყოს'),
    customEnabled: z.boolean(),
  })
  .superRefine((v, ctx) => {
    for (const [enabled, value, field] of [
      [v.googleEnabled, v.googleId, 'googleId'],
      [v.yandexEnabled, v.yandexId, 'yandexId'],
      [v.topGeEnabled, v.topGeId, 'topGeId'],
      [v.customEnabled, v.customHtml.trim(), 'customHtml'],
    ] as const) {
      if (enabled && !value)
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: 'ჩართვისთვის შეავსე ველი',
        });
    }
  });
export type TrackingSettings = z.infer<typeof trackingSchema>;
export type TrackingRecord = { settings: TrackingSettings; version: number };
export const trackingUpdateSchema = z.object({
  settings: trackingSchema,
  version: z.number().int().nonnegative(),
});

// Disabled code stays private to the admin editor.
export function publicTracking(settings: TrackingSettings): TrackingSettings {
  return {
    ...settings,
    googleId: settings.googleEnabled ? settings.googleId : '',
    yandexId: settings.yandexEnabled ? settings.yandexId : '',
    topGeId: settings.topGeEnabled ? settings.topGeId : '',
    customHtml: settings.customEnabled ? settings.customHtml : '',
  };
}
