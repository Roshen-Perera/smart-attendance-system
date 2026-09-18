import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  BarChart3,
  PieChart as PieChartIcon,
  ShieldCheck,
  AlertTriangle,
  Info,
  X,
  GraduationCap
} from 'lucide-react';
import { classesApi, eligibilityApi } from '../api/endpoints';
import type { ClassCourse, Student, EligibilityResult } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import toast from 'react-hot-toast';

export const EligibilityPage: React.FC = () => {
  const [classes, setClasses] = useState<ClassCourse[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [eligibilityData, setEligibilityData] = useState<Record<string, EligibilityResult>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [activeModalStudent, setActiveModalStudent] = useState<Student | null>(null);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const classesData = await classesApi.getAll(0, 100);
        setClasses(classesData);
        if (classesData.length > 0) {
          setSelectedClassId(classesData[0].id);
        }
      } catch (err) {
        toast.error('Failed to load course classes');
      }
    };
    fetchClasses();
  }, []);

  useEffect(() => {
    const loadClassEligibility = async () => {
      if (!selectedClassId) return;
      try {
        setIsLoading(true);
        const enrolledStudents = await classesApi.getStudents(selectedClassId);
        setStudents(enrolledStudents);

        const results: Record<string, EligibilityResult> = {};
        await Promise.all(
          enrolledStudents.map(async (s) => {
            try {
              const res = await eligibilityApi.get(s.id, selectedClassId);
              results[s.id] = res;
            } catch (e) {
              console.error(e);
            }
          })
        );
        setEligibilityData(results);
      } catch (err) {
        toast.error('Failed to calculate eligibility results');
      } finally {
        setIsLoading(false);
      }
    };

    loadClassEligibility();
  }, [selectedClassId]);

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  const chartData = students.map((s) => {
    const res = eligibilityData[s.id];
    return {
      name: s.name.split(' ')[0],
      percentage: res ? res.attendance_percentage : 0,
      isEligible: res?.status === 'Eligible',
    };
  });

  const eligibleCount = Object.values(eligibilityData).filter((r) => r.status === 'Eligible').length;
  const notEligibleCount = Object.values(eligibilityData).filter((r) => r.status === 'Not Eligible').length;

  // Selected student breakdown calculations for Modal
  const modalRes = activeModalStudent ? eligibilityData[activeModalStudent.id] : null;
  const modalAttended = modalRes?.attended_sessions || 0;
  const modalTotal = modalRes?.total_sessions || 0;
  const modalMissed = Math.max(0, modalTotal - modalAttended);
  const modalPercentage = modalRes?.attendance_percentage || 0;
  const modalIsEligible = modalRes?.status === 'Eligible';
  const modalDeltaThreshold = (modalPercentage - 80).toFixed(1);

  const modalPieData = [
    { name: 'Attended', value: modalAttended, color: '#10b981' },
    { name: 'Missed', value: modalMissed, color: '#f43f5e' },
  ];

  return (
    <div className="space-y-8 relative">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">80% Exam Eligibility Matrix</h1>
          <p className="text-xs text-slate-400">Automatic calculation of student attendance threshold for final examinations</p>
        </div>

        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-2.5 rounded-2xl">
          <span className="text-xs text-slate-400 font-medium">Select Class:</span>
          <select
            value={selectedClassId}
            onChange={(e) => {
              setSelectedClassId(e.target.value);
              setActiveModalStudent(null);
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-semibold"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.course_code} - {c.course_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-2">
          <p className="text-xs text-slate-400 uppercase font-semibold">Total Students</p>
          <p className="text-3xl font-bold text-slate-100">{students.length}</p>
          <p className="text-[11px] text-indigo-400 font-mono">{selectedClass?.course_code}</p>
        </div>
        <div className="bg-slate-900 border border-emerald-900/40 rounded-2xl p-6 space-y-2 bg-emerald-950/10">
          <p className="text-xs text-emerald-400 uppercase font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Eligible (≥ 80%)
          </p>
          <p className="text-3xl font-bold text-emerald-400">{eligibleCount}</p>
          <p className="text-[11px] text-emerald-500/80">Approved for final examinations</p>
        </div>
        <div className="bg-slate-900 border border-rose-900/40 rounded-2xl p-6 space-y-2 bg-rose-950/10">
          <p className="text-xs text-rose-400 uppercase font-semibold flex items-center gap-1.5">
            <XCircle className="w-4 h-4" /> Not Eligible (&lt; 80%)
          </p>
          <p className="text-3xl font-bold text-rose-400">{notEligibleCount}</p>
          <p className="text-[11px] text-rose-500/80">Disqualified due to low attendance</p>
        </div>
      </div>

      {/* Recharts Bar Chart */}
      {chartData.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <span>Attendance Percentage Distribution</span>
          </h3>
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                />
                <Bar dataKey="percentage" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.isEligible ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Detailed Eligibility Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-slate-200">Student Eligibility & Attendance Breakdown</h2>
          </div>
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-slate-500" /> Click any student row or "Breakdown" to view interactive dialog
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-3.5">Student Name</th>
                <th className="px-6 py-3.5">Reg Number</th>
                <th className="px-6 py-3.5 text-center">Sessions Attended</th>
                <th className="px-6 py-3.5 text-center">Attendance %</th>
                <th className="px-6 py-3.5 text-center">Exam Status</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">
                    Calculating eligibility threshold matrix...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">
                    No students in class roster.
                  </td>
                </tr>
              ) : (
                students.map((student) => {
                  const res = eligibilityData[student.id];
                  const isEligible = res?.status === 'Eligible';

                  return (
                    <tr
                      key={student.id}
                      onClick={() => setActiveModalStudent(student)}
                      className="cursor-pointer hover:bg-slate-800/50 transition-colors group"
                    >
                      <td className="px-6 py-4 font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors">
                        {student.name}
                      </td>
                      <td className="px-6 py-4 font-mono text-indigo-400 font-semibold">{student.reg_number}</td>
                      <td className="px-6 py-4 text-center text-slate-300">
                        {res ? `${res.attended_sessions} / ${res.total_sessions}` : '-'}
                      </td>
                      <td className="px-6 py-4 text-center font-mono font-bold">
                        {res ? `${res.attendance_percentage}%` : '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {res && (
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isEligible
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                                : 'bg-rose-950 text-rose-400 border border-rose-800/50'
                            }`}
                          >
                            {isEligible ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {res.status}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveModalStudent(student);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 transition-all shadow-sm"
                        >
                          <PieChartIcon className="w-3.5 h-3.5" />
                          <span>Breakdown</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Modal / Dialog for Student Analytics */}
      {activeModalStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-all"
          onClick={() => setActiveModalStudent(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-xl w-full shadow-2xl space-y-6 relative text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    {activeModalStudent.name}
                    <span className="text-xs font-mono font-normal text-indigo-400">
                      ({activeModalStudent.reg_number})
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedClass?.course_code} - {selectedClass?.course_name}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveModalStudent(null)}
                className="p-2 rounded-xl bg-slate-800/60 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content: Pie Chart & Details */}
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Pie Chart */}
              <div className="flex flex-col items-center justify-center min-w-[190px]">
                <div className="w-40 h-40 relative">
                  {modalTotal > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderColor: '#334155',
                            borderRadius: '10px',
                            fontSize: '11px',
                          }}
                          formatter={(val: any, name: any) => [`${val} sessions`, name]}
                        />
                        <Pie
                          data={modalPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={60}
                          paddingAngle={3}
                          stroke="transparent"
                        >
                          {modalPieData.map((entry, idx) => (
                            <Cell key={`modal-cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-500 text-center">
                      No session data
                    </div>
                  )}
                  {modalTotal > 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-lg font-bold text-slate-100">{modalPercentage}%</span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider">Attendance</span>
                    </div>
                  )}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    Attended: {modalAttended}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-rose-400 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    Missed: {modalMissed}
                  </div>
                </div>
              </div>

              {/* Status and Metric Cards */}
              <div className="flex-1 space-y-3 w-full">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Examination Status</span>
                  {modalIsEligible ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-700/50">
                      <ShieldCheck className="w-4 h-4" /> Exam Approved
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-700/50">
                      <AlertTriangle className="w-4 h-4" /> Disqualified (&lt;80%)
                    </span>
                  )}
                </div>

                {/* Metric Grid */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-xl">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Total Conducted</p>
                    <p className="text-sm font-bold text-slate-100">{modalTotal} Sessions</p>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-xl">
                    <p className="text-[10px] text-emerald-400 uppercase font-semibold">Attended</p>
                    <p className="text-sm font-bold text-emerald-400">{modalAttended} Sessions</p>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-xl">
                    <p className="text-[10px] text-rose-400 uppercase font-semibold">Missed</p>
                    <p className="text-sm font-bold text-rose-400">{modalMissed} Sessions</p>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-xl">
                    <p className="text-[10px] text-indigo-400 uppercase font-semibold">vs 80% Threshold</p>
                    <p
                      className={`text-sm font-bold font-mono ${
                        Number(modalDeltaThreshold) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {Number(modalDeltaThreshold) >= 0 ? `+${modalDeltaThreshold}%` : `${modalDeltaThreshold}%`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {/* Attendance Dates Lists */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950/40 rounded-xl border border-emerald-900/30 p-3.5">
                <h4 className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Sessions Attended
                </h4>
                <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto pr-1">
                  {modalRes?.attended_dates?.length ? (
                    modalRes.attended_dates.map((date) => (
                      <span key={date} className="px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 text-[10px] border border-emerald-800/50">
                        {date}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-500">No sessions attended</span>
                  )}
                </div>
              </div>
              <div className="bg-slate-950/40 rounded-xl border border-rose-900/30 p-3.5">
                <h4 className="text-xs font-semibold text-rose-400 mb-2 flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" /> Sessions Missed
                </h4>
                <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto pr-1">
                  {modalRes?.missed_dates?.length ? (
                    modalRes.missed_dates.map((date) => (
                      <span key={date} className="px-2 py-0.5 rounded-md bg-rose-950 text-rose-300 text-[10px] border border-rose-800/50">
                        {date}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-500">No sessions missed</span>
                  )}
                </div>
              </div>
            </div>

            {/* Advisory Recommendation Box */}
            <div
              className={`p-3.5 rounded-2xl border text-xs flex items-start gap-3 ${
                modalIsEligible
                  ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300'
                  : 'bg-rose-950/20 border-rose-900/40 text-rose-300'
              }`}
            >
              {modalIsEligible ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-emerald-200">Clearance Confirmed:</span>{' '}
                    This student has satisfied the statutory 80% attendance rule and is authorized to sit for all final assessments and exams.
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-rose-200">Attendance Deficit Alert:</span>{' '}
                    This student has fallen below the mandatory 80% attendance threshold. An official warning notice or makeup session evaluation is recommended before exam slip issuance.
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setActiveModalStudent(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


