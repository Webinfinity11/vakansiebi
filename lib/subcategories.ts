/* Role names within the chosen parent, never employer sector or generic roles.
 * Order is classification priority: if two role rules match, the first wins.
 * Keep the original 17 IDs: URLs and saved searches persist them.
 * სხვა deliberately has no children; misfiled professions need parent repair.
 */
const roleRules = [
  {
    id: 'tech-security',
    category: 'ტექნოლოგიები',
    label: 'კიბერუსაფრთხოება',
    pattern:
      'კიბერ|cyber|ინფორმაციულ.*უსაფრთხოებ|information security|security (engineer|analyst)|(^|[^ა-ჰa-z])soc([^ა-ჰa-z]|$)',
  },
  {
    id: 'tech-business-systems',
    category: 'ტექნოლოგიები',
    label: 'ბიზნესსისტემები / ERP',
    pattern: '(^|[^ა-ჰa-z])(1c|erp|sap)([^ა-ჰa-z]|$)|ბიზნეს.*სისტემ',
  },
  {
    id: 'tech-product',
    category: 'ტექნოლოგიები',
    label: 'ციფრული პროდუქტი / პროექტები / UX',
    pattern:
      'პროდუქტ.*(მფლობელ|მენეჯერ)|პროექტ.*(მართვ|მენეჯერ)|პროცეს.*დანერგვ|product (owner|manager)|project manager|(^|[^ა-ჰa-z])(ui|ux)([^ა-ჰa-z]|$)',
  },
  {
    id: 'tech-data',
    category: 'ტექნოლოგიები',
    label: 'მონაცემები / AI / ანალიტიკა',
    pattern:
      'მონაცემთა.*(ანალიტ|ინჟინერ|მეცნიერ|ბაზ.*ადმინისტრატორ)|(^|[^ა-ჰa-z])data (analyst|engineer|scientist)|(^|[^ა-ჰa-z])(ai|ml) (ინჟინერ|სპეციალისტ|developer|პროგრამისტ)|ბიზნეს.*ანალიტ|business analy|machine learning|ხელოვნურ.*ინტელექტ.*(ინჟინერ|სპეციალისტ|დეველოპერ)',
  },
  {
    id: 'tech-qa',
    category: 'ტექნოლოგიები',
    label: 'ტესტირება / QA',
    pattern:
      'ტესტერ|პროგრამ.*ტესტირებ|(^|[^ა-ჰa-z])qa([^ა-ჰa-z]|$)|quality assurance|test engineer',
  },
  {
    id: 'tech-development',
    category: 'ტექნოლოგიები',
    label: 'პროგრამირება',
    pattern:
      'დეველოპერ|პროგრამისტ|developer|software engineer|frontend|front.end|backend|back.end|full.stack',
  },
  {
    id: 'tech-systems',
    category: 'ტექნოლოგიები',
    label: 'ინფრასტრუქტურა / ქსელები / ღრუბელი',
    pattern:
      'სისტემურ.*ადმინისტრატორ|ქსელ.*(ინჟინერ|ადმინისტრატორ|სპეციალისტ)|system.*admin|network.*(engineer|admin|specialist)|devops|cloud.*(architect|engineer|არქიტექტ|ინჟინერ)|(^|[^ა-ჰa-z])sre([^ა-ჰa-z]|$)',
  },
  {
    id: 'tech-support',
    category: 'ტექნოლოგიები',
    label: 'IT / აპლიკაციების მხარდაჭერა',
    pattern:
      '(^|[^ა-ჰa-z])it([^ა-ჰa-z]|$).*(მხარდაჭერ|მხარდამჭერ|support|სპეციალისტ)|ტექნიკურ.*მხარდაჭერ|ტექნოლოგიების.*სპეციალისტ|აპლიკაცი.*მხარდაჭერ|help.?desk',
  },
  {
    id: 'sales-property',
    category: 'გაყიდვები',
    label: 'უძრავი ქონების გაყიდვა',
    pattern:
      'უძრავ.*ქონებ.*(აგენტ|ბროკერ|გაყიდვ|მენეჯერ|კონსულტანტ)|real estate.*(agent|broker|sales|manager)|რეალტორ|realtor',
  },
  {
    id: 'sales-store',
    category: 'გაყიდვები',
    label: 'მაღაზიის მართვა',
    pattern:
      '(მაღაზი|შოურუმ|ფილიალ|სავაჭრო ობიექტ).*(მენეჯერ|ადმინისტრატორ|უფროს|ხელმძღვანელ)|store manager|retail manager',
  },
  {
    id: 'sales-retail',
    category: 'გაყიდვები',
    label: 'სალარო / საცალო გაყიდვა',
    pattern:
      'მოლარ[ეი]|cashier|გაყიდვ.*კონსულტანტ|სავაჭრო.*კონსულტანტ|მაღაზი.*კონსულტანტ|შოურუმ.*კონსულტანტ|გამყიდველ|sales assistant|retail associate',
  },
  {
    id: 'sales-representative',
    category: 'გაყიდვები',
    label: 'წარმომადგენელი / მერჩენდაიზერი',
    pattern:
      'პრესელერ|პრისელერ|პრისეილერ|მერჩენდ|სავაჭრო.*(წარმომადგენ|აგენტ)|გაყიდვ.*(წარმომადგენ|აგენტ)|sales representative|merchandis',
  },
  {
    id: 'sales-operations',
    category: 'გაყიდვები',
    label: 'გაყიდვების მხარდაჭერა',
    pattern:
      'გაყიდვ.*(სპეციალისტ|ოპერატორ|ასისტენტ|ოფიცერ|კოორდინატორ)|sales (support|operations|specialist|coordinator)|გაყიდვ.*შემდგომ.*(მომსახურ|მხარდაჭერ)|after.sales.*(support|service|manager)',
  },
  {
    id: 'sales-management',
    category: 'გაყიდვები',
    label: 'გაყიდვების მართვა',
    pattern:
      'გაყიდვ.*(მენეჯერ|ხელმძღვანელ|უფროს)|sales.*(manager|head|lead)|account manager|ბიზნეს.*განვითარ|business development',
  },
  {
    id: 'marketing-promotion',
    category: 'მარკეტინგი',
    label: 'პრომო / რეკლამის გავრცელება',
    pattern: 'რეკლამ.*დამრიგებელ|პრომოუტერ|promoter|პრომო.*კონსულტანტ',
  },
  {
    id: 'marketing-design',
    category: 'მარკეტინგი',
    label: 'გრაფიკული დიზაინი',
    pattern:
      'გრაფიკულ.*დიზაინ|graphic.*design|ილუსტრატ|illustrat|მოუშენ|motion design',
  },
  {
    id: 'marketing-media',
    category: 'მარკეტინგი',
    label: 'ფოტო / ვიდეოწარმოება',
    pattern:
      'ვიდეო[ -]*(ოპერატორ|მონტაჟ|ედიტორ|მსახიობ)|სარეკლამო ვიდეოს მსახიობ|ვიდეოგრაფ|ფოტოგრაფ|photograph|videograph|video editor|პირდაპირი ჩართვის წამყვან',
  },
  {
    id: 'marketing-social',
    category: 'მარკეტინგი',
    label: 'სოციალური მედია / რეკლამა',
    pattern:
      'სოციალურ.*მედი|სოც.?მედი|(^|[^ა-ჰa-z])(smm|seo|ppc)([^ა-ჰa-z]|$)|social media|ციფრულ.*მარკეტინგ|digital marketing|ედვერთაიზ|advertis',
  },
  {
    id: 'marketing-content',
    category: 'მარკეტინგი',
    label: 'კონტენტი / ჟურნალისტიკა',
    pattern:
      'კონტენტ|content|კოპირაიტერ|copywrit|ჟურნალისტ|journalist|რედაქტორ',
  },
  {
    id: 'marketing-pr',
    category: 'მარკეტინგი',
    label: 'PR / ღონისძიებები',
    pattern:
      '(^|[^ა-ჰa-z])pr([^ა-ჰa-z]|$)|საზოგადოებასთან|საზოგადოებასთან.*ურთიერთობ|public relations|communications (manager|specialist|officer)|ღონისძიებ|ივენთ|event',
  },
  {
    id: 'marketing-management',
    category: 'მარკეტინგი',
    label: 'მარკეტინგი / ბრენდი',
    pattern:
      'მარკეტინგ|marketing|ბრენდ.*(მენეჯერ|ხელმძღვანელ|ამბასადორ)|brand.*(manager|lead|ambassador)',
  },
  {
    id: 'admin-hr',
    category: 'ადმინისტრაცია',
    label: 'HR / რეკრუტინგი',
    pattern:
      '(^|[^ა-ჰa-z])hr([^ა-ჰa-z]|$)|ადამიანურ.*რესურს|human resources|რეკრუტ|recruit|პერსონალ.*(მართვ|შერჩევ)',
  },
  {
    id: 'admin-reception',
    category: 'ადმინისტრაცია',
    label: 'მიმღები / რეგისტრატურა',
    pattern:
      'რეგისტრატორ|მიმღებ|რეცეფ|reception|registrar|სტუმრ.*(მიმღებ|კოორდინატორ)|guest.*(reception|coordinator|relations)',
  },
  {
    id: 'admin-projects',
    category: 'ადმინისტრაცია',
    label: 'პროექტების მართვა',
    pattern:
      'პროექტ.*(მენეჯერ|კოორდინატორ|ასისტენტ|მართვ)|project.*(manager|coordinator|assistant)',
  },
  {
    id: 'admin-branch',
    category: 'ადმინისტრაცია',
    label: 'ფილიალის / სივრცის მართვა',
    pattern:
      '(ფილიალ|დარბაზ|სივრც|შოურუმ).*(მენეჯერ|ადმინისტრატორ|კოორდინატორ|ხელმძღვანელ)|branch manager',
  },
  {
    id: 'admin-office',
    category: 'ადმინისტრაცია',
    label: 'ოფისი / საქმისწარმოება',
    pattern:
      'ოფის.?მენეჯერ|ოფისის.*მენეჯერ|office manager|ადმინისტრაციულ.*(ასისტენტ|მენეჯერ|სპეციალისტ)|პერსონალურ.*ასისტენტ|personal assistant|მდივან|secretary|ხელმძღვანელ.*(ასისტენტ|თანაშემწე)|მდივნ|office assistant|საქმის.?წარმო|არქივ|დოკუმენტ|კანცელარი|archiv|document|clerk',
  },
  {
    id: 'finance-audit',
    category: 'ფინანსები',
    label: 'აუდიტი',
    pattern: 'აუდიტ|audit',
  },
  {
    id: 'finance-accounting',
    category: 'ფინანსები',
    label: 'ბუღალტერია',
    pattern: 'ბუღალტ[ერ]|accountant|accounting|bookkeep',
  },
  {
    id: 'finance-risk',
    category: 'ფინანსები',
    label: 'რისკები / დაზღვევა',
    pattern:
      'რისკ|risk|პრობლემურ|ვალდებულებ|დავალიანებ|ამოღებ|ვადაგადაცილ|დაზღვევ|სადაზღვევ|insurance',
  },
  {
    id: 'finance-credit',
    category: 'ფინანსები',
    label: 'სესხები / განვადება',
    pattern:
      'საკრედიტ|დაკრედიტ|სესხ|სასესხო|განვადებ|ლომბარდ|credit|loan|ლიზინგ|leasing',
  },
  {
    id: 'finance-cash',
    category: 'ფინანსები',
    label: 'სალარო',
    pattern: 'მოლარე|საკასო|cashier|cash operations',
  },
  {
    id: 'finance-banking',
    category: 'ფინანსები',
    label: 'ბანკირი',
    pattern: 'ბანკირ|ბანკინგ|banker|banking|დიჯი[ტთ]ალ.*სერვის.*ოფიცერ',
  },
  {
    id: 'finance-analysis',
    category: 'ფინანსები',
    label: 'ფინანსური ანალიზი',
    pattern:
      'ფინანს.*(ანალიტ|ანალიზ|მენეჯერ|დირექტორ|მართვ|სპეციალისტ|კონტროლ)|financial.*(analyst|manager|controller)|(^|[^ა-ჰa-z])cfo([^ა-ჰa-z]|$)|ხაზინ|ბიუჯეტ|treasury',
  },
  {
    id: 'logistics-customs',
    category: 'ლოჯისტიკა',
    label: 'საბაჟო / იმპორტი / ექსპორტი',
    pattern: 'საბაჟო|იმპორტ|ექსპორტ|customs|import|export',
  },
  {
    id: 'logistics-driving',
    category: 'ლოჯისტიკა',
    label: 'მძღოლი / კურიერი',
    pattern: 'მძღოლ|driver|გადამზიდ|კურიერ|courier|მიწოდების აგენტ|delivery',
  },
  {
    id: 'logistics-distribution',
    category: 'ლოჯისტიკა',
    label: 'დისტრიბუცია / ექსპედიცია',
    pattern: 'დისტრიბუტ|დისტრიბუც|ექსპედიტორ|distribut|forwarder',
  },
  {
    id: 'logistics-warehouse',
    category: 'ლოჯისტიკა',
    label: 'საწყობი / მარაგები',
    pattern:
      'საწყობ|მტვირთავ|შემფუთ|ამგროვებ|შემგროვებ|ინვენტარიზაცი|მარაგებ|warehouse|packer|დაფასოებ|დამფასოებ|შეფუთვ|packaging',
  },
  {
    id: 'logistics-procurement',
    category: 'ლოჯისტიკა',
    label: 'შესყიდვა / მომარაგება',
    pattern: 'შესყიდვ|მომარაგებ|procurement|purchas|supply',
  },
  {
    id: 'logistics-dispatch',
    category: 'ლოჯისტიკა',
    label: 'ლოჯისტიკა / დისპეტჩერი',
    pattern: 'ლოჯისტ|ლოგისტ|logistic|დისპეტჩ|დისპეჩ|dispatch',
  },
  {
    id: 'service-reception',
    category: 'მომსახურება',
    label: 'მიღება / სასტუმროს მართვა',
    pattern:
      '(სასტუმრო|რესტორნ|კაფე).*(ადმინისტრატორ|მენეჯერ|სუპერვაიზერ)|რეცეფ|reception|ჰოსტეს|hostess|კონსიერჟ|concierge|ბელბოი|მიღება.განთავსებ',
  },
  {
    id: 'service-kitchen',
    category: 'მომსახურება',
    label: 'სამზარეულო / საცხობი',
    pattern:
      'მზარეულ|კონდიტერ|მცხობელ|სამზარეულ.*(თანამშრომ|დამხმარ|მუშაკ|პერსონალ|მენეჯერ|უფროს)|ჭურჭლის.*მრეცხ|მეხინკლ|მემწვად|მეშაურმ|(^|[^ა-ჰa-z])შეფ(ი|ის)?([^ა-ჰa-z]|$)|(^|[^ა-ჰa-z])(cook|chef|baker)([^ა-ჰa-z]|$)|სტიუარდ|steward',
  },
  {
    id: 'service-hospitality',
    category: 'მომსახურება',
    label: 'მიმტანი / ბარისტა / ბარმენი',
    pattern: 'მიმტან|ბარისტ|ბარმენ|waiter|waitress|barista|bartender',
  },
  {
    id: 'service-auto',
    category: 'მომსახურება',
    label: 'ავტომობილის რეცხვა',
    pattern:
      '(ავტო|ავტომობილ|მანქან).{0,20}მრეცხ|car wash|ავტო.?სამრეცხაო.*(თანამშრომ|მრეცხავ|მუშა)',
  },
  {
    id: 'service-cleaning',
    category: 'მომსახურება',
    label: 'დასუფთავება',
    pattern:
      'დამლაგებელ|დასუფთავ|დიასახლის|მწმენდავ|cleaner|cleaning|housekeep|ქიმწმენდ|dry clean',
  },
  {
    id: 'service-care',
    category: 'მომსახურება',
    label: 'ბავშვის / ოჯახის მოვლა',
    pattern: 'ძიძა|მომვლელ|nanny|caregiver',
  },
  {
    id: 'service-support',
    category: 'მომსახურება',
    label: 'მომხმარებელთა მხარდაჭერა',
    pattern:
      '(მომხმარებელ|კლიენტ).*(მხარდაჭერ|მომსახურ|ურთიერთობ)|ქოლ.?ცენტრ|სატელეფონო.*ოპერატორ|კონტაქტ.?ცენტრ|customer.*(support|service)|call.center',
  },
  {
    id: 'medical-administration',
    category: 'სამედიცინო',
    label: 'კლინიკის ადმინისტრირება',
    pattern:
      'რეგისტრატორ|(^|[^ა-ჰa-z])სამედიცინო.*მხარდაჭერ|კლინიკ.*(ადმინისტრატორ|მენეჯერ)|(^|[^ა-ჰa-z])სამედიცინო.*(ადმინისტრატორ|კოორდინატორ)|clinic.*(administrator|manager)|medical (coordinator|administrator)|registrar',
  },
  {
    id: 'medical-commercial',
    category: 'სამედიცინო',
    label: 'სამედიცინო წარმომადგენლობა',
    pattern:
      '(^|[^ა-ჰa-z])სამედიცინო.*(წარმომადგენ|პროდუქც|პროდუქტ)|medical representative',
  },
  {
    id: 'medical-dental',
    category: 'სამედიცინო',
    label: 'სტომატოლოგია',
    pattern:
      'სტომატოლოგ(ი|ის|იის)([^ა-ჰa-z]|$)|კბილის.*(ტექნიკოს|ექიმ)|დენტალ.*(ტექნიკოს|ასისტენტ)|dentist|dental (assistant|technician)|სტომატოლოგის.*ასისტენტ',
  },
  {
    id: 'medical-nursing',
    category: 'სამედიცინო',
    label: 'საექთნო საქმე / სანიტარია',
    pattern: 'ექთან|ექთნ|მედდა|სანიტარ|nurse|nursing',
  },
  {
    id: 'medical-pharmacy',
    category: 'სამედიცინო',
    label: 'ფარმაცია',
    pattern: 'ფარმაც|pharm',
  },
  {
    id: 'medical-mental-rehab',
    category: 'სამედიცინო',
    label: 'ფსიქოლოგია / რეაბილიტაცია',
    pattern:
      'ფსიქოლოგ|ფსიქოთერაპ|ფსიქიატრ|რეაბილიტოლოგ|ფიზიოთერაპ|ფიზიკურ.*თერაპ|ოკუპაციურ.*თერაპ|psycholog|rehabilitation therapist',
  },
  {
    id: 'medical-laboratory',
    category: 'სამედიცინო',
    label: 'ლაბორატორია / დიაგნოსტიკა',
    pattern:
      'ლაბორანტ|ლაბორატორ|ფლებოტომ|რენტგენ|ექოსკოპ|სონოგრაფ|მიკრობიოლოგ|laboratory|phlebotom',
  },
  {
    id: 'medical-doctors',
    category: 'სამედიცინო',
    label: 'ექიმები',
    pattern:
      'ექიმ|doctor|physician|რადიოლოგ|გასტროენტეროლოგ|კარდიოლოგ|ენდოკრინოლოგ|გინეკოლოგ|უროლოგ|ნევროლოგ|პედიატრ|ქირურგ|თერაპევტ|ოფთალმოლოგ|დერმატოლოგ|ალერგოლოგ|ანესთეზიოლოგ|ოტორინოლარინგოლოგ',
  },
  {
    id: 'education-support',
    category: 'განათლება',
    label: 'სწავლის მხარდაჭერა',
    pattern:
      'სპეციალურ.*მასწავლებ|მასწავლებ.*ასისტენტ|კლასის მხარდამჭერი მასწავლებ|მოსწავლეთა.*მხარდაჭერის მასწავლებ|შშმ.*ასისტენტ|თანასწორ.განმანათლებელ|დამრიგებლ.*ასისტენტ|special education teacher|teaching assistant|learning support|inclusive education',
  },
  {
    id: 'education-preschool',
    category: 'განათლება',
    label: 'სკოლამდელი აღზრდა',
    pattern:
      'აღმზრდელ|საბავშვო.*ბაღ.*(მასწავლებ|პედაგოგ|ასისტენტ|დამხმარე)|ბაღის.*მასწავლებ|kindergarten.*(teacher|assistant)',
  },
  {
    id: 'education-vocational',
    category: 'განათლება',
    label: 'პროფესიული სწავლება',
    pattern:
      'პროფესიულ.*(მასწავლებ|საგანმანათლებლო პროგრამის ხელმძღვანელ)|vocational.*(teacher|trainer|instructor)',
  },
  {
    id: 'education-training',
    category: 'განათლება',
    label: 'ტრენინგი / ინსტრუქტორი',
    pattern: 'ტრენერ|ტრენინგ|ტრეინინგ|ინსტრუქტორ|trainer|training|instructor',
  },
  {
    id: 'education-academic',
    category: 'განათლება',
    label: 'უმაღლესი განათლება',
    pattern: 'პროფესორ|ლექტორ|აკადემიურ|დეკან|რექტორ|professor|lecturer',
  },
  {
    id: 'education-school',
    category: 'განათლება',
    label: 'სწავლება',
    pattern: 'მასწავლებ|მასწავლებლ|პედაგოგ|რეპეტიტორ|ტუტორ|teacher|tutor',
  },
  {
    id: 'construction-architecture',
    category: 'მშენებლობა',
    label: 'პროექტირება / გეოდეზია',
    pattern: 'არქიტექტ|გეოდეზ|პროექტანტ|ინტერიერ.*დიზაინ|architect|surveyor',
  },
  {
    id: 'construction-management',
    category: 'მშენებლობა',
    label: 'მშენებლობის მართვა',
    pattern:
      '(მშენებლ|სამშენებლ|ინფრასტრუქტურ).*(მენეჯერ|ზედამხედველ|მწარმოებელ)|სამუშაოთა.*მწარმოებელ|საიტ.?მენეჯერ|site manager|construction manager',
  },
  {
    id: 'construction-electrical',
    category: 'მშენებლობა',
    label: 'ელექტროობა / სანტექნიკა',
    pattern:
      'ელექტრ|სანტექნიკ|გათბობ|კონდიცირ|ვენტილაცი|hvac|electric|plumb|mep',
  },
  {
    id: 'construction-furniture',
    category: 'მშენებლობა',
    label: 'ავეჯი / დურგლობა',
    pattern:
      'ავეჯ.*(ამწყობ|ხელოსან|მუშა|დამხმარ|მონტაჟ)|დურგალ|ხის.*დამუშავ|furniture.*(assembl|maker|carpenter)|carpenter|assembler',
  },
  {
    id: 'construction-installation',
    category: 'მშენებლობა',
    label: 'მონტაჟი / შედუღება',
    pattern:
      'მონტაჟ|მემონტაჟ|ინსტალატ|შემდუღ|მეთუნუქ|ლითონ|კარ.?ფანჯ|ალუმინ|welder|install',
  },
  {
    id: 'construction-finishing',
    category: 'მშენებლობა',
    label: 'მოპირკეთება / შეღებვა',
    pattern: 'მღებავ|მალიარ|მოპირკეთ|თაბაშირ|შპალერ|კაფელ|მეტლახ|painter',
  },
  {
    id: 'construction-structure',
    category: 'მშენებლობა',
    label: 'ბეტონი / მძიმე ტექნიკა',
    pattern:
      'ბეტონ|არმატურ|მონოლით|კალატოზ|ამწე|ამწის|ბულდოზერ|ექსკავატორ|crane|concrete',
  },
  {
    id: 'construction-labor',
    category: 'მშენებლობა',
    label: 'სამშენებლო მუშა',
    pattern:
      '(^|[^ა-ჰa-z])მუშა([^ა-ჰa-z]|$)|მუშის|(^|[^ა-ჰa-z])მშრომელ|მშენებელ|construction worker|labou?rer',
  },
  {
    id: 'security-safety',
    category: 'დაცვა',
    label: 'შრომის / სახანძრო უსაფრთხოება',
    pattern:
      'შრომის.*უსაფრთხოებ|სახანძრო|გარემოსდაცვ|hse|occupational safety|fire safety',
  },
  {
    id: 'security-monitoring',
    category: 'დაცვა',
    label: 'ვიდეომონიტორინგი',
    // A bare "monitoring" is as often a bank portfolio or a ministry department.
    pattern:
      'ვიდეო[- ]?მონიტორინგ|(ობიექტ|უსაფრთხოებ)[^ ]*.*მონიტორინგ|მონიტორინგის (თანამშრომ|ოპერატორ|ოფიცერ)|კამერებ|მეთვალყურ|cctv|surveillance',
  },
  {
    id: 'security-cash',
    category: 'დაცვა',
    label: 'ინკასაცია',
    pattern: 'ინკასატორ|ინკასაცი|cash.in.transit',
  },
  {
    id: 'security-guard',
    category: 'დაცვა',
    label: 'დაცვა / დარაჯი',
    // Environmental, health and data protection are not guarding.
    pattern:
      '^(?![\\s\\S]*(გარემოს?[- ]?დაცვ|ჯანდაცვ|მონაცემთა დაცვ|უფლებების დაცვ))[\\s\\S]*((^|[^ა-ჰa-z])დაცვა([^ა-ჰa-z]|$)|დაცვის|მცველ|დარაჯ|ფიზიკურ.*უსაფრთხოებ|უსაფრთხოების.*(თანამშრომ|ოფიცერ|ადმინისტრატორ|ინსპექტორ)|security guard|guard)',
  },
  {
    id: 'production-engineering',
    category: 'წარმოება',
    label: 'ინჟინერია / ტექნოლოგია',
    pattern:
      '(ელექტრო|მექანიკურ|hvac|mep|სამრეწველო|ტექნოლოგი|სისტემ|ქსელ|სერვის|სამოქალაქო).*ინჟინერ|ინჟინერ.*(ელექტრო|მექანიკ|hvac|mep|პროექტ|სისტემ|კონსტრუქტ)|ტექნოლოგ|technologist|mechanical engineer|electrical engineer',
  },
  {
    id: 'production-maintenance',
    category: 'წარმოება',
    label: 'ტექნიკური მოვლა / მექანიკა',
    pattern:
      'ტექნიკოს|მექანიკ|ტექნიკურ.*(სპეციალისტ|მომსახურ)|technician|mechanic|ზეინკალ|აპარატ.*სერვის',
  },
  {
    id: 'production-sewing',
    category: 'წარმოება',
    label: 'კერვა / ტექსტილი',
    pattern:
      'მკერავ|სამკერვალ.*(მუშა|თანამშრომ|დამხმარ)|კერვის.*(სპეციალისტ|ოსტატ)|tailor|sewing.*(operator|specialist)',
  },
  {
    id: 'production-furniture',
    category: 'წარმოება',
    label: 'ავეჯი / აწყობა',
    pattern:
      'ავეჯ.*(ამწყობ|ხელოსან|მუშა|დამხმარ|მონტაჟ)|დურგალ|ხის.*დამუშავ|ამწყობ|furniture.*(assembl|maker|carpenter)|carpenter|assembler|წიბოს.*შემოკვრ|edge.band',
  },
  {
    id: 'production-packing',
    category: 'წარმოება',
    label: 'შეფუთვა / დაფასოება',
    pattern: 'შემფუთ|შეფუთ|დამფასოებ|დაფასოებ|დამსტიკერ|packer|packag',
  },
  {
    id: 'production-line',
    category: 'წარმოება',
    label: 'წარმოება / დანადგარები',
    pattern:
      '(წარმოებ|საწარმო|დანადგარ|ჩარხ|ქარხ|საამქრო).*(თანამშრომ|ოპერატორ|მუშა|დამხმარ|მენეჯერ|უფროს|სპეციალისტ|ხელმძღვანელ)|production (worker|operator|manager)|machine operator|manufacturing.*(worker|operator|manager)|მბეჭდავ',
  },
  {
    id: 'production-labor',
    category: 'წარმოება',
    label: 'მუშა / დამხმარე',
    pattern: '(^|[^ა-ჰa-z])მუშა([^ა-ჰa-z]|$)|მუშის|labou?rer|worker',
  },
  {
    id: 'legal-assistance',
    category: 'იურიდიული',
    label: 'იურიდიული თანაშემწე',
    pattern:
      'იურისტ.*ასისტენტ|ადვოკატ.*თანაშემწე|ნოტარიუს.*თანაშემწე|იურიდიულ.*ასისტენტ|paralegal|legal assistant',
  },
  {
    id: 'legal-proceedings',
    category: 'იურიდიული',
    label: 'სასამართლო / სამართალწარმოება',
    pattern:
      'სასამართლო|სამართალწარმო|მოსამართლე|სისხლის სამართ|litigation|court',
  },
  {
    id: 'legal-practice',
    category: 'იურიდიული',
    label: 'იურიდიული პრაქტიკა',
    pattern: 'იურისტ|იურიდიულ|ადვოკატ|lawyer|legal counsel',
  },
  {
    id: 'beauty-management',
    category: 'სილამაზე',
    label: 'სალონის / სპას მართვა',
    pattern:
      '(სალონ|სოლარიუმ|ბარბერ|სპა).*(ადმინისტრატორ|მენეჯერ)|ადმინისტრატორ.*სპა|(salon|spa|barber).*(manager|administrator)|administrator.*spa',
  },
  {
    id: 'beauty-nails',
    category: 'სილამაზე',
    label: 'მანიკური / პედიკური',
    pattern: 'მანიკურ|მანიკიურ|პედიკურ|ფრჩხილ|ფჩხილ|nail',
  },
  {
    id: 'beauty-cosmetics',
    category: 'სილამაზე',
    label: 'კოსმეტოლოგია / მაკიაჟი',
    pattern: 'კოსმეტოლოგ|ვიზაჟისტ|cosmetolog|makeup',
  },
  {
    id: 'beauty-spa',
    category: 'სილამაზე',
    label: 'მასაჟი / სპა',
    pattern: 'მასაჟ|massage.*(therapist|specialist)|spa therapist',
  },
  {
    id: 'beauty-hair',
    category: 'სილამაზე',
    label: 'თმა / ბარბერი',
    pattern:
      'სტილისტ|თმის.*(ოსტატ|სპეციალისტ)|ბარბერ(ი|ის)?([^ა-ჰa-z]|$)|პარიკმახერ|hairdress|stylist|barber|თავის დამბან',
  },
] as const;

