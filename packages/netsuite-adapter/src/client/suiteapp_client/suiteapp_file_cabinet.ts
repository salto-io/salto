/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Element,
  Change,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isStaticFile,
  StaticFile,
  isAdditionChange,
  isModificationChange,
  ElemID,
  SaltoElementError,
} from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { chunks, promises, regex } from '@salto-io/lowerdash'
import Ajv from 'ajv'
import _ from 'lodash'
import path from 'path'
import {
  ReadFileEncodingError,
  ReadFileInsufficientPermissionError,
  RetryableError,
  retryOnRetryableError,
} from './errors'
import SuiteAppClient from './suiteapp_client'
import { ExistingFileCabinetInstanceDetails, FileCabinetInstanceDetails } from './types'
import {
  FileCabinetCustomizationInfo,
  FileCustomizationInfo,
  FolderCustomizationInfo,
  ImportFileCabinetResult,
  LargeFilesCountFolderWarning,
} from '../types'
import { FILE_CABINET_PATH_SEPARATOR, INTERNAL_ID, PARENT, PATH } from '../../constants'
import { FileCabinetDeployGroup } from '../../group_changes'
import { NetsuiteQuery } from '../../config/query'
import { isFileCabinetType, isFileInstance } from '../../types'
import { filterFilePathsInFolders, filterFolderPathsInFolders, largeFoldersToExclude } from '../file_cabinet_utils'
import { getDeployResultFromSuiteAppResult, toElementError, toError } from '../utils'
import { SoapDeployResult } from './soap_client/types'
import { MaxFilesPerFileCabinetFolder } from '../../config/types'
import { DEFAULT_MAX_FILES_PER_FOLDER_VALUE } from '../../config/constants'

const log = logger(module)

type DeployType = 'add' | 'update' | 'delete'

const FILE_CABINET_DEPLOY_GROUPS: Record<FileCabinetDeployGroup, DeployType> = {
  'Salto SuiteApp - File Cabinet - Creating Files': 'add',
  'Salto SuiteApp - File Cabinet - Updating Files': 'update',
  'Salto SuiteApp - File Cabinet - Deleting Files': 'delete',
}

type WithPath = Record<typeof PATH, string>
type WithInternalId = Record<typeof INTERNAL_ID, string>
type WithParent = Partial<Record<typeof PARENT, string>>
type FileCabinetInstance = Element &
  Omit<InstanceElement, 'value'> & {
    value: WithPath &
      WithInternalId &
      WithParent & {
        bundleable?: boolean
        isinactive?: boolean
        description?: string
        availablewithoutlogin?: boolean
        hideinbundle?: boolean
        link?: string
        content?: StaticFile | string
        isprivate?: boolean
      }
  }

type FileCabinetDeployResult = {
  appliedChanges: Change<FileCabinetInstance>[]
  errors: SaltoElementError[]
  elemIdToInternalId: Record<string, string>
}
type DeployFunction = (
  suiteAppClient: SuiteAppClient,
  changes: ReadonlyArray<Change<FileCabinetInstance>>,
) => Promise<FileCabinetDeployResult>

const FOLDERS_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      id: { type: 'string' },
      bundleable: { type: 'string', enum: ['T', 'F'] },
      isinactive: { type: 'string', enum: ['T', 'F'] },
      isprivate: { type: 'string', enum: ['T', 'F'] },
      description: { type: 'string' },
      parent: { type: 'string' },
    },
    required: ['name', 'id', 'isinactive', 'isprivate'],
  },
}

type FolderResult = {
  name: string
  id: string
  bundleable?: 'T' | 'F'
  isinactive: 'T' | 'F'
  isprivate: 'T' | 'F'
  description?: string
  parent?: string
}

const FILES_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      id: { type: 'string' },
      filesize: { type: 'string' },
      bundleable: { type: 'string', enum: ['T', 'F'] },
      isinactive: { type: 'string', enum: ['T', 'F'] },
      isonline: { type: 'string', enum: ['T', 'F'] },
      addtimestamptourl: { type: 'string', enum: ['T', 'F'] },
      hideinbundle: { type: 'string', enum: ['T', 'F'] },
      description: { type: 'string' },
      folder: { type: 'string' },
      islink: { type: 'string', enum: ['T', 'F'] },
      url: { type: 'string' },
    },
    required: ['name', 'id', 'filesize', 'isinactive', 'isonline', 'addtimestamptourl', 'folder'],
  },
}

const FILES_COUNT_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      folder: { type: 'string' },
      count: { type: 'string' },
    },
    required: ['folder', 'count'],
  },
}

