import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  BarChart3,
  PieChart as PieChartIcon,
  AlertTriangle,
  Info,
  X,
  GraduationCap,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  Sliders,
  Calendar,
  AlertOctagon,
  RefreshCw,
} from 'lucide-react';
import { classesApi, eligibilityApi } from '../api/endpoints';
import type { ClassCourse, ClassPredictiveAnalytics, PredictiveStudentItem } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  ReferenceLine,
} from 'recharts';
import toast from 'react-hot-toast';

export const EligibilityPage: React.FC = () => {
  const [classes, setClasses] = useState<ClassCourse[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [plannedSessions, setPlannedSessions] = useState(15);
  const [predictions, setPredictions] = useState<ClassPredictiveAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeModalStudent, setActiveModalStudent] = useState<PredictiveStudentItem | null>(null);
  const [simulatedAbsences, setSimulatedAbsences] = useState(0);

  // Fetch all classes
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const classesData = await classesApi.getAll(0, 100);
        setClasses(classesData);
        if (classesData.length > 0) {
          setSelectedClassId(classesData[0].id);
        }
      } catch {
        toast.error('Failed to load courses');
      }
    };
    fetchClasses();
  }, []);

  // Fetch predictive analytics whenever selected class or plannedSessions changes
  const loadPredictions = async () => {
    if (!selectedClassId) return;
    try {
      setIsLoading(true);
      const data = await eligibilityApi.getClassPredictions(selectedClassId, plannedSessions);
      setPredictions(data);
    } catch {
      toast.error('Failed to calculate predictive eligibility analytics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPredictions();
  }, [selectedClassId, plannedSessions]);

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  // Reset simulator when opening a new student
  const openStudentModal = (student: PredictiveStudentItem) => {
    setActiveModalStudent(student);
    setSimulatedAbsences(0);
  };

  // Comparative Chart data: Current % vs Projected %
  const chartData = (predictions?.students || []).map((s) => ({
    name: s.student_name.split(' ')[0],
    reg: s.reg_number,
    current: s.current_attendance_percentage,
    projected: s.projected_final_percentage,
    maxPossible: s.max_attainable_percentage,
    risk: s.risk_level,
  }));

  // Risk Distribution Donut data
  const riskPieData = predictions
    ? [
        { name: 'Safe / On Track', value: predictions.risk_distribution.SAFE, color: '#10b981' },
        { name: 'Moderate Risk', value: predictions.risk_distribution.MODERATE_RISK, color: '#3b82f6' },
        { name: 'High Risk', value: predictions.risk_distribution.HIGH_RISK, color: '#f59e0b' },
        { name: 'Critical (0 Buffer)', value: predictions.risk_distribution.CRITICAL, color: '#f97316' },
        { name: 'Disqualified', value: predictions.risk_distribution.DISQUALIFIED, color: '#ef4444' },
      ].filter((d) => d.value > 0)
    : [];

  // What-If Simulation Math for Modal
  const modalStudent = activeModalStudent;
  const remSessions = modalStudent?.remaining_sessions || 0;
  const simulatedMisses = Math.min(simulatedAbsences, remSessions);
  const simulatedAttendedFuture = Math.max(0, remSessions - simulatedMisses);
  const totalSimulatedAttended = (modalStudent?.attended_sessions || 0) + simulatedAttendedFuture;
  const simulatedFinalPercentage = modalStudent
    ? Math.round((totalSimulatedAttended / modalStudent.planned_semester_sessions) * 1000) / 10
    : 0;
  const simulatedIsEligible = simulatedFinalPercentage >= 80.0;

  const getRiskBadge = (level: string, label: string) => {
    switch (level) {
      case 'SAFE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
            <CheckCircle2 className="w-3 h-3" /> {label}
          </span>
        );
      case 'MODERATE_RISK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-950/80 text-blue-400 border border-blue-800/60">
            <Info className="w-3 h-3" /> {label}
          </span>
        );
      case 'HIGH_RISK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-950/80 text-amber-400 border border-amber-800/60">
            <AlertTriangle className="w-3 h-3" /> {label}
          </span>
        );
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-950/80 text-orange-400 border border-orange-800/60">
            <AlertOctagon className="w-3 h-3" /> {label}
          </span>
        );
      case 'DISQUALIFIED':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-950/80 text-rose-400 border border-rose-800/60">
            <XCircle className="w-3 h-3" /> {label}
          </span>
        );
    }
  };

  const getMomentumIcon = (m: string) => {
    if (m === 'improving') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
          <TrendingUp className="w-3.5 h-3.5" /> Improving
        </span>
      );
    }
    if (m === 'declining') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400">
          <TrendingDown className="w-3.5 h-3.5" /> Slipping
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
        <Minus className="w-3.5 h-3.5" /> Stable
      </span>
    );
  };

  return (
    <div className="space-y-8 relative">
      {/* Top Header & Semester Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-100">Predictive Exam Eligibility Engine</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> AI Predictive Math
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Forward-looking forecast, allowed absence buffer, and risk classification for final 80% examination clearance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Class Select */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-2xl">
            <span className="text-xs text-slate-400 font-medium pl-1">Course:</span>
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setActiveModalStudent(null);
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-semibold"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.course_code} - {c.course_name}
                </option>
              ))}
            </select>
          </div>

          {/* Planned Semester Length Setting */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-2xl">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs text-slate-400 font-medium">Semester Target:</span>
            <div className="flex items-center gap-1 bg-slate-950 rounded-xl px-2 py-1 border border-slate-800">
              <input
                type="number"
                min="1"
                max="40"
                value={plannedSessions}
                onChange={(e) => setPlannedSessions(Math.max(1, Number(e.target.value)))}
                className="w-12 bg-transparent text-xs font-bold text-indigo-400 text-center focus:outline-none font-mono"
              />
              <span className="text-[10px] text-slate-500 font-medium">Weeks</span>
            </div>
            <button
              onClick={loadPredictions}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
              title="Recalculate Predictions"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Predictive Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <p className="text-[11px] text-slate-400 uppercase font-semibold">Total Students</p>
          <p className="text-2xl font-bold text-slate-100">{predictions?.total_students || 0}</p>
          <p className="text-[10px] text-indigo-400 font-mono">
            {predictions ? `${predictions.sessions_held_count} held · ${predictions.remaining_sessions_count} remain` : ''}
          </p>
        </div>

        <div className="bg-slate-900 border border-emerald-900/40 rounded-2xl p-5 space-y-2 bg-emerald-950/10">
          <p className="text-[11px] text-emerald-400 uppercase font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Projected Safe
          </p>
          <p className="text-2xl font-bold text-emerald-400">
            {predictions ? predictions.risk_distribution.SAFE + predictions.risk_distribution.MODERATE_RISK : 0}
          </p>
          <p className="text-[10px] text-emerald-500/80">Buffer &gt; 1 absence left</p>
        </div>

        <div className="bg-slate-900 border border-amber-900/40 rounded-2xl p-5 space-y-2 bg-amber-950/10">
          <p className="text-[11px] text-amber-400 uppercase font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> High Risk Watch
          </p>
          <p className="text-2xl font-bold text-amber-400">{predictions?.risk_distribution.HIGH_RISK || 0}</p>
          <p className="text-[10px] text-amber-500/80">Only 1 absence remaining</p>
        </div>

        <div className="bg-slate-900 border border-orange-900/40 rounded-2xl p-5 space-y-2 bg-orange-950/10">
          <p className="text-[11px] text-orange-400 uppercase font-semibold flex items-center gap-1">
            <AlertOctagon className="w-3.5 h-3.5" /> Critical Margin
          </p>
          <p className="text-2xl font-bold text-orange-400">{predictions?.critical_count || 0}</p>
          <p className="text-[10px] text-orange-500/80">Zero margin: must attend all</p>
        </div>

        <div className="bg-slate-900 border border-rose-900/40 rounded-2xl p-5 space-y-2 bg-rose-950/10 col-span-2 md:col-span-1">
          <p className="text-[11px] text-rose-400 uppercase font-semibold flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" /> Disqualified
          </p>
          <p className="text-2xl font-bold text-rose-400">{predictions?.disqualified_count || 0}</p>
          <p className="text-[10px] text-rose-500/80">Max attainable &lt; 80%</p>
        </div>
      </div>

      {/* Dual Visual Analytics Charts */}
      {predictions && predictions.students.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Comparative Bar Chart: Current vs Projected */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                <span>Attendance Forecast Matrix (Current vs Projected vs Max)</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">Dashed Line = 80% Exam Bar</span>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      fontSize: '11px',
                    }}
                    formatter={(val: any, name: any) => [`${val}%`, name === 'current' ? 'Current %' : name === 'projected' ? 'Projected Final %' : 'Max Attainable %']}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                    formatter={(value) => (value === 'current' ? 'Current Rate' : value === 'projected' ? 'Projected Outcome' : 'Max Possible')}
                  />
                  <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '80% Exam Bar', fill: '#ef4444', fontSize: 10 }} />
                  <Bar dataKey="current" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="projected" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="maxPossible" fill="#334155" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Risk Tier Donut Distribution */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-indigo-400" />
                <span>Cohort Risk Breakdown</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">{predictions.total_students} Total</span>
            </div>

            <div className="h-56 w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '10px',
                      fontSize: '11px',
                    }}
                  />
                  <Pie
                    data={riskPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    stroke="transparent"
                  >
                    {riskPieData.map((entry, idx) => (
                      <Cell key={`donut-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-slate-100">{predictions.average_projected_percentage}%</span>
                <span className="text-[9px] text-slate-400 uppercase tracking-wider">Avg Projected</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-800">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Safe: {predictions.risk_distribution.SAFE}
              </div>
              <div className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                High Risk: {predictions.risk_distribution.HIGH_RISK}
              </div>
              <div className="flex items-center gap-1.5 text-orange-400">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                Critical: {predictions.critical_count}
              </div>
              <div className="flex items-center gap-1.5 text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Disqualified: {predictions.disqualified_count}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Predictive Student Roster Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-slate-200">
              Early Warning & Predictive Eligibility Roster
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5 text-indigo-400" /> Click "Simulate" to run What-If absence scenarios
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3.5">Student</th>
                <th className="px-4 py-3.5 text-center">Current Rate</th>
                <th className="px-4 py-3.5 text-center">Projected Final</th>
                <th className="px-4 py-3.5 text-center">Max Possible</th>
                <th className="px-4 py-3.5 text-center">Allowed Absences</th>
                <th className="px-4 py-3.5 text-center">Trend</th>
                <th className="px-4 py-3.5 text-center">Risk Tier</th>
                <th className="px-5 py-3.5 text-right">What-If Analysis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-500">
                    Running predictive forecast algorithms...
                  </td>
                </tr>
              ) : !predictions || predictions.students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-500">
                    No students found in this course roster.
                  </td>
                </tr>
              ) : (
                predictions.students.map((student) => {
                  return (
                    <tr
                      key={student.student_id}
                      onClick={() => openStudentModal(student)}
                      className="cursor-pointer hover:bg-slate-800/50 transition-colors group"
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors">
                          {student.student_name}
                        </div>
                        <div className="text-[11px] font-mono text-indigo-400 font-medium">
                          {student.reg_number}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-center font-mono">
                        <span className="font-bold text-slate-200">{student.current_attendance_percentage}%</span>
                        <div className="text-[10px] text-slate-500">
                          {student.attended_sessions}/{student.total_held_sessions} held
                        </div>
                      </td>

                      <td className="px-4 py-4 text-center font-mono">
                        <span
                          className={`font-bold ${
                            student.projected_final_percentage >= 80 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {student.projected_final_percentage}%
                        </span>
                        <div className="text-[10px] text-slate-500">
                          Target: {student.planned_semester_sessions} wks
                        </div>
                      </td>

                      <td className="px-4 py-4 text-center font-mono">
                        <span
                          className={`font-semibold ${
                            student.max_attainable_percentage >= 80 ? 'text-slate-300' : 'text-rose-400 font-bold'
                          }`}
                        >
                          {student.max_attainable_percentage}%
                        </span>
                      </td>

                      <td className="px-4 py-4 text-center font-mono">
                        {student.is_mathematically_disqualified ? (
                          <span className="text-rose-400 font-bold">0 left</span>
                        ) : student.allowed_absences_remaining === 0 ? (
                          <span className="text-orange-400 font-bold bg-orange-950/60 px-2 py-0.5 rounded">0 (Zero)</span>
                        ) : (
                          <span className="text-emerald-400 font-bold">
                            {student.allowed_absences_remaining} classes
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4 text-center">{getMomentumIcon(student.momentum)}</td>

                      <td className="px-4 py-4 text-center">{getRiskBadge(student.risk_level, student.risk_label)}</td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openStudentModal(student);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 transition-all shadow-sm"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Simulate</span>
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

      {/* Interactive What-If Absence Simulator Modal */}
      {modalStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-all"
          onClick={() => setActiveModalStudent(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-4xl w-full shadow-2xl space-y-6 relative text-slate-100 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    {modalStudent.student_name}
                    <span className="text-xs font-mono font-normal text-indigo-400">
                      ({modalStudent.reg_number})
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

            {/* AI Predictive Insight Banner */}
            <div
              className={`p-4 rounded-2xl border text-xs flex items-start gap-3.5 ${
                modalStudent.is_mathematically_disqualified
                  ? 'bg-rose-950/20 border-rose-900/40 text-rose-300'
                  : modalStudent.risk_level === 'CRITICAL'
                  ? 'bg-orange-950/20 border-orange-900/40 text-orange-300'
                  : modalStudent.risk_level === 'HIGH_RISK'
                  ? 'bg-amber-950/20 border-amber-900/40 text-amber-300'
                  : 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300'
              }`}
            >
              <Sparkles className="w-5 h-5 shrink-0 mt-0.5 text-indigo-400" />
              <div>
                <p className="font-bold text-sm text-slate-100 mb-0.5">
                  Predictive Analysis: {modalStudent.risk_label}
                </p>
                <p className="text-xs leading-relaxed opacity-90">{modalStudent.prediction_summary}</p>
              </div>
            </div>

            {/* Interactive "What-If" Absence Simulator Slider */}
            <div className="bg-slate-950 border border-indigo-500/30 rounded-2xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  <h4 className="font-bold text-sm text-slate-100">Live "What-If" Absence Scenario Simulator</h4>
                </div>
                <span className="text-[11px] text-indigo-400 font-mono">
                  {remSessions} Sessions Left in Semester
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-300">
                    Hypothetical Additional Absences in Future Sessions:
                  </span>
                  <span className="text-base font-bold font-mono text-indigo-400 bg-indigo-950/60 px-3 py-1 rounded-xl border border-indigo-800/40">
                    +{simulatedAbsences} {simulatedAbsences === 1 ? 'Missed Class' : 'Missed Classes'}
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max={Math.max(1, remSessions)}
                  value={simulatedAbsences}
                  onChange={(e) => setSimulatedAbsences(Number(e.target.value))}
                  disabled={remSessions === 0}
                  className="w-full accent-indigo-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                />

                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>0 (Perfect Future Attendance)</span>
                  <span>{remSessions} (Miss All Remaining)</span>
                </div>
              </div>

              {/* Dynamic Simulated Outcome Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Simulated Final Attendance</p>
                  <p
                    className={`text-xl font-bold font-mono mt-1 ${
                      simulatedIsEligible ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {simulatedFinalPercentage}%
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {totalSimulatedAttended} of {modalStudent.planned_semester_sessions} classes
                  </p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Predicted Exam Clearance</p>
                  <div className="mt-1 flex items-center justify-center">
                    {simulatedIsEligible ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-400 bg-rose-950/60 border border-rose-800/40 px-2.5 py-1 rounded-lg">
                        <XCircle className="w-3.5 h-3.5" /> Disqualified (&lt;80%)
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Under statutory 80% rule</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Absence Buffer Remaining</p>
                  <p
                    className={`text-xl font-bold font-mono mt-1 ${
                      modalStudent.allowed_absences_remaining - simulatedAbsences < 0
                        ? 'text-rose-400'
                        : modalStudent.allowed_absences_remaining - simulatedAbsences === 0
                        ? 'text-orange-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {Math.max(0, modalStudent.allowed_absences_remaining - simulatedAbsences)} classes
                  </p>
                  <p className="text-[10px] text-slate-500">Before reaching disqualification</p>
                </div>
              </div>
            </div>

            {/* Historical Session Timeline */}
            <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-4 py-3 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-300">Historical Session Log</h4>
                <span className="text-[10px] text-slate-500 font-mono">
                  {modalStudent.attended_sessions} Attended / {modalStudent.total_held_sessions} Held
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 sticky top-0 border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2 text-center">Arrival / Verification</th>
                      <th className="px-4 py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {modalStudent.session_details?.length ? (
                      modalStudent.session_details.map((sess, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="px-4 py-2 font-mono text-slate-300">{sess.date}</td>
                          <td className="px-4 py-2 font-mono text-center text-slate-400">{sess.time_in || '-'}</td>
                          <td className="px-4 py-2 text-right">
                            {sess.status === 'Present' ? (
                              <span className="text-emerald-400 font-semibold bg-emerald-950/50 px-2 py-0.5 rounded text-[10px]">
                                Present
                              </span>
                            ) : (
                              <span className="text-rose-400 font-semibold bg-rose-950/50 px-2 py-0.5 rounded text-[10px]">
                                Absent
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-4 py-4 text-center text-slate-500">
                          No session records yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setActiveModalStudent(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
              >
                Close Simulator
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