// Exclude earlier raw role rules in the exported pattern as well. This keeps
// independent SQL filters disjoint without changing search-plan.ts: one title
// belongs to the first matching child only, even for combined roles. Both JS
// and PostgreSQL ARE support this negative lookahead. Do not sort roleRules.
export const subcategories = roleRules.map((item, index) => {
  const previous = roleRules
    .slice(0, index)
    .filter((rule) => rule.category === item.category)
    .map((rule) => `(?:${rule.pattern})`);
  return {
    ...item,
    pattern: previous.length
      ? `^(?![\\s\\S]*(?:${previous.join('|')}))[\\s\\S]*(?:${item.pattern})`
      : item.pattern,
  };
});

const titleRules = subcategories.map((item) => ({
  item,
  regex: new RegExp(item.pattern, 'i'),
}));

export function subcategoryFor(category: string, id?: string | null) {
  return subcategories.find(
    (item) => item.category === category && item.id === id,
  );
}

export function subcategoryForTitle(category: string, title: string) {
  // Mirrors SQL lower(normalize(title, NFKC)); non-Unicode PG locales may not
  // lowercase Mtavruli. See the parity audit in subcategories-research.
  const normalized = title.normalize('NFKC').toLowerCase();
  return titleRules.find(
    ({ item, regex }) => item.category === category && regex.test(normalized),
  )?.item;
}
