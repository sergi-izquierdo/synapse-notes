import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));
vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn().mockReturnValue("mock-anthropic-model"),
}));

import { generateObject } from "ai";
import { createAutoTagService } from "./auto-tag.service";

const mockedGenerateObject = vi.mocked(generateObject);

interface InsertCall {
  table: string;
  rows: unknown;
}

function makeClient(initial: { insertCalls?: InsertCall[] } = {}) {
  const insertCalls = initial.insertCalls ?? [];
  const client = {
    from: vi.fn((table: string) => ({
      insert: vi.fn(async (rows: unknown) => {
        insertCalls.push({ table, rows });
        return { error: null };
      }),
    })),
    insertCalls,
  };
  return client;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("AutoTagService.proposeForNote", () => {
  it("filters echoed tags down to the user's actual library and caps at 3", async () => {
    mockedGenerateObject.mockResolvedValueOnce({
      object: {
        existing: ["work", "ideas", "todo", "made-up-tag"],
        newTag: null,
      },
    } as never);

    const client = makeClient();
    const service = createAutoTagService(client as never);

    const result = await service.proposeForNote({
      note: { id: 42, title: "Standup", content: "Plan for today", tags: [] },
      availableTags: ["work", "ideas", "todo", "personal"],
      userId: "user-1",
      persist: false,
    });

    expect(result.existing).toEqual(["work", "ideas", "todo"]);
    expect(result.newTag).toBeNull();
  });

  it("normalises a new tag to kebab-case and rejects collisions with the existing library", async () => {
    mockedGenerateObject.mockResolvedValueOnce({
      object: { existing: [], newTag: "Home Security" },
    } as never);

    const client = makeClient();
    const service = createAutoTagService(client as never);

    const result = await service.proposeForNote({
      note: {
        id: 7,
        title: null,
        content: "Recordar el codi de l'alarma 1234",
        tags: [],
      },
      availableTags: [],
      userId: "user-1",
      persist: false,
    });

    expect(result.newTag).toBe("home-security");
  });

  it("drops the newTag when it collides with an existing library tag", async () => {
    mockedGenerateObject.mockResolvedValueOnce({
      object: { existing: ["work"], newTag: "Work" },
    } as never);

    const client = makeClient();
    const service = createAutoTagService(client as never);

    const result = await service.proposeForNote({
      note: { id: 1, title: "X", content: "Y", tags: [] },
      availableTags: ["work"],
      userId: "user-1",
      persist: false,
    });

    expect(result.newTag).toBeNull();
    expect(result.existing).toEqual(["work"]);
  });

  it("returns empty proposal for blank notes without calling the LLM", async () => {
    const client = makeClient();
    const service = createAutoTagService(client as never);

    const result = await service.proposeForNote({
      note: { id: 1, title: null, content: "  \n  ", tags: [] },
      availableTags: ["work"],
      userId: "user-1",
      persist: false,
    });

    expect(result).toEqual({ noteId: 1, existing: [], newTag: null });
    expect(mockedGenerateObject).not.toHaveBeenCalled();
  });

  it("persists proposals to tag_suggestions and agent_events when persist=true", async () => {
    mockedGenerateObject.mockResolvedValueOnce({
      object: { existing: ["work"], newTag: "standup" },
    } as never);

    const client = makeClient();
    const service = createAutoTagService(client as never);

    await service.proposeForNote({
      note: { id: 99, title: "Daily", content: "Sprint review", tags: [] },
      availableTags: ["work"],
      userId: "user-1",
      persist: true,
    });

    const tagsCall = client.insertCalls.find(
      (c) => c.table === "tag_suggestions",
    );
    const eventsCall = client.insertCalls.find(
      (c) => c.table === "agent_events",
    );

    expect(tagsCall?.rows).toEqual([
      {
        user_id: "user-1",
        note_id: 99,
        tag: "work",
        status: "pending",
      },
      {
        user_id: "user-1",
        note_id: 99,
        tag: "standup",
        status: "pending",
      },
    ]);
    expect(eventsCall?.rows).toMatchObject({
      user_id: "user-1",
      agent: "auto-tag",
      action: "tag.proposed",
    });
  });

  it("logs an agent_event even when the proposal is empty", async () => {
    mockedGenerateObject.mockResolvedValueOnce({
      object: { existing: [], newTag: null },
    } as never);

    const client = makeClient();
    const service = createAutoTagService(client as never);

    await service.proposeForNote({
      note: { id: 5, title: "Random", content: "asdfgh", tags: [] },
      availableTags: ["work"],
      userId: "user-1",
      persist: true,
    });

    expect(
      client.insertCalls.find((c) => c.table === "tag_suggestions"),
    ).toBeUndefined();
    expect(
      client.insertCalls.find((c) => c.table === "agent_events"),
    ).toBeDefined();
  });
});
