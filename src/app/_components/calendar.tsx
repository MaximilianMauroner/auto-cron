"use client";

type Day = {
  date: Moment;
  events: Event[];
};

type Event = {
  startTime: Moment;
  endTime: Moment;
  hexColor: string;
  name: string;
};

import moment, { type Moment } from "moment";
import { useEffect, useState } from "react";

export default function Calendar() {
  const [data, setData] = useState<Day[]>([]);
  const date = moment(new Date());

  const val = (date.weekday() + 6) % 7;

  useEffect(() => {
    prepareData();
  }, []);

  function prepareData() {
    const tmp: Day[] = [];
    for (let i = 0; i < 7; i++) {
      if (i < val) {
        tmp.push({ date: date.clone().subtract(val - i, "days"), events: [] });
      } else {
        tmp.push({ date: date.clone().add(i - val, "days"), events: [] });
      }
      let counter = i;
      for (let j = 0; counter >= 0; ) {
        if (Math.random() < 1 / 24) {
          const row = tmp[i];
          if (row) {
            const startTime = row.date.clone().hour(j).second(0).minute(0);
            const endTime = startTime
              ?.clone()
              .add(j + Math.random() * 5 + 1, "hours");
            row.events.push({
              name: "Event " + j,
              startTime: startTime,
              endTime: endTime,
              hexColor: "#" + Math.floor(Math.random() * 16777215).toString(16),
            });
            counter--;
          }
        }
        j = (j + 1) % 24;
      }
    }
    setData(tmp);
  }
  return (
    <>
      <div className="flex w-full flex-row">
        <div className="bg-primary-foreground text-primary">
          {new Array(24).fill(0).map((_, i) => {
            return (
              <div key={i} className="relative h-16 w-14">
                <span className="absolute -top-[8px] right-1 font-mono text-xs font-thin">
                  {i !== 0 ? i + ":00" : ""}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex flex-auto items-start">
          <div className="relative inline-flex w-full min-w-full flex-none overflow-hidden align-top">
            <div className="">
              {new Array(24).fill(0).map((_, i) => {
                return <div key={i} className="calendar-grid-row h-16"></div>;
              })}
            </div>
            <div className="w-2 flex-none border-r"></div>
            <div className="flex flex-1">
              {data.map((day, i) => {
                return (
                  <div
                    key={i}
                    className="relative block h-full w-full border-l pr-4"
                  >
                    <DisplayDayEvents day={day} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function DisplayDayEvents({ day }: { day: Day }) {
  const events = day.events;
  const overlapMap = new Map<number, number>();

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const eventA = events[i];
      const eventB = events[j];

      if (!eventA || !eventB) {
        continue;
      }

      const startA = eventA.startTime.hour();
      const endA = eventA.endTime.hour();
      const startB = eventB.startTime.hour();
      const endB = eventB.endTime.hour();

      if (startA < endB && startB < endA) {
        // Calculate the overlapping range
        const overlapStart = Math.max(startA, startB);
        const overlapEnd = Math.min(endA, endB);

        for (let hour = overlapStart; hour < overlapEnd; hour++) {
          overlapMap.set(hour, (overlapMap.get(hour) ?? 0) + 1);
        }
      }
    }
  }
  console.log(overlapMap, day.date.format("YYYY-MM-DD"));
  return (
    <>
      {events.map((event, i) => {
        return (
          <div
            key={i}
            className="absolute h-16 w-full text-white"
            style={{
              top: `${(+event.startTime.hour() / 24) * 100}%`,
              height: `${((event.endTime.hour() - event.startTime.hour()) / 24) * 100}%`,
              backgroundColor: event.hexColor,
            }}
          >
            <span className="absolute left-0">
              <b>{event.name}</b> <br />
              {event.startTime.hour()}:00 - {event.endTime.hour()}:00
            </span>
          </div>
        );
      })}
    </>
  );
}
