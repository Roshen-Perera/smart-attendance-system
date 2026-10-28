export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'lecturer';
  is_active: boolean;
  created_at: string;
}

export interface Student {
  id: string;
  reg_number: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  programme?: string | null;
  created_at: string;
}

export interface StudentCreate {
  reg_number: string;
  name: string;
  email?: string;
  phone?: string;
  programme?: string;
}

export interface StudentUpdate {
  reg_number?: string;
  name?: string;
  email?: string;
  phone?: string;
  programme?: string;
}

export interface Lecturer {
  id: string;
  name: string;
  email: string;
  department?: string | null;
  employee_id?: string | null;
  created_at: string;
}

export interface LecturerCreate {
  name: string;
  email: string;
  department?: string;
  employee_id?: string;
}

export interface LecturerUpdate {
  name?: string;
  email?: string;
  department?: string;
  employee_id?: string;
}

export interface ClassCourse {
  id: string;
  course_code: string;
  course_name: string;
  lecturer_id: string;
  schedule_info?: string | null;
  created_at: string;
  lecturer?: Lecturer;
}

export interface ClassCreate {
  course_code: string;
  course_name: string;
  lecturer_id: string;
  schedule_info?: string;
}

export interface ClassUpdate {
  course_code?: string;
  course_name?: string;
  lecturer_id?: string;
  schedule_info?: string;
}

export interface Enrollment {
  id: string;
  student_id: string;
  class_id: string;
  created_at: string;
  student?: Student;
  classroom?: ClassCourse;
}

export interface EnrollmentCreate {
  student_id: string;
  class_id: string;
}

export interface Session {
  id: string;
  class_id: string;
  session_date: string;
  topic?: string | null;
  is_active: boolean;
  created_at: string;
  classroom?: ClassCourse;
}

export interface SessionCreate {
  class_id: string;
  session_date: string;
  topic?: string;
  is_active?: boolean;
}

export interface SessionUpdate {
  session_date?: string;
  topic?: string;
  is_active?: boolean;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  session_id: string;
  marked_at: string;
  confidence_score?: number | null;
  student?: Student;
}

export interface AttendanceCreate {
  student_id: string;
  session_id: string;
  confidence_score?: number;
}

export interface AttendanceDetailOut extends AttendanceRecord {
  student?: Student;
}

export interface FaceImage {
  id: string;
  student_id: string;
  image_path: string;
  uploaded_at: string;
}

export interface FaceEmbedding {
  id: string;
  student_id: string;
  embedding: number[];
  created_at: string;
}

export interface SessionDetailItem {
  date: string;
  time_in: string | null;
  status: string;
}

export interface EligibilityResult {
  student_id: string;
  class_id: string;
  total_sessions: number;
  attended_sessions: number;
  attendance_percentage: number;
  status: 'Eligible' | 'Not Eligible';
  attended_dates?: string[];
  missed_dates?: string[];
  session_details?: SessionDetailItem[];

  // Predictive fields
  planned_semester_sessions?: number;
  remaining_sessions?: number;
  max_attainable_percentage?: number;
  projected_final_percentage?: number;
  sessions_needed_for_eligibility?: number;
  allowed_absences_remaining?: number;
  risk_level?: 'SAFE' | 'MODERATE_RISK' | 'HIGH_RISK' | 'CRITICAL' | 'DISQUALIFIED';
  risk_label?: string;
  is_mathematically_disqualified?: boolean;
  momentum?: 'improving' | 'declining' | 'stable';
  prediction_summary?: string;
}

export interface PredictiveStudentItem {
  student_id: string;
  student_name: string;
  reg_number: string;
  email?: string | null;
  total_held_sessions: number;
  attended_sessions: number;
  current_attendance_percentage: number;
  current_status: string;

  planned_semester_sessions: number;
  remaining_sessions: number;
  max_attainable_percentage: number;
  projected_final_percentage: number;
  sessions_needed_for_eligibility: number;
  allowed_absences_remaining: number;
  risk_level: 'SAFE' | 'MODERATE_RISK' | 'HIGH_RISK' | 'CRITICAL' | 'DISQUALIFIED';
  risk_label: string;
  is_mathematically_disqualified: boolean;
  momentum: 'improving' | 'declining' | 'stable';
  prediction_summary: string;
  session_details?: SessionDetailItem[];
}

export interface ClassPredictiveAnalytics {
  class_id: string;
  course_code: string;
  course_name: string;
  planned_semester_sessions: number;
  sessions_held_count: number;
  remaining_sessions_count: number;
  total_students: number;
  projected_eligible_count: number;
  at_risk_count: number;
  critical_count: number;
  disqualified_count: number;
  average_current_percentage: number;
  average_projected_percentage: number;
  risk_distribution: {
    SAFE: number;
    MODERATE_RISK: number;
    HIGH_RISK: number;
    CRITICAL: number;
    DISQUALIFIED: number;
  };
  students: PredictiveStudentItem[];
}

export interface RecognitionResult {
  message: string;
  student_id?: string;
  student_name?: string;
  student_reg_number?: string;
  attendance_id?: string;
  confidence_score?: number;
}

export interface MultiFaceInfo {
  bbox: [number, number, number, number];
  det_score?: number;
  status: 'newly_marked' | 'already_marked' | 'unrecognized';
  student_id?: string;
  student_name?: string;
  student_reg_number?: string;
  confidence_score?: number;
  attendance_id?: string;
}

export interface MultiFaceRecognitionResult {
  total_faces: number;
  recognized_count: number;
  newly_marked_count: number;
  faces: MultiFaceInfo[];
  message?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface AnalyticsTrend {
  session_id: string;
  session_date: string;
  topic: string;
  attended: number;
  absent: number;
}

export interface ClassAnalytics {
  class_id: string;
  course_code: string;
  course_name: string;
  total_sessions: number;
  total_students: number;
  overall_attendance_percentage: number;
  eligibility: {
    eligible: number;
    not_eligible: number;
  };
  trends: AnalyticsTrend[];
}
