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
import _ from 'lodash'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { FileProperties, MetadataInfo, MetadataObject } from 'jsforce-types'
import { InstanceElement, ObjectType, TypeElement } from '@salto-io/adapter-api'
import { values as lowerDashValues, collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FetchElements, ConfigChangeSuggestion, MAX_ITEMS_IN_RETRIEVE_REQUEST, MAX_INSTANCES_PER_TYPE } from './types'
import {
  METADATA_CONTENT_FIELD, NAMESPACE_SEPARATOR, INTERNAL_ID_FIELD, DEFAULT_NAMESPACE,
  RETRIEVE_SIZE_LIMIT_ERROR, LAYOUT_TYPE_ID_METADATA_TYPE, CUSTOM_OBJECT, UNLIMITED_INSTANCES_VALUE,
} from './constants'
import SalesforceClient, { ErrorFilter } from './client/client'
import { createListMetadataObjectsConfigChange, createRetrieveConfigChange, createSkippedListConfigChange } from './config_change'
import { apiName, createInstanceElement, MetadataObjectType, createMetadataTypeElements, getAuthorAnnotations } from './transformers/transformer'
import { fromRetrieveResult, toRetrieveRequest, getManifestTypeName } from './transformers/xml_transformer'
import { MetadataQuery } from './fetch_profile/metadata_query'

const { isDefined } = lowerDashValues
const { makeArray } = collections.array
const { awu, keyByAsync } = collections.asynciterable
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
  const fullNameWithCorrectedObjectName = obj.fullName.startsWith(namePrefix) ? obj.fullName : `${namePrefix}${obj.fullName}`
  if (obj.type === LAYOUT_TYPE_ID_METADATA_TYPE && obj.namespacePrefix) {
  // Ensure layout name starts with the namespace prefix if there is one.
  // needed due to a SF quirk where sometimes layout metadata instances fullNames return as
  // <namespace>__<objectName>-<layoutName> where it should be
  // <namespace>__<objectName>-<namespace>__<layoutName>
    const [objectName, ...layoutName] = fullNameWithCorrectedObjectName.split('-')
    if (layoutName.length !== 0 && !layoutName[0].startsWith(obj.namespacePrefix)) {
      return `${objectName}-${namePrefix}${layoutName.join('-')}`
    }
  }
  return fullNameWithCorrectedObjectName
}

const getNamespace = (obj: FileProperties): string => (
  obj.namespacePrefix === undefined || obj.namespacePrefix === '' ? DEFAULT_NAMESPACE : obj.namespacePrefix
)

const getInstanceFromMetadataInformation = (metadata: MetadataInfo,
  filePropertiesMap: Record<string, FileProperties>, metadataType: ObjectType): InstanceElement => {
  const newMetadata = filePropertiesMap[metadata.fullName]?.id
    ? { ...metadata, [INTERNAL_ID_FIELD]: filePropertiesMap[metadata.fullName]?.id } : metadata
  return createInstanceElement(newMetadata, metadataType,
    filePropertiesMap[newMetadata.fullName]?.namespacePrefix,
    getAuthorAnnotations(filePropertiesMap[newMetadata.fullName]))
}

export const fetchMetadataInstances = async ({
  client, metadataType, fileProps, metadataQuery, maxInstancesPerType = UNLIMITED_INSTANCES_VALUE,
}: {
  client: SalesforceClient
  fileProps: FileProperties[]
  metadataType: ObjectType
  metadataQuery: MetadataQuery
  maxInstancesPerType?: number
}): Promise<FetchElements<InstanceElement[]>> => {
  if (fileProps.length === 0) {
    return { elements: [], configChanges: [] }
  }

  const typeName = fileProps[0].type
  const instancesCount = fileProps.length
  // We exclude metadataTypes with too many instances to avoid unwanted big and slow requests
  // CustomObjects are checked in another flow
  if (typeName !== CUSTOM_OBJECT
      && maxInstancesPerType !== UNLIMITED_INSTANCES_VALUE
      && instancesCount > maxInstancesPerType) {
    const reason = `'${typeName}' has ${instancesCount} instances so it was skipped and would be excluded from future fetch operations, as ${MAX_INSTANCES_PER_TYPE} is set to ${maxInstancesPerType}.
      If you wish to fetch it anyway, remove it from your app configuration exclude block and increase maxInstancePerType to the desired value (${UNLIMITED_INSTANCES_VALUE} for unlimited).`
    const skippedListConfigChange = createSkippedListConfigChange({ type: typeName, reason })
    return {
      elements: [],
      configChanges: [skippedListConfigChange],
    }
  }

  const metadataTypeName = await apiName(metadataType)

  const { result: metadataInfos, errors } = await client.readMetadata(
    metadataTypeName,
    fileProps.map(
      prop => ({
        name: getFullName(prop),
        namespace: getNamespace(prop),
      })
    ).filter(
      ({ name, namespace }) => metadataQuery.isInstanceMatch({
        namespace,
        metadataType: metadataTypeName,
        name,
      })
    ).map(({ name }) => name),
  )

  const filePropertiesMap = _.keyBy(fileProps, getFullName)
  const elements = metadataInfos
    .filter(m => !_.isEmpty(m))
    .filter(m => m.fullName !== undefined)
    .map(m => getInstanceFromMetadataInformation(m, filePropertiesMap, metadataType))
  return {
    elements,
    configChanges: makeArray(errors)
      .map(e => createSkippedListConfigChange({ type: metadataTypeName, instance: e })),
  }
}

