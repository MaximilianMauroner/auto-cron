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
import { useState } from "react";

export default function Calendar() {
  const [data, setData] = useState<Day[]>([
    {
      date: moment("2024-09-09"),
      events: [
        {
          startTime: moment("2024-09-09T08:00"),
          endTime: moment("2024-09-09T12:00"),
          hexColor: "#14b8a6",
          name: "Event 1",
        },
        {
          startTime: moment("2024-09-09T10:00"),
          endTime: moment("2024-09-09T11:00"),
          hexColor: "#14b8a6",
          name: "Event 2",
        },
        {
          startTime: moment("2024-09-09T11:00"),
          endTime: moment("2024-09-09T14:00"),
          hexColor: "#14b8a6",
          name: "Event 3",
        },
        {
          startTime: moment("2024-09-09T16:00"),
          endTime: moment("2024-09-09T18:00"),
          hexColor: "#14b8a6",
          name: "Event 4",
        },
        {
          startTime: moment("2024-09-09T10:30"),
          endTime: moment("2024-09-09T11:30"),
          hexColor: "#14b8a6",
          name: "Event 4",
        },
      ],
    },
    { date: moment("2024-09-10"), events: [] },
    { date: moment("2024-09-11"), events: [] },
    { date: moment("2024-09-12"), events: [] },
    { date: moment("2024-09-13"), events: [] },
    { date: moment("2024-09-14"), events: [] },
    { date: moment("2024-09-15"), events: [] },
  ]);

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
  const overlaping = new Map<number, { overlaps: number; events: Event[] }>();

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const eventA = events[i];
      const eventB = events[j];

      if (!eventA || !eventB) {
        continue;
      }

      const startA = eventA.startTime;
      const endA = eventA.endTime;
      const startB = eventB.startTime;
      const endB = eventB.endTime;
      // if a starts before b && b ends before a
      if (startA.isBefore(startB) && endA.isAfter(startB)) {
        const getMinHr = startA.hour() * 60 + startA.minute();

        const getEndHr = endA.hour() * 60 + endA.minute();
      }
    }
  }

  console.log(overlaping);

  function timeFix(hour: number, minute: number) {
    let time = "";
    if (hour < 10) {
      time += "0" + hour;
    } else {
      time += hour;
    }
    time += ":";
    if (minute < 10) {
      time += "0" + minute;
    } else {
      time += minute;
    }
    return time;
  }
  return (
    <>
      {events.map((event, i) => {
        const startH = event.startTime.hour();
        const startM = event.startTime.minute();
        const endH = event.endTime.hour();
        const endM = event.endTime.minute();

        const width = "100%";
        const zIndex = 0;
        const left = "0%";

        // if there is one event -> full with
        // if there is complete overlap -> 50/50
        // if there is partial overlap -> 100 on the longer and 50% on the smaller task, smaller task to the right

        const startPercentage = ((startH + startM / 60) / 24) * 100;
        const endPercentage = ((endH + endM / 60) / 24) * 100;

        return (
          <div
            key={i}
            className="absolute mb-1 mr-1 h-16 cursor-pointer touch-manipulation overflow-hidden rounded-lg border text-white"
            style={{
              top: `${startPercentage}%`,
              height: `${endPercentage - startPercentage}%`,
              backgroundColor: event.hexColor,
              width: width,
              zIndex: zIndex,
              left: left,
            }}
          >
            <div className="absolute left-0 grid">
              <span className="font-bold">{event.name}</span>
              <span className="text-xs">
                {timeFix(startH, startM)} - {timeFix(endH, endM)} <br />
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
}
