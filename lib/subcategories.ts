/* Match role names within the chosen parent category, never duties or a generic
   word such as "manager" alone. Patterns are shared with PostgreSQL's ~* operator. */
export const subcategories = [
  {
    id: 'sales-retail',
    category: 'გაყიდვები',
    label: 'მოლარე / კონსულტანტი',
    pattern: 'მოლარე|კონსულტანტ|cashier|sales assistant|retail associate',
  },
  {
    id: 'sales-management',
    category: 'გაყიდვები',
    label: 'გაყიდვების მართვა',
    pattern:
      'გაყიდვების.*მენეჯერ|sales.*manager|account manager|ბიზნეს.*განვითარ',
  },
  {
    id: 'sales-representative',
    category: 'გაყიდვები',
    label: 'გაყიდვების წარმომადგენელი',
    pattern:
      'პრესელერ|სავაჭრო.*წარმომადგენ|გაყიდვების.*წარმომადგენ|sales representative|მერჩენდაიზერ',
  },
  {
    id: 'service-hospitality',
    category: 'მომსახურება',
    label: 'მიმტანი / ბარისტა / ბარმენი',
    pattern: 'მიმტან|ბარისტა|ბარმენ|waiter|waitress|barista|bartender',
  },
  {
    id: 'service-kitchen',
    category: 'მომსახურება',
    label: 'სამზარეულო',
    pattern:
      'მზარეულ|კონდიტერ|მცხობელ|ჭურჭლის.*მრეცხ|cook|chef|baker|სამზარეულ',
  },
  {
    id: 'service-cleaning',
    category: 'მომსახურება',
    label: 'დასუფთავება',
    pattern: 'დამლაგებელ|დასუფთავ|დიასახლის|მწმენდავ|cleaner|housekeep',
  },
  {
    id: 'service-support',
    category: 'მომსახურება',
    label: 'მომხმარებელთა მხარდაჭერა',
    pattern:
      'მომხმარებელ.*(მხარდაჭერ|მომსახურ)|ქოლ.*ცენტრ|სატელეფონო.*ოპერატორ|customer.*(support|service)|call.center',
  },
  {
    id: 'tech-development',
    category: 'ტექნოლოგიები',
    label: 'პროგრამირება',
    pattern:
      'დეველოპერ|პროგრამისტ|developer|software engineer|frontend|backend|full.stack',
  },
  {
    id: 'tech-qa',
    category: 'ტექნოლოგიები',
    label: 'ტესტირება / QA',
    pattern:
      'ტესტერ|ტესტირებ|(^|[^a-z])qa([^a-z]|$)|quality assurance|test engineer',
  },
  {
    id: 'tech-support',
    category: 'ტექნოლოგიები',
    label: 'IT მხარდაჭერა',
    pattern:
      'it.*(მხარდაჭერ|support|სპეციალისტ)|ტექნიკურ.*მხარდაჭერ|help.?desk',
  },
  {
    id: 'tech-systems',
    category: 'ტექნოლოგიები',
    label: 'სისტემები / ქსელები',
    pattern:
      'სისტემურ.*ადმინისტრატორ|ქსელ.*(ინჟინერ|ადმინისტრატორ)|system.*admin|network.*engineer|devops',
  },
  {
    id: 'logistics-driving',
    category: 'ლოჯისტიკა',
    label: 'მძღოლი / კურიერი',
    pattern: 'მძღოლ|კურიერ|driver|courier',
  },
  {
    id: 'logistics-warehouse',
    category: 'ლოჯისტიკა',
    label: 'საწყობი',
    pattern: 'საწყობ|შემფუთავ|მტვირთავ|warehouse|packer',
  },
  {
    id: 'logistics-procurement',
    category: 'ლოჯისტიკა',
    label: 'შესყიდვები / მომარაგება',
    pattern: 'შესყიდვ|მომარაგებ|procurement|purchasing|supply',
  },
  {
    id: 'finance-accounting',
    category: 'ფინანსები',
    label: 'ბუღალტერია',
    pattern: 'ბუღალტერ|accountant|accounting|bookkeep',
  },
  {
    id: 'finance-analysis',
    category: 'ფინანსები',
    label: 'ფინანსური ანალიზი',
    pattern: 'ფინანსურ.*ანალიტ|financial analyst|ფინანს.*ანალიზ',
  },
  {
    id: 'finance-audit',
    category: 'ფინანსები',
    label: 'აუდიტი',
    pattern: 'აუდიტ|audit',
  },
] as const;

export function subcategoryFor(category: string, id?: string | null) {
  return subcategories.find(
    (item) => item.category === category && item.id === id,
  );
}
