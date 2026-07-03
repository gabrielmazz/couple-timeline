#!/usr/bin/env node

import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const SUPABASE_BUCKET = 'timeline-photos'
const DEFAULT_R2_BUCKET = 'couple-timeline-images'
const REPORT_DIR = 'migration-reports'
const PAGE_SIZE = 1000
const uuidPattern = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
const imagePathPattern = new RegExp(`^couples\\/(${uuidPattern})\\/events\\/(${uuidPattern})\\/.+$`)

function parseArgs(argv) {
  const options = {
    dryRun: false,
    execute: false,
    verifyOnly: false,
    force: false,
    limit: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (arg === '--execute') {
      options.execute = true
      continue
    }

    if (arg === '--verify-only') {
      options.verifyOnly = true
      continue
    }

    if (arg === '--force') {
      options.force = true
      continue
    }

    if (arg === '--limit') {
      options.limit = Number(argv[index + 1])
      index += 1
      continue
    }

    if (arg.startsWith('--limit=')) {
      options.limit = Number(arg.slice('--limit='.length))
      continue
    }

    throw new Error(`Argumento desconhecido: ${arg}`)
  }

  if (!options.dryRun && !options.execute && !options.verifyOnly) {
    options.dryRun = true
  }

  if ([options.dryRun, options.execute, options.verifyOnly].filter(Boolean).length > 1) {
    throw new Error('Use apenas um modo: --dry-run, --execute ou --verify-only.')
  }

  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit <= 0)) {
    throw new Error('O valor de --limit deve ser um inteiro positivo.')
  }

  return options
}

function getRequiredEnv(name) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`)
  }

  return value
}

function getSupabaseKey() {
  const key = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!key) {
    throw new Error('Informe SUPABASE_SECRET_KEY ou SUPABASE_SERVICE_ROLE_KEY.')
  }

  return key
}

function createSupabaseClient() {
  return createClient(getRequiredEnv('SUPABASE_URL'), getSupabaseKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

function createR2Client() {
  const accountId = getRequiredEnv('R2_ACCOUNT_ID')

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: getRequiredEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: getRequiredEnv('R2_SECRET_ACCESS_KEY'),
    },
  })
}

function getR2Backend() {
  const backend = process.env.R2_BACKEND?.trim() || 's3'

  if (backend !== 's3' && backend !== 'wrangler') {
    throw new Error('R2_BACKEND deve ser "s3" ou "wrangler".')
  }

  return backend
}

function createR2Target() {
  const backend = getR2Backend()
  const bucket = process.env.R2_BUCKET_NAME?.trim() || DEFAULT_R2_BUCKET

  if (backend === 'wrangler') {
    getRequiredEnv('CLOUDFLARE_API_TOKEN')
    getRequiredEnv('CLOUDFLARE_ACCOUNT_ID')

    return { backend, bucket }
  }

  return {
    backend,
    bucket,
    client: createR2Client(),
  }
}

function isNotFoundError(error) {
  const statusCode = error?.$metadata?.httpStatusCode
  const name = error?.name

  return statusCode === 404 || name === 'NotFound' || name === 'NoSuchKey'
}

function validateStoragePath(storagePath) {
  if (
    typeof storagePath !== 'string' ||
    storagePath.length === 0 ||
    storagePath.length > 1024 ||
    storagePath.startsWith('/') ||
    storagePath.includes('\\') ||
    storagePath.includes('\0') ||
    storagePath.includes('//') ||
    storagePath.split('/').includes('..') ||
    !imagePathPattern.test(storagePath)
  ) {
    return false
  }

  return true
}

async function fetchAllRows(supabase, table, columns) {
  const rows = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      throw error
    }

    rows.push(...(data ?? []))

    if (!data || data.length < PAGE_SIZE) {
      break
    }
  }

  return rows
}

async function loadStoragePaths(supabase) {
  const [photoRows, eventRows] = await Promise.all([
    fetchAllRows(supabase, 'timeline_photos', 'storage_path'),
    fetchAllRows(supabase, 'timeline_events', 'cover_photo_path'),
  ])
  const paths = new Set()

  for (const row of photoRows) {
    if (row.storage_path) {
      paths.add(row.storage_path)
    }
  }

  for (const row of eventRows) {
    if (row.cover_photo_path) {
      paths.add(row.cover_photo_path)
    }
  }

  return Array.from(paths).sort()
}

function runWranglerR2(args) {
  return spawnSync('npx', ['wrangler', 'r2', 'object', ...args], {
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 1024 * 1024 * 100,
  })
}

async function headWranglerR2Object(bucket, key) {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'couple-timeline-r2-check-'))
  const tmpFile = path.join(tmpDir, 'object')

  try {
    const result = runWranglerR2(['get', `${bucket}/${key}`, '--remote', '--file', tmpFile])

    if (result.status !== 0) {
      const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`

      if (/authentication failed|invalid request headers|invalid format for authorization header|code:\s*9106|code:\s*6111/i.test(output)) {
        throw new Error(output.trim() || `wrangler r2 object get falhou por autenticação para ${key}`)
      }

      if (/not found|NoSuchKey|404|object not found|specified key does not exist/i.test(output)) {
        return { exists: false }
      }

      throw new Error(output.trim() || `wrangler r2 object get falhou para ${key}`)
    }

    const fileStat = await stat(tmpFile)

    return {
      exists: true,
      contentLength: fileStat.size,
      contentType: null,
      etag: null,
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}

