import type { Metadata } from "next";
import CalendarView from "@/app/_components/calendar";
import Sidebar from "@/app/_components/sidebar";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function Dashboard() {
  return (
    <div className="flex">
      <Sidebar />
      <div className="w-full">
        <h1 className="w-full border text-4xl">Dashboard</h1>
        <div className="flex">
          <div className="w-full border">
            <CalendarView />
          </div>
          <div className="h-full w-64 border">Here right content</div>
        </div>
      </div>
    </div>
  );
}
