"use client";

type Day = {
  date: Moment;
  events: Event[];
};

type Event = {
  id: string;
  startTime: Moment;
  endTime: Moment;
  hexColor: string;
  name: string;
};

import moment, { type Moment } from "moment";
import { useState } from "react";

export default function Calendar() {
  const [data, _] = useState<Day[]>([
    {
      date: moment("2024-09-09"),
      events: [
        {
          id: "1",
          startTime: moment("2024-09-09T08:00"),
          endTime: moment("2024-09-09T12:00"),
          hexColor: "#14b8a6",
          name: "Event 1",
        },
        {
          id: "2",
          startTime: moment("2024-09-09T10:00"),
          endTime: moment("2024-09-09T11:00"),
          hexColor: "#14b8a6",
          name: "Event 2",
        },
        {
          id: "3",
          startTime: moment("2024-09-09T11:00"),
          endTime: moment("2024-09-09T14:00"),
          hexColor: "#14b8a6",
          name: "Event 3",
        },
        {
          id: "4",
          startTime: moment("2024-09-09T10:30"),
          endTime: moment("2024-09-09T11:30"),
          hexColor: "#14b8a6",
          name: "Event 4",
        },
        {
          id: "5",
          startTime: moment("2024-09-09T16:00"),
          endTime: moment("2024-09-09T18:00"),
          hexColor: "#14b8a6",
          name: "Event 5",
        },
      ],
    },
    {
      date: moment("2024-09-10"),
      events: [
        {
          id: "11",
          startTime: moment("2024-09-10T18:30"),
          endTime: moment("2024-09-10T20:00"),
          hexColor: "#d2691e",
          name: "Event 11",
        },
        {
          id: "12",
          startTime: moment("2024-09-10T20:30"),
          endTime: moment("2024-09-10T22:00"),
          hexColor: "#ff1493",
          name: "Event 12",
        },
        {
          id: "13",
          startTime: moment("2024-09-10T22:30"),
          endTime: moment("2024-09-11T00:00"),
          hexColor: "#00ced1",
          name: "Event 13",
        },
        {
          id: "14",
          startTime: moment("2024-09-10T08:00"),
          endTime: moment("2024-09-10T09:30"),
          hexColor: "#ff69b4",
          name: "Event 14",
        },
        {
          id: "15",
          startTime: moment("2024-09-10T09:00"),
          endTime: moment("2024-09-10T10:30"),
          hexColor: "#1e90ff",
          name: "Event 15",
        },
        {
          id: "16",
          startTime: moment("2024-09-10T10:00"),
          endTime: moment("2024-09-10T11:00"),
          hexColor: "#ff6347",
          name: "Event 16",
        },
        {
          id: "17",
          startTime: moment("2024-09-10T11:00"),
          endTime: moment("2024-09-10T12:30"),
          hexColor: "#4682b4",
          name: "Event 17",
        },
        {
          id: "18",
          startTime: moment("2024-09-10T13:30"),
          endTime: moment("2024-09-10T15:00"),
          hexColor: "#32cd32",
          name: "Event 18",
        },
        {
          id: "19",
          startTime: moment("2024-09-10T15:00"),
          endTime: moment("2024-09-10T16:30"),
          hexColor: "#ff4500",
          name: "Event 19",
        },
        {
          id: "20",
          startTime: moment("2024-09-10T16:00"),
          endTime: moment("2024-09-10T17:30"),
          hexColor: "#8a2be2",
          name: "Event 20",
        },
      ],
    },
    {
      date: moment("2024-09-11"),
      events: [
        {
          id: "21",
          startTime: moment("2024-09-11T08:30"),
          endTime: moment("2024-09-11T10:00"),
          hexColor: "#ff7f50",
          name: "Event 21",
        },
        {
          id: "22",
          startTime: moment("2024-09-11T10:00"),
          endTime: moment("2024-09-11T11:30"),
          hexColor: "#6a5acd",
          name: "Event 22",
        },
        {
          id: "23",
          startTime: moment("2024-09-11T11:00"),
          endTime: moment("2024-09-11T12:30"),
          hexColor: "#20b2aa",
          name: "Event 23",
        },
        {
          id: "24",
          startTime: moment("2024-09-11T13:00"),
          endTime: moment("2024-09-11T14:30"),
          hexColor: "#ff6347",
          name: "Event 24",
        },
        {
          id: "25",
          startTime: moment("2024-09-11T14:30"),
          endTime: moment("2024-09-11T15:30"),
          hexColor: "#ff4500",
          name: "Event 25",
        },
      ],
    },
    {
      date: moment("2024-09-12"),
      events: [
        {
          id: "26",
          startTime: moment("2024-09-12T09:00"),
          endTime: moment("2024-09-12T10:00"),
          hexColor: "#ff69b4",
          name: "Event 26",
        },
        {
          id: "27",
          startTime: moment("2024-09-12T10:30"),
          endTime: moment("2024-09-12T11:30"),
          hexColor: "#1e90ff",
          name: "Event 27",
        },
        {
          id: "28",
          startTime: moment("2024-09-12T12:00"),
          endTime: moment("2024-09-12T13:30"),
          hexColor: "#32cd32",
          name: "Event 28",
        },
        {
          id: "29",
          startTime: moment("2024-09-12T14:00"),
          endTime: moment("2024-09-12T15:30"),
          hexColor: "#ff4500",
          name: "Event 29",
        },
        {
          id: "30",
          startTime: moment("2024-09-12T15:00"),
          endTime: moment("2024-09-12T16:30"),
          hexColor: "#8a2be2",
          name: "Event 30",
        },
      ],
    },
    {
      date: moment("2024-09-13"),
      events: [
        {
          id: "31",
          startTime: moment("2024-09-13T08:30"),
          endTime: moment("2024-09-13T09:30"),
          hexColor: "#ff7f50",
          name: "Event 31",
        },
        {
          id: "32",
          startTime: moment("2024-09-13T09:00"),
          endTime: moment("2024-09-13T10:00"),
          hexColor: "#6a5acd",
          name: "Event 32",
        },
        {
          id: "33",
          startTime: moment("2024-09-13T11:00"),
          endTime: moment("2024-09-13T12:00"),
          hexColor: "#20b2aa",
          name: "Event 33",
        },
        {
          id: "34",
          startTime: moment("2024-09-13T12:30"),
          endTime: moment("2024-09-13T13:30"),
          hexColor: "#ff6347",
          name: "Event 34",
        },
        {
          id: "35",
          startTime: moment("2024-09-13T14:00"),
          endTime: moment("2024-09-13T15:30"),
          hexColor: "#ff4500",
          name: "Event 35",
        },
      ],
    },
    {
      date: moment("2024-09-15"),
      events: [
        {
          id: "41",
          startTime: moment("2024-09-15T08:00"),
          endTime: moment("2024-09-15T09:00"),
          hexColor: "#ff7f50",
          name: "Event 41",
        },
        {
          id: "42",
          startTime: moment("2024-09-15T09:30"),
          endTime: moment("2024-09-15T10:30"),
          hexColor: "#6a5acd",
          name: "Event 42",
        },
        {
          id: "43",
          startTime: moment("2024-09-15T11:00"),
          endTime: moment("2024-09-15T12:00"),
          hexColor: "#20b2aa",
          name: "Event 43",
        },
        {
          id: "44",
          startTime: moment("2024-09-15T12:30"),
          endTime: moment("2024-09-15T13:30"),
          hexColor: "#ff6347",
          name: "Event 44",
        },
        {
          id: "45",
          startTime: moment("2024-09-15T14:00"),
          endTime: moment("2024-09-15T15:00"),
          hexColor: "#ff4500",
          name: "Event 45",
        },
      ],
    },
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
                    <DisplayDayEvents key={i} day={day} />
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

  const groups: Event[][][] = [];
  // Each column contains events that do not overlap.
  let columns: Event[][] = [];
  let lastEventEnding: Moment | undefined;

  events
    .sort(
      ({ startTime: st1, endTime: et1 }, { startTime: st2, endTime: et2 }) => {
        if (st1.isBefore(st2)) return -1;
        if (st1.isAfter(st2)) return 1;
        if (et1.isBefore(et2)) return -1;
        if (et1.isAfter(et2)) return 1;
        return 0;
      },
    )
    .forEach((e) => {
      // Check if a new event group needs to be started.
      if (lastEventEnding && e.startTime.isSameOrAfter(lastEventEnding)) {
        // The event is later than any of the events in the
        // current group. There is no overlap. Output the
        // current event group and start a new one.
        groups.push(columns);
        columns = [];
        lastEventEnding = undefined;
      }

      // Try to place the event inside an existing column.
      let placed = false;
      columns.some((col) => {
        const item = col[col.length - 1];
        if (item && !collides(item, e)) {
          col.push(e);
          placed = true;
        }
        return placed;
      });

      // It was not possible to place the event (it overlaps
      // with events in each existing column). Add a new column
      // to the current event group with the event in it.
      if (!placed) columns.push([e]);

      // Remember the last event end time of the current group.
      if (!lastEventEnding || e.endTime.isAfter(lastEventEnding))
        lastEventEnding = e.endTime;
    });
  groups.push(columns);

  return (
    <>
      {groups.map((cols: Event[][]) =>
        cols.map((col: Event[], colIdx) =>
          col.map((event: Event) => {
            return (
              <DisplayEvent
                key={event.id}
                event={event}
                colIdx={colIdx}
                cols={cols}
              />
            );
          }),
        ),
      )}
    </>
  );
}

function collides(a: Event, b: Event): boolean {
  return a.endTime.isAfter(b.startTime) && a.startTime.isBefore(b.endTime);
}

function expand(e: Event, colIdx: number, cols: Event[][]): number {
  let colSpan = 1;
  cols.slice(colIdx + 1).some((col) => {
    if (col.some((evt) => collides(e, evt))) return true;
    colSpan += 1;
    return false;
  });
  return colSpan;
}
function formatTime(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function DisplayEvent({
  event,
  cols,
  colIdx,
}: {
  event: Event;
  cols: Event[][];
  colIdx: number;
}) {
  const startH = event.startTime.hour();
  const startM = event.startTime.minute();
  const endH = event.endTime.hour();
  const endM = event.endTime.minute();

  const startPercentage = ((startH + startM / 60) / 24) * 100;
  const endPercentage = ((endH + endM / 60) / 24) * 100;

  const item = cols[colIdx];
  if (!item) return null;
  const maxOverlappingEvents = item.length;

  const eventWidth = `calc(100% / ${maxOverlappingEvents} - 1rem)`;
  const eventLeft = `calc(${item.indexOf(event)} * (100% / ${maxOverlappingEvents}))`;

  // Calculate zIndex based on the start time to ensure later events are on top
  const zIndex = Math.floor(startPercentage);
  return (
    <>
      <div
        key={event.id}
        className="absolute mb-1 mr-1 h-16 cursor-pointer touch-manipulation overflow-hidden rounded-lg border text-white"
        style={{
          top: `${startPercentage}%`,
          height: `${endPercentage - startPercentage}%`,
          backgroundColor: event.hexColor,
          width: eventWidth,
          left: eventLeft,
          zIndex: zIndex, // Handle overlapping
        }}
      >
        <div className="event-content absolute left-0 grid select-none">
          <span className="font-bold">{event.name}</span>
          <span className="text-xs">
            {formatTime(startH, startM)} - {formatTime(endH, endM)} <br />
          </span>
        </div>
      </div>
    </>
  );
}

function sortByRender(events: Event[]) {
  events.sort(
    ({ startTime: st1, endTime: et1 }, { startTime: st2, endTime: et2 }) => {
      if (st1.isBefore(st2)) return -1;
      if (st1.isAfter(st2)) return 1;
      if (et1.isBefore(et2)) return -1;
      if (et1.isAfter(et2)) return 1;
      return 0;
    },
  );
  const sortedByTime = events;
  const sorted = [];
  while (sortedByTime.length > 0) {
    const event = sortedByTime.shift();
    if (!event) continue;
    sorted.push(event);

    for (let i = 0; i < sortedByTime.length; i++) {
      const test = sortedByTime[i];

      // Still inside this event, look for next.
      if (event?.endTime.isAfter(test?.startTime)) continue;

      // We've found the first event of the next event group.
      // If that event is not right next to our current event, we have to
      // move it here.
      if (i > 0) {
        const event = sortedByTime.splice(i, 1)[0];
        if (event) sorted.push(event);
      }

      // We've already found the next event group, so stop looking.
      break;
    }
  }
  return sorted;
}

function onSameRow(a: Event, b: Event, minimumStartDifference: number) {
  return (
    // Occupies the same start slot.
    Math.abs(b.startTime.diff(a.startTime, "minutes")) <
      minimumStartDifference ||
    // A's start slot overlaps with b's end slot.
    (b.startTime.isAfter(a.startTime) && b.startTime.isBefore(a.endTime))
  );
}

export function getStyledEvents({
  events,
  minimumStartDifference,
}: {
  events: Event[];
  minimumStartDifference: number;
}) {
  // Create proxy events and order them so that we don't have
  // to fiddle with z-indexes.
  const proxies = events.map((event) => structuredClone(event));
  const eventsInRenderOrder = sortByRender(proxies);

  // Group overlapping events, while keeping order.
  // Every event is always one of: container, row or leaf.
  // Containers can contain rows, and rows can contain leaves.
  const containerEvents: Event[] = [];
  for (const event of eventsInRenderOrder) {
    // Check if this event can go into a container event.
    const container = containerEvents.find(
      (c) =>
        c?.endTime.isAfter(event?.startTime) ||
        Math.abs(event?.startTime.diff(c?.startTime, "minutes")) <
          minimumStartDifference,
    );

    // Couldn't find a container — that means this event is a container.
    if (!container) {
      event.rows = [];
      containerEvents.push(event);
      continue;
    }

    // Found a container for the event.
    event.container = container;

    // Check if the event can be placed in an existing row.
    // Start looking from behind.
    let row = null;
    for (let j = container.rows.length - 1; !row && j >= 0; j--) {
      if (onSameRow(container.rows[j], event, minimumStartDifference)) {
        row = container.rows[j];
      }
    }

    if (row) {
      // Found a row, so add it.
      row.leaves.push(event);
      event.row = row;
    } else {
      // Couldn't find a row – that means this event is a row.
      event.leaves = [];
      container.rows.push(event);
    }
  }

  // Return the original events, along with their styles.
  return eventsInRenderOrder.map((event) => ({
    event: event.data,
    style: {
      top: event.top,
      height: event.height,
      width: event.width,
      xOffset: Math.max(0, event.xOffset),
    },
  }));
}

// https://github.com/search?q=repo:jquense/react-big-calendar%20overlap.js&type=code
