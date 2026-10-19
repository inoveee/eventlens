// @TheTechMargin 2026
// Хеширование паролей через argon2id (@node-rs/argon2).
//
// Пароль хранится ТОЛЬКО в виде хеша — открытый текст никогда не пишется
// в БД, логи или ответы. argon2id — рекомендованный режим Argon2 (сочетает
// сопротивление side-channel и GPU-атакам) и дефолт @node-rs/argon2; хеш
// начинается с "$argon2id$", что фиксирует режим в самом значении.

import { hash, verify } from "@node-rs/argon2";

/** Хеширует пароль. Бросает при сбое — молчаливый провал здесь опасен:
 *  пользователь получил бы учётку без сохранённого пароля. */
export async function hashPassword(password: string): Promise<string> {
  return hash(password);
}

/**
 * Сверяет пароль с хешем. Любая ошибка (повреждённый хеш, пустой пароль)
 * трактуется как несовпадение — не как успех и не как 500: переборщик не
 * должен отличать «нет такого хеша» от «неверный пароль».
 */
export async function verifyPassword(
  storedHash: string,
  password: string,
): Promise<boolean> {
  if (!storedHash || !password) return false;
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}
