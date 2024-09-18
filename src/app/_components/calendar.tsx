"use client";

import { createDragAndDropPlugin } from "@schedule-x/drag-and-drop";
import { createEventModalPlugin } from "@schedule-x/event-modal";
import { createResizePlugin } from "@schedule-x/resize";
import { createEventsServicePlugin } from "@schedule-x/events-service";
import { createCalendarControlsPlugin } from "@schedule-x/calendar-controls";
import { createScrollControllerPlugin } from "@schedule-x/scroll-controller";
import { createCurrentTimePlugin } from "@schedule-x/current-time";

import { useState } from "react";
import { useNextCalendarApp, ScheduleXCalendar } from "@schedule-x/react";
import {
  createViewDay,
  createViewMonthAgenda,
  createViewMonthGrid,
  createViewWeek,
} from "@schedule-x/calendar";

import "@schedule-x/theme-default/dist/index.css";

import { data } from "./data";

export default function CalendarView() {
  const tmp = data.map((d) => d.events).flat();
  const [events, setEvents] = useState(
    tmp.map((e) => {
      return {
        id: e.id,
        start: e.start,
        end: e.end,
        hexColor: e.hexColor,
        title: e.title,
      };
    }),
  );

  const eventsServicePlugin = createEventsServicePlugin();
  const calendarControls = createCalendarControlsPlugin();
  const scrollController = createScrollControllerPlugin({
    initialScroll: "07:50",
  });

  const calendar = useNextCalendarApp({
    views: [
      createViewDay(),
      createViewWeek(),
      createViewMonthGrid(),
      createViewMonthAgenda(),
    ],
    events,
    selectedDate: "2024-09-13",
    locale: "en-GB",
    plugins: [
      createDragAndDropPlugin(),
      createEventModalPlugin(),
      createResizePlugin(),
      eventsServicePlugin,
      calendarControls,
      scrollController,
      createCurrentTimePlugin(),
    ],
    callbacks: {
      /**
       * Is called when:
       * 1. Selecting a date in the date picker
       * 2. Selecting a new view
       * */
      onRangeUpdate(range) {
        console.log("new calendar range start date", range.start);
        console.log("new calendar range end date", range.end);
      },

      /**
       * Is called when an event is updated through drag and drop
       * */
      onEventUpdate(updatedEvent) {
        console.log("onEventUpdate", updatedEvent);
      },

      /**
       * Is called when an event is clicked
       * */
      onEventClick(calendarEvent) {
        console.log("onEventClick", calendarEvent);
      },

      /**
       * Is called when clicking a date in the month grid
       * */
      onClickDate(date) {
        console.log("onClickDate", date); // e.g. 2024-01-01
      },

      /**
       * Is called when clicking somewhere in the time grid of a week or day view
       * */
      onClickDateTime(dateTime) {
        console.log("onClickDateTime", dateTime); // e.g. 2024-01-01 12:37
      },

      /**
       * Is called when selecting a day in the month agenda
       * */
      onClickAgendaDate(date) {
        console.log("onClickAgendaDate", date); // e.g. 2024-01-01
      },

      /**
       * Is called when double clicking a date in the month grid
       * */
      onDoubleClickDate(date) {
        console.log("onClickDate", date); // e.g. 2024-01-01
      },

      /**
       * Is called when double clicking somewhere in the time grid of a week or day view
       * */
      onDoubleClickDateTime(dateTime) {
        console.log("onDoubleClickDateTime", dateTime); // e.g. 2024-01-01 12:37
      },

      /**
       * Is called when clicking the "+ N events" button of a month grid-day
       * */
      onClickPlusEvents(date) {
        console.log("onClickPlusEvents", date); // e.g. 2024-01-01
      },

      /**
       * Is called when the selected date is updated
       * */
      onSelectedDateUpdate(date) {
        console.log("onSelectedDateUpdate", date);
      },
    },
  });

  return (
    <div>
      <ScheduleXCalendar
        calendarApp={calendar}
        customComponents={{
          eventModal: (props) => {
            return <>Content</>;
          },
        }}
      />
    </div>
  );
}
