// @TheTechMargin 2026
// Список проектов организатора и действия над ними.
//   GET  /api/event/projects              — все проекты (включая архив)
//   POST /api/event/projects { action }   — create | rename | duplicate |
//                                           archive | delete
// Доступ — cookie-сессия админа (requireAdminAccess): super_admin видит
// все проекты, admin — только свой по лицензии. Legacy Bearer
// ADMIN_API_SECRET принимается для скриптов/CI как super_admin.

import { NextRequest, NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/adminAuth";
import {
  PROJECT_DESCRIPTION_LIMIT,
  PROJECT_TITLE_LIMIT,
  isProjectKey,
} from "@/lib/eventSettings";
import {
  ProjectKeyTakenError,
  ProjectNotFoundError,
  StorageUnavailableError,
  createProject,
  deleteProject,
  duplicateProject,
  listProjectSummaries,
  rekeyProject,
  renameProject,
  storageEngine,
  updateProjectMeta,
} from "@/lib/eventSettingsStore";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const auth = await requireAdminAccess(request);
  if (!auth.ok) return auth.response;
  try {
    const all = await listProjectSummaries();
    // У admin лицензия ровно на один проект — список сужаем до неё,
    // чужие проекты он не должен даже видеть.
    const projects =
      auth.ctx.role === "admin" && auth.ctx.projectKey
        ? all.filter((p) => p.key === auth.ctx.projectKey)
        : all;
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
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "create" || action === "duplicate") {
      // Создание новых проектов — только super_admin: у admin лицензия
      // ровно на один проект, созданный проект он всё равно не увидит.
      const auth = await requireAdminAccess(request);
      if (!auth.ok) return auth.response;
      if (auth.ctx.role !== "super_admin") {
        return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
      }
    }

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

    // Остальные действия привязаны к проекту: admin работает только со
    // своим (проект берётся из лицензии в БД, а не из запроса),
    // super_admin — с любым.
    if (action !== "duplicate") {
      const auth = await requireAdminAccess(request, key);
      if (!auth.ok) return auth.response;
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

    if (action === "alias") {
      const alias =
        typeof body.alias === "string" ? body.alias.trim().toLowerCase() : "";
      if (!isProjectKey(alias)) {
        return NextResponse.json(
          {
            error:
              "Алиас: только латиница в нижнем регистре, цифры и дефис — например, devfest",
          },
          { status: 400 },
        );
      }
      await rekeyProject(key, alias);
      return NextResponse.json({ key: alias });
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
    if (err instanceof ProjectKeyTakenError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
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
