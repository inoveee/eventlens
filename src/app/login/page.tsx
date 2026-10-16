// @TheTechMargin 2026
// Старый вход организатора переехал на стартовый экран «/» —
// публичные страницы участников живут на /p/<key> и никогда
// не показывают авторизацию.

import { redirect } from "next/navigation";

export default function LoginPage() {
  redirect("/");
}
