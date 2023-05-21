/*
*                      Copyright 2023 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
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
} from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { chunks, promises, values } from '@salto-io/lowerdash'
import Ajv from 'ajv'
import _ from 'lodash'
import path from 'path'
import { ReadFileEncodingError, ReadFileInsufficientPermissionError, RetryableError, retryOnRetryableError } from './errors'
import SuiteAppClient from './suiteapp_client'
import { ExistingFileCabinetInstanceDetails, FileCabinetInstanceDetails } from './types'
import { ImportFileCabinetResult } from '../types'
import { FILE_CABINET_PATH_SEPARATOR, INTERNAL_ID, PARENT, PATH } from '../../constants'
import { DEFAULT_MAX_FILE_CABINET_SIZE_IN_GB } from '../../config'
import { NetsuiteQuery } from '../../query'
import { DeployResult, isFileCabinetType, isFileInstance } from '../../types'
import { filterFilePathsInFolders, filterFolderPathsInFolders, largeFoldersToExclude } from '../file_cabinet_utils'

const log = logger(module)

export type DeployType = 'add' | 'update' | 'delete'

type WithPath = Record<typeof PATH, string>
type WithInternalId = Record<typeof INTERNAL_ID, string>
type WithParent = Partial<Record<typeof PARENT, number>>
type FileCabinetInstance = Element & Omit<InstanceElement, 'value'> & {
  value: WithPath & WithInternalId & WithParent & {
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

type ChangeWithId = Change<FileCabinetInstance> & { id: number }
type FileCabinetDeployResult = {
  appliedChanges: ChangeWithId[]
  failedChanges: Change<FileCabinetInstance>[]
  errors: Error[]
}

type DeployFunction = (
  changes: ReadonlyArray<Change<FileCabinetInstance>>
) => Promise<DeployResult>

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
    required: [
      'name',
      'id',
      'isinactive',
      'isprivate',
    ],
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
    required: [
      'name',
      'id',
      'filesize',
      'isinactive',
      'isonline',
      'addtimestamptourl',
      'hideinbundle',
      'folder',
    ],
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
  hideinbundle: 'T' | 'F'
  description?: string
  islink: 'T' | 'F'
  url: string
  folder: string
}

type ExtendedFolderResult = FolderResult & { path: string[] }
type ExtendedFileResult = FileResult & { path: string[] }

type FileCabinetResults = {
  filesResults: ExtendedFileResult[]
  foldersResults: ExtendedFolderResult[]
}

const FILES_CHUNK_SIZE = 5 * 1024 * 1024
const MAX_DEPLOYABLE_FILE_SIZE = 10 * 1024 * 1024
const DEPLOY_CHUNK_SIZE = 50
const MAX_ITEMS_IN_WHERE_QUERY = 200

export const THROW_ON_MISSING_FEATURE_ERROR: Record<string, string> = {
  'Search error occurred: Unknown identifier \'bundleable\'':
    'Failed to list folders. Please verify that the "Create bundles with SuiteBundler" feature is enabled in the account.',
}

export type SuiteAppFileCabinetOperations = {
  importFileCabinet: (query: NetsuiteQuery, maxFileCabinetSizeInGB: number) => Promise<ImportFileCabinetResult>
  deploy: (
    changes: ReadonlyArray<Change<InstanceElement>>,
    type: DeployType,
  ) => Promise<DeployResult>
}

export const getContent = async (content: unknown): Promise<Buffer> => {
  if (isStaticFile(content)) {
    return await content.getContent() ?? Buffer.from('')
  }
  if (typeof content === 'string') {
    return Buffer.from(content)
  }
  if (content === undefined) {
    return Buffer.from('')
  }
  throw new Error(`Got invalid content value: ${safeJsonStringify(content, undefined, 2)}`)
}

export const isTooBigFileForSuiteApp = async (
  change: Change<InstanceElement>,
): Promise<boolean> => isAdditionOrModificationChange(change)
    && isFileInstance(getChangeData(change))
    && (await getContent(getChangeData(change).value.content)).toString('base64').length > MAX_DEPLOYABLE_FILE_SIZE

// SuiteApp can't change generateurltimestamp.
export const hasDisallowedValueModification = (change: Change<InstanceElement>): boolean => {
  if (isAdditionChange(change) && change.data.after.value.generateurltimestamp === true) {
    return true
  }
  return isModificationChange(change)
    && change.data.before.value.generateurltimestamp !== change.data.after.value.generateurltimestamp
}

export const isChangeDeployable = async (
  change: Change
): Promise<boolean> => {
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
  changes: ReadonlyArray<Change<FileCabinetInstance>>
): [string, Change<FileCabinetInstance>[]][] => _(changes)
  .groupBy(change => getChangeData(change).value.path.split(FILE_CABINET_PATH_SEPARATOR).length)
  .entries()
  .sortBy(([depth]) => depth)
  .value()

export const createSuiteAppFileCabinetOperations = (suiteAppClient: SuiteAppClient):
SuiteAppFileCabinetOperations => {
  let fileCabinetResults: FileCabinetResults

  const queryFolders = (
    whereQuery: string
  ): Promise<FolderResult[]> => retryOnRetryableError(async () => {
    const foldersResults = await suiteAppClient.runSuiteQL(
      'SELECT name, id, bundleable, isinactive, isprivate, description, parent'
      + ` FROM mediaitemfolder WHERE ${whereQuery} ORDER BY id ASC`,
      THROW_ON_MISSING_FEATURE_ERROR,
    )

    if (foldersResults === undefined) {
      throw new RetryableError(new Error('Failed to list folders'))
    }

    const ajv = new Ajv({ allErrors: true, strict: false })
    if (!ajv.validate<FolderResult[]>(FOLDERS_SCHEMA, foldersResults)) {
      log.error(
        'Got invalid results from listing folders - %s: %o',
        ajv.errorsText(),
        foldersResults
      )
      throw new RetryableError(new Error('Failed to list folders'))
    }

    return foldersResults
  })

  const queryTopLevelFolders = async (): Promise<FolderResult[]> =>
    queryFolders('istoplevel = \'T\'')

  const querySubFolders = async (topLevelFolders: FolderResult[]): Promise<FolderResult[]> => {
    const subFolderCriteria = 'istoplevel = \'F\''
    const whereQuery = topLevelFolders.length > 0
      ? `${subFolderCriteria} AND (${topLevelFolders.map(folder => `appfolder LIKE '${folder.name}%'`).join(' OR ')})`
      : subFolderCriteria
    return queryFolders(whereQuery)
  }

  const queryFiles = (
    folderIdsToQuery: string[]
  ): Promise<FileResult[]> => retryOnRetryableError(async () => {
    const fileCriteria = 'hideinbundle = \'F\''
    const whereQueries = _.chunk(folderIdsToQuery, MAX_ITEMS_IN_WHERE_QUERY).map(foldersToQueryChunk =>
      `${fileCriteria} AND folder IN (${foldersToQueryChunk.join(', ')})`)
    const results = await Promise.all(whereQueries.map(async whereQuery => {
      const filesResults = await suiteAppClient.runSuiteQL(
        'SELECT name, id, filesize, bundleable, isinactive, isonline,'
        + ' addtimestamptourl, hideinbundle, description, folder, islink, url'
        + ` FROM file WHERE ${whereQuery} ORDER BY id ASC`
      )

      if (filesResults === undefined) {
        throw new RetryableError(new Error('Failed to list files'))
      }

      const ajv = new Ajv({ allErrors: true, strict: false })
      if (!ajv.validate<FileResult[]>(FILES_SCHEMA, filesResults)) {
        log.error(
          'Got invalid results from listing files - %s: %o',
          ajv.errorsText(),
          filesResults
        )
        throw new RetryableError(new Error('Failed to list files'))
      }
      return filesResults
    }))

    return results.flat()
  })

  const removeResultsWithoutParentFolder = (
    foldersResults: FolderResult[],
  ): FolderResult[] => {
    const folderIdsSet = new Set(foldersResults.map(folder => folder.id))
    const removeFoldersWithoutParentFolder = (folders: FolderResult[]): FolderResult[] => {
      const filteredFolders = folders.filter(folder => {
        if (folder.parent !== undefined && !folderIdsSet.has(folder.parent)) {
          log.warn('folder\'s parent does not exist: %o', folder)
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
    filteredFolderResults: ExtendedFolderResult[],
  ): FileResult[] => {
    const folderIdsSet = new Set(filteredFolderResults.map(folder => folder.id))
    return filesResults.filter(file => {
      if (!folderIdsSet.has(file.folder)) {
        log.warn('file\'s folder does not exist: %o', file)
        return false
      }
      return true
    })
  }

  const fullPathParts = (folder: FolderResult, idToFolder: Record<string, FolderResult>):
    string[] => {
    if (folder.parent === undefined) {
      return [folder.name]
    }
    if (idToFolder[folder.parent] === undefined) {
      log.error('folder\'s parent is unknown\nfolder: %o\nidToFolder: %o', folder, idToFolder)
      throw new Error(`Failed to get absolute folder path of ${folder.name}`)
    }
    return [...fullPathParts(idToFolder[folder.parent], idToFolder), folder.name]
  }

  const fullPath = (fileParts: string[]): string =>
    `${FILE_CABINET_PATH_SEPARATOR}${fileParts.join(FILE_CABINET_PATH_SEPARATOR)}`

  const queryFileCabinet = async (query: NetsuiteQuery): Promise<FileCabinetResults> => {
    if (fileCabinetResults === undefined) {
      const topLevelFoldersResults = (await queryTopLevelFolders())
        .filter(folder => query.isParentFolderMatch(`/${folder.name}`))

      if (topLevelFoldersResults.length === 0) {
        log.warn('No top level folder matched the adapter\'s query. returning empty result')
        fileCabinetResults = { foldersResults: [], filesResults: [] }
        return fileCabinetResults
      }
      log.debug(
        'the following top level folders have been queried: %o',
        topLevelFoldersResults.map(folder => folder.name)
      )

      const subFoldersResults = await querySubFolders(topLevelFoldersResults)
      const foldersResults = topLevelFoldersResults.concat(subFoldersResults)
      const idToFolder = _.keyBy(foldersResults, folder => folder.id)
      const [filteredFolderResults, removedFolders] = _.partition(
        removeResultsWithoutParentFolder(foldersResults)
          .map(folder => ({ path: fullPathParts(folder, idToFolder), ...folder })),
        // remove excluded folders before creating the query
        folder => query.isFileMatch(`${fullPath(folder.path)}${FILE_CABINET_PATH_SEPARATOR}`)
      )
      log.debug('removed the following %d folder before querying files: %o', removedFolders.length, removedFolders)
      const filesResults = filteredFolderResults.length > 0 ? await queryFiles(
        filteredFolderResults.map(folder => folder.id)
      ) : []
      const filteredFilesResults = removeFilesWithoutParentFolder(filesResults, filteredFolderResults)
        .map(file => ({ path: [...fullPathParts(idToFolder[file.folder], idToFolder), file.name], ...file }))
        .filter(file => query.isFileMatch(fullPath(file.path)))
      fileCabinetResults = { filesResults: filteredFilesResults, foldersResults: filteredFolderResults }
    }
    return fileCabinetResults
  }

  const importFileCabinet = async (
    query: NetsuiteQuery, maxFileCabinetSizeInGB: number = DEFAULT_MAX_FILE_CABINET_SIZE_IN_GB
  ): Promise<ImportFileCabinetResult> => {
    if (!query.areSomeFilesMatch()) {
      return { elements: [], failedPaths: { lockedError: [], otherError: [], largeFolderError: [] } }
    }

    const { foldersResults, filesResults } = await queryFileCabinet(query)
    const unfilteredFoldersCustomizationInfo = foldersResults.map(folder => ({
      path: folder.path,
      typeName: 'folder',
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
      typeName: 'file',
      values: {
        description: file.description ?? '',
        bundleable: file.bundleable ?? 'F',
        isinactive: file.isinactive,
        availablewithoutlogin: file.isonline,
        generateurltimestamp: file.addtimestamptourl,
        hideinbundle: file.hideinbundle,
        internalId: file.id,
        ...file.islink === 'T' ? { link: file.url } : {},
      },
      id: file.id,
      size: parseInt(file.filesize, 10),
    }))

    const [
      unfilteredFilesCustomizationWithoutContent,
      filesCustomizationsLinks,
    ] = _.partition(filesCustomizations, file => file.values.link === undefined)

    const filesSize = unfilteredFilesCustomizationWithoutContent.map(
      file => ({ path: fullPath(file.path), size: file.size })
    )
    const largeFolders = largeFoldersToExclude(filesSize, maxFileCabinetSizeInGB)
    const filesCustomizationWithoutContent = filterFilePathsInFolders(
      unfilteredFilesCustomizationWithoutContent,
      largeFolders
    )
    const foldersCustomizationInfo = filterFolderPathsInFolders(
      unfilteredFoldersCustomizationInfo,
      largeFolders
    )

    const fileChunks = chunks.weightedChunks(
      filesCustomizationWithoutContent,
      FILES_CHUNK_SIZE,
      file => file.size
    )

    const filesContent = (await Promise.all(
      fileChunks.map(
        async (fileChunk, i) => {
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

          return results && Promise.all(results.map(async (content, index) => {
            if (!(content instanceof ReadFileEncodingError)) {
              return content
            }

            const id = parseInt(fileChunk[index].id, 10)
            log.debug(`Received file encoding error for id ${id}. Fallback to SOAP request`)
            return suiteAppClient.readLargeFile(id)
          }))
        }
      )
    )).flat()

    const failedPaths: string[][] = []
    const lockedPaths: string[][] = []
    const filesCustomizationWithContent = filesCustomizationWithoutContent.map((file, index) => {
      if (!(filesContent[index] instanceof Buffer)) {
        log.warn(`Failed reading file ${fullPath(file.path)} with id ${file.id}`)
        if (filesContent[index] instanceof ReadFileInsufficientPermissionError) {
          lockedPaths.push(file.path)
        } else {
          failedPaths.push(file.path)
        }
        return undefined
      }
      return {
        path: file.path,
        typeName: 'file',
        fileContent: filesContent[index],
        values: file.values,
      }
    }).filter(values.isDefined)

    return {
      elements: [
        ...foldersCustomizationInfo,
        ...filesCustomizationWithContent,
        ...filesCustomizationsLinks.map(file => ({
          path: file.path,
          typeName: 'file',
          values: file.values,
        })),
      ],
      failedPaths: {
        otherError: failedPaths.map(fileCabinetPath => fullPath(fileCabinetPath)),
        lockedError: lockedPaths.map(fileCabinetPath => fullPath(fileCabinetPath)),
        largeFolderError: largeFolders,
      },
    }
  }

  const convertToFileCabinetDetails = async (
    change: Change<FileCabinetInstance>,
    type: DeployType,
  ): Promise<FileCabinetInstanceDetails> => {
    const instance = getChangeData(change)

    const { parent, id } = type === 'add'
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
        ...instance.value.link === undefined
          ? { content: await getContent(instance.value.content) }
          : { url: instance.value.link },
      }
      : {
        ...base,
        type: 'folder',
        parent,
        isPrivate: instance.value.isprivate ?? false,
      }
  }

  const deployInstances = async (
    instances: FileCabinetInstanceDetails[],
    type: DeployType,
  ): Promise<(number | Error)[]> => {
    if (type === 'add') {
      return suiteAppClient.addFileCabinetInstances(instances)
    }
    if (type === 'delete') {
      return suiteAppClient.deleteFileCabinetInstances(
      instances as ExistingFileCabinetInstanceDetails[]
      )
    }
    return suiteAppClient.updateFileCabinetInstances(
    instances as ExistingFileCabinetInstanceDetails[]
    )
  }

  const deployChunk = async (
    chunk: ReadonlyArray<Change<FileCabinetInstance>>,
    type: DeployType,
  ): Promise<FileCabinetDeployResult> => {
    log.debug(`Deploying chunk of ${chunk.length} file changes`)

    const changes = await Promise.all(chunk.map(
      async change => ({
        details: await convertToFileCabinetDetails(change, type),
        change,
      })
    ))

    try {
      const deployResults = await deployInstances(
        changes.map(({ details }) => details),
        type
      )

      log.debug(`Deployed chunk of ${chunk.length} file changes`)

      const [deployErrors, deployChanges] = _.partition(
        deployResults.map((res, index) => ({ res, ...changes[index].change })),
        ({ res }) => res instanceof Error
      )

      return {
        appliedChanges: deployChanges.map(({ res, ...change }) => ({ ...change, id: res as number })),
        failedChanges: deployErrors,
        errors: deployErrors.map(({ res }) => res as Error),
      }
    } catch (e) {
      return {
        errors: [e as Error],
        appliedChanges: [],
        failedChanges: [...chunk],
      }
    }
  }

  const deployChanges = async (
    changes: ReadonlyArray<Change<FileCabinetInstance>>,
    type: DeployType,
  ): Promise<FileCabinetDeployResult> => {
    const deployChunkResults = await Promise.all(
      _.chunk(changes, DEPLOY_CHUNK_SIZE)
        .map(chunk => deployChunk(chunk, type))
    )
    return {
      appliedChanges: deployChunkResults.flatMap(res => res.appliedChanges),
      failedChanges: deployChunkResults.flatMap(res => res.failedChanges),
      errors: deployChunkResults.flatMap(res => res.errors),
    }
  }

  const deployAdditions: DeployFunction = async allChanges => {
    const changesByParentDirectory = _.groupBy(
      allChanges,
      change => path.dirname(getChangeData(change).value.path)
    )
    const pathsToSkip = new Set<string>()
    const elemIdToInternalId: Record<string, string> = {}

    const deployGroup = async (changes: Change<FileCabinetInstance>[]): Promise<DeployResult> => {
      const { appliedChanges, failedChanges, errors } = await deployChanges(
        changes.filter(change => !pathsToSkip.has(getChangeData(change).value.path)),
        'add'
      )
      appliedChanges.forEach(({ id, ...appliedChange }) => {
        const appliedInstance = getChangeData(appliedChange)
        elemIdToInternalId[appliedInstance.elemID.getFullName()] = id.toString()
        const children = changesByParentDirectory[appliedInstance.value.path] ?? []
        if (children.length > 0) {
          log.debug('adding %s internal id as parent for %d childern files/folders', appliedInstance.value.path, children.length)
        }
        children.forEach(change => {
          getChangeData(change).value.parent = id
        })
      })
      failedChanges.forEach(failedChange => {
        const failedInstance = getChangeData(failedChange)
        const children = changesByParentDirectory[failedInstance.value.path] ?? []
        if (children.length > 0) {
          log.debug('skipping %d childern files/folders of %s that failed the deploy', children.length, failedInstance.value.path)
        }
        children.forEach(change => {
          pathsToSkip.add(getChangeData(change).value.path)
        })
      })
      return {
        appliedChanges,
        errors,
      }
    }

    const orderedChangesGroups = groupChangesByDepth(allChanges)
    const deployResults = await promises.array.series(orderedChangesGroups
      .map(([depth, group]) => async () => {
        log.debug(`Deploying ${group.length} new files with depth of ${depth}`)
        return deployGroup(group)
      }))

    const dependenciesError = pathsToSkip.size > 0
      ? new Error(`Can't deploy the following files/folders because their parent folders deploy failed:\n${
        Array.from(pathsToSkip).map(failedPath => `- ${failedPath}`).join('\n')}`)
      : []

    return {
      appliedChanges: deployResults.flatMap(res => res.appliedChanges),
      errors: deployResults.flatMap(res => res.errors).concat(dependenciesError),
      elemIdToInternalId,
    }
  }

  const deployDeletions: DeployFunction = async changes => {
    const orderedChangesGroups = groupChangesByDepth(changes).reverse()
    const deployResults = await promises.array.series(orderedChangesGroups
      .map(([depth, group]) => async () => {
        log.debug(`Deleting ${group.length} files with depth of ${depth}`)
        return deployChanges(group, 'delete')
      }))

    return {
      appliedChanges: deployResults.flatMap(res => res.appliedChanges),
      errors: deployResults.flatMap(res => res.errors),
    }
  }

  const deployUpdates: DeployFunction = changes => deployChanges(changes, 'update')

  const typeToDeployFunction: Record<DeployType, DeployFunction> = {
    add: deployAdditions,
    delete: deployDeletions,
    update: deployUpdates,
  }

  const deploy = async (
    changes: ReadonlyArray<Change<InstanceElement>>,
    type: DeployType,
  ): Promise<DeployResult> => typeToDeployFunction[type](changes as ReadonlyArray<Change<FileCabinetInstance>>)

  return {
    importFileCabinet,
    deploy,
  }
}
