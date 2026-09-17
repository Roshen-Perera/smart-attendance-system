import api from './axios';
import type {
  User,
  AuthResponse,
  Student,
  StudentCreate,
  StudentUpdate,
  Lecturer,
  LecturerCreate,
  LecturerUpdate,
  ClassCourse,
  ClassCreate,
  ClassUpdate,
  Enrollment,
  EnrollmentCreate,
  Session,
  SessionCreate,
  SessionUpdate,
  AttendanceRecord,
  AttendanceCreate,
  FaceImage,
  FaceEmbedding,
  EligibilityResult,
  RecognitionResult,
} from '../types';

// Auth
export const authApi = {
  login: async (formData: FormData): Promise<AuthResponse> => {
    const res = await api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return res.data;
  },
  register: async (data: { email: string; password: string; full_name: string; role?: string }): Promise<User> => {
    const res = await api.post('/auth/register', data);
    return res.data;
  },
  getMe: async (): Promise<User> => {
    const res = await api.get('/auth/me');
    return res.data;
  },
};

// Students
export const studentsApi = {
  getAll: async (skip = 0, limit = 100): Promise<Student[]> => {
    const res = await api.get(`/students?skip=${skip}&limit=${limit}`);
    return res.data;
  },
  getById: async (id: string): Promise<Student> => {
    const res = await api.get(`/students/${id}`);
    return res.data;
  },
  getClasses: async (id: string): Promise<ClassCourse[]> => {
    const res = await api.get(`/students/${id}/classes`);
    return res.data;
  },
  create: async (data: StudentCreate): Promise<Student> => {
    const res = await api.post('/students', data);
    return res.data;
  },
  update: async (id: string, data: StudentUpdate): Promise<Student> => {
    const res = await api.put(`/students/${id}`, data);
    return res.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/students/${id}`);
  },
};

// Lecturers
export const lecturersApi = {
  getAll: async (skip = 0, limit = 100): Promise<Lecturer[]> => {
    const res = await api.get(`/lecturers?skip=${skip}&limit=${limit}`);
    return res.data;
  },
  getById: async (id: string): Promise<Lecturer> => {
    const res = await api.get(`/lecturers/${id}`);
    return res.data;
  },
  create: async (data: LecturerCreate): Promise<Lecturer> => {
    const res = await api.post('/lecturers', data);
    return res.data;
  },
  update: async (id: string, data: LecturerUpdate): Promise<Lecturer> => {
    const res = await api.put(`/lecturers/${id}`, data);
    return res.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/lecturers/${id}`);
  },
};

// Classes
export const classesApi = {
  getAll: async (skip = 0, limit = 100): Promise<ClassCourse[]> => {
    const res = await api.get(`/classes?skip=${skip}&limit=${limit}`);
    return res.data;
  },
  getById: async (id: string): Promise<ClassCourse> => {
    const res = await api.get(`/classes/${id}`);
    return res.data;
  },
  getStudents: async (id: string): Promise<Student[]> => {
    const res = await api.get(`/classes/${id}/students`);
    return res.data;
  },
  getSessions: async (id: string): Promise<Session[]> => {
    const res = await api.get(`/classes/${id}/sessions`);
    return res.data;
  },
  create: async (data: ClassCreate): Promise<ClassCourse> => {
    const res = await api.post('/classes', data);
    return res.data;
  },
  update: async (id: string, data: ClassUpdate): Promise<ClassCourse> => {
    const res = await api.put(`/classes/${id}`, data);
    return res.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/classes/${id}`);
  },
};

// Enrollments
export const enrollmentsApi = {
  getAll: async (skip = 0, limit = 100): Promise<Enrollment[]> => {
    const res = await api.get(`/enrollments?skip=${skip}&limit=${limit}`);
    return res.data;
  },
  getById: async (id: string): Promise<Enrollment> => {
    const res = await api.get(`/enrollments/${id}`);
    return res.data;
  },
  create: async (data: EnrollmentCreate): Promise<Enrollment> => {
    const res = await api.post('/enrollments', data);
    return res.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/enrollments/${id}`);
  },
};

