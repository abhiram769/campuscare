import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";

const GREEN = ["#176b45", "#4d9b72", "#8bc5a5", "#c5e5d2", "#105336", "#718078"];
const STATUS_LABELS = {
  SUBMITTED: "Submitted", UNDER_REVIEW: "Under review", ASSIGNED: "Assigned",
  ACCEPTED: "Accepted", IN_PROGRESS: "In progress", COMPLETED: "Completed", DUPLICATE: "Duplicate"
};

function ChartPanel({ title, subtitle, children }) {
  return <article className="analytics-chart-card"><div className="analytics-chart-heading"><h3>{title}</h3><p>{subtitle}</p></div><div className="analytics-chart-body">{children}</div></article>;
}

export default function AnalyticsCharts({ mode = "requester", complaints = [], tasks = [], attendance = null }) {
  const data = useMemo(() => {
    if (mode === "cleaner") {
      const statusCounts = ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"].map((status) => ({
        name: STATUS_LABELS[status], count: tasks.filter((task) => task.status === status).length
      }));
      const categories = [...new Set(tasks.map((task) => task.category).filter(Boolean))].map((category) => ({
        name: category.replaceAll("_", " "), count: tasks.filter((task) => task.category === category).length
      }));
      const attendanceData = attendance?.status
        ? [{ name: attendance.status === "LATE" ? "Late" : "Present", value: 1 }, { name: "Not recorded", value: 0 }]
        : [{ name: "Not checked in", value: 1 }];
      return { statusCounts, categories, attendanceData };
    }
    const statuses = Object.keys(STATUS_LABELS).map((status) => ({
      name: STATUS_LABELS[status], value: complaints.filter((item) => item.status === status).length
    })).filter((item) => item.value > 0);
    const categories = [...new Set(complaints.map((item) => item.category).filter(Boolean))].map((category) => ({
      name: category.replaceAll("_", " "), count: complaints.filter((item) => item.category === category).length
    }));
    const months = new Map();
    complaints.forEach((item) => {
      const date = new Date(item.createdAt);
      if (Number.isNaN(date.getTime())) return;
      const key = date.toLocaleString("en-IN", { month: "short", year: "2-digit" });
      months.set(key, (months.get(key) || 0) + 1);
    });
    const monthly = [...months.entries()].map(([month, count]) => ({ month, count }));
    return { statuses, categories, monthly };
  }, [mode, complaints, tasks, attendance]);

  const noData = mode === "cleaner" ? tasks.length === 0 : complaints.length === 0;
  return (
    <section className="analytics-section">
      <div className="analytics-section-heading"><div><span className="dashboard-eyebrow">YOUR INSIGHTS</span><h2>Dashboard analytics</h2><p>{mode === "cleaner" ? "A snapshot of your active workload and today's attendance." : "Explore your complaint activity, status and issue categories."}</p></div></div>
      {noData ? <div className="analytics-empty">Charts will appear here when {mode === "cleaner" ? "tasks are assigned to you" : "you submit your first complaint"}.</div> : (
        <div className="analytics-grid">
          {mode === "cleaner" ? <>
            <ChartPanel title="Active tasks by status" subtitle="Your current assigned workload">
              <ResponsiveContainer width="100%" height="100%"><BarChart data={data.statusCounts}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#176b45" radius={[6,6,0,0]} /></BarChart></ResponsiveContainer>
            </ChartPanel>
            <ChartPanel title="Tasks by category" subtitle="Categories in your active assignments">
              {data.categories.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.categories} dataKey="count" nameKey="name" outerRadius={82} label={({ name, value }) => value ? name : ""}>{data.categories.map((item, index) => <Cell key={item.name} fill={GREEN[index % GREEN.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer> : <div className="analytics-empty">No task categories yet.</div>}
            </ChartPanel>
            <ChartPanel title="Today's attendance" subtitle="Attendance recorded for the current duty day">
              <div className="attendance-chart-summary"><strong>{attendance?.status === "PRESENT" ? "Present" : attendance?.status === "LATE" ? "Late" : "Not checked in"}</strong><span>{attendance?.checkIn ? new Date(attendance.checkIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "No check-in time recorded"}</span></div>
            </ChartPanel>
          </> : <>
            <ChartPanel title="Complaints by status" subtitle="Your reports grouped by current status">
              {data.statuses.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.statuses} dataKey="value" nameKey="name" outerRadius={88} label={({ name, value }) => value ? name : ""}>{data.statuses.map((item, index) => <Cell key={item.name} fill={GREEN[index % GREEN.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer> : <div className="analytics-empty">No status data yet.</div>}
            </ChartPanel>
            <ChartPanel title="Reports by category" subtitle="Which campus issues you report most">
              <ResponsiveContainer width="100%" height="100%"><BarChart data={data.categories}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={55} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#176b45" radius={[6,6,0,0]} /></BarChart></ResponsiveContainer>
            </ChartPanel>
            <ChartPanel title="Monthly complaint activity" subtitle="Reports submitted, based on your available history">
              <ResponsiveContainer width="100%" height="100%"><LineChart data={data.monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="count" name="Reports" stroke="#176b45" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer>
            </ChartPanel>
          </>}
        </div>
      )}
    </section>
  );
}
