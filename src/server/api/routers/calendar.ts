import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import { db } from "@/server/db";
import { posts } from "@/server/db/schema";
import { CalendarList } from "@/utils/types";

export const calendarRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),
  getSecretMessage: protectedProcedure.query(async ({ ctx }) => {
    const acc = await db.query.accounts.findFirst({
      where: (accounts, { eq }) => eq(accounts.userId, ctx.session.user.id),
    });
    if (!acc) {
      // todo
      return null;
    }
    const calendars = (await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      {
        headers: {
          Authorization: `Bearer ${acc?.access_token}`,
        },
      },
    ).then((res) => res.json())) as CalendarList;
    return calendars;
  }),
});