type FileResult = {
  name: string
  id: string
  filesize: string
  bundleable?: 'T' | 'F'
  isinactive: 'T' | 'F'
  isonline: 'T' | 'F'
  addtimestamptourl: 'T' | 'F'
  hideinbundle?: 'T' | 'F'
  description?: string
  islink: 'T' | 'F'
  url: string
  folder: string
}

type FileCustomizationInfoWithoutContent = { size: number; id: string } & Omit<FileCustomizationInfo, 'fileContent'>

type FilesCountResult = {
  folder: string
  count: string
}

type ExtendedFolderResult = FolderResult & { path: string[] }
type ExtendedFileResult = FileResult & { path: string[] }

type FileCabinetResults = {
  filesResults: ExtendedFileResult[]
  foldersResults: ExtendedFolderResult[]
  largeFilesCountFoldersError: string[]
  largeFilesCountFolderWarnings: LargeFilesCountFolderWarning[]
}

type FilesQueryParams = {
  folderIdsToQuery: string[]
  isSuiteBundlesEnabled: boolean
  extensionsToExclude: string[]
}

export type ImportFileCabinetParams = {
  query: NetsuiteQuery
  maxFileCabinetSizeInGB: number
  extensionsToExclude: string[]
  maxFilesPerFileCabinetFolder: MaxFilesPerFileCabinetFolder[]
}

const FILES_CHUNK_SIZE = 5 * 1024 * 1024
const MAX_FILES_IN_READ_REQUEST = 10000
const MAX_DEPLOYABLE_FILE_SIZE = 10 * 1024 * 1024
const DEPLOY_CHUNK_SIZE = 50
const MAX_ITEMS_IN_WHERE_QUERY = 200
const MAX_FILES_PER_FOLDER_WARNING_THRESHOLD = 0.9
const BUNDLEABLE = ', bundleable'
export const SUITEBUNDLES_DISABLED_ERROR =
  'Failed to list folders. Please verify that the "Create bundles with SuiteBundler" feature is enabled in the account.'

export const THROW_ON_MISSING_FEATURE_ERROR: Record<string, string> = {
  "Unknown identifier 'bundleable'": SUITEBUNDLES_DISABLED_ERROR,
}

export const getContent = async (content: unknown): Promise<Buffer> => {
  if (isStaticFile(content)) {
    const buffer = await content.getContent()
    if (buffer === undefined) {
      log.warn('Static file content is undefined')
      return Buffer.from('')
    }
    return buffer
  }
  if (typeof content === 'string') {
    return Buffer.from(content)
  }
  if (content === undefined) {
    return Buffer.from('')
  }
  throw new Error(`Got invalid content value: ${safeJsonStringify(content, undefined, 2)}`)
}

export const isTooBigFileForSuiteApp = async (change: Change<InstanceElement>): Promise<boolean> =>
  isAdditionOrModificationChange(change) &&
  isFileInstance(getChangeData(change)) &&
  (await getContent(getChangeData(change).value.content)).toString('base64').length > MAX_DEPLOYABLE_FILE_SIZE

// SuiteApp can't change generateurltimestamp.
export const hasDisallowedValueModification = (change: Change<InstanceElement>): boolean => {
  if (isAdditionChange(change) && change.data.after.value.generateurltimestamp === true) {
    return true
  }
  return (
    isModificationChange(change) &&
    change.data.before.value.generateurltimestamp !== change.data.after.value.generateurltimestamp
  )
}

export const isChangeDeployable = async (change: Change): Promise<boolean> => {
  if (!isInstanceChange(change)) {
    return false
  }
  const changedInstance = getChangeData(change)
  if (!isFileCabinetType(changedInstance.refType)) {
    return false
  }

  // SuiteApp can't modify files bigger than 10mb
  if (await isTooBigFileForSuiteApp(change)) {
    return false
  }

  return !hasDisallowedValueModification(change)
}

const groupChangesByDepth = (
  changes: ReadonlyArray<Change<FileCabinetInstance>>,
): [string, Change<FileCabinetInstance>[]][] =>
  _(changes)
    .groupBy(change => getChangeData(change).value.path.split(FILE_CABINET_PATH_SEPARATOR).length)
    .entries()
    .sortBy(([depth]) => depth)
    .value()

function assertFoldersResults(
  foldersResults: Record<string, unknown>[] | undefined,
): asserts foldersResults is FolderResult[] {
  if (foldersResults === undefined) {
    throw new RetryableError(new Error('Failed to list folders'))
  }

  const ajv = new Ajv({ allErrors: true, strict: false })
  if (!ajv.validate<FolderResult[]>(FOLDERS_SCHEMA, foldersResults)) {
    log.error('Got invalid results from listing folders - %s: %o', ajv.errorsText(), foldersResults)
    throw new RetryableError(new Error('Failed to list folders'))
  }
}

