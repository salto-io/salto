/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { Change, DeployResult, getChangeElement, InstanceElement, isAdditionOrModificationChange, isInstanceChange, isModificationChange, StaticFile } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { chunks, promises, values } from '@salto-io/lowerdash'
import Ajv from 'ajv'
import _ from 'lodash'
import path from 'path'
import { ReadFileEncodingError } from './client/suiteapp_client/errors'
import SuiteAppClient from './client/suiteapp_client/suiteapp_client'
import { ExistingFileCabinetInstanceDetails, FileCabinetInstanceDetails } from './client/suiteapp_client/types'
import { ImportFileCabinetResult } from './client/types'
import { NetsuiteQuery } from './query'
import { isFileCabinetType, isFileInstance } from './types'

const log = logger(module)

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
  folder: string
}

const FILES_CHUNK_SIZE = 5 * 1024 * 1024
const MAX_DEPLOYABLE_FILE_SIZE = 10 * 1024 * 1024
const DEPLOY_CHUNK_SIZE = 50


const queryFolders = async (suiteAppClient: SuiteAppClient):
Promise<FolderResult[]> => {
  const foldersResults = await suiteAppClient.runSuiteQL(`SELECT name, id, bundleable, isinactive, isprivate, description, parent 
    FROM mediaitemfolder`)

  if (foldersResults === undefined) {
    throw new Error('Failed to list folders')
  }

  const ajv = new Ajv({ allErrors: true, strict: false })
  if (!ajv.validate<FolderResult[]>(FOLDERS_SCHEMA, foldersResults)) {
    log.error(`Got invalid results from listing folders: ${ajv.errorsText()}`)
    throw new Error('Failed to list folders')
  }

  return foldersResults
}

const queryFiles = async (suiteAppClient: SuiteAppClient):
Promise<FileResult[]> => {
  const filesResults = await suiteAppClient.runSuiteQL(`SELECT name, id, filesize, bundleable, isinactive, isonline, addtimestamptourl, hideinbundle, description, folder 
    FROM file`)

  if (filesResults === undefined) {
    throw new Error('Failed to list files')
  }

  const ajv = new Ajv({ allErrors: true, strict: false })
  if (!ajv.validate<FileResult[]>(FILES_SCHEMA, filesResults)) {
    log.error(`Got invalid results from listing files: ${ajv.errorsText()}`)
    throw new Error('Failed to list files')
  }

  return filesResults
}

const getFullPath = (folder: FolderResult, idToFolder: Record<string, FolderResult>):
  string[] => {
  if (folder.parent === undefined) {
    return [folder.name]
  }
  return [...getFullPath(idToFolder[folder.parent], idToFolder), folder.name]
}

