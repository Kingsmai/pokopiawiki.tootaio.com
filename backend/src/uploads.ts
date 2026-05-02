import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { MultipartFile } from '@fastify/multipart';
import type { PoolClient } from 'pg';
import type { AuthUser } from './auth.ts';
import { query, queryOne } from './db.ts';

export type UploadEntityType = 'pokemon' | 'items' | 'habitats';

export type EntityImageUpload = {
  id: number;
  entityType: UploadEntityType;
  entityId: number | null;
  entityName: string;
  path: string;
  url: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  uploadedAt: Date;
  uploadedBy: { id: number; displayName: string } | null;
};

type UploadRow = {
  id: number;
  entityType: UploadEntityType;
  entityId: number | null;
  entityName: string;
  path: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  uploadedAt: Date;
  uploadedBy: { id: number; displayName: string } | null;
};

type MultipartField = {
  value?: unknown;
};

const uploadEntityTypes = new Set<UploadEntityType>(['pokemon', 'items', 'habitats']);
const imageMimeTypes = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif']
]);

const backendPublicOrigin = process.env.BACKEND_PUBLIC_ORIGIN ?? `http://localhost:${process.env.BACKEND_PORT ?? 3001}`;
export const imageUploadMaxBytes = 3 * 1024 * 1024;
export const uploadRoot = path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads'));
export const uploadPublicBaseUrl = (process.env.UPLOAD_PUBLIC_BASE_URL ?? `${backendPublicOrigin}/uploads/`).replace(/\/?$/, '/');

export function isUploadEntityType(value: string): value is UploadEntityType {
  return uploadEntityTypes.has(value as UploadEntityType);
}

export function isUploadImagePath(value: string | null | undefined): boolean {
  const cleanPath = value?.trim() ?? '';
  if (cleanPath === '' || cleanPath.startsWith('/') || cleanPath.includes('..')) {
    return false;
  }

  const [entityType] = cleanPath.split('/');
  return isUploadEntityType(entityType);
}

export function uploadImageUrl(relativePath: string): string {
  return `${uploadPublicBaseUrl}${relativePath.split('/').map(encodeURIComponent).join('/')}`;
}

function validationError(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 400;
  return error;
}

function fieldValue(fields: Record<string, unknown> | undefined, fieldName: string): string {
  const field = fields?.[fieldName];
  if (field && typeof field === 'object' && 'value' in field) {
    const value = (field as MultipartField).value;
    return typeof value === 'string' ? value.trim() : '';
  }
  return '';
}