const queryFolders = (
  suiteAppClient: SuiteAppClient,
  whereQuery: string,
  isSuiteBundlesEnabled = true,
): Promise<{ results: FolderResult[]; isSuiteBundlesEnabled: boolean }> =>
  retryOnRetryableError(async () => {
    const foldersQuery = {
      select: `id, name${isSuiteBundlesEnabled ? BUNDLEABLE : ''}, isinactive, isprivate, description, parent`,
      from: 'mediaitemfolder',
      where: whereQuery,
      orderBy: 'id',
    }
    try {
      const results = await suiteAppClient.runSuiteQL(foldersQuery, THROW_ON_MISSING_FEATURE_ERROR)
      assertFoldersResults(results)
      return { results, isSuiteBundlesEnabled: true }
    } catch (e) {
      if (toError(e).message === SUITEBUNDLES_DISABLED_ERROR && isSuiteBundlesEnabled) {
        log.debug("SuiteBundles not enabled in the account, removing 'bundleable' from query")
        const noBundleableQuery = { ...foldersQuery, select: foldersQuery.select.replace(BUNDLEABLE, '') }
        const results = await suiteAppClient.runSuiteQL(noBundleableQuery, THROW_ON_MISSING_FEATURE_ERROR)
        assertFoldersResults(results)
        return { results, isSuiteBundlesEnabled: false }
      }
      throw e
    }
  })

const queryTopLevelFolders = async (
  suiteAppClient: SuiteAppClient,
): Promise<{ results: FolderResult[]; isSuiteBundlesEnabled: boolean }> =>
  queryFolders(suiteAppClient, "istoplevel = 'T'")

const querySubFolders = async (
  suiteAppClient: SuiteAppClient,
  topLevelFolders: FolderResult[],
  isSuiteBundlesEnabled: boolean,
): Promise<FolderResult[]> => {
  const whereQuery = `istoplevel = 'F' AND (${topLevelFolders.map(folder => `appfolder LIKE '${folder.name}%'`).join(' OR ')})`
  const { results } = await queryFolders(suiteAppClient, whereQuery, isSuiteBundlesEnabled)
  return results
}

const getFilesWhereQueries = ({
  folderIdsToQuery,
  isSuiteBundlesEnabled,
  extensionsToExclude,
}: FilesQueryParams): string[] => {
  const whereNotHideInBundle = isSuiteBundlesEnabled ? "hideinbundle = 'F' AND " : ''
  const whereNotExtension = extensionsToExclude.map(reg => `NOT REGEXP_LIKE(name, '${reg}') AND `).join('')
  const whereQueries = _.chunk(folderIdsToQuery, MAX_ITEMS_IN_WHERE_QUERY).map(
    foldersToQueryChunk => `${whereNotExtension}${whereNotHideInBundle}folder IN (${foldersToQueryChunk.join(', ')})`,
  )
  return whereQueries
}

const queryFiles = (suiteAppClient: SuiteAppClient, params: FilesQueryParams): Promise<FileResult[]> =>
  retryOnRetryableError(async () => {
    const whereQueries = getFilesWhereQueries(params)
    const results = await Promise.all(
      whereQueries.map(async whereQuery => {
        const filesResults = await suiteAppClient.runSuiteQL({
          select: `id, name, filesize, isinactive, isonline, addtimestamptourl, description, folder, islink, url${params.isSuiteBundlesEnabled ? ', bundleable, hideinbundle' : ''}`,
          from: 'file',
          where: whereQuery,
          orderBy: 'id',
        })

        if (filesResults === undefined) {
          throw new RetryableError(new Error('Failed to list files'))
        }

        const ajv = new Ajv({ allErrors: true, strict: false })
        if (!ajv.validate<FileResult[]>(FILES_SCHEMA, filesResults)) {
          log.error('Got invalid results from listing files - %s: %o', ajv.errorsText(), filesResults)
          throw new RetryableError(new Error('Failed to list files'))
        }
        return filesResults
      }),
    )

    return results.flat()
  })

const queryFilesCountPerFolder = (
  suiteAppClient: SuiteAppClient,
  params: FilesQueryParams,
): Promise<Record<string, number>> =>
  retryOnRetryableError(async () => {
    const whereQueries = getFilesWhereQueries(params)
    const results = await Promise.all(
      whereQueries.map(async whereQuery => {
        const filesCountResults = await suiteAppClient.runSuiteQL({
          select: 'folder, count(*) as count',
          from: 'file',
          where: whereQuery,
          orderBy: 'folder',
          groupBy: 'folder',
        })

        if (filesCountResults === undefined) {
          throw new RetryableError(new Error('Failed to list files'))
        }

        const ajv = new Ajv({ allErrors: true, strict: false })
        if (!ajv.validate<FilesCountResult[]>(FILES_COUNT_SCHEMA, filesCountResults)) {
          log.error('Got invalid results from files count query - %s: %o', ajv.errorsText(), filesCountResults)
          throw new RetryableError(new Error('Failed to list files'))
        }
        return filesCountResults
      }),
    )

    return Object.fromEntries(results.flat().map(({ folder, count }) => [folder, parseInt(count, 10)]))
  })

