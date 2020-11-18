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
import { FileProperties, MetadataObject } from 'jsforce-types'
import { InstanceElement, ObjectType, TypeElement } from '@salto-io/adapter-api'
import { values as lowerDashValues, collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FetchElements, ConfigChangeSuggestion } from './types'
import { METADATA_CONTENT_FIELD, NAMESPACE_SEPARATOR, INTERNAL_ID_FIELD } from './constants'
import SalesforceClient, { ErrorFilter } from './client/client'
import { createListMetadataObjectsConfigChange, createRetrieveConfigChange, createSkippedListConfigChange } from './config_change'
import { apiName, createInstanceElement, MetadataObjectType, createMetadataTypeElements } from './transformers/transformer'
import { fromRetrieveResult, toRetrieveRequest, getManifestTypeName } from './transformers/xml_transformer'

const { isDefined } = lowerDashValues
const { makeArray } = collections.array
const log = logger(module)

export const fetchMetadataType = async (
  client: SalesforceClient,
  typeInfo: MetadataObject,
  knownTypes: Map<string, TypeElement>,
  baseTypeNames: Set<string>,
  childTypeNames: Set<string>,
): Promise<TypeElement[]> => {
  const typeDesc = await client.describeMetadataType(typeInfo.xmlName)
  const folderType = typeInfo.inFolder ? typeDesc.parentField?.foreignKeyDomain : undefined
  const mainTypes = await createMetadataTypeElements({
    name: typeInfo.xmlName,
    fields: typeDesc.valueTypeFields,
    knownTypes,
    baseTypeNames,
    childTypeNames,
    client,
    annotations: {
      hasMetaFile: typeInfo.metaFile ? true : undefined,
      folderType,
      suffix: typeInfo.suffix,
      dirName: typeInfo.directoryName,
    },
  })
  const folderTypes = folderType === undefined
    ? []
    : await createMetadataTypeElements({
      name: folderType,
      fields: (await client.describeMetadataType(folderType)).valueTypeFields,
      knownTypes,
      baseTypeNames,
      childTypeNames,
      client,
      annotations: {
        hasMetaFile: true,
        folderContentType: typeInfo.xmlName,
        dirName: typeInfo.directoryName,
      },
    })
  return [...mainTypes, ...folderTypes]
}

export const listMetadataObjects = async (
  client: SalesforceClient,
  metadataTypeName: string,
  folders: string[],
  isUnhandledError?: ErrorFilter,
): Promise<FetchElements<FileProperties[]>> => {
  const { result, errors } = await client.listMetadataObjects(
    _.isEmpty(folders)
      ? { type: metadataTypeName }
      : folders.map(folder => ({ type: metadataTypeName, folder })),
    isUnhandledError
  )
  return {
    elements: result,
    configChanges: (errors ?? []).map(createListMetadataObjectsConfigChange),
  }
}

const getFullName = (obj: FileProperties): string => {
  const namePrefix = obj.namespacePrefix
    ? `${obj.namespacePrefix}${NAMESPACE_SEPARATOR}` : ''
  // Ensure fullName starts with the namespace prefix if there is one
  // needed due to a SF quirk where sometimes metadata instances return without a namespace
  // in the fullName even when they should have it
  return obj.fullName.startsWith(namePrefix) ? obj.fullName : `${namePrefix}${obj.fullName}`
}

export const fetchMetadataInstances = async ({
  client, metadataType, fileProps, instancesRegexSkippedList,
}: {
  client: SalesforceClient
  fileProps: FileProperties[]
  metadataType: ObjectType
  instancesRegexSkippedList: ReadonlyArray<RegExp> | undefined
}): Promise<FetchElements<InstanceElement[]>> => {
  if (fileProps.length === 0) {
    return { elements: [], configChanges: [] }
  }
  const metadataTypeName = apiName(metadataType)

  const { result: metadataInfos, errors } = await client.readMetadata(
    metadataTypeName,
    fileProps.map(getFullName)
      .filter(name => !((instancesRegexSkippedList ?? [])
        .some(re => re.test(`${metadataTypeName}.${name}`)))),
  )

  const fullNameToNamespaceAndId = Object.fromEntries(
    fileProps
      .map(props => [getFullName(props), {
        namespace: props.namespacePrefix,
        id: props.id,
      }])
  )

  return {
    elements: metadataInfos
      .filter(m => !_.isEmpty(m))
      .filter(m => m.fullName !== undefined)
      .map(m => (fullNameToNamespaceAndId[m.fullName]?.id
        ? { ...m, [INTERNAL_ID_FIELD]: fullNameToNamespaceAndId[m.fullName]?.id }
        : m
      ))
      .map(m => createInstanceElement(
        m,
        metadataType,
        fullNameToNamespaceAndId[m.fullName]?.namespace,
      )),
    configChanges: makeArray(errors)
      .map(e => createSkippedListConfigChange(metadataTypeName, e)),
  }
}

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
  instancesRegexSkippedList: ReadonlyArray<RegExp>
}

export const retrieveMetadataInstances = async ({
  client,
  types,
  maxItemsInRetrieveRequest,
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
    const { elements: res, configChanges: listObjectsConfigChanges } = await listMetadataObjects(
      client, folderType, []
    )
    configChanges.push(...listObjectsConfigChanges)
    return _(res)
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
    const { elements: res, configChanges: listObjectsConfigChanges } = await listMetadataObjects(
      client, apiName(type), folderNames.filter(isDefined)
    )
    configChanges.push(...listObjectsConfigChanges)
    return [
      ...folders.filter(isDefined),
      ..._.uniqBy(res, file => file.fullName),
    ]
  }

  const typesByName = _.keyBy(types, t => apiName(t))
  const typesWithMetaFile = getTypesWithMetaFile(types)
  const typesWithContent = getTypesWithContent(types)

  const retrieveInstances = async (
    fileProps: ReadonlyArray<FileProperties>
  ): Promise<InstanceElement[]> => {
    // Salesforce quirk - folder instances are listed under their content's type in the manifest
    const filesToRetrieve = fileProps.map(inst => (
      { ...inst, type: getManifestTypeName(typesByName[inst.type]) }
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
  const instances = await Promise.all(_.chunk(filesToRetrieve, maxItemsInRetrieveRequest)
    .filter(filesChunk => filesChunk.length > 0)
    .map(filesChunk => retrieveInstances(filesChunk)))

  return {
    elements: _.flatten(instances),
    configChanges,
  }
}
