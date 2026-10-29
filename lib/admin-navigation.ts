/** Labels describe the actual tools; analytics is separate from record management. */
export const adminSections = [
  {
    id: 'control',
    group: 'მთავარი',
    label: 'მიმოხილვა',
    description: 'მიმდინარე მდგომარეობა და შესასრულებელი საქმეები',
  },
  {
    id: 'analytics',
    group: 'მთავარი',
    label: 'ანალიტიკა',
    description: 'ტრაფიკი, ძებნა და ვაკანსიების შედეგები',
  },
  {
    id: 'submissions',
    group: 'ვაკანსიები',
    label: 'განაცხადების განხილვა',
    description: 'დამსაქმებლების მიერ გამოგზავნილი ვაკანსიების დადასტურება',
  },
  {
    id: 'vacancies',
    group: 'ვაკანსიები',
    label: 'ვაკანსიების კატალოგი',
    description: 'წყაროებიდან შემოტანილი ვაკანსიები და მათი მართვა',
  },
  {
    id: 'reports',
    group: 'ვაკანსიები',
    label: 'დარღვევის შეტყობინებები',
    description: 'მომხმარებლების მითითებული შეცდომები ვაკანსიებში',
  },
  {
    id: 'employers',
    group: 'შინაარსი',
    label: 'კომპანიების გვერდები',
    description: 'კომპანიის პროფილი, ლოგო და სახელების გაერთიანება',
  },
  {
    id: 'resumes',
    group: 'შინაარსი',
    label: 'რეზიუმეები',
    description: 'შენახული და Swipe-ით გაგზავნილი რეზიუმეები',
  },
  {
    id: 'blog',
    group: 'შინაარსი',
    label: 'ბლოგი',
    description: 'სტატიების რედაქტირება და გამოქვეყნება',
    href: '/admin/blog',
  },
  {
    id: 'customers',
    group: 'დამსაქმებლები',
    label: 'კონტაქტები',
    description: 'განმთავსებლების საკონტაქტო ინფორმაცია და ისტორია',
  },
  {
    id: 'company-accounts',
    group: 'დამსაქმებლები',
    label: 'კომპანიის ანგარიშები',
    description: 'შესვლის მონაცემები და კომპანიაზე წვდომა',
    href: '/admin/company-accounts',
  },
  {
    id: 'billing',
    group: 'დამსაქმებლები',
    label: 'ინვოისები და გადახდები',
    description: 'ფასიანი განთავსებები, გადახდა და რეკვიზიტები',
  },
  {
    id: 'removals',
    group: 'დამსაქმებლები',
    label: 'ამოღების მოთხოვნები',
    description: 'კომპანიის მოთხოვნით განცხადებების ამოღება და ბლოკირება',
  },
  {
    id: 'sources',
    group: 'სისტემა',
    label: 'სკრაპერები',
    description: 'წყაროების შემოწმება და ავტომატიზაციის პარამეტრები',
  },
  {
    id: 'runs',
    group: 'სისტემა',
    label: 'სკრაპერის ისტორია',
    description: 'გაშვებების შედეგები და შეცდომები',
  },
  {
    id: 'tracking',
    group: 'სისტემა',
    label: 'ტრეკინგის პარამეტრები',
    description: 'Google Analytics და მარკეტინგის პიქსელები',
  },
  {
    id: 'history',
    group: 'სისტემა',
    label: 'ცვლილებების ჟურნალი',
    description: 'ვინ, რა და როდის შეცვალა',
  },
] as const;
export const analyticsViews = [
  ['analytics', 'საიტის აქტივობა'],
  ['performance', 'ვაკანსიების შედეგები'],
  ['posting', 'განთავსების ფორმა'],
] as const;
export const adminView = (value: string | null) =>
  value &&
  (adminSections.some((item) => item.id === value && !('href' in item)) ||
    analyticsViews.some(([id]) => id === value))
    ? value
    : 'control';
export const adminHref = (id: string) =>
  id === 'control' ? '/admin' : `/admin?view=${id}`;