const removeResultsWithoutParentFolder = (foldersResults: FolderResult[]): FolderResult[] => {
  const folderIdsSet = new Set(foldersResults.map(folder => folder.id))
  const removeFoldersWithoutParentFolder = (folders: FolderResult[]): FolderResult[] => {
    const filteredFolders = folders.filter(folder => {
      if (folder.parent !== undefined && !folderIdsSet.has(folder.parent)) {
        log.warn("folder's parent does not exist: %o", folder)
        folderIdsSet.delete(folder.id)
        return false
      }
      return true
    })
    if (folders.length === filteredFolders.length) {
      return folders
    }
    return removeFoldersWithoutParentFolder(filteredFolders)
  }
  return removeFoldersWithoutParentFolder(foldersResults)
}

const removeFilesWithoutParentFolder = (
  filesResults: FileResult[],
  foldersResults: ExtendedFolderResult[],
): FileResult[] => {
  const folderIdsSet = new Set(foldersResults.map(folder => folder.id))
  return filesResults.filter(file => {
    if (!folderIdsSet.has(file.folder)) {
      log.warn("file's folder does not exist: %o", file)
      return false
    }
    return true
  })
}

const fullPathParts = (folder: FolderResult, idToFolder: Record<string, FolderResult>): string[] => {
  if (folder.parent === undefined) {
    return [folder.name]
  }
  if (idToFolder[folder.parent] === undefined) {
    log.error("folder's parent is unknown\nfolder: %o\nidToFolder: %o", folder, idToFolder)
    throw new Error(`Failed to get absolute folder path of ${folder.name}`)
  }
  return [...fullPathParts(idToFolder[folder.parent], idToFolder), folder.name]
}

const fullPath = (fileParts: string[]): string =>
  `${FILE_CABINET_PATH_SEPARATOR}${fileParts.join(FILE_CABINET_PATH_SEPARATOR)}`

const toFoldersWithPaths = ({
  queriedFolders,
  idToFolder,
}: {
  queriedFolders: FolderResult[]
  idToFolder: Record<string, FolderResult>
}): ExtendedFolderResult[] => {
  const foldersWithParent = removeResultsWithoutParentFolder(queriedFolders)
  return foldersWithParent.map(folder => ({ path: fullPathParts(folder, idToFolder), ...folder }))
}

const filterFoldersByPath = ({
  foldersWithPath,
  query,
}: {
  foldersWithPath: ExtendedFolderResult[]
  query: NetsuiteQuery
}): ExtendedFolderResult[] => {
  const [foldersToInclude, removedFolders] = _.partition(foldersWithPath, folder =>
    query.isFileMatch(`${fullPath(folder.path)}${FILE_CABINET_PATH_SEPARATOR}`),
  )
  if (removedFolders.length > 0) {
    log.debug(
      'removed the following %d folders before querying files counts: %o',
      removedFolders.length,
      removedFolders.map(folder => folder.path),
    )
  }
  return foldersToInclude
}

const getFolderMaxFilesPerFolderInfo = ({
  folder,
  filesCountsPerFolder,
  maxFilesPerFileCabinetFolder,
  level,
}: {
  folder: ExtendedFolderResult
  filesCountsPerFolder: Record<string, number>
  maxFilesPerFileCabinetFolder: MaxFilesPerFileCabinetFolder[]
  level: 'error' | 'warn'
}): LargeFilesCountFolderWarning | undefined => {
  const folderPath = fullPath(folder.path)
  const filesInFolder = filesCountsPerFolder[folder.id] ?? 0

  const limit = maxFilesPerFileCabinetFolder
    .filter(row => regex.isFullRegexMatch(folderPath, row.folderPath))
    .map(row => row.limit)
    .reduce((max, next) => Math.max(max, next), DEFAULT_MAX_FILES_PER_FOLDER_VALUE)

  const maxFilesCountAllowedByLevel = {
    error: limit,
    warn: limit * MAX_FILES_PER_FOLDER_WARNING_THRESHOLD,
  }

  if (filesInFolder > maxFilesCountAllowedByLevel[level]) {
    return { folderPath, limit, current: filesInFolder }
  }

  return undefined
}