async function headR2Object(r2Target, key) {
  if (r2Target.backend === 'wrangler') {
    return headWranglerR2Object(r2Target.bucket, key)
  }

  try {
    const object = await r2Target.client.send(new HeadObjectCommand({ Bucket: r2Target.bucket, Key: key }))

    return {
      exists: true,
      contentLength: object.ContentLength ?? null,
      contentType: object.ContentType ?? null,
      etag: object.ETag ?? null,
    }
  } catch (error) {
    if (isNotFoundError(error)) {
      return { exists: false }
    }

    throw error
  }
}

async function downloadSupabaseObject(supabase, key) {
  const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).download(key)

  if (error) {
    return {
      ok: false,
      message: error.message,
    }
  }

  const arrayBuffer = await data.arrayBuffer()

  return {
    ok: true,
    body: new Uint8Array(arrayBuffer),
    size: data.size,
    contentType: data.type || 'application/octet-stream',
  }
}

async function uploadWranglerR2Object(bucket, key, source) {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'couple-timeline-r2-upload-'))
  const tmpFile = path.join(tmpDir, 'object')

  try {
    await writeFile(tmpFile, source.body)
    const result = runWranglerR2([
      'put',
      `${bucket}/${key}`,
      '--remote',
      '--file',
      tmpFile,
      '--content-type',
      source.contentType,
      '--cache-control',
      'private, max-age=3600',
      '--force',
    ])

    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim()

    if (result.status !== 0) {
      throw new Error(output || `wrangler r2 object put falhou para ${key}`)
    }

    return output
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}

async function uploadR2Object(r2Target, key, source) {
  if (r2Target.backend === 'wrangler') {
    return uploadWranglerR2Object(r2Target.bucket, key, source)
  }

  await r2Target.client.send(
    new PutObjectCommand({
      Bucket: r2Target.bucket,
      Key: key,
      Body: source.body,
      ContentType: source.contentType,
      CacheControl: 'private, max-age=3600',
      Metadata: {
        migratedFrom: 'supabase-storage',
        supabaseBucket: SUPABASE_BUCKET,
      },
    }),
  )

  return null
}

function createReport(mode, options, totalDiscovered) {
  const r2Backend = getR2Backend()

  return {
    mode,
    options: {
      limit: options.limit,
      force: options.force,
    },
    startedAt: new Date().toISOString(),
    finishedAt: null,
    source: {
      supabaseBucket: SUPABASE_BUCKET,
      r2Bucket: process.env.R2_BUCKET_NAME?.trim() || DEFAULT_R2_BUCKET,
      r2Backend,
    },
    totalDiscovered,
    totalSelected: 0,
    pending: [],
    uploaded: [],
    skipped: [],
    verified: [],
    missing: [],
    invalid: [],
    failed: [],
  }
}

async function writeReport(report) {
  report.finishedAt = new Date().toISOString()
  await mkdir(REPORT_DIR, { recursive: true })

  const stamp = report.finishedAt.replace(/[:.]/g, '-')
  const reportPath = path.join(REPORT_DIR, `r2-image-migration-${stamp}.json`)

  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  return reportPath
}

async function processDryRun({ r2Target, storagePath, report }) {
  const r2Head = await headR2Object(r2Target, storagePath)

  if (r2Head.exists) {
    report.skipped.push({
      path: storagePath,
      reason: 'already-exists-in-r2',
      r2Size: r2Head.contentLength,
    })
    return
  }

  report.pending.push({
    path: storagePath,
    reason: 'would-upload',
  })
}

