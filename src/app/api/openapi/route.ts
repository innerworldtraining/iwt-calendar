import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const spec = {
    openapi: "3.0.0",
    info: {
      title: "IWT Calendar API",
      version: "1.0.0",
      description: "Inner World Training member calendar — Elites and Plats events",
    },
    servers: [{ url: "https://iwt-calendar.vercel.app" }],
    security: [{ ApiKeyAuth: [] }],
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: "apiKey", in: "header", name: "x-api-key" },
      },
    },
    paths: {
      "/api/events": {
        get: {
          operationId: "listEvents",
          summary: "List calendar events",
          description: "Returns all events for a given calendar (elites or plats)",
          parameters: [
            {
              name: "calendar",
              in: "query",
              required: true,
              schema: { type: "string", enum: ["elites", "plats"] },
              description: "Which calendar to fetch events from",
            },
          ],
          responses: {
            "200": {
              description: "List of events",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      events: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            calendar: { type: "string" },
                            title: { type: "string" },
                            description: { type: "string" },
                            location: { type: "string" },
                            url: { type: "string" },
                            startsAt: { type: "string", format: "date-time" },
                            endsAt: { type: "string", format: "date-time", nullable: true },
                            timezone: { type: "string" },
                            allDay: { type: "boolean" },
                            legendId: { type: "string", nullable: true },
                            recurrenceGroupId: { type: "string", nullable: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "401": { description: "Unauthorized — invalid or missing API key" },
          },
        },
        post: {
          operationId: "createEvent",
          summary: "Create a new event",
          description: "Creates a single new event on the specified calendar",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["calendar", "title", "startsAt"],
                  properties: {
                    calendar: { type: "string", enum: ["elites", "plats"] },
                    title: { type: "string" },
                    description: { type: "string" },
                    location: { type: "string" },
                    url: { type: "string" },
                    organizer: { type: "string" },
                    organizerEmail: { type: "string" },
                    startsAt: { type: "string", format: "date-time" },
                    endsAt: { type: "string", format: "date-time" },
                    timezone: { type: "string", default: "America/New_York" },
                    allDay: { type: "boolean", default: false },
                    legendId: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Event created successfully" },
            "400": { description: "Invalid input" },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/events/{id}": {
        patch: {
          operationId: "updateEvent",
          summary: "Update an existing event",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Event ID" },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    location: { type: "string" },
                    url: { type: "string" },
                    startsAt: { type: "string", format: "date-time" },
                    endsAt: { type: "string", format: "date-time" },
                    timezone: { type: "string" },
                    allDay: { type: "boolean" },
                    legendId: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Event updated successfully" },
            "401": { description: "Unauthorized" },
            "404": { description: "Event not found" },
          },
        },
        delete: {
          operationId: "deleteEvent",
          summary: "Delete an event",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Event ID" },
            { name: "series", in: "query", schema: { type: "boolean" }, description: "If true, deletes all events in the same recurring series" },
          ],
          responses: {
            "200": { description: "Event deleted successfully" },
            "401": { description: "Unauthorized" },
            "404": { description: "Event not found" },
          },
        },
      },
      "/api/legends": {
        get: {
          operationId: "listLegends",
          summary: "List event legends",
          description: "Returns all color-coded legend categories for a calendar",
          parameters: [
            {
              name: "calendar",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["elites", "plats"] },
            },
          ],
          responses: {
            "200": {
              description: "List of legends",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      legends: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            label: { type: "string" },
                            color: { type: "string" },
                            calendar: { type: "string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
          },
        },
      },
    },
  };

  return NextResponse.json(spec, {
    headers: {
      // Allow Base44 to fetch this spec publicly (no auth needed for the spec itself)
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
  });
}