const filterFoldersByFilesCount = ({
  filesCountsPerFolder,
  foldersToIncludeByPath,
  maxFilesPerFileCabinetFolder,
}: {
  foldersToIncludeByPath: ExtendedFolderResult[]
  filesCountsPerFolder: Record<string, number>
  maxFilesPerFileCabinetFolder: MaxFilesPerFileCabinetFolder[]
}): {
  foldersResults: ExtendedFolderResult[]
  largeFilesCountFoldersError: string[]
  largeFilesCountFolderWarnings: LargeFilesCountFolderWarning[]
} => {
  const [foldersToInclude, removedFolders] = _.partition(
    foldersToIncludeByPath,
    folder =>
      getFolderMaxFilesPerFolderInfo({
        folder,
        filesCountsPerFolder,
        maxFilesPerFileCabinetFolder,
        level: 'error',
      }) === undefined,
  )

  const largeFilesCountFoldersError = removedFolders.map(
    folder => `${fullPath(folder.path)}${FILE_CABINET_PATH_SEPARATOR}`,
  )
  const foldersResults = filterFolderPathsInFolders(foldersToInclude, largeFilesCountFoldersError)
  const largeFilesCountFolderWarnings = foldersResults.flatMap(
    folder =>
      getFolderMaxFilesPerFolderInfo({
        folder,
        filesCountsPerFolder,
        maxFilesPerFileCabinetFolder,
        level: 'warn',
      }) ?? [],
  )

  return { foldersResults, largeFilesCountFoldersError, largeFilesCountFolderWarnings }
}

const filterFoldersBySize = (
  unfilteredFilesCustomizationInfos: FileCustomizationInfoWithoutContent[],
  unfilteredFoldersCustomizationInfo: FolderCustomizationInfo[],
  { maxFileCabinetSizeInGB }: ImportFileCabinetParams,
): {
  foldersCustomizationInfos: FolderCustomizationInfo[]
  filesWithoutContent: FileCustomizationInfoWithoutContent[]
  largeSizeFoldersError: string[]
} => {
  const filesSize = unfilteredFilesCustomizationInfos.map(file => ({
    path: fullPath(file.path),
    size: file.size,
  }))
  const largeSizeFoldersError = largeFoldersToExclude(filesSize, maxFileCabinetSizeInGB)
  const filesWithoutContent = filterFilePathsInFolders(unfilteredFilesCustomizationInfos, largeSizeFoldersError)
  const foldersCustomizationInfos = filterFolderPathsInFolders(
    unfilteredFoldersCustomizationInfo,
    largeSizeFoldersError,
  )
  return { filesWithoutContent, foldersCustomizationInfos, largeSizeFoldersError }
}

const toFilesWithPaths = ({
  queriedFiles,
  foldersResults,
  idToFolder,
}: {
  queriedFiles: FileResult[]
  foldersResults: ExtendedFolderResult[]
  idToFolder: Record<string, FolderResult>
}): ExtendedFileResult[] => {
  const filesWithParent = removeFilesWithoutParentFolder(queriedFiles, foldersResults)
  return filesWithParent.map(file => ({
    path: [...fullPathParts(idToFolder[file.folder], idToFolder), file.name],
    ...file,
  }))
}

const filterFilesByPath = ({
  filesWithPath,
  query,
}: {
  filesWithPath: ExtendedFileResult[]
  query: NetsuiteQuery
}): ExtendedFileResult[] => filesWithPath.filter(file => query.isFileMatch(fullPath(file.path)))

