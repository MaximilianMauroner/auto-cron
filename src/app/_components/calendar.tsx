"use client";

import {
  Calendar,
  type EventProps,
  momentLocalizer,
  type Event,
  EventWrapperProps,
} from "react-big-calendar";
import withDragAndDrop, {
  type withDragAndDropProps,
} from "react-big-calendar/lib/addons/dragAndDrop";

type EventMeeting = {
  id: string;
  start: Date;
  end: Date;
  hexColor: string;
  title: string;
};

import "moment/locale/en-gb";
import moment from "moment";
import { useState } from "react";

import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "react-big-calendar/lib/css/react-big-calendar.css";

moment.locale("en-GB");

const data = [
  {
    date: moment("2024-09-09"),
    events: [
      {
        id: "1",
        start: moment("2024-09-09T08:00").toDate(),
        end: moment("2024-09-09T12:00").toDate(),
        hexColor: "#14b8a6",
        title: "Event 1",
      },
      {
        id: "2",
        start: moment("2024-09-09T10:00").toDate(),
        end: moment("2024-09-09T11:00").toDate(),
        hexColor: "#14b8a6",
        title: "Event 2",
      },
      {
        id: "3",
        start: moment("2024-09-09T11:00").toDate(),
        end: moment("2024-09-09T14:00").toDate(),
        hexColor: "#14b8a6",
        title: "Event 3",
      },
      {
        id: "4",
        start: moment("2024-09-09T10:30").toDate(),
        end: moment("2024-09-09T11:30").toDate(),
        hexColor: "#14b8a6",
        title: "Event 4",
      },
      {
        id: "5",
        start: moment("2024-09-09T16:00").toDate(),
        end: moment("2024-09-09T18:00").toDate(),
        hexColor: "#14b8a6",
        title: "Event 5",
      },
    ],
  },
  {
    date: moment("2024-09-10"),
    events: [
      {
        id: "11",
        start: moment("2024-09-10T18:30").toDate(),
        end: moment("2024-09-10T20:00").toDate(),
        hexColor: "#d2691e",
        title: "Event 11",
      },
      {
        id: "12",
        start: moment("2024-09-10T20:30").toDate(),
        end: moment("2024-09-10T22:00").toDate(),
        hexColor: "#ff1493",
        title: "Event 12",
      },
      {
        id: "13",
        start: moment("2024-09-10T22:30").toDate(),
        end: moment("2024-09-11T00:00").toDate(),
        hexColor: "#00ced1",
        title: "Event 13",
      },
      {
        id: "14",
        start: moment("2024-09-10T08:00").toDate(),
        end: moment("2024-09-10T09:30").toDate(),
        hexColor: "#ff69b4",
        title: "Event 14",
      },
      {
        id: "15",
        start: moment("2024-09-10T09:00").toDate(),
        end: moment("2024-09-10T10:30").toDate(),
        hexColor: "#1e90ff",
        title: "Event 15",
      },
      {
        id: "16",
        start: moment("2024-09-10T10:00").toDate(),
        end: moment("2024-09-10T11:00").toDate(),
        hexColor: "#ff6347",
        title: "Event 16",
      },
      {
        id: "17",
        start: moment("2024-09-10T11:00").toDate(),
        end: moment("2024-09-10T12:30").toDate(),
        hexColor: "#4682b4",
        title: "Event 17",
      },
      {
        id: "18",
        start: moment("2024-09-10T13:30").toDate(),
        end: moment("2024-09-10T15:00").toDate(),
        hexColor: "#32cd32",
        title: "Event 18",
      },
      {
        id: "19",
        start: moment("2024-09-10T15:00").toDate(),
        end: moment("2024-09-10T16:30").toDate(),
        hexColor: "#ff4500",
        title: "Event 19",
      },
      {
        id: "20",
        start: moment("2024-09-10T16:00").toDate(),
        end: moment("2024-09-10T17:30").toDate(),
        hexColor: "#8a2be2",
        title: "Event 20",
      },
    ],
  },
  {
    date: moment("2024-09-11"),
    events: [
      {
        id: "21",
        start: moment("2024-09-11T08:30").toDate(),
        end: moment("2024-09-11T10:00").toDate(),
        hexColor: "#ff7f50",
        title: "Event 21",
      },
      {
        id: "22",
        start: moment("2024-09-11T10:00").toDate(),
        end: moment("2024-09-11T11:30").toDate(),
        hexColor: "#6a5acd",
        title: "Event 22",
      },
      {
        id: "23",
        start: moment("2024-09-11T11:00").toDate(),
        end: moment("2024-09-11T12:30").toDate(),
        hexColor: "#20b2aa",
        title: "Event 23",
      },
      {
        id: "24",
        start: moment("2024-09-11T13:00").toDate(),
        end: moment("2024-09-11T14:30").toDate(),
        hexColor: "#ff6347",
        title: "Event 24",
      },
      {
        id: "25",
        start: moment("2024-09-11T14:30").toDate(),
        end: moment("2024-09-11T15:30").toDate(),
        hexColor: "#ff4500",
        title: "Event 25",
      },
    ],
  },
  {
    date: moment("2024-09-12"),
    events: [
      {
        id: "26",
        start: moment("2024-09-12T09:00").toDate(),
        end: moment("2024-09-12T10:00").toDate(),
        hexColor: "#ff69b4",
        title: "Event 26",
      },
      {
        id: "27",
        start: moment("2024-09-12T10:30").toDate(),
        end: moment("2024-09-12T11:30").toDate(),
        hexColor: "#1e90ff",
        title: "Event 27",
      },
      {
        id: "28",
        start: moment("2024-09-12T12:00").toDate(),
        end: moment("2024-09-12T13:30").toDate(),
        hexColor: "#32cd32",
        title: "Event 28",
      },
      {
        id: "29",
        start: moment("2024-09-12T14:00").toDate(),
        end: moment("2024-09-12T15:30").toDate(),
        hexColor: "#ff4500",
        title: "Event 29",
      },
      {
        id: "30",
        start: moment("2024-09-12T15:00").toDate(),
        end: moment("2024-09-12T16:30").toDate(),
        hexColor: "#8a2be2",
        title: "Event 30",
      },
    ],
  },
  {
    date: moment("2024-09-13"),
    events: [
      {
        id: "31",
        start: moment("2024-09-13T08:30").toDate(),
        end: moment("2024-09-13T09:30").toDate(),
        hexColor: "#ff7f50",
        title: "Event 31",
      },
      {
        id: "32",
        start: moment("2024-09-13T09:00").toDate(),
        end: moment("2024-09-13T10:00").toDate(),
        hexColor: "#6a5acd",
        title: "Event 32",
      },
      {
        id: "33",
        start: moment("2024-09-13T11:00").toDate(),
        end: moment("2024-09-13T12:00").toDate(),
        hexColor: "#20b2aa",
        title: "Event 33",
      },
      {
        id: "34",
        start: moment("2024-09-13T12:30").toDate(),
        end: moment("2024-09-13T13:30").toDate(),
        hexColor: "#ff6347",
        title: "Event 34",
      },
      {
        id: "35",
        start: moment("2024-09-13T14:00").toDate(),
        end: moment("2024-09-13T15:30").toDate(),
        hexColor: "#ff4500",
        title: "Event 35",
      },
    ],
  },
  {
    date: moment("2024-09-15"),
    events: [
      {
        id: "41",
        start: moment("2024-09-15T08:00").toDate(),
        end: moment("2024-09-15T12:00").toDate(),
        hexColor: "#ff7f50",
        title: "Event 41",
      },
      {
        id: "42",
        start: moment("2024-09-15T08:30").toDate(),
        end: moment("2024-09-15T10:30").toDate(),
        hexColor: "#6a5acd",
        title: "Event 42",
      },
      {
        id: "43",
        start: moment("2024-09-15T07:30").toDate(),
        end: moment("2024-09-15T12:00").toDate(),
        hexColor: "#20b2aa",
        title: "Event 43",
      },
      {
        id: "44",
        start: moment("2024-09-15T08:30").toDate(),
        end: moment("2024-09-15T09:30").toDate(),
        hexColor: "#ff6347",
        title: "Event 44",
      },
      {
        id: "45",
        start: moment("2024-09-15T08:00").toDate(),
        end: moment("2024-09-15T09:00").toDate(),
        hexColor: "#ff4500",
        title: "Event 45",
      },
    ],
  },
];

