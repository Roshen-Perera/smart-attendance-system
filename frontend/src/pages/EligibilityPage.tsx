import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, BarChart3 } from 'lucide-react';
import { classesApi, eligibilityApi } from '../api/endpoints';
import type { ClassCourse, Student, EligibilityResult } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import toast from 'react-hot-toast';

export const EligibilityPage: React.FC = () => {
  const [classes, setClasses] = useState<ClassCourse[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [eligibilityData, setEligibilityData] = useState<Record<string, EligibilityResult>>({});
  const [isLoading, setIsLoading] = useState(false);

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">80% Exam Eligibility Matrix</h1>
          <p className="text-xs text-slate-400">Automatic calculation of student attendance threshold for final examinations</p>
        </div>

        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-2.5 rounded-2xl">
          <span className="text-xs text-slate-400 font-medium">Select Class:</span>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-3.5">Student Name</th>
                <th className="px-6 py-3.5">Reg Number</th>
                <th className="px-6 py-3.5 text-center">Sessions Attended</th>
                <th className="px-6 py-3.5 text-center">Attendance %</th>
                <th className="px-6 py-3.5 text-right">Exam Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500">
                    Calculating eligibility threshold matrix...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500">
                    No students in class roster.
                  </td>
                </tr>
              ) : (
                students.map((student) => {
                  const res = eligibilityData[student.id];
                  const isEligible = res?.status === 'Eligible';

                  return (
                    <tr key={student.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-200">{student.name}</td>
                      <td className="px-6 py-4 font-mono text-indigo-400 font-semibold">{student.reg_number}</td>
                      <td className="px-6 py-4 text-center text-slate-300">
                        {res ? `${res.attended_sessions} / ${res.total_sessions}` : '-'}
                      </td>
                      <td className="px-6 py-4 text-center font-mono font-bold">
                        {res ? `${res.attendance_percentage}%` : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
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
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
