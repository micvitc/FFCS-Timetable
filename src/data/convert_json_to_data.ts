import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

type RawCourseRow = Record<string, unknown> & {
    CODE?: string;
    TITLE?: string;
};

const DATA_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_DATA_DIR = DATA_DIR;
const INPUT_FILE = path.join(DATA_DIR, 'output_chennai.json');
const FALLBACK_XLSX_FILE = path.join(DATA_DIR, 'report_chennai.xlsx');

const readJson = async () => {
    const contents = await fs.readFile(INPUT_FILE, 'utf8');
    return JSON.parse(contents) as RawCourseRow[];
};

const readFromWorkbook = async () => {
    const workbook = XLSX.readFile(FALLBACK_XLSX_FILE);
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
        throw new Error('No worksheets found in report_chennai.xlsx');
    }

    const worksheet = workbook.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_json<RawCourseRow>(worksheet);
};

const fileExists = async (filePath: string) => {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
};

const ensureDirectory = async () => {
    await fs.mkdir(SRC_DATA_DIR, { recursive: true });
};

const formatTsModule = (value: unknown) => {
    return `const data = ${JSON.stringify(value, null, 2)} as const;\n\nexport default data;\n`;
};

const writeTsModule = async (filePath: string, value: unknown) => {
    await fs.writeFile(filePath, formatTsModule(value));
};

const normalizeCourseRow = (row: RawCourseRow): RawCourseRow => {
    if (!row.CODE || !row.TITLE) return row;
    
    const code = String(row.CODE).trim();
    let title = String(row.TITLE).trim();
    
    if (code === 'BEEE309L' || code === 'BEEE309P') {
        if (title.startsWith('Microprocessors and Microcontro')) {
            title = 'Microprocessors and Microcontrollers';
        }
    } else if (code === 'BACSE102') {
        if (title === 'Problem Solving Using Java - Lab Only') {
            title = 'Problem Solving Using Java';
        }
    } else if (code === 'BACSE106') {
        if (title === 'Operating Systems - Embedded Theory and Lab') {
            title = 'Operating Systems';
        }
    } else if (code === 'BEEE303P') {
        if (title === 'Control Systems Lab') {
            title = 'Control Systems';
        }
    } else if (code === 'BEEE312P') {
        if (title === 'AC Machines Lab') {
            title = 'AC Machines';
        }
    }
    
    title = title.replace(/\s*-\s*Lab Only$/i, '');
    title = title.replace(/\s*-\s*Embedded Theory and Lab$/i, '');
    title = title.replace(/\s*-\s*Embedded Theory \/ Embedded Lab$/i, '');
    
    return {
        ...row,
        CODE: code,
        TITLE: title,
    };
};

const uniqueCourses = (courses: RawCourseRow[]) =>
    courses.filter(
        (element, index, self) =>
            self.findIndex(
                (course) => course.CODE === element.CODE && course.TITLE === element.TITLE,
            ) === index,
    );

const run = async () => {
    await ensureDirectory();

    const rawData = await fileExists(INPUT_FILE)
        ? await readJson()
        : await readFromWorkbook();

    const outputObjectChennai = rawData.map(normalizeCourseRow);

    await writeTsModule(path.join(SRC_DATA_DIR, 'all_data_chennai.ts'), outputObjectChennai);
    console.log('Updated all_data_chennai.ts');

    await writeTsModule(path.join(SRC_DATA_DIR, 'courses_chennai.ts'), uniqueCourses(outputObjectChennai));
    console.log('Updated courses_chennai.ts');
};

run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Failed to convert JSON to TypeScript data files';
    console.error(message);
    process.exitCode = 1;
});