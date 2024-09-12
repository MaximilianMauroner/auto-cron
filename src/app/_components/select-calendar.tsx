"use client";
import { api } from "~/trpc/react";

export function ListCalendars() {
  const { data } = api.calendar.getSecretMessage.useQuery();
  return (
    <div className="w-full max-w-xs">
      <form
        onSubmit={(e) => {
          e.preventDefault();
        }}
        className="flex flex-col gap-2"
      >
        <select id="calendar">
          {data?.items.map((item, index) => (
            <option key={item.id} value={item.id} selected={index == 0}>
              {item.summary}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-full bg-white/10 px-10 py-3 font-semibold transition hover:bg-white/20"
        >
          Select
        </button>
      </form>
    </div>
  );
}
