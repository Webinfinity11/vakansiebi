export const placementTiers = ['standard', 'vip', 'premium'] as const;
export type PlacementTier = (typeof placementTiers)[number];
export const placementLabels: Record<PlacementTier, string> = {
  standard: 'სტანდარტული',
  vip: 'VIP',
  premium: 'პრემიუმი',
};
export const introductoryDays = 14;
