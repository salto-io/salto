/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { Change, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange, isStaticFile } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { chunks, collections, promises, values } from '@salto-io/lowerdash'
import Ajv from 'ajv'
import _ from 'lodash'
import path from 'path'
import { ReadFileEncodingError, ReadFileInsufficientPermissionError, RetryableError, retryOnRetryableError } from './client/suiteapp_client/errors'
import SuiteAppClient from './client/suiteapp_client/suiteapp_client'
import { ExistingFileCabinetInstanceDetails, FileCabinetInstanceDetails } from './client/suiteapp_client/types'
import { ImportFileCabinetResult } from './client/types'
import { INTERNAL_ID } from './constants'
import { LazyElementsSourceIndexes } from './elements_source_index/types'
import { NetsuiteQuery } from './query'
import { DeployResult, isFileCabinetType, isFileInstance } from './types'

const { awu } = collections.asynciterable

const log = logger(module)

export type DeployType = 'add' | 'update' | 'delete'

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

type FileCabinetResults = {
  filesResults: FileResult[]
  foldersResults: FolderResult[]
}

const FILES_CHUNK_SIZE = 5 * 1024 * 1024
const MAX_DEPLOYABLE_FILE_SIZE = 10 * 1024 * 1024
const DEPLOY_CHUNK_SIZE = 50
const MAX_ITEMS_IN_WHERE_QUERY = 200

export type SuiteAppFileCabinetOperations = {
  importFileCabinet: (query: NetsuiteQuery) => Promise<ImportFileCabinetResult>
  getPathToIdMap: () => Record<string, number>
  deploy: (
    changes: ReadonlyArray<Change<InstanceElement>>,
    type: DeployType,
    elementsSourceIndex: LazyElementsSourceIndexes
  ) => Promise<DeployResult>
}

