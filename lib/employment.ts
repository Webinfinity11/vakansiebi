// Match an offered schedule in the description, where some sources omit the
// structured field. A bare mention can describe past experience or splitting
// a full-time job between two duties, so it is not enough on its own.
const partTime =
  '(?:ნახევარი?|არასრული?|ნაწილობრივი?|½|1/2)[[:blank:]]*განაკვეთ[ა-ჰ]*|part[ -]?time';
const sameLine = '[^\\n\\r.!?]';
export const describedPartTimePattern = [
  `(?:სამუშაო[[:blank:]]+(?:გრაფიკი|განაკვეთი|დრო)|დასაქმების[[:blank:]]+ტიპი|work[[:blank:]]+(?:hours|schedule)|employment[[:blank:]]+type)[[:blank:]:–-]+${sameLine}{0,100}(?:${partTime})`,
  `(?:სრულ[ა-ჰ]*|full[ -]?time)${sameLine}{0,60}(?:ან|ისე|and|or|/)[[:blank:]]+(?:${partTime})`,
  `(?:^|[\\n\\r])[[:blank:]•*–—-]*(?:${partTime})[[:blank:]]*[:–-]`,
  `(?:^|[^ა-ჰa-z])(?:შესაძლებელია|გთავაზობთ|იმუშაო[ა-ჰ]*|პოზიციაზე)${sameLine}{0,100}(?:${partTime})`,
].join('|');
export const unavailablePartTimePattern = `(?:${partTime})[[:blank:]]+(?:არ[[:blank:]]+(?:არის|გვაქვს|განიხილება|შეგვიძლია|შეიძლება)|ვერ)|(?:არ[[:blank:]]+(?:არის[[:blank:]]+)?(?:შესაძლებელი|განიხილება)|ვერ[[:blank:]]+(?:იმუშავებ[ა-ჰ]*|გთავაზობთ))${sameLine}{0,60}(?:${partTime})|(?:do[[:blank:]]+not|not[[:blank:]]+(?:available|offered))${sameLine}{0,30}part[ -]?time`;
