// @TheTechMargin 2026
// Список проектов организатора и действия над ними.
//   GET  /api/event/projects              — все проекты (включая архив)
//   POST /api/event/projects { action }   — create | rename | duplicate |
//                                           archive | delete
// Доступ только по паролю организатора (Bearer).

import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import {
  PROJECT_DESCRIPTION_LIMIT,
  PROJECT_TITLE_LIMIT,
  isProjectKey,
} from "@/lib/eventSettings";
import {
  ProjectNotFoundError,
  StorageUnavailableError,
  createProject,
  deleteProject,
  duplicateProject,
  listProjectSummaries,
  renameProject,
  storageEngine,
  updateProjectMeta,
} from "@/lib/eventSettingsStore";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const projects = await listProjectSummaries();
    return NextResponse.json({ projects, storage: storageEngine() });
  } catch (err) {
    if (err instanceof StorageUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("[event/projects] GET failed:", err);
    return NextResponse.json(
      { error: "Не удалось загрузить список проектов" },
      { status: 500 },
    );
  }
}

function pickKey(body: Record<string, unknown>): string | null {
  const key = body.key;
  return typeof key === "string" && isProjectKey(key) ? key : null;
}

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "create") {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) {
        return NextResponse.json(
          { error: "Укажите название мероприятия" },
          { status: 400 },
        );
      }
      if (title.length > PROJECT_TITLE_LIMIT) {
        return NextResponse.json(
          { error: `Название — не длиннее ${PROJECT_TITLE_LIMIT} символов` },
          { status: 400 },
        );
      }
      const date = typeof body.date === "string" && body.date ? body.date : null;
      if (date && !DATE_RE.test(date)) {
        return NextResponse.json(
          { error: "Дата указана в непонятном формате" },
          { status: 400 },
        );
      }
      const description =
        typeof body.description === "string"
          ? body.description.trim().slice(0, PROJECT_DESCRIPTION_LIMIT)
          : "";
      const { key } = await createProject({ title, date, description });
      return NextResponse.json({ key }, { status: 201 });
    }

    const key = pickKey(body);
    if (!key) {
      return NextResponse.json({ error: "Проект не выбран" }, { status: 400 });
    }

    if (action === "rename") {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title || title.length > PROJECT_TITLE_LIMIT) {
        return NextResponse.json(
          { error: "Проверьте название проекта" },
          { status: 400 },
        );
      }
      await renameProject(key, title);
      return NextResponse.json({ key });
    }

    if (action === "duplicate") {
      const created = await duplicateProject(key);
      return NextResponse.json({ key: created.key }, { status: 201 });
    }

    if (action === "archive") {
      const archived = body.archived !== false;
      await updateProjectMeta(key, { archived });
      return NextResponse.json({ key });
    }

    if (action === "delete") {
      await deleteProject(key);
      return NextResponse.json({ key });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (err) {
    if (err instanceof ProjectNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof StorageUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("[event/projects] POST failed:", err);
    return NextResponse.json(
      { error: "Не удалось выполнить действие с проектом" },
      { status: 500 },
    );
  }
}
