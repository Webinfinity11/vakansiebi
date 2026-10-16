// Match an offered schedule in the description, where some sources omit the
// structured field. A bare mention can describe past experience or splitting
// a full-time job between two duties, so it is not enough on its own.
const partTime =
  '(?:ნახევარი?|არასრული?|ნაწილობრივი?|½|1/2)[[:blank:]]*განაკვეთ[ა-ჰ]*|part[ -]?time';
const sameLine = '[^\\n\\r.!?;]';
export const describedPartTimePattern = [
  `(?:სამუშაო[[:blank:]]+(?:გრაფიკი|განრიგი|განაკვეთი|დატვირთვა|ფორმატი|დრო)|დასაქმების[[:blank:]]+(?:ტიპი|ფორმატი)|work[[:blank:]]+(?:hours|schedule)|employment[[:blank:]]+type)[[:blank:]:–—-]+${sameLine}{0,100}(?:${partTime})`,
  `(?:^|[\\n\\r])[[:blank:]•*·>–—-]*(?:მოქნილი[[:blank:]]+)?გრაფიკ[ა-ჰ]*[[:blank:]:(–—-]+(?:${partTime})`,
  `(?:სრულ[ა-ჰ]*|full[ -]?time)${sameLine}{0,60}(?:ან|და|ისე|ასევე|and|or|/)[[:blank:]–—-]+(?:${partTime})`,
  `(?:^|[\\n\\r])[[:blank:]•*·>–—-]*(?:${partTime})[[:blank:]]*(?:[:;–—(0-9-]|$|[\\n\\r]|გრაფიკ)`,
  `(?:^|[^ა-ჰa-z])(?:შესაძლებელია|შესაძლოა|გთავაზობთ|გვესაჭიროება|ესაჭიროება|ვეძებთ|ეძებს|იმუშაო[ა-ჰ]*|პოზიციაზე|ვაკანსია:)${sameLine}{0,100}(?:${partTime})`,
  `(?:availability[[:blank:]]+to[[:blank:]]+work|vacancy[[:blank:]]+considers)${sameLine}{0,40}part[ -]?time`,
].join('|');
export const unavailablePartTimePattern = `(?:${partTime})[[:blank:]]+(?:არ[[:blank:]]+(?:არის|გვაქვს|განიხილება|შეგვიძლია|შეიძლება)|ვერ)|(?:არ[[:blank:]]+(?:არის[[:blank:]]+)?(?:შესაძლებელი|განიხილება)|ვერ[[:blank:]]+(?:იმუშავებ[ა-ჰ]*|გთავაზობთ))${sameLine}{0,60}(?:${partTime})|(?:do[[:blank:]]+not|not[[:blank:]]+(?:available|offered))${sameLine}{0,30}part[ -]?time`;

// An internship must be the offered role/programme. Training an ordinary new
// employee, past experience, and supervising interns do not make it an internship.
export const describedInternshipPattern = [
  `(?:აცხადებს|ვაცხადებთ)[[:blank:]]+(?:ანაზღაურებად[[:blank:]]+)?სტაჟირებ`,
  `(?:აცხადებს|ვაცხადებთ)[[:blank:]]+ვაკანსიას${sameLine}{0,100}სტაჟიორ[ა-ჰ]*[[:blank:]]+პოზიცია`,
  `(?:ვეძებთ|ეძებს|ესაჭიროება|გვჭირდება)[[:blank:]]+(?:[ა-ჰa-z]+[[:blank:]]+){0,4}სტაჟიორ`,
  `დასაქმების[[:blank:]]+ტიპი[[:blank:]:–—-]+სტაჟირებ`,
  `(?:we[[:blank:]]+are[[:blank:]]+(?:hiring|seeking)|looking[[:blank:]]+for)[[:blank:]]+(?:(?:an?|paid|unpaid)[[:blank:]]+)?intern\\M`,
].join('|');
