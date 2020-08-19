/*
*                      Copyright 2020 Salto Labs Ltd.
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
import _ from 'lodash'
import { FileProperties } from 'jsforce-types'
import { InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { promises, values as lowerDashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FetchElements, ConfigChangeSuggestion } from './types'
import { METADATA_CONTENT_FIELD } from './constants'
import SalesforceClient from './client/client'
import { createListMetadataObjectsConfigChange, createRetrieveConfigChange } from './config_change'
import { apiName, createInstanceElement, MetadataObjectType } from './transformers/transformer'
import { fromRetrieveResult, toRetrieveRequest } from './transformers/xml_transformer'

const { isDefined } = lowerDashValues
const log = logger(module)

const getTypesWithContent = (types: ReadonlyArray<ObjectType>): Set<string> => new Set(
  types
    .filter(t => Object.keys(t.fields).includes(METADATA_CONTENT_FIELD))
    .map(t => apiName(t))
)

const getTypesWithMetaFile = (types: ReadonlyArray<MetadataObjectType>): Set<string> => new Set(
  types
    .filter(t => t.annotations.hasMetaFile === true)
    .map(t => apiName(t))
)

type RetrieveMetadataInstancesArgs = {
  client: SalesforceClient
  types: ReadonlyArray<MetadataObjectType>
  maxItemsInRetrieveRequest: number
  maxConcurrentRetrieveRequests: number
  instancesRegexSkippedList: ReadonlyArray<RegExp>
}

export const retrieveMetadataInstances = async ({
  client,
  types,
  maxItemsInRetrieveRequest,
  maxConcurrentRetrieveRequests,
  instancesRegexSkippedList,
}: RetrieveMetadataInstancesArgs): Promise<FetchElements<InstanceElement[]>> => {
  const configChanges: ConfigChangeSuggestion[] = []

  const notInSkipList = (file: FileProperties): boolean => (
    !instancesRegexSkippedList.some(re => re.test(`${file.type}.${file.fullName}`))
  )

  const getFolders = async (type: MetadataObjectType): Promise<(FileProperties | undefined)[]> => {
    const { folderType } = type.annotations
    if (folderType === undefined) {
      return [undefined]
    }
    const { result, errors } = await client.listMetadataObjects({ type: folderType })
    configChanges.push(...errors.map(createListMetadataObjectsConfigChange))
    return _(result)
      .filter(notInSkipList)
      .uniqBy(file => file.fullName)
      .value()
  }

  const listFilesOfType = async (type: MetadataObjectType): Promise<FileProperties[]> => {
    if (type.annotations.folderContentType !== undefined) {
      // We get folders as part of getting the records inside them
      return []
    }
    const folders = await getFolders(type)
    const folderNames = folders.map(folder => (folder === undefined ? folder : folder.fullName))
    const { result, errors } = await client.listMetadataObjects(
      folderNames.map(folder => ({ type: apiName(type), folder }))
    )
    configChanges.push(...errors.map(createListMetadataObjectsConfigChange))
    return [
      ...folders.filter(isDefined),
      ..._.uniqBy(result, file => file.fullName),
    ]
  }

  const typesByName = _.keyBy(types, t => apiName(t))
  const typesWithMetaFile = getTypesWithMetaFile(types)
  const typesWithContent = getTypesWithContent(types)

  const retrieveInstances = async (
    fileProps: ReadonlyArray<FileProperties>
  ): Promise<InstanceElement[]> => {
    log.info('retrieving %d files', fileProps.length)
    // Because of a salesforce quirk, in order to get folder instances we actually need to use the
    // "child" type with the folder fullName
    const filesToRetrieve = fileProps.map(inst => (
      { ...inst, type: typesByName[inst.type]?.annotations?.folderContentType ?? inst.type }
    ))
    const request = toRetrieveRequest(filesToRetrieve)
    const result = await client.retrieve(request)
    configChanges.push(...createRetrieveConfigChange(result))
    const allValues = await fromRetrieveResult(
      result,
      fileProps,
      typesWithMetaFile,
      typesWithContent,
    )
    return allValues.map(({ file, values }) => (
      createInstanceElement(values, typesByName[file.type], file.namespacePrefix)
    ))
  }

  const filesToRetrieve = _.flatten(await Promise.all(types.map(listFilesOfType)))
    .filter(notInSkipList)

  log.info('going to retrieve %d files', filesToRetrieve.length)
  const instances = await promises.array.withLimitedConcurrency(
    _.chunk(filesToRetrieve, maxItemsInRetrieveRequest)
      .filter(filesChunk => filesChunk.length > 0)
      .map(filesChunk => () => retrieveInstances(filesChunk)),
    maxConcurrentRetrieveRequests,
  )

  return {
    elements: _.flatten(instances),
    configChanges,
  }
}
