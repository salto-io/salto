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
import { FetchElements, ConfigChangeSuggestion } from './types'
import { FOLDER_TYPE, METADATA_CONTENT_FIELD, HAS_META_FILE, IS_FOLDER } from './constants'
import SalesforceClient from './client/client'
import { createListMetadataObjectsConfigChange, createRetrieveConfigChange } from './config_change'
import { apiName, createInstanceElement } from './transformers/transformer'
import { fromRetrieveResult, toRetrieveRequest } from './transformers/xml_transformer'

const { isDefined } = lowerDashValues

const getTypesWithContent = (types: ReadonlyArray<ObjectType>): Set<string> => new Set(
  types
    .filter(t => Object.keys(t.fields).includes(METADATA_CONTENT_FIELD))
    .map(t => apiName(t))
)

const getTypesWithMetaFile = (types: ReadonlyArray<ObjectType>): Set<string> => new Set(
  types
    .filter(t => t.annotations[HAS_META_FILE] === true)
    .map(t => apiName(t))
)

type RetreiveMetadataInstancesArgs = {
  client: SalesforceClient
  types: ReadonlyArray<ObjectType>
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
}: RetreiveMetadataInstancesArgs): Promise<FetchElements<InstanceElement[]>> => {
  const configChanges: ConfigChangeSuggestion[] = []

  const notInSkipList = (file: FileProperties): boolean => (
    !instancesRegexSkippedList.some(re => re.test(`${file.type}.${file.fullName}`))
  )

  const getFolders = async (type: ObjectType): Promise<(FileProperties | undefined)[]> => {
    const folderType = type.annotations[FOLDER_TYPE]
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

  const listFilesOfType = async (type: ObjectType): Promise<FileProperties[]> => {
    if (type.annotations[IS_FOLDER] === true) {
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
  const folderToChildType = _(types)
    .filter(type => FOLDER_TYPE in type.annotations)
    .map(type => [type.annotations[FOLDER_TYPE], apiName(type)])
    .fromPairs()
    .value()
  const typesWithMetaFile = getTypesWithMetaFile(types)
  const typesWithContent = getTypesWithContent(types)

  const retrieveInstances = async (
    fileProps: ReadonlyArray<FileProperties>
  ): Promise<InstanceElement[]> => {
    // Because of a salesforce quirk, in order to get folder instances we actually need to use the
    // "child" type with the folder fullName
    const filesToRetrieve = fileProps.map(inst => (
      inst.type in folderToChildType
        ? { ...inst, type: folderToChildType[inst.type] }
        : inst
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
