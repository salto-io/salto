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
import { logger } from '@salto-io/logging'
import { chunks, values } from '@salto-io/lowerdash'
import Ajv from 'ajv'
import _ from 'lodash'
import { ReadFileEncodingError } from './client/suiteapp_client/errors'
import SuiteAppClient from './client/suiteapp_client/suiteapp_client'
import { ImportFileCabinetResult } from './client/types'
import { NetsuiteQuery } from './query'

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
    failedPaths: failedPaths.map(path => `/${path.join('/')}`),
  }
}