export const importFileCabinet = async (suiteAppClient: SuiteAppClient, query: NetsuiteQuery):
Promise<ImportFileCabinetResult> => {
  if (!query.areSomeFilesMatch()) {
    return { elements: [], failedPaths: [] }
  }
  const [filesResults, foldersResults] = await Promise.all([
    queryFiles(suiteAppClient),
    queryFolders(suiteAppClient),
  ])

  const idToFolder = _.keyBy(foldersResults, folder => folder.id)

  const foldersCustomizationInfo = foldersResults.map(folder => ({
    path: getFullPath(folder, idToFolder),
    typeName: 'folder',
    values: {
      description: folder.description ?? '',
      bundleable: folder.bundleable ?? 'F',
      isinactive: folder.isinactive,
      isprivate: folder.isprivate,
    },
  })).filter(folder => query.isFileMatch(`/${folder.path.join('/')}`))

  const filesCustomizationInfoWithoutContent = filesResults.map(file => ({
    path: [...getFullPath(idToFolder[file.folder], idToFolder), file.name],
    typeName: 'file',
    values: {
      description: file.description ?? '',
      bundleable: file.bundleable ?? 'F',
      isinactive: file.isinactive,
      availablewithoutlogin: file.isonline,
      generateurltimestamp: file.addtimestamptourl,
      hideinbundle: file.hideinbundle,
    },
    id: file.id,
    size: parseInt(file.filesize, 10),
  })).filter(file => query.isFileMatch(`/${file.path.join('/')}`))

  const fileChunks = chunks.weightedChunks(
    filesCustomizationInfoWithoutContent,
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

        const results = await suiteAppClient.readFiles(fileChunk.map(f => parseInt(f.id, 10)))
        if (results === undefined) {
          throw new Error('Request for reading files from the file cabinet failed')
        }
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
  const filesCustomizationInfo = filesCustomizationInfoWithoutContent.map((file, index) => {
    if (!(filesContent[index] instanceof Buffer)) {
      log.warn(`Failed reading file /${file.path.join('/')} with id ${file.id}`)
      failedPaths.push(file.path)
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
    elements: [...foldersCustomizationInfo, ...filesCustomizationInfo].filter(file => query.isFileMatch(`/${file.path.join('/')}`)),
    failedPaths: failedPaths.map(fileCabinetPath => `/${fileCabinetPath.join('/')}`),
  }
}

const generatePathToIdMap = async (suiteAppClient: SuiteAppClient):
  Promise<Record<string, number>> => {
  const files = await queryFiles(suiteAppClient)
  const folders = await queryFolders(suiteAppClient)
  const idToFolder = _.keyBy(folders, folder => folder.id)
  return Object.fromEntries([
    ...files.map(file => [`/${[...getFullPath(idToFolder[file.folder], idToFolder), file.name].join('/')}`, parseInt(file.id, 10)]),
    ...folders.map(folder => [`/${getFullPath(folder, idToFolder).join('/')}`, parseInt(folder.id, 10)]),
  ])
}

const getContent = (content: string | StaticFile): Buffer =>
  (content instanceof StaticFile ? content.content : Buffer.from(content)) ?? Buffer.from('')

const convertToFileCabinetDetails = (
  change: Change<InstanceElement>,
  pathToId: Record<string, number>
): FileCabinetInstanceDetails | Error => {
  const instance = getChangeElement(change)
  const dirname = path.dirname(instance.value.path)
  if (dirname !== '/' && !(dirname in pathToId)) {
    return new Error(`Directory ${dirname} was not found when attempting to deploy a file with path ${instance.value.path}`)
  }

  return isFileInstance(instance)
    ? {
      type: 'file',
      path: instance.value.path,
      folder: pathToId[dirname],
      bundleable: instance.value.bundleable ?? false,
      isInactive: instance.value.isinactive ?? false,
      isOnline: instance.value.availablewithoutlogin ?? false,
      hideInBundle: instance.value.hideinbundle ?? false,
      content: getContent(instance.value.content),
      description: instance.value.description ?? '',
    }
    : {
      type: 'folder',
      path: instance.value.path,
      parent: dirname !== '/' ? pathToId[dirname] : undefined,
      bundleable: instance.value.bundleable ?? false,
      isInactive: instance.value.isinactive ?? false,
      isPrivate: instance.value.isprivate ?? false,
      description: instance.value.description ?? '',
    }
}

const convertToExistingFileCabinetDetails = (
  change: Change<InstanceElement>,
  pathToId: Record<string, number>
): ExistingFileCabinetInstanceDetails | Error => {
  const details = convertToFileCabinetDetails(change, pathToId)
  if (details instanceof Error) {
    return details
  }
  const instance = getChangeElement(change)
  if (pathToId[instance.value.path] === undefined) {
    log.warn(`Failed to find the internal id of the file ${instance.value.path}`)
    return new Error(`Failed to find the internal id of the file ${instance.value.path}`)
  }
  return { ...details, id: pathToId[instance.value.path] }
}

const deployChunk = async (
  suiteAppClient: SuiteAppClient,
  chunk: ReadonlyArray<Change<InstanceElement>>,
  pathToId: Record<string, number>,
  type: 'add' | 'update'
): Promise<DeployResult> => {
  log.debug(`Deploying chunk of ${chunk.length} files`)

  try {
    const instancesDetails = chunk.map(
      change => ({
        details: type === 'add' ? convertToFileCabinetDetails(change, pathToId) : convertToExistingFileCabinetDetails(change, pathToId),
        change,
      })
    )

    const [errorsInstances, validInstances] = _.partition(
      instancesDetails,
      ({ details }) => details instanceof Error,
    )

    const deployResults = type === 'add'
      ? await suiteAppClient.addFileCabinetInstances(
        validInstances.map(({ details }) => details as FileCabinetInstanceDetails)
      )
      : await suiteAppClient.updateFileCabinet(
        validInstances.map(
          ({ details }) => details as ExistingFileCabinetInstanceDetails
        )
      )

    log.debug(`Deployed chunk of ${chunk.length} files`)

    const [deployErrors, deployChanges] = _(deployResults)
      .map((res, index) => ({ res, change: validInstances[index].change }))
      .partition(({ res }) => res instanceof Error)
      .value()

    deployChanges.forEach(deployedChange => {
      pathToId[getChangeElement(deployedChange.change).value.path] = deployedChange.res as number
    })

    return {
      errors: [
        ...deployErrors.map(({ res }) => res as Error),
        ...errorsInstances.map(({ details }) => details as Error),
      ],
      appliedChanges: deployChanges.map(({ change }) => change),
    }
  } catch (e) {
    return { errors: [e], appliedChanges: [] }
  }
}

const deployChanges = async (
  suiteAppClient: SuiteAppClient,
  changes: ReadonlyArray<Change<InstanceElement>>,
  pathToId: Record<string, number>,
  type: 'add' | 'update'): Promise<DeployResult> => {
  const deployChunkResults = await Promise.all(
    _.chunk(changes, DEPLOY_CHUNK_SIZE)
      .map(chunk => deployChunk(suiteAppClient, chunk, pathToId, type))
  )
  return {
    appliedChanges: deployChunkResults
      .flatMap(deployChunkResult => deployChunkResult.appliedChanges),
    errors: deployChunkResults.flatMap(deployChunkResult => deployChunkResult.errors),
  }
}

const deployAdditions = async (
  suiteAppClient: SuiteAppClient,
  changes: ReadonlyArray<Change<InstanceElement>>,
  pathToId: Record<string, number>,
): Promise<DeployResult> => {
  const changesGroups = _(changes)
    .groupBy(change => getChangeElement(change).value.path.split('/').length)
    .entries()
    .sortBy(([depth]) => depth)
    .value()

  const deployResults = await promises.array.series(changesGroups
    .map(([depth, group]) => () => {
      log.debug(`Deploying ${group.length} new files with depth of ${depth}`)
      return deployChanges(suiteAppClient, group, pathToId, 'add')
    }))
  return {
    appliedChanges: deployResults.flatMap(deployResult => deployResult.appliedChanges),
    errors: deployResults.flatMap(deployResult => deployResult.errors),
  }
}

export const deploy = async (
  suiteAppClient: SuiteAppClient,
  changes: ReadonlyArray<Change<InstanceElement>>,
  type: 'add' | 'update'
): Promise<DeployResult> => {
  const pathToId = await generatePathToIdMap(suiteAppClient)
  const [modifications, additions] = _.partition(changes, isModificationChange)

  return type === 'add'
    ? deployAdditions(suiteAppClient, additions, pathToId)
    : deployChanges(suiteAppClient, modifications, pathToId, 'update')
}

export const isChangeDeployable = (
  change: Change
): boolean => {
  if (!isInstanceChange(change)) {
    return false
  }

  const changedElement = getChangeElement(change)
  if (!isFileCabinetType(changedElement.type)) {
    return false
  }

  // SuiteApp can't modify files bigger than 10mb
  if (isAdditionOrModificationChange(change)
    && isFileInstance(changedElement)
    && getContent(changedElement.value.content).toString('base64').length > MAX_DEPLOYABLE_FILE_SIZE) {
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