async function processVerifyOnly({ supabase, r2Target, storagePath, report }) {
  const source = await downloadSupabaseObject(supabase, storagePath)

  if (!source.ok) {
    report.missing.push({
      path: storagePath,
      source: 'supabase',
      message: source.message,
    })
    return
  }

  const r2Head = await headR2Object(r2Target, storagePath)

  if (!r2Head.exists) {
    report.missing.push({
      path: storagePath,
      source: 'r2',
    })
    return
  }

  if (r2Head.contentLength !== source.size) {
    report.failed.push({
      path: storagePath,
      reason: 'size-mismatch',
      supabaseSize: source.size,
      r2Size: r2Head.contentLength,
    })
    return
  }

  report.verified.push({
    path: storagePath,
    size: source.size,
  })
}

async function processExecute({ supabase, r2Target, storagePath, report, force }) {
  const currentObject = await headR2Object(r2Target, storagePath)

  if (currentObject.exists && !force) {
    report.skipped.push({
      path: storagePath,
      reason: 'already-exists-in-r2',
      r2Size: currentObject.contentLength,
    })
    return
  }

  const source = await downloadSupabaseObject(supabase, storagePath)

  if (!source.ok) {
    report.missing.push({
      path: storagePath,
      source: 'supabase',
      message: source.message,
    })
    return
  }

  const uploadOutput = await uploadR2Object(r2Target, storagePath, source)

  const uploadedObject = await headR2Object(r2Target, storagePath)

  if (!uploadedObject.exists || uploadedObject.contentLength !== source.size) {
    report.failed.push({
      path: storagePath,
      reason: 'post-upload-verification-failed',
      supabaseSize: source.size,
      r2Size: uploadedObject.contentLength ?? null,
      uploadOutput,
    })
    return
  }

  report.uploaded.push({
    path: storagePath,
    size: source.size,
    contentType: source.contentType,
  })
}

function shouldExitWithFailure(report) {
  return report.invalid.length > 0 || report.missing.length > 0 || report.failed.length > 0
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const mode = options.execute ? 'execute' : options.verifyOnly ? 'verify-only' : 'dry-run'
  const supabase = createSupabaseClient()
  const r2Target = createR2Target()
  const allPaths = await loadStoragePaths(supabase)
  const selectedPaths = options.limit ? allPaths.slice(0, options.limit) : allPaths
  const report = createReport(mode, options, allPaths.length)
  report.totalSelected = selectedPaths.length

  console.log(`Modo: ${mode}`)
  console.log(`Paths encontrados: ${allPaths.length}`)
  console.log(`Paths selecionados: ${selectedPaths.length}`)
  console.log(`Bucket R2: ${r2Target.bucket}`)
  console.log(`Backend R2: ${r2Target.backend}`)

  for (const [index, storagePath] of selectedPaths.entries()) {
    const prefix = `[${index + 1}/${selectedPaths.length}]`

    if (!validateStoragePath(storagePath)) {
      console.warn(`${prefix} Path inválido: ${storagePath}`)
      report.invalid.push({ path: storagePath })
      continue
    }

    try {
      if (mode === 'dry-run') {
        await processDryRun({ r2Target, storagePath, report })
      } else if (mode === 'verify-only') {
        await processVerifyOnly({ supabase, r2Target, storagePath, report })
      } else {
        await processExecute({ supabase, r2Target, storagePath, report, force: options.force })
      }

      const latestFailure = report.failed.at(-1)
      const latestMissing = report.missing.at(-1)
      const latestInvalid = report.invalid.at(-1)

      if (latestFailure?.path === storagePath || latestMissing?.path === storagePath || latestInvalid?.path === storagePath) {
        console.warn(`${prefix} Falhou validação ${storagePath}`)
      } else {
        console.log(`${prefix} OK ${storagePath}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`${prefix} Falhou ${storagePath}: ${message}`)
      report.failed.push({ path: storagePath, message })
    }
  }

  const reportPath = await writeReport(report)
  console.log(`Relatório salvo em ${reportPath}`)
  console.log(
    JSON.stringify(
      {
        pending: report.pending.length,
        uploaded: report.uploaded.length,
        skipped: report.skipped.length,
        verified: report.verified.length,
        missing: report.missing.length,
        invalid: report.invalid.length,
        failed: report.failed.length,
      },
      null,
      2,
    ),
  )

  if (shouldExitWithFailure(report)) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
