export type EmployerContact = {
  key: string;
  company: string;
  emails: string[];
  phones: string[];
  notes: string;
  lastContactedAt: string | null;
  version: number;
  jobs: {
    id: string;
    title: string;
    status: string;
    active: boolean;
    createdAt: string;
    notificationEmail: string | null;
    emailStatus: string | null;
    emailSentAt: string | null;
  }[];
};
export const publicationEmailStatuses: Record<string, string> = {
  pending: 'გაგზავნის რიგშია',
  sending: 'იგზავნება',
  sent: 'გაგზავნილია',
  failed: 'გაგზავნა ვერ მოხერხდა',
  cancelled: 'გაგზავნა გაუქმებულია',
};