const queryFileCabinet = async (
  suiteAppClient: SuiteAppClient,
  { query, extensionsToExclude, maxFilesPerFileCabinetFolder }: ImportFileCabinetParams,
): Promise<FileCabinetResults> => {
  const { results: topLevelFolders, isSuiteBundlesEnabled } = await queryTopLevelFolders(suiteAppClient)
  const topLevelFoldersResults = topLevelFolders.filter(folder => query.isParentFolderMatch(`/${folder.name}`))

  if (topLevelFoldersResults.length === 0) {
    log.warn("No top level folder matched the adapter's query. returning empty result")
    return {
      foldersResults: [],
      filesResults: [],
      largeFilesCountFoldersError: [],
      largeFilesCountFolderWarnings: [],
    }
  }
  log.debug(
    'the following top level folders have been queried: %o',
    topLevelFoldersResults.map(folder => folder.name),
  )

  const subFoldersResults = await querySubFolders(suiteAppClient, topLevelFoldersResults, isSuiteBundlesEnabled)
  const queriedFolders = topLevelFoldersResults.concat(subFoldersResults)
  const idToFolder = _.keyBy(queriedFolders, folder => folder.id)

  const foldersWithPath = toFoldersWithPaths({ queriedFolders, idToFolder })
  const foldersToIncludeByPath = filterFoldersByPath({ foldersWithPath, query })
  if (foldersToIncludeByPath.length === 0) {
    return {
      filesResults: [],
      foldersResults: [],
      largeFilesCountFoldersError: [],
      largeFilesCountFolderWarnings: [],
    }
  }

  const filesCountsPerFolder = await queryFilesCountPerFolder(suiteAppClient, {
    folderIdsToQuery: foldersToIncludeByPath.map(folder => folder.id),
    isSuiteBundlesEnabled,
    extensionsToExclude,
  })

  const { foldersResults, largeFilesCountFoldersError, largeFilesCountFolderWarnings } = filterFoldersByFilesCount({
    filesCountsPerFolder,
    foldersToIncludeByPath,
    maxFilesPerFileCabinetFolder,
  })

  if (foldersResults.length === 0) {
    return {
      filesResults: [],
      foldersResults: [],
      largeFilesCountFoldersError,
      largeFilesCountFolderWarnings,
    }
  }

  const queriedFiles = await queryFiles(suiteAppClient, {
    folderIdsToQuery: foldersResults.map(folder => folder.id),
    isSuiteBundlesEnabled,
    extensionsToExclude,
  })

  const filesWithPath = toFilesWithPaths({ queriedFiles, foldersResults, idToFolder })
  const filesResults = filterFilesByPath({ filesWithPath, query })

  return {
    filesResults,
    foldersResults,
    largeFilesCountFoldersError,
    largeFilesCountFolderWarnings,
  }
}

const queryFilesContent = async (
  suiteAppClient: SuiteAppClient,
  filesWithoutContent: FileCustomizationInfoWithoutContent[],
): Promise<{
  filesCustomizationInfos: FileCustomizationInfo[]
  otherError: string[]
  lockedError: string[]
}> => {
  const fileChunks = chunks.weightedChunks(
    filesWithoutContent,
    FILES_CHUNK_SIZE,
    file => file.size,
    MAX_FILES_IN_READ_REQUEST,
  )

  const contents = await Promise.all(
    fileChunks.map(async (fileChunk, i) => {
      if (fileChunk[0].size > FILES_CHUNK_SIZE) {
        const id = parseInt(fileChunk[0].id, 10)
        log.debug(`File with id ${id} is too big to fetch via Restlet (${fileChunk[0].size}), using SOAP API`)
        return suiteAppClient.readLargeFile(id)
      }

      const results = await retryOnRetryableError(async () => {
        const res = await suiteAppClient.readFiles(fileChunk.map(f => parseInt(f.id, 10)))
        if (res === undefined) {
          throw new RetryableError(new Error('Request for reading files from the file cabinet failed'))
        }
        return res
      })

      log.debug(`Finished Reading files chunk ${i + 1}/${fileChunks.length} with ${fileChunk.length} files`)

      return Promise.all(
        results.map(async (content, index) => {
          if (content instanceof ReadFileEncodingError) {
            const id = parseInt(fileChunk[index].id, 10)
            log.debug(`Received file encoding error for id ${id}. Fallback to SOAP request`)
            return suiteAppClient.readLargeFile(id)
          }
          return content
        }),
      )
    }),
  )

  const filesContent: (Buffer | Error)[] = contents.flat()

  const otherError: string[] = []
  const lockedError: string[] = []

  const filesCustomizationInfos = filesWithoutContent.flatMap((file, index) => {
    const fileContent = filesContent[index]
    if (fileContent instanceof Buffer) {
      return {
        path: file.path,
        typeName: 'file' as const,
        fileContent,
        values: file.values,
      }
    }
    log.warn(`Failed reading file ${fullPath(file.path)} with id ${file.id}`)
    if (fileContent instanceof ReadFileInsufficientPermissionError) {
      lockedError.push(fullPath(file.path))
    } else {
      otherError.push(fullPath(file.path))
    }
    return []
  })

  return { filesCustomizationInfos, otherError, lockedError }
}