function optionalPositiveInteger(value: string): number | null {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

function safePathSegment(value: string): string {
  const segment = value
    .normalize('NFKC')
    .trim()
    .replace(/[\\/:*?"<>|#%?&\u0000-\u001F]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+$/, '')
    .slice(0, 80);

  return segment || 'record';
}

function timestampForPath(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds())
  ].join('');
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function uniqueRelativePath(entityType: UploadEntityType, entityName: string, extension: string): Promise<string> {
  const entitySegment = safePathSegment(entityName);
  const dir = path.join(uploadRoot, entityType, entitySegment);
  const timestamp = timestampForPath();

  await mkdir(dir, { recursive: true });

  for (let index = 1; index <= 99; index += 1) {
    const suffix = index === 1 ? '' : `-${index}`;
    const fileName = `${timestamp}${suffix}${extension}`;
    const candidate = path.join(dir, fileName);
    if (!(await fileExists(candidate))) {
      return `${entityType}/${entitySegment}/${fileName}`;
    }
  }

  throw validationError('server.validation.imageUploadFailed');
}

function hasValidImageSignature(mimeType: string, buffer: Buffer): boolean {
  if (mimeType === 'image/png') {
    return buffer.length > 8 && buffer[0] === 0x89 && buffer.subarray(1, 4).toString('ascii') === 'PNG';
  }

  if (mimeType === 'image/jpeg') {
    return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimeType === 'image/webp') {
    return buffer.length > 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }

  if (mimeType === 'image/gif') {
    const signature = buffer.subarray(0, 6).toString('ascii');
    return signature === 'GIF87a' || signature === 'GIF89a';
  }

  return false;
}

function mapUploadRow(row: UploadRow): EntityImageUpload {
  return {
    ...row,
    url: uploadImageUrl(row.path)
  };
}

export async function saveEntityImageUpload(
  entityType: UploadEntityType,
  file: MultipartFile | undefined,
  user: AuthUser
): Promise<EntityImageUpload> {
  if (!file) {
    throw validationError('server.validation.imageUploadRequired');
  }

  const extension = imageMimeTypes.get(file.mimetype);
  if (!extension) {
    throw validationError('server.validation.imageUploadTypeInvalid');
  }

  const entityName = fieldValue(file.fields as Record<string, unknown>, 'entityName');
  if (entityName === '') {
    throw validationError('server.validation.imageUploadEntityNameRequired');
  }

  const buffer = await file.toBuffer();
  if (buffer.length === 0 || buffer.length > imageUploadMaxBytes || !hasValidImageSignature(file.mimetype, buffer)) {
    throw validationError('server.validation.imageUploadContentInvalid');
  }

  const entityId = optionalPositiveInteger(fieldValue(file.fields as Record<string, unknown>, 'entityId'));
  const relativePath = await uniqueRelativePath(entityType, entityName, extension);
  const absolutePath = path.join(uploadRoot, relativePath);
  await writeFile(absolutePath, buffer, { flag: 'wx' });

  const row = await queryOne<UploadRow>(
    `
      INSERT INTO entity_image_uploads (
        entity_type,
        entity_id,
        entity_name,
        path,
        original_filename,
        mime_type,
        byte_size,
        created_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id,
        entity_type AS "entityType",
        entity_id AS "entityId",
        entity_name AS "entityName",
        path,
        original_filename AS "originalFilename",
        mime_type AS "mimeType",
        byte_size AS "byteSize",
        created_at AS "uploadedAt",
        json_build_object('id', $8::integer, 'displayName', $9::text) AS "uploadedBy"
    `,
    [entityType, entityId, entityName.trim(), relativePath, file.filename, file.mimetype, buffer.length, user.id, user.displayName]
  );

  if (!row) {
    throw validationError('server.validation.imageUploadFailed');
  }

  return mapUploadRow(row);
}

export async function listEntityImageUploads(entityType: UploadEntityType, entityId: number): Promise<EntityImageUpload[]> {
  const rows = await query<UploadRow>(
    `
      SELECT
        upload.id,
        upload.entity_type AS "entityType",
        upload.entity_id AS "entityId",
        upload.entity_name AS "entityName",
        upload.path,
        upload.original_filename AS "originalFilename",
        upload.mime_type AS "mimeType",
        upload.byte_size AS "byteSize",
        upload.created_at AS "uploadedAt",
        CASE
          WHEN u.id IS NULL THEN NULL
          ELSE json_build_object('id', u.id, 'displayName', u.display_name)
        END AS "uploadedBy"
      FROM entity_image_uploads upload
      LEFT JOIN users u ON u.id = upload.created_by_user_id
      WHERE upload.entity_type = $1
        AND upload.entity_id = $2
      ORDER BY upload.created_at DESC, upload.id DESC
    `,
    [entityType, entityId]
  );

  return rows.map(mapUploadRow);
}

export async function linkEntityImageUpload(
  client: PoolClient,
  entityType: UploadEntityType,
  entityId: number,
  imagePath: string | null | undefined,
  entityName: string
): Promise<void> {
  if (!isUploadImagePath(imagePath)) {
    return;
  }

  await client.query(
    `
      UPDATE entity_image_uploads
      SET entity_id = $1,
          entity_name = $2
      WHERE entity_type = $3
        AND path = $4
    `,
    [entityId, entityName.trim(), entityType, imagePath]
  );
}