// Sessions
export const sessionsApi = {
  getAll: async (class_id?: string, skip = 0, limit = 100): Promise<Session[]> => {
    const url = class_id
      ? `/sessions?class_id=${class_id}&skip=${skip}&limit=${limit}`
      : `/sessions?skip=${skip}&limit=${limit}`;
    const res = await api.get(url);
    return res.data;
  },
  getById: async (id: string): Promise<Session> => {
    const res = await api.get(`/sessions/${id}`);
    return res.data;
  },
  create: async (data: SessionCreate): Promise<Session> => {
    const res = await api.post('/sessions', data);
    return res.data;
  },
  update: async (id: string, data: SessionUpdate): Promise<Session> => {
    const res = await api.put(`/sessions/${id}`, data);
    return res.data;
  },
  close: async (id: string): Promise<Session> => {
    const res = await api.patch(`/sessions/${id}/close`);
    return res.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/sessions/${id}`);
  },
};

// Attendance
export const attendanceApi = {
  getAll: async (skip = 0, limit = 100): Promise<AttendanceRecord[]> => {
    const res = await api.get(`/attendance?skip=${skip}&limit=${limit}`);
    return res.data;
  },
  getBySession: async (sessionId: string): Promise<AttendanceRecord[]> => {
    const res = await api.get(`/attendance/session/${sessionId}`);
    return res.data;
  },
  getByStudent: async (studentId: string): Promise<AttendanceRecord[]> => {
    const res = await api.get(`/attendance/student/${studentId}`);
    return res.data;
  },
  mark: async (data: AttendanceCreate): Promise<AttendanceRecord> => {
    const res = await api.post('/attendance', data);
    return res.data;
  },
  correct: async (id: string, newStudentId: string): Promise<AttendanceRecord> => {
    const res = await api.patch(`/attendance/${id}/correct?new_student_id=${newStudentId}`);
    return res.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/attendance/${id}`);
  },
};

// Faces & Embeddings
export const facesApi = {
  upload: async (regNumber: string, file: File | Blob) => {
    const formData = new FormData();
    formData.append('file', file, file instanceof File ? file.name : 'camera_capture.jpg');
    const res = await api.post(`/faces/upload/${encodeURIComponent(regNumber)}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  getImages: async (regNumber: string): Promise<FaceImage[]> => {
    const res = await api.get(`/faces/${encodeURIComponent(regNumber)}`);
    return res.data;
  },
  generateEmbedding: async (regNumber: string): Promise<FaceEmbedding> => {
    const res = await api.post(`/embeddings/generate/${encodeURIComponent(regNumber)}`);
    return res.data;
  },
  getEmbeddings: async (regNumber: string): Promise<FaceEmbedding[]> => {
    const res = await api.get(`/embeddings/${encodeURIComponent(regNumber)}`);
    return res.data;
  },
  deleteEmbedding: async (id: string): Promise<void> => {
    await api.delete(`/embeddings/${id}`);
  },
};

// Recognition
export const recognitionApi = {
  recognize: async (sessionId: string, file: Blob | File): Promise<RecognitionResult> => {
    const formData = new FormData();
    formData.append('file', file, 'capture.jpg');
    const res = await api.post(`/recognition/recognize?session_id=${sessionId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};

// Eligibility
export const eligibilityApi = {
  get: async (studentId: string, classId: string): Promise<EligibilityResult> => {
    const res = await api.get(`/eligibility/${studentId}/${classId}`);
    return res.data;
  },
};

// Reports
export const reportsApi = {
  downloadClassReport: async (classId: string, courseCode: string) => {
    const res = await api.get(`/reports/attendance/class/${classId}`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `attendance_report_${courseCode}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
  downloadSessionReport: async (sessionId: string) => {
    const res = await api.get(`/reports/attendance/session/${sessionId}`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `session_attendance_${sessionId}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
};