const getContent = async (content: unknown): Promise<Buffer> => {
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

export const isChangeDeployable = async (
  change: Change
): Promise<boolean> => {
  if (!isInstanceChange(change)) {
    return false
  }

  const changedElement = getChangeData(change)
  if (!isFileCabinetType(changedElement.refType)) {
    return false
  }

  // SuiteApp can't modify files bigger than 10mb
  if (isAdditionOrModificationChange(change)
  && isFileInstance(changedElement)
  && (await getContent(changedElement.value.content)).toString('base64').length > MAX_DEPLOYABLE_FILE_SIZE) {
    return false
  }

  // SuiteApp can't change generateurltimestamp.
  if (change.action === 'add' && change.data.after.value.generateurltimestamp === true) {
    return false
  }
  if (change.action === 'modify' && change.data.before.value.generateurltimestamp !== change.data.after.value.generateurltimestamp) {
    return false
  }

  return true
}

export const createSuiteAppFileCabinetOperations = (suiteAppClient: SuiteAppClient):
SuiteAppFileCabinetOperations => {
  let fileCabinetResults: FileCabinetResults
  let pathToIdResults: Record<string, number>

  const queryFolders = (
    whereQuery: string
  ): Promise<FolderResult[]> => retryOnRetryableError(async () => {
    const foldersResults = await suiteAppClient.runSuiteQL(
      'SELECT name, id, bundleable, isinactive, isprivate, description, parent'
      + ` FROM mediaitemfolder WHERE ${whereQuery} ORDER BY id ASC`
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
    foldersToQuery: FolderResult[]
  ): Promise<FileResult[]> => retryOnRetryableError(async () => {
    const fileCriteria = 'hideinbundle = \'F\''
    const whereQueries = foldersToQuery.length > 0
      ? _.chunk(foldersToQuery, MAX_ITEMS_IN_WHERE_QUERY).map(foldersToQueryChunk =>
        `${fileCriteria} AND (${foldersToQueryChunk.map(folder => `folder = '${folder.id}'`).join(' OR ')})`)
      : [fileCriteria]

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
    { foldersResults, filesResults }: FileCabinetResults
  ): FileCabinetResults => {
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

    const filteredFoldersResults = removeFoldersWithoutParentFolder(foldersResults)
    return {
      foldersResults: filteredFoldersResults,
      filesResults: filesResults.filter(file => {
        if (!folderIdsSet.has(file.folder)) {
          log.warn('file\'s folder does not exist: %o', file)
          return false
        }
        return true
      }),
    }
  }

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
      const filesResults = await queryFiles(foldersResults)

      fileCabinetResults = removeResultsWithoutParentFolder({ foldersResults, filesResults })
    }
    return fileCabinetResults
  }

  const getFullPath = (folder: FolderResult, idToFolder: Record<string, FolderResult>):
  string[] => {
    if (folder.parent === undefined) {
      return [folder.name]
    }
    if (idToFolder[folder.parent] === undefined) {
      log.error('folder\'s parent is unknown\nfolder: %o\nidToFolder: %o', folder, idToFolder)
      throw new Error(`Failed to get absolute folder path of ${folder.name}`)
    }
    return [...getFullPath(idToFolder[folder.parent], idToFolder), folder.name]
  }

  const importFileCabinet = async (query: NetsuiteQuery): Promise<ImportFileCabinetResult> => {
    if (!query.areSomeFilesMatch()) {
      return { elements: [], failedPaths: { lockedError: [], otherError: [] } }
    }

    const { foldersResults, filesResults } = await queryFileCabinet(query)
    const idToFolder = _.keyBy(foldersResults, folder => folder.id)

    const foldersCustomizationInfo = foldersResults.map(folder => ({
      path: getFullPath(folder, idToFolder),
      typeName: 'folder',
      values: {
        description: folder.description ?? '',
        bundleable: folder.bundleable ?? 'F',
        isinactive: folder.isinactive,
        isprivate: folder.isprivate,
        internalId: folder.id,
      },
    })).filter(folder => query.isFileMatch(`/${folder.path.join('/')}`))

    const filesCustomizations = filesResults.map(file => ({
      path: [...getFullPath(idToFolder[file.folder], idToFolder), file.name],
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
    })).filter(file => query.isFileMatch(`/${file.path.join('/')}`))

    const [
      filesCustomizationWithoutContent,
      filesCustomizationsLinks,
    ] = _.partition(filesCustomizations, file => file.values.link === undefined)

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
        log.warn(`Failed reading file /${file.path.join('/')} with id ${file.id}`)
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
      ].filter(file => query.isFileMatch(`/${file.path.join('/')}`)),
      failedPaths: {
        otherError: failedPaths.map(fileCabinetPath => `/${fileCabinetPath.join('/')}`),
        lockedError: lockedPaths.map(fileCabinetPath => `/${fileCabinetPath.join('/')}`),
      },
    }
  }

  const getPathToIdMap = (): Record<string, number> => {
    if (pathToIdResults === undefined) {
      log.debug('creating pathToId mapping')
      if (fileCabinetResults === undefined) {
        throw new Error('missing fileCabinet results cache')
      }
      const { foldersResults, filesResults } = fileCabinetResults
      const idToFolder = _.keyBy(foldersResults, folder => folder.id)
      pathToIdResults = Object.fromEntries([
        ...filesResults.map(file => [
          `/${[...getFullPath(idToFolder[file.folder], idToFolder), file.name].join('/')}`,
          parseInt(file.id, 10),
        ]),
        ...foldersResults.map(folder => [
          `/${getFullPath(folder, idToFolder).join('/')}`,
          parseInt(folder.id, 10),
        ]),
      ])
    }
    return pathToIdResults
  }

  const convertToFileCabinetDetails = async (params: {
    change: Change<InstanceElement>
  } & ({
    type: 'delete' | 'update'
  } | {
    type: 'add'
    pathToId: Record<string, number>
  })): Promise<FileCabinetInstanceDetails | Error> => {
    const instance = getChangeData(params.change)
    const dirname = path.dirname(instance.value.path)
    if (dirname !== '/' && params.type === 'add' && !(dirname in params.pathToId)) {
      return new Error(`Directory ${dirname} was not found when attempting to deploy a file with path ${instance.value.path}`)
    }

    return isFileInstance(instance)
      ? {
        type: 'file',
        path: instance.value.path,
        folder: params.type === 'add' ? params.pathToId[dirname] : undefined,
        bundleable: instance.value.bundleable ?? false,
        isInactive: instance.value.isinactive ?? false,
        isOnline: instance.value.availablewithoutlogin ?? false,
        hideInBundle: instance.value.hideinbundle ?? false,
        description: instance.value.description ?? '',
        ...instance.value.link === undefined
          ? { content: await getContent(instance.value.content) }
          : { url: instance.value.link },
      }
      : {
        type: 'folder',
        path: instance.value.path,
        parent: dirname !== '/' && params.type === 'add' ? params.pathToId[dirname] : undefined,
        bundleable: instance.value.bundleable ?? false,
        isInactive: instance.value.isinactive ?? false,
        isPrivate: instance.value.isprivate ?? false,
        description: instance.value.description ?? '',
      }
  }

  const convertToExistingFileCabinetDetails = async (
    change: Change<InstanceElement>,
    type: 'delete' | 'update'
  ): Promise<ExistingFileCabinetInstanceDetails | Error> => {
    const details = await convertToFileCabinetDetails({ change, type })
    if (details instanceof Error) {
      return details
    }
    const instance = getChangeData(change)
    if (instance.value[INTERNAL_ID] === undefined) {
      log.warn(`Failed to find the internal id of the file ${instance.value.path}`)
      return new Error(`Failed to find the internal id of the file ${instance.value.path}`)
    }
    return { ...details, id: parseInt(instance.value[INTERNAL_ID], 10) }
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
    chunk: ReadonlyArray<Change<InstanceElement>>,
    pathToId: Record<string, number>,
    type: DeployType
  ): Promise<DeployResult> => {
    log.debug(`Deploying chunk of ${chunk.length} file changes`)

    const instancesDetails = await awu(chunk).map(
      async change => ({
        details: type === 'add'
          ? await convertToFileCabinetDetails({ change, type, pathToId })
          : await convertToExistingFileCabinetDetails(change, type),
        change,
      })
    ).toArray()

    const [errorsInstances, validInstances] = _.partition(
      instancesDetails,
      ({ details }) => details instanceof Error,
    )

    try {
      const deployResults = validInstances.length > 0 ? await deployInstances(validInstances.map(
        ({ details }) => details as FileCabinetInstanceDetails
      ), type) : []

      log.debug(`Deployed chunk of ${chunk.length} file changes`)

      const [deployErrors, deployChanges] = _(deployResults)
        .map((res, index) => ({ res, change: validInstances[index].change }))
        .partition(({ res }) => res instanceof Error)
        .value()

      deployChanges.forEach(deployedChange => {
        pathToId[getChangeData(deployedChange.change).value.path] = deployedChange.res as number
      })

      return {
        errors: [
          ...deployErrors.map(({ res }) => res as Error),
          ...errorsInstances.map(({ details }) => details as Error),
        ],
        appliedChanges: deployChanges.map(({ change }) => change),
      }
    } catch (e) {
      return {
        errors: [
          e,
          ...errorsInstances.map(({ details }) => details as Error),
        ],
        appliedChanges: [],
      }
    }
  }

  const deployChanges = async (
    changes: ReadonlyArray<Change<InstanceElement>>,
    pathToId: Record<string, number>,
    type: DeployType): Promise<DeployResult> => {
    const deployChunkResults = await Promise.all(
      _.chunk(changes, DEPLOY_CHUNK_SIZE)
        .map(chunk => deployChunk(chunk, pathToId, type))
    )
    return {
      appliedChanges: deployChunkResults
        .flatMap(deployChunkResult => deployChunkResult.appliedChanges),
      errors: deployChunkResults.flatMap(deployChunkResult => deployChunkResult.errors),
      ...type === 'add' ? {
        elemIdToInternalId: _(changes)
          .map(getChangeData)
          .filter(change => pathToId[change.value.path] !== undefined)
          .keyBy(change => change.elemID.getFullName())
          .mapValues(change => pathToId[change.value.path].toString())
          .value(),
      } : {},
    }
  }

  const deployAdditionsOrDeletions = async (
    changes: ReadonlyArray<Change<InstanceElement>>,
    pathToId: Record<string, number>,
    type: 'add' | 'delete'
  ): Promise<DeployResult> => {
    const changesGroups = _(changes)
      .groupBy(change => getChangeData(change).value.path.split('/').length)
      .entries()
      .sortBy(([depth]) => depth)
      .value()

    const orderedChangesGroups = type === 'delete' ? changesGroups.reverse() : changesGroups

    const deployResults = await promises.array.series(orderedChangesGroups
      .map(([depth, group]) => () => {
        if (type === 'delete') {
          log.debug(`Deleting ${group.length} files with depth of ${depth}`)
        } else {
          log.debug(`Deploying ${group.length} new files with depth of ${depth}`)
        }

        return deployChanges(group, pathToId, type)
      }))
    return {
      appliedChanges: deployResults.flatMap(deployResult => deployResult.appliedChanges),
      errors: deployResults.flatMap(deployResult => deployResult.errors),
      elemIdToInternalId: deployResults
        .map(deployResult => deployResult.elemIdToInternalId)
        .reduce((val1, val2) => ({ ...val1, ...val2 })),
    }
  }

  const deploy = async (
    changes: ReadonlyArray<Change<InstanceElement>>,
    type: DeployType,
    elementsSourceIndex: LazyElementsSourceIndexes
  ): Promise<DeployResult> => {
    const { pathToInternalIdsIndex = {} } = type === 'add'
      ? await elementsSourceIndex.getIndexes()
      : {}

    return type === 'update'
      ? deployChanges(changes, pathToInternalIdsIndex, 'update')
      : deployAdditionsOrDeletions(changes, pathToInternalIdsIndex, type)
  }

  return {
    importFileCabinet,
    getPathToIdMap,
    deploy,
  }
}
