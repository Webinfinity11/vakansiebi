import { z } from 'zod';

export const CV_STORAGE_KEY = 'jobx-cv-v1';
export const cvLanguages = ['ka', 'en'] as const;
export type CvLanguage = (typeof cvLanguages)[number];
export const cvTemplates = ['classic', 'modern', 'compact', 'bold'] as const;
export type CvTemplate = (typeof cvTemplates)[number];
export const accentPresets = [
  '#1f5fbf',
  '#0f766e',
  '#7c3aed',
  '#b91c1c',
  '#c2410c',
  '#0e7490',
  '#374151',
  '#a16207',
] as const;
export const textPresets = [
  '#111111',
  '#2b2b2b',
  '#3f3f46',
  '#1e293b',
  '#14532d',
  '#3f2a1d',
] as const;
export const cvFonts = ['fira', 'system', 'serif'] as const;
export type CvFont = (typeof cvFonts)[number];
export const photoShapes = ['circle', 'rounded', 'square'] as const;
export type PhotoShape = (typeof photoShapes)[number];
export const languageLevels = [
  'a1',
  'a2',
  'b1',
  'b2',
  'c1',
  'c2',
  'native',
] as const;
export type LanguageLevel = (typeof languageLevels)[number];

const id = z.string().min(1).max(40);
const month = z
  .string()
  .max(7)
  .regex(/^(?:\d{4}-(?:0[1-9]|1[0-2]))?$/);
const photoPattern =
  /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/;
