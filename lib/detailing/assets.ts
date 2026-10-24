import { randomUUID } from "node:crypto";
import { statfsSync } from "node:fs";
import { dataDirectory, db, rateLimit } from "./db";
import { DetailError } from "./store";

export async function saveUpload(req: Request, owner: string, hourlyLimit: number) {
  if (!rateLimit(`upload:${owner}`, hourlyLimit, 3600)) throw new DetailError("Слишком много загрузок. Попробуйте позже.", 429);
  if (Number(req.headers.get("content-length") || 0) > 6500000) throw new DetailError("Фотография должна быть меньше 6 МБ", 413);
  const file = (await req.formData()).get("file");
  if (!(file instanceof File) || file.size > 6000000) throw new DetailError("Выберите изображение до 6 МБ");
  const buffer = Buffer.from(await file.arrayBuffer());
  const type = buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ? "image/jpeg" : buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "image/png" : buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP" ? "image/webp" : null;
  if (!type) throw new DetailError("Поддерживаются JPG, PNG и WebP");
  const fs = statfsSync(dataDirectory());
  if (fs.bavail * fs.bsize < file.size * 2 + 64 * 1024 * 1024) throw new DetailError("Недостаточно места для фотографии. Обратитесь в поддержку студии.", 503);
  const id = randomUUID();
  db().prepare("INSERT INTO detail_assets VALUES(?,?,?)").run(id, type, buffer);
  return { url: `/api/detailing/assets/${id}` };
}
