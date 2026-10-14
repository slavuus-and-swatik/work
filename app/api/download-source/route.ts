import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export async function GET() {
  try {
    const zipPath = path.join(process.cwd(), 'public', 'project-source.zip');
    if (!fs.existsSync(zipPath)) {
      return NextResponse.json({ error: 'Архив не найден' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(zipPath);
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="universal-booking-site-source.zip"',
        'Content-Length': fileBuffer.byteLength.toString(),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Не удалось отдать архив исходников' }, { status: 500 });
  }
}