export const importFileCabinet = async (
  suiteAppClient: SuiteAppClient,
  params: ImportFileCabinetParams,
): Promise<ImportFileCabinetResult> => {
  if (!params.query.areSomeFilesMatch()) {
    return {
      elements: [],
      failedPaths: {
        lockedError: [],
        otherError: [],
        largeSizeFoldersError: [],
        largeFilesCountFoldersError: [],
      },
      largeFilesCountFolderWarnings: [],
    }
  }

  const { foldersResults, filesResults, largeFilesCountFoldersError, largeFilesCountFolderWarnings } =
    await queryFileCabinet(suiteAppClient, params)

  const unfilteredFoldersCustomizationInfo = foldersResults.map(folder => ({
    path: folder.path,
    typeName: 'folder' as const,
    values: {
      description: folder.description ?? '',
      bundleable: folder.bundleable ?? 'F',
      isinactive: folder.isinactive,
      isprivate: folder.isprivate,
      internalId: folder.id,
    },
  }))

  const filesCustomizations = filesResults.map(file => ({
    path: file.path,
    typeName: 'file' as const,
    values: {
      description: file.description ?? '',
      bundleable: file.bundleable ?? 'F',
      isinactive: file.isinactive,
      availablewithoutlogin: file.isonline,
      generateurltimestamp: file.addtimestamptourl,
      hideinbundle: file.hideinbundle ?? 'F',
      internalId: file.id,
      ...(file.islink === 'T' ? { link: file.url } : {}),
    },
    id: file.id,
    size: parseInt(file.filesize, 10),
  }))

  const [unfilteredFilesCustomizationWithoutContent, linksCustomlizations] = _.partition(
    filesCustomizations,
    file => file.values.link === undefined,
  )

  const linksCustomizationInfos = linksCustomlizations.map(file => ({
    path: file.path,
    typeName: 'file' as const,
    values: file.values,
  }))

  const { filesWithoutContent, foldersCustomizationInfos, largeSizeFoldersError } = filterFoldersBySize(
    unfilteredFilesCustomizationWithoutContent,
    unfilteredFoldersCustomizationInfo,
    params,
  )

  const { filesCustomizationInfos, otherError, lockedError } = await queryFilesContent(
    suiteAppClient,
    filesWithoutContent,
  )

  return {
    elements: ([] as FileCabinetCustomizationInfo[])
      .concat(foldersCustomizationInfos)
      .concat(filesCustomizationInfos)
      .concat(linksCustomizationInfos),
    failedPaths: {
      otherError,
      lockedError,
      largeSizeFoldersError,
      largeFilesCountFoldersError,
    },
    largeFilesCountFolderWarnings,
  }
}

const convertToFileCabinetDetails = async (
  change: Change<FileCabinetInstance>,
  type: DeployType,
): Promise<FileCabinetInstanceDetails> => {
  const instance = getChangeData(change)

  const { parent, id } =
    type === 'add'
      ? { parent: instance.value.parent, id: undefined }
      : { id: parseInt(getChangeData(change).value.internalId, 10), parent: undefined }

  const base = {
    id,
    path: instance.value.path,
    bundleable: instance.value.bundleable ?? false,
    isInactive: instance.value.isinactive ?? false,
    description: instance.value.description ?? '',
  }

  return isFileInstance(instance)
    ? {
        ...base,
        type: 'file',
        folder: parent,
        isOnline: instance.value.availablewithoutlogin ?? false,
        hideInBundle: instance.value.hideinbundle ?? false,
        ...(instance.value.link === undefined
          ? { content: await getContent(instance.value.content) }
          : { url: instance.value.link }),
      }
    : {
        ...base,
        type: 'folder',
        parent,
        isPrivate: instance.value.isprivate ?? false,
      }
}

const deployInstances = async (
  suiteAppClient: SuiteAppClient,
  instances: FileCabinetInstanceDetails[],
  type: DeployType,
): Promise<SoapDeployResult[]> => {
  if (type === 'add') {
    return suiteAppClient.addFileCabinetInstances(instances)
  }
  if (type === 'delete') {
    return suiteAppClient.deleteFileCabinetInstances(instances as ExistingFileCabinetInstanceDetails[])
  }
  return suiteAppClient.updateFileCabinetInstances(instances as ExistingFileCabinetInstanceDetails[])
}

const deployChunk = async (
  suiteAppClient: SuiteAppClient,
  changes: Change<FileCabinetInstance>[],
  type: DeployType,
): Promise<FileCabinetDeployResult> => {
  log.debug(`Deploying chunk of ${changes.length} file changes`)
  const fileCabinetDetails = await Promise.all(changes.map(change => convertToFileCabinetDetails(change, type)))

  try {
    const deployResults = await deployInstances(suiteAppClient, fileCabinetDetails, type)
    log.debug(`Deployed chunk of ${changes.length} file changes`)
    return getDeployResultFromSuiteAppResult(changes, deployResults)
  } catch (e) {
    const { message } = toError(e)
    return {
      errors: changes.map(change =>
        toElementError({ elemID: getChangeData(change).elemID, message, detailedMessage: message }),
      ),
      appliedChanges: [],
      elemIdToInternalId: {},
    }
  }
}

