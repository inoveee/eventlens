// @TheTechMargin 2026
// Старый адрес панели: стартовый экран организатора теперь живёт на «/».

import { redirect } from "next/navigation";

export default function OrganizerIndexRedirect() {
  redirect("/");
}
