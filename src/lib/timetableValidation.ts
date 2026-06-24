type TimetableSlotInput = {
    slot?: unknown;
    courseCode?: unknown;
    courseName?: unknown;
    facultyName?: unknown;
    venue?: unknown;
};

type TimetableBodyInput = {
    title?: unknown;
    slots?: unknown;
    owner?: unknown;
    isPublic?: unknown;
};

export type ValidatedTimetableSlot = {
    slot: string;
    courseCode: string;
    courseName: string;
    facultyName: string;
    venue?: string;
};

const MAX_TITLE_LENGTH = 120;
const MAX_SLOT_COUNT = 64;
const MAX_FIELD_LENGTH = 200;
const ALLOWED_TIMETABLE_UPDATE_KEYS = new Set(['title', 'slots', 'isPublic']);
const ALLOWED_TIMETABLE_CREATE_KEYS = new Set(['title', 'slots', 'owner', 'isPublic']);

const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;

const normalizeString = (value: unknown, field: string, maxLength = MAX_FIELD_LENGTH) => {
    if (!isNonEmptyString(value)) {
        throw new Error(`${field} must be a non-empty string`);
    }

    const normalized = value.trim();
    if (normalized.length > maxLength) {
        throw new Error(`${field} is too long`);
    }

    return normalized;
};

export const validateTimetableTitle = (value: unknown) => {
    return normalizeString(value, 'Title', MAX_TITLE_LENGTH);
};

export const validateTimetableSlots = (value: unknown): ValidatedTimetableSlot[] => {
    if (!Array.isArray(value) || value.length === 0) {
        throw new Error('Slots must be a non-empty array');
    }

    if (value.length > MAX_SLOT_COUNT) {
        throw new Error('Too many slots submitted');
    }

    return value.map((slot, index) => {
        const input = slot as TimetableSlotInput;
        return {
            slot: normalizeString(input.slot, `slots[${index}].slot`),
            courseCode: normalizeString(input.courseCode, `slots[${index}].courseCode`),
            courseName: normalizeString(input.courseName, `slots[${index}].courseName`),
            facultyName: normalizeString(input.facultyName, `slots[${index}].facultyName`),
            venue: input.venue !== undefined ? String(input.venue || '').trim() : undefined,
        };
    });
};

const validateBodyShape = (body: unknown) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new Error('Request body must be a JSON object');
    }

    return body as Record<string, unknown>;
};

export const validateTimetableCreateBody = (body: unknown) => {
    const input = validateBodyShape(body);
    const unknownKeys = Object.keys(input).filter((key) => !ALLOWED_TIMETABLE_CREATE_KEYS.has(key));
    if (unknownKeys.length > 0) {
        throw new Error(`Unexpected fields: ${unknownKeys.join(', ')}`);
    }

    const typedInput = input as TimetableBodyInput;
    if (typedInput.isPublic !== undefined && typeof typedInput.isPublic !== 'boolean') {
        throw new Error('isPublic must be a boolean');
    }

    return {
        title: validateTimetableTitle(typedInput.title),
        slots: validateTimetableSlots(typedInput.slots),
        owner: normalizeString(typedInput.owner, 'Owner'),
        isPublic: typedInput.isPublic ?? false,
    };
};

export const validateTimetableUpdateBody = (body: unknown) => {
    const input = validateBodyShape(body);
    const unknownKeys = Object.keys(input).filter((key) => !ALLOWED_TIMETABLE_UPDATE_KEYS.has(key));
    if (unknownKeys.length > 0) {
        throw new Error(`Unexpected fields: ${unknownKeys.join(', ')}`);
    }

    const typedInput = input as TimetableBodyInput;
    const update: {
        title?: string;
        slots?: ValidatedTimetableSlot[];
        isPublic?: boolean;
    } = {};

    if (typedInput.title !== undefined) update.title = validateTimetableTitle(typedInput.title);
    if (typedInput.slots !== undefined) update.slots = validateTimetableSlots(typedInput.slots);
    if (typedInput.isPublic !== undefined) {
        if (typeof typedInput.isPublic !== 'boolean') {
            throw new Error('isPublic must be a boolean');
        }
        update.isPublic = typedInput.isPublic;
    }

    if (Object.keys(update).length === 0) {
        throw new Error('At least one valid field must be provided');
    }

    return update;
};
