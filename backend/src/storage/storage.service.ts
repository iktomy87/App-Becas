import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { mkdirSync, createWriteStream, createReadStream, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { tmpdir } from 'os';
import { Readable } from 'stream';
import type { ReadableStream as NodeReadableStream } from 'stream/web';
import { pipeline } from 'stream/promises';

export interface SignedUpload {
  path: string;
  signedUrl: string;
  token: string;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly url = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  private readonly secret = process.env.SUPABASE_STORAGE_SECRET ?? '';
  private readonly bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'archivos';

  onModuleInit(): void {
    if (!this.url || !this.secret) {
      this.logger.warn(
        'SUPABASE_URL / SUPABASE_STORAGE_SECRET no configurados: los uploads a Storage fallarán',
      );
    }
  }

  createObjectPath(scope: string, originalname: string): string {
    const safeScope = scope.replace(/^\/+|\/+$/g, '');
    const safeName = originalname
      .split(/[\\/]/)
      .pop()!
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = safeName.includes('.')
      ? safeName.slice(safeName.lastIndexOf('.'))
      : '';
    return `${safeScope}/${Date.now()}-${randomUUID()}${ext}`;
  }

  async uploadFile(path: string, sourcePath: string): Promise<void> {
    this.assertConfigured();
    const stream = createReadStream(sourcePath);
    const res = await fetch(
      `${this.url}/storage/v1/object/${this.bucket}/${this.encodePath(path)}`,
      {
        method: 'PUT',
        headers: this.headers({
          'content-type': this.contentTypeFor(path),
          'x-upsert': 'true',
        }),
        body: Readable.toWeb(stream) as unknown as BodyInit,
        duplex: 'half',
      } as RequestInit,
    );
    if (!res.ok) {
      throw new Error(
        `No se pudo subir ${path} a Storage (${res.status}): ${await res.text()}`,
      );
    }
  }

  async createSignedUploadUrl(
    scope: string,
    originalname: string,
  ): Promise<SignedUpload> {
    this.assertConfigured();
    const path = this.createObjectPath(scope, originalname);

    const res = await fetch(
      `${this.url}/storage/v1/object/upload/sign/${this.bucket}/${this.encodePath(path)}`,
      {
        method: 'POST',
        headers: this.headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({ upsert: false }),
      },
    );
    if (!res.ok) {
      throw new Error(
        `No se pudo crear URL firmada de upload (${res.status}): ${await res.text()}`,
      );
    }

    const data = (await res.json()) as { url?: string };
    if (!data.url) throw new Error('Storage no devolvió URL firmada de upload');

    const signedUrl = new URL(data.url, `${this.url}/storage/v1/`).toString();
    return {
      path,
      signedUrl,
      token: new URL(signedUrl).searchParams.get('token') ?? '',
    };
  }

  async downloadToFile(path: string): Promise<string> {
    this.assertConfigured();
    const res = await fetch(
      `${this.url}/storage/v1/object/authenticated/${this.bucket}/${this.encodePath(path)}`,
      { headers: this.headers() },
    );
    if (!res.ok || !res.body) {
      throw new Error(
        `No se pudo descargar ${path} desde Storage (${res.status}): ${await res.text()}`,
      );
    }

    const dir = join(tmpdir(), 'becas-storage');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const fileName = path
      .split('/')
      .pop()!
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const destination = join(dir, `${randomUUID()}-${fileName}`);
    await pipeline(
      Readable.fromWeb(res.body as unknown as NodeReadableStream),
      createWriteStream(destination),
    );
    return destination;
  }

  async uploadBuffer(
    path: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    this.assertConfigured();
    const res = await fetch(
      `${this.url}/storage/v1/object/${this.bucket}/${this.encodePath(path)}`,
      {
        method: 'POST',
        headers: this.headers({
          'content-type': contentType,
          'x-upsert': 'true',
        }),
        body: buffer as unknown as BodyInit,
      },
    );
    if (!res.ok) {
      throw new Error(
        `No se pudo subir ${path} a Storage (${res.status}): ${await res.text()}`,
      );
    }
  }

  async createSignedDownloadUrl(
    path: string,
    downloadName: string,
    expiresIn = 3600,
  ): Promise<string> {
    this.assertConfigured();
    const res = await fetch(
      `${this.url}/storage/v1/object/sign/${this.bucket}/${this.encodePath(path)}`,
      {
        method: 'POST',
        headers: this.headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({ expiresIn, download: downloadName }),
      },
    );
    if (!res.ok) {
      throw new Error(
        `No se pudo crear URL firmada de descarga (${res.status}): ${await res.text()}`,
      );
    }

    const data = (await res.json()) as {
      signedURL?: string;
      signedUrl?: string;
    };
    const signed = data.signedURL ?? data.signedUrl;
    if (!signed) throw new Error('Storage no devolvió URL firmada de descarga');
    return new URL(signed, `${this.url}/storage/v1/`).toString();
  }

  assertPath(path: string, scope: string): void {
    const prefix = `${scope.replace(/^\/+|\/+$/g, '')}/`;
    if (!path.startsWith(prefix) || path.includes('..')) {
      throw new BadRequestException('Path de archivo inválido');
    }
  }

  private assertConfigured(): void {
    if (!this.url || !this.secret) {
      throw new InternalServerErrorException(
        'Falta configurar SUPABASE_URL o SUPABASE_STORAGE_SECRET',
      );
    }
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      apikey: this.secret,
      Authorization: `Bearer ${this.secret}`,
      ...extra,
    };
  }

  private encodePath(path: string): string {
    return path.split('/').map(encodeURIComponent).join('/');
  }

  private contentTypeFor(path: string): string {
    switch (extname(path).toLowerCase()) {
      case '.xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case '.xls':
        return 'application/vnd.ms-excel';
      case '.csv':
        return 'text/csv';
      default:
        return 'application/octet-stream';
    }
  }
}