const deployChanges = async (
  suiteAppClient: SuiteAppClient,
  changes: ReadonlyArray<Change<FileCabinetInstance>>,
  type: DeployType,
): Promise<FileCabinetDeployResult> => {
  const deployChunkResults = await Promise.all(
    _.chunk(changes, DEPLOY_CHUNK_SIZE).map(chunk => deployChunk(suiteAppClient, chunk, type)),
  )
  return {
    appliedChanges: deployChunkResults.flatMap(res => res.appliedChanges),
    errors: deployChunkResults.flatMap(res => res.errors),
    elemIdToInternalId: deployChunkResults.reduce(
      (acc, { elemIdToInternalId }) => Object.assign(acc, elemIdToInternalId),
      {},
    ),
  }
}

const deployAdditions: DeployFunction = async (suiteAppClient, allChanges) => {
  const changesByParentDirectory = _.groupBy(allChanges, change => path.dirname(getChangeData(change).value.path))
  const elemIdToPath = Object.fromEntries(
    allChanges.map(change => {
      const instance = getChangeData(change)
      return [instance.elemID.getFullName(), instance.value.path]
    }),
  )
  const changesToSkip = new Set<string>()

  const deployGroup = async (changes: Change<FileCabinetInstance>[]): Promise<FileCabinetDeployResult> => {
    const changesToDeploy = changes.filter(change => !changesToSkip.has(getChangeData(change).elemID.getFullName()))
    const deployResult = await deployChanges(suiteAppClient, changesToDeploy, 'add')

    deployResult.appliedChanges.forEach(appliedChange => {
      const appliedInstance = getChangeData(appliedChange)
      const children = changesByParentDirectory[appliedInstance.value.path] ?? []
      if (children.length > 0) {
        log.debug(
          'adding %s internal id as parent for %d childern files/folders',
          appliedInstance.value.path,
          children.length,
        )
      }
      children.forEach(change => {
        getChangeData(change).value.parent = deployResult.elemIdToInternalId[appliedInstance.elemID.getFullName()]
      })
    })

    deployResult.errors.forEach(error => {
      const failedPath = elemIdToPath[error.elemID.getFullName()]
      const children = changesByParentDirectory[failedPath] ?? []
      if (children.length > 0) {
        log.debug('skipping %d childern files/folders of %s that failed the deploy', children.length, failedPath)
      }
      children.forEach(change => {
        changesToSkip.add(getChangeData(change).elemID.getFullName())
      })
    })

    return deployResult
  }

  const orderedChangesGroups = groupChangesByDepth(allChanges)
  const deployResults = await promises.array.series(
    orderedChangesGroups.map(([depth, group]) => async () => {
      log.debug(`Deploying ${group.length} new files with depth of ${depth}`)
      return deployGroup(group)
    }),
  )

  const dependencyErrors = [...changesToSkip].map(id => {
    const elemID = ElemID.fromFullName(id)
    const message = `Cannot deploy this ${elemID.typeName} because its parent folder deploy failed`
    return toElementError({ elemID, message, detailedMessage: message })
  })

  return {
    appliedChanges: deployResults.flatMap(res => res.appliedChanges),
    errors: deployResults.flatMap(res => res.errors).concat(dependencyErrors),
    elemIdToInternalId: deployResults.reduce(
      (acc, { elemIdToInternalId }) => Object.assign(acc, elemIdToInternalId),
      {},
    ),
  }
}

const deployDeletions: DeployFunction = async (suiteAppClient, changes) => {
  const orderedChangesGroups = groupChangesByDepth(changes).reverse()
  const deployResults = await promises.array.series(
    orderedChangesGroups.map(([depth, group]) => async () => {
      log.debug(`Deleting ${group.length} files with depth of ${depth}`)
      return deployChanges(suiteAppClient, group, 'delete')
    }),
  )

  return {
    appliedChanges: deployResults.flatMap(res => res.appliedChanges),
    errors: deployResults.flatMap(res => res.errors),
    elemIdToInternalId: {},
  }
}

const deployUpdates: DeployFunction = (suiteAppClient, changes) => deployChanges(suiteAppClient, changes, 'update')

const typeToDeployFunction: Record<DeployType, DeployFunction> = {
  add: deployAdditions,
  delete: deployDeletions,
  update: deployUpdates,
}

export const deployFileCabinetInstances = async (
  suiteAppClient: SuiteAppClient,
  changes: ReadonlyArray<Change<InstanceElement>>,
  groupId: FileCabinetDeployGroup,
): Promise<FileCabinetDeployResult> =>
  typeToDeployFunction[FILE_CABINET_DEPLOY_GROUPS[groupId]](
    suiteAppClient,
    changes as ReadonlyArray<Change<FileCabinetInstance>>,
  )
