export type slot = {
    colStart: number;
    colEnd: number;
    rowStart: number;
    rowEnd: number;
    slotName: string;
};

export type timetableDisplayData = {
    courseCode: string;
    courseName: string;
    slotName: string;
    facultyName: string;
    _id?: string;
    venue?: string;
};

export type fullCourseData = {
    id: string;
    courseType: 'th' | 'lab' | 'both';
    courseCode: string;
    courseName: string;
    courseCodeLab?: string;
    courseNameLab?: string;
    courseSlots: {
        slotName: string;
        slotFaculties: {
            facultyName: string;
            facultyLabSlot?: string;
            venue?: string;
            venueLab?: string;
        }[];
    }[];
};
