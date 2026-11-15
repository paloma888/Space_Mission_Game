// slices/briefing/hiring-rules.js: the hiring rules and money math, with no screen code,
// so hiring-test.html can check them directly. Slice 1 brief section 10.

export const CREW_SIZE = 3;
export const KEY_ROLES = ['engineer', 'inspector', 'meteorologist'];
export const WHY_CREW_FULL = 'Your capsule only fits three.';
export const WHY_NO_BUDGET = 'Not enough budget.';

// state.crew and state.staff hold exactly the RULEBOOK 7.1 fields, the same shape fakeState uses.
// Bios and lines stay in the JSON files, so other slices never depend on them.
const ASTRONAUT_FIELDS = ['id', 'name', 'pilot', 'eng', 'nerves', 'cost', 'portrait'];
const STAFF_FIELDS = ['id', 'name', 'role', 'title', 'skill', 'cost', 'portrait'];

const listFor = (state, kind) => (kind === 'astronaut' ? state.crew : state.staff);
const keepFields = (person, fieldNames) =>
  Object.fromEntries(fieldNames.filter((field) => person[field] !== undefined).map((field) => [field, person[field]]));

export function isHired(state, kind, personId) {
  return listFor(state, kind).some((person) => person.id === personId);
}

// Why this person can't be hired right now, or null if they can (or are already hired).
export function hireBlockReason(state, kind, person) {
  if (isHired(state, kind, person.id)) return null; // releasing is always allowed
  if (kind === 'astronaut' && state.crew.length >= CREW_SIZE) return WHY_CREW_FULL;
  if (person.cost > state.budget) return WHY_NO_BUDGET;
  return null;
}

// applyEffects is passed in so the budget only ever changes through it (RULEBOOK section 5).
export function hire(state, kind, person, applyEffects) {
  if (isHired(state, kind, person.id) || hireBlockReason(state, kind, person)) return false;
  listFor(state, kind).push(keepFields(person, kind === 'astronaut' ? ASTRONAUT_FIELDS : STAFF_FIELDS));
  applyEffects(state, { budget: -person.cost });
  return true;
}

// Refunds exactly what was paid: the cost stored on the hired copy.
export function release(state, kind, personId, applyEffects) {
  const list = listFor(state, kind);
  const index = list.findIndex((person) => person.id === personId);
  if (index === -1) return false;
  const [releasedPerson] = list.splice(index, 1);
  applyEffects(state, { budget: releasedPerson.cost });
  return true;
}

export const totalSpent = (state) => [...state.crew, ...state.staff].reduce((sum, person) => sum + person.cost, 0);
export const canContinue = (state) => state.crew.length === CREW_SIZE;

export function missingKeyRoles(state) {
  return KEY_ROLES.filter((role) => !state.staff.some((member) => member.role === role));
}

// Which of Rosa's three reactions fits the crew (brief section 9, scene 6).
// Light engineering is checked first on purpose: the only astronauts with eng 2 (Amara, Lucía,
// Mateo) average exactly 4 nerves together, so checking "steady" first would hide this warning forever.
export function crewReactionVariant(crew) {
  if (crew.length === 0) return 'balanced';
  const bestEngineering = Math.max(...crew.map((astronaut) => astronaut.eng));
  const averageNerves = crew.reduce((sum, astronaut) => sum + astronaut.nerves, 0) / crew.length;
  if (bestEngineering <= 2) return 'lightEngineering';
  if (averageNerves >= 4) return 'steady';
  return 'balanced';
}

// The astronaut's strongest skill, so Rosa's Why? explains what they are best at. Ties go to piloting.
export function bestSkill(astronaut) {
  return ['pilot', 'eng', 'nerves'].reduce((best, skill) => (astronaut[skill] > astronaut[best] ? skill : best), 'pilot');
}

// The single combined warning when key staff are missing (brief section 10, rule 6).
export function missingWarningText(missingRoles, warningText) {
  return [warningText.intro, ...missingRoles.map((role) => warningText.roles[role])].join(' ');
}