export const cvExperienceSchema = z.object({
  id,
  company: z.string().max(120),
  role: z.string().max(120),
  from: month,
  to: month,
  current: z.boolean(),
  description: z.string().max(2000),
});
export const cvEducationSchema = z.object({
  id,
  school: z.string().max(120),
  degree: z.string().max(120),
  from: month,
  to: month,
  description: z.string().max(1000),
});
export const cvLanguageSchema = z.object({
  id,
  name: z.string().max(60),
  level: z.enum(languageLevels),
});
export const cvSchema = z.object({
  version: z.literal(1),
  language: z.enum(cvLanguages),
  template: z.enum(cvTemplates),
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#1f5fbf'),
  textColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#111111'),
  font: z.enum(cvFonts).default('fira'),
  photoShape: z.enum(photoShapes).default('circle'),
  showPhoto: z.boolean(),
  photo: z
    .string()
    .max(170000)
    .refine((value) => !value || photoPattern.exec(value)?.[0] === value),
  fullName: z.string().max(120),
  title: z.string().max(120),
  phone: z.string().max(32),
  email: z.string().max(120),
  city: z.string().max(80),
  link: z.string().max(200),
  summary: z.string().max(1500),
  experience: z.array(cvExperienceSchema).max(20),
  education: z.array(cvEducationSchema).max(20),
  skills: z.array(z.string().max(60)).max(40),
  languages: z.array(cvLanguageSchema).max(10),
  updatedAt: z.iso.datetime(),
});
export type Cv = z.infer<typeof cvSchema>;
export type CvStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function contrastRatio(hexA: string, hexB: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((offset) => {
      const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const a = luminance(hexA);
  const b = luminance(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function newId(): string {
  return typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : Math.random().toString(36).slice(2) || '0';
}

export function emptyCv(language: CvLanguage = 'ka'): Cv {
  return {
    version: 1,
    language,
    template: 'classic',
    accent: '#1f5fbf',
    textColor: '#111111',
    font: 'fira',
    photoShape: 'circle',
    showPhoto: language === 'ka',
    photo: '',
    fullName: '',
    title: '',
    phone: '',
    email: '',
    city: '',
    link: '',
    summary: '',
    experience: [],
    education: [],
    skills: [],
    languages: [],
    updatedAt: new Date().toISOString(),
  };
}

export function sampleCv(language: CvLanguage): Cv {
  const ka = language === 'ka';
  return {
    ...emptyCv(language),
    fullName: ka ? 'ნინო ბერიძე' : 'Nino Beridze',
    title: ka ? 'ფრონტენდ დეველოპერი' : 'Frontend developer',
    phone: '+995 555 12 34 56',
    email: 'nino@example.com',
    city: ka ? 'თბილისი' : 'Tbilisi',
    link: 'https://example.com',
    summary: ka
      ? 'ფრონტენდ დეველოპერი ვებაპლიკაციების შექმნის ოთხწლიანი გამოცდილებით. ვქმნი სწრაფ, ხელმისაწვდომ ინტერფეისებს და ვთანამშრომლობ დიზაინისა და პროდუქტის გუნდებთან.'
      : 'Frontend developer with four years of experience building web applications. I create fast, accessible interfaces in collaboration with design and product teams.',
    experience: [
      {
        id: 'sample-experience-1',
        company: ka ? 'ციფრული სტუდია' : 'Digital Studio',
        role: ka ? 'ფრონტენდ დეველოპერი' : 'Frontend developer',
        from: '2023-03',
        to: '',
        current: true,
        description: ka
          ? 'შევქმენი მომხმარებლის პირადი სივრცე React-ისა და TypeScript-ის გამოყენებით.\nგვერდების ჩატვირთვის დრო შევამცირე 30%-ით.\nდიზაინერებთან ერთად გავაუმჯობესე კლავიატურით ნავიგაცია.'
          : 'Built a customer dashboard using React and TypeScript.\nReduced page loading time by 30%.\nImproved keyboard navigation in collaboration with designers.',
      },
      {
        id: 'sample-experience-2',
        company: ka ? 'ვებ ლაბი' : 'Web Lab',
        role: ka ? 'უმცროსი ფრონტენდ დეველოპერი' : 'Junior frontend developer',
        from: '2021-09',
        to: '2023-02',
        current: false,
        description: ka
          ? 'მოვამზადე ადაპტიური გვერდები მცირე ბიზნესებისთვის.\nდავამატე ავტომატური ტესტები რეგისტრაციისა და ძიების ფუნქციებს.'
          : 'Developed responsive pages for small businesses.\nAdded automated tests for registration and search features.',
      },
    ],
    education: [
      {
        id: 'sample-education-1',
        school: ka
          ? 'თბილისის სახელმწიფო უნივერსიტეტი'
          : 'Tbilisi State University',
        degree: ka
          ? 'კომპიუტერული მეცნიერების ბაკალავრი'
          : 'BSc in Computer Science',
        from: '2017-09',
        to: '2021-06',
        description: ka
          ? 'საბაკალავრო პროექტი: სასწავლო რესურსების ვებპლატფორმა.'
          : 'Final project: a web platform for learning resources.',
      },
    ],
    skills: [
      'JavaScript',
      'TypeScript',
      'React',
      'HTML / CSS',
      'Git',
      ka ? 'გუნდური მუშაობა' : 'Teamwork',
    ],
    languages: [
      {
        id: 'sample-language-1',
        name: ka ? 'ქართული' : 'Georgian',
        level: 'native',
      },
      {
        id: 'sample-language-2',
        name: ka ? 'ინგლისური' : 'English',
        level: 'b2',
      },
    ],
  };
}

export function cvProgress(cv: Cv): number {
  const completed = [
    Boolean(cv.fullName.trim()),
    Boolean(cv.title.trim()),
    Boolean(cv.phone.trim() || cv.email.trim()),
    Boolean(cv.summary.trim()),
    cv.experience.length >= 1,
    cv.education.length >= 1,
    cv.skills.length >= 3,
    cv.languages.length >= 1,
  ].filter(Boolean).length;
  return Math.round((completed / 8) * 100);
}

export function readCv(storage: CvStorage): Cv | null {
  try {
    const raw = storage.getItem(CV_STORAGE_KEY);
    return raw ? cvSchema.parse(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeCv(storage: CvStorage, cv: Cv): Cv {
  const saved = { ...cvSchema.parse(cv), updatedAt: new Date().toISOString() };
  storage.setItem(CV_STORAGE_KEY, JSON.stringify(saved));
  return saved;
}

export function clearCv(storage: CvStorage): void {
  storage.removeItem(CV_STORAGE_KEY);
}

export function formatPeriod(
  from: string,
  to: string,
  current: boolean,
  language: CvLanguage,
): string {
  const end = current ? (language === 'ka' ? 'დღემდე' : 'present') : to;
  return [from, end].filter(Boolean).join(' — ');
}

export type CvText = {
  gallery: string;
  accent: string;
  textColor: string;
  textContrastWarning: string;
  customColor: string;
  font: string;
  fonts: Record<CvFont, string>;
  photoShape: string;
  photoShapes: Record<PhotoShape, string>;
  editPhoto: string;
  changePhoto: string;
  zoom: string;
  dragHint: string;
  apply: string;
  cancel: string;
  progress: string;
  pageBreak: string;
  currentJob: string;
  sectionEmpty: string;
  hints: Record<
    | 'fullName'
    | 'title'
    | 'phone'
    | 'email'
    | 'city'
    | 'link'
    | 'summary'
    | 'experience'
    | 'education'
    | 'skills'
    | 'languages',
    string
  >;
  contact: string;
  summary: string;
  experience: string;
  education: string;
  skills: string;
  languages: string;
  add: string;
  remove: string;
  moveUp: string;
  moveDown: string;
  print: string;
  clear: string;
  choosePhoto: string;
  removePhoto: string;
  showPhoto: string;
  fullName: string;
  title: string;
  phone: string;
  email: string;
  city: string;
  link: string;
  company: string;
  role: string;
  from: string;
  to: string;
  current: string;
  description: string;
  school: string;
  degree: string;
  name: string;
  level: string;
  language: string;
  template: string;
  preview: string;
  heading: string;
  intro: string;
  placeholders: {
    fullName: string;
    title: string;
    phone: string;
    email: string;
    city: string;
    link: string;
    summary: string;
    company: string;
    role: string;
    from: string;
    to: string;
    description: string;
    school: string;
    degree: string;
    educationDescription: string;
    skills: string;
    name: string;
  };
  templates: Record<CvTemplate, { name: string; description: string }>;
  atsNote: string;
  languageLevels: Record<LanguageLevel, string>;
  storageNote: string;
  cleared: string;
  saved: string;
  printHint: string;
  clearConfirm: string;
  storageError: string;
  photoError: string;
};

export const cvText: Record<CvLanguage, CvText> = {
  ka: {
    gallery: 'შაბლონები',
    accent: 'ფერი',
    textColor: 'ტექსტის ფერი',
    textContrastWarning: 'ეს ფერი თეთრ ფონზე ცუდად იკითხება.',
    customColor: 'სხვა ფერი',
    font: 'შრიფტი',
    fonts: { fira: 'FiraGO', system: 'სისტემური', serif: 'სერიფი' },
    photoShape: 'ფოტოს ფორმა',
    photoShapes: {
      circle: 'წრე',
      rounded: 'მომრგვალებული',
      square: 'კვადრატი',
    },
    editPhoto: 'ფოტოს რედაქტირება',
    changePhoto: 'ფოტოს შეცვლა',
    zoom: 'მასშტაბი',
    dragHint: 'გადაათრიე ფოტო, რომ მოარგო',
    apply: 'გამოყენება',
    cancel: 'გაუქმება',
    progress: 'შევსებულია',
    pageBreak: 'მე-2 გვერდი',
    currentJob: 'ამჟამად ვმუშაობ',
    sectionEmpty: 'სექცია ჯერ ცარიელია',
    hints: {
      fullName: 'ჩაწერე სახელი და გვარი ისე, როგორც დამსაქმებელს წარუდგენ.',
      title: 'მიუთითე პროფესია ან სასურველი პოზიცია.',
      phone: 'მიუთითე მოქმედი ნომერი ქვეყნის კოდით.',
      email: 'გამოიყენე ელფოსტა, რომელსაც რეგულარულად ამოწმებ.',
      city: 'მიუთითე ქალაქი, სადაც ცხოვრობ ან მუშაობას გეგმავ.',
      link: 'დაამატე პორტფოლიოს ან პროფესიული პროფილის ბმული.',
      summary:
        'ორ-სამ წინადადებაში აღწერე შენი გამოცდილება და ძლიერი მხარეები.',
      experience: 'დაიწყე ბოლო სამსახურით და მიღწევები ცალკე ხაზებად ჩაწერე.',
      education: 'მიუთითე სასწავლებელი, სპეციალობა და სწავლის პერიოდი.',
      skills: 'შეარჩიე პოზიციისთვის მნიშვნელოვანი უნარები.',
      languages: 'დაამატე ენები და თითოეულისთვის აირჩიე ცოდნის დონე.',
    },
    contact: 'საკონტაქტო ინფორმაცია',
    summary: 'ჩემ შესახებ',
    experience: 'სამუშაო გამოცდილება',
    education: 'განათლება',
    skills: 'უნარები',
    languages: 'ენები',
    add: 'დამატება',
    remove: 'წაშლა',
    moveUp: 'ზემოთ აწევა',
    moveDown: 'ქვემოთ ჩამოწევა',
    print: 'PDF-ად შენახვა',
    clear: 'გასუფთავება',
    choosePhoto: 'ფოტოს არჩევა',
    removePhoto: 'ფოტოს წაშლა',
    showPhoto: 'ფოტოს ჩვენება',
    fullName: 'სახელი და გვარი',
    title: 'პროფესია',
    phone: 'ტელეფონი',
    email: 'ელფოსტა',
    city: 'ქალაქი',
    link: 'ბმული',
    company: 'კომპანია',
    role: 'პოზიცია',
    from: 'დაწყება',
    to: 'დასრულება',
    current: 'ამჟამად ვმუშაობ',
    description: 'აღწერა',
    school: 'სასწავლებელი',
    degree: 'ხარისხი / სპეციალობა',
    name: 'ენა',
    level: 'დონე',
    language: 'რეზიუმეს ენა',
    template: 'შაბლონი',
    preview: 'გადახედვა',
    heading: 'რეზიუმეს შედგენა',
    intro: 'შეავსე ინფორმაცია, აირჩიე შაბლონი და შეინახე რეზიუმე PDF-ად.',
    placeholders: {
      fullName: 'ნინო ბერიძე',
      title: 'ფრონტენდ დეველოპერი',
      phone: '+995 555 12 34 56',
      email: 'nino@example.com',
      city: 'თბილისი',
      link: 'https://example.com',
      summary:
        'ფრონტენდ დეველოპერი ვებაპლიკაციების შექმნის გამოცდილებით. ვქმნი მარტივ და ხელმისაწვდომ ინტერფეისებს.',
      company: 'კომპანიის სახელი',
      role: 'ფრონტენდ დეველოპერი',
      from: '2021-03',
      to: '2023-08',
      description: 'აღწერე შენი პასუხისმგებლობები და მნიშვნელოვანი მიღწევები.',
      school: 'თბილისის სახელმწიფო უნივერსიტეტი',
      degree: 'კომპიუტერული მეცნიერების ბაკალავრი',
      educationDescription:
        'მიუთითე მნიშვნელოვანი კურსები ან სასწავლო პროექტები.',
      skills: 'JavaScript, React, გუნდური მუშაობა',
      name: 'ინგლისური',
    },
    templates: {
      bold: { name: 'გამოკვეთილი', description: 'რეზიუმე ფერადი ზედა ზოლით.' },
      classic: {
        name: 'კლასიკური',
        description: 'ერთსვეტიანი რეზიუმე მკაფიო სექციებით.',
      },
      modern: {
        name: 'თანამედროვე',
        description: 'ორსვეტიანი რეზიუმე ცალკე საკონტაქტო ნაწილით.',
      },
      compact: {
        name: 'კომპაქტური',
        description: 'მოკლე, ერთსვეტიანი რეზიუმე ფოტოს გარეშე.',
      },
    },
    atsNote: 'ორსვეტიან შაბლონს ზოგი ATS სისტემა ცუდად კითხულობს.',
    languageLevels: {
      a1: 'A1 — საწყისი',
      a2: 'A2 — ელემენტარული',
      b1: 'B1 — საშუალო',
      b2: 'B2 — საშუალოზე მაღალი',
      c1: 'C1 — მაღალი',
      c2: 'C2 — სრულყოფილი',
      native: 'მშობლიური',
    },
    storageNote:
      'რეზიუმე ინახება მხოლოდ ამ ბრაუზერში; ბრაუზერის მონაცემების გასუფთავებისას იკარგება — საჭიროებისას შეინახე PDF-ად.',
    cleared: 'რეზიუმე გასუფთავდა.',
    saved: 'რეზიუმე შენახულია.',
    printHint: 'ჯერ შეავსე ერთი ველი მაინც',
    clearConfirm: 'გსურს რეზიუმეს გასუფთავება?',
    storageError:
      'რეზიუმე ბრაუზერში ვერ შეინახა. შეინახე PDF-ად, რომ არ დაიკარგოს.',
    photoError: 'ფოტოს დამუშავება ვერ მოხერხდა. სცადე სხვა.',
  },
  en: {
    gallery: 'Templates',
    accent: 'Color',
    textColor: 'Text colour',
    textContrastWarning: 'This colour is hard to read on white.',
    customColor: 'Custom color',
    font: 'Font',
    fonts: { fira: 'FiraGO', system: 'System', serif: 'Serif' },
    photoShape: 'Photo shape',
    photoShapes: { circle: 'Circle', rounded: 'Rounded', square: 'Square' },
    editPhoto: 'Edit photo',
    changePhoto: 'Change photo',
    zoom: 'Zoom',
    dragHint: 'Drag the photo to adjust it',
    apply: 'Apply',
    cancel: 'Cancel',
    progress: 'Completed',
    pageBreak: 'Page 2',
    currentJob: 'I currently work here',
    sectionEmpty: 'This section is empty',
    hints: {
      fullName:
        'Enter the name you use when introducing yourself to employers.',
      title: 'Enter your profession or the role you are applying for.',
      phone: 'Include an active phone number with its country code.',
      email: 'Use an email address you check regularly.',
      city: 'Enter the city where you live or plan to work.',
      link: 'Add a link to your portfolio or professional profile.',
      summary:
        'Describe your experience and strengths in two or three sentences.',
      experience:
        'Start with your most recent role and put each achievement on a separate line.',
      education: 'Include your school, field of study and attendance dates.',
      skills: 'Choose skills relevant to the position.',
      languages: 'Add your languages and select your proficiency in each.',
    },
    contact: 'Contact',
    summary: 'Profile',
    experience: 'Work experience',
    education: 'Education',
    skills: 'Skills',
    languages: 'Languages',
    add: 'Add',
    remove: 'Remove',
    moveUp: 'Move up',
    moveDown: 'Move down',
    print: 'Save as PDF',
    clear: 'Clear',
    choosePhoto: 'Choose photo',
    removePhoto: 'Remove photo',
    showPhoto: 'Show photo',
    fullName: 'Full name',
    title: 'Profession',
    phone: 'Phone',
    email: 'Email',
    city: 'City',
    link: 'Link',
    company: 'Company',
    role: 'Role',
    from: 'From',
    to: 'To',
    current: 'I currently work here',
    description: 'Description',
    school: 'School',
    degree: 'Degree / field of study',
    name: 'Language',
    level: 'Level',
    language: 'Resume language',
    template: 'Template',
    preview: 'Preview',
    heading: 'Build your resume',
    intro:
      'Enter your details, choose a template and save your resume as a PDF.',
    placeholders: {
      fullName: 'Nino Beridze',
      title: 'Frontend developer',
      phone: '+995 555 12 34 56',
      email: 'nino@example.com',
      city: 'Tbilisi',
      link: 'https://example.com',
      summary:
        'Frontend developer with experience building web applications. I create simple and accessible interfaces.',
      company: 'Company name',
      role: 'Frontend developer',
      from: '2021-03',
      to: '2023-08',
      description: 'Describe your responsibilities and key achievements.',
      school: 'Tbilisi State University',
      degree: 'BSc in Computer Science',
      educationDescription: 'Include relevant courses or academic projects.',
      skills: 'JavaScript, React, teamwork',
      name: 'English',
    },
    templates: {
      bold: {
        name: 'Bold',
        description: 'A resume with a colorful header band.',
      },
      classic: {
        name: 'Classic',
        description: 'A single-column resume with clear sections.',
      },
      modern: {
        name: 'Modern',
        description: 'A two-column resume with a separate contact section.',
      },
      compact: {
        name: 'Compact',
        description: 'A concise, single-column resume without a photo.',
      },
    },
    atsNote: 'Some ATS systems read two-column layouts poorly.',
    languageLevels: {
      a1: 'A1 — Beginner',
      a2: 'A2 — Elementary',
      b1: 'B1 — Intermediate',
      b2: 'B2 — Upper intermediate',
      c1: 'C1 — Advanced',
      c2: 'C2 — Proficient',
      native: 'Native',
    },
    storageNote:
      'Your resume is saved only in this browser; clearing browser data deletes it — save a PDF copy when needed.',
    cleared: 'Resume cleared.',
    saved: 'Resume saved.',
    printHint: 'Fill in at least one field first',
    clearConfirm: 'Do you want to clear your resume?',
    storageError:
      'Your resume could not be saved in this browser. Save it as a PDF so it is not lost.',
    photoError: 'The photo could not be processed. Try another one.',
  },
};