const getTypesWithContent = async (
  types: ReadonlyArray<ObjectType>
): Promise<Set<string>> => new Set(
  await awu(types)
    .filter(t => Object.keys(t.fields).includes(METADATA_CONTENT_FIELD))
    .map(t => apiName(t))
    .toArray()
)

const getTypesWithMetaFile = async (
  types: ReadonlyArray<MetadataObjectType>
): Promise<Set<string>> => new Set(
  await awu(types)
    .filter(t => t.annotations.hasMetaFile === true)
    .map(t => apiName(t))
    .toArray()
)

type RetrieveMetadataInstancesArgs = {
  client: SalesforceClient
  types: ReadonlyArray<MetadataObjectType>
  maxItemsInRetrieveRequest: number
  metadataQuery: MetadataQuery
}

export const retrieveMetadataInstances = async ({
  client,
  types,
  maxItemsInRetrieveRequest,
  metadataQuery,
}: RetrieveMetadataInstancesArgs): Promise<FetchElements<InstanceElement[]>> => {
  const configChanges: ConfigChangeSuggestion[] = []

  const notInSkipList = (file: FileProperties): boolean => (
    metadataQuery.isInstanceMatch({
      namespace: getNamespace(file),
      metadataType: file.type,
      name: file.fullName,
    })
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
      client, await apiName(type), folderNames.filter(isDefined)
    )
    configChanges.push(...listObjectsConfigChanges)
    return [
      ...folders.filter(isDefined),
      ..._.uniqBy(res, file => file.fullName),
    ]
  }

  const typesByName = await keyByAsync(types, t => apiName(t))
  const typesWithMetaFile = await getTypesWithMetaFile(types)
  const typesWithContent = await getTypesWithContent(types)

  const retrieveInstances = async (
    fileProps: ReadonlyArray<FileProperties>
  ): Promise<InstanceElement[]> => {
    // Salesforce quirk - folder instances are listed under their content's type in the manifest
    const filesToRetrieve = fileProps.map(inst => (
      { ...inst, type: getManifestTypeName(typesByName[inst.type]) }
    ))
    const typesToRetrieve = [...new Set(filesToRetrieve.map(prop => prop.type))].join(',')
    log.debug('retrieving types %s', typesToRetrieve)
    const request = toRetrieveRequest(filesToRetrieve)
    const result = await client.retrieve(request)

    log.debug(
      'retrieve result for types %s: %o',
      typesToRetrieve, _.omit(result, ['zipFile', 'fileProperties']),
    )

    if (result.errorStatusCode === RETRIEVE_SIZE_LIMIT_ERROR) {
      if (fileProps.length <= 1) {
        configChanges.push(...fileProps.map(fileProp =>
          createSkippedListConfigChange({ type: fileProp.type, instance: fileProp.fullName })))
        log.warn(`retrieve request for ${typesToRetrieve} failed: ${result.errorStatusCode} ${result.errorMessage}, adding to skip list`)
        return []
      }

      const chunkSize = Math.ceil(fileProps.length / 2)
      log.debug('reducing retrieve item count %d -> %d', fileProps.length, chunkSize)
      configChanges.push({ type: MAX_ITEMS_IN_RETRIEVE_REQUEST, value: chunkSize })
      return (await Promise.all(_.chunk(fileProps, chunkSize).map(retrieveInstances))).flat()
    }

    configChanges.push(...createRetrieveConfigChange(result))
    // Unclear when / why this can happen, but it seems like sometimes zipFile is not a string
    // TODO: investigate further why this happens and find a better solution than just failing
    if (!_.isString(result.zipFile)) {
      log.warn(
        'retrieve request for types %s failed, zipFile is %o',
        typesToRetrieve, result.zipFile,
      )
      throw new Error(`Retrieve request for ${typesToRetrieve} failed. messages: ${safeJsonStringify(result.messages)}`)
    }
    const allValues = await fromRetrieveResult(
      result,
      fileProps,
      typesWithMetaFile,
      typesWithContent,
    )
    return allValues.map(({ file, values }) => (
      createInstanceElement(values, typesByName[file.type], file.namespacePrefix,
        getAuthorAnnotations(file))
    ))
  }

  const filesToRetrieve = _.flatten(await Promise.all(types.map(listFilesOfType)))
    .filter(notInSkipList)

  log.info('going to retrieve %d files', filesToRetrieve.length)

  const instances = await Promise.all(
    _.chunk(filesToRetrieve, maxItemsInRetrieveRequest)
      .filter(filesChunk => filesChunk.length > 0)
      .map(filesChunk => retrieveInstances(filesChunk))
  )

  return {
    elements: _.flatten(instances),
    configChanges,
  }
}