export default function CalendarView() {
  const tmp = data.map((d) => d.events).flat();
  const [events, setEvents] = useState<EventMeeting[]>(tmp);

  const localizer = momentLocalizer(moment);

  const onEventResize: withDragAndDropProps["onEventResize"] = (data) => {
    const ev = data.event as EventMeeting;
    const { start, end } = data;

    const changedEvents = events.map((e) => {
      if (e.id === ev.id) {
        return { ...e, start: new Date(start), end: new Date(end) };
      } else {
        return e;
      }
    });
    setEvents([...changedEvents]);
  };

  const onEventDrop: withDragAndDropProps["onEventDrop"] = (data) => {
    console.log(data);
    const ev = data.event as EventMeeting;
    const { start, end } = data;

    const changedEvents = events.map((e) => {
      if (e.id === ev.id) {
        return { ...e, start: new Date(start), end: new Date(end) };
      } else {
        return e;
      }
    });
    setEvents([...changedEvents]);
  };

  return (
    <DnDCalendar
      defaultView="week"
      date={moment("2024-09-09").toDate()}
      events={events}
      localizer={localizer}
      onEventDrop={onEventDrop}
      onEventResize={onEventResize}
      resizable
      scrollToTime={new Date()}
      showMultiDayTimes
      components={{
        event: MyEvent,
        eventWrapper: MyEventWrapper as React.ComponentType<
          EventWrapperProps<EventMeeting>
        >,
      }}
      formats={{
        timeGutterFormat: (date, culture, localizer) =>
          localizer ? localizer.format(date, "HH:mm", culture) : "",
        eventTimeRangeFormat: ({ start, end }, culture, localizer) => {
          const s = localizer?.format(start, "HH:mm", culture) ?? "";
          const e = localizer?.format(end, "HH:mm", culture) ?? "";
          return `${s} - ${e}`;
        },
        agendaTimeRangeFormat: ({ start, end }, culture, localizer) => {
          const s = localizer?.format(start, "HH:mm", culture) ?? "";
          const e = localizer?.format(end, "HH:mm", culture) ?? "";
          return `${s} - ${e}`;
        },
        dayRangeHeaderFormat: ({ start, end }, culture, localizer) => {
          const s = localizer?.format(start, "MMM DD", culture) ?? "";
          const e = localizer?.format(end, "MMM DD", culture) ?? "";
          return `${s} - ${e}`;
        },
      }}
    />
  );
}

const MyEventWrapper = (data) => {
  console.log(data);
  return (
    <div className="rounded-lg border bg-red-500">
      <div>{data.children}</div>
    </div>
  );
};

const MyEvent = ({}) => {
  return <>Hello</>;
};
const DnDCalendar = withDragAndDrop(Calendar);
