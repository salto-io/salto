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
import _ from 'lodash'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { FileProperties, MetadataInfo, MetadataObject } from 'jsforce-types'
import { InstanceElement, ObjectType, TypeElement } from '@salto-io/adapter-api'
import { values as lowerDashValues, collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FetchElements, ConfigChangeSuggestion, MAX_ITEMS_IN_RETRIEVE_REQUEST, MAX_INSTANCES_PER_TYPE } from './types'
import {
  METADATA_CONTENT_FIELD,
  NAMESPACE_SEPARATOR,
  INTERNAL_ID_FIELD,
  DEFAULT_NAMESPACE,
  RETRIEVE_SIZE_LIMIT_ERROR,
  LAYOUT_TYPE_ID_METADATA_TYPE,
  CUSTOM_OBJECT,
  UNLIMITED_INSTANCES_VALUE,
  FOLDER_CONTENT_TYPE,
  API_NAME_SEPARATOR,
  INSTALLED_PACKAGE_METADATA,
} from './constants'
import SalesforceClient, { ErrorFilter } from './client/client'
import {
  createListMetadataObjectsConfigChange,
  createRetrieveConfigChange,
  createSkippedListConfigChange,
  createSkippedListConfigChangeFromError,
} from './config_change'
import { apiName, createInstanceElement, MetadataObjectType, createMetadataTypeElements, getAuthorAnnotations } from './transformers/transformer'
import { fromRetrieveResult, toRetrieveRequest, getManifestTypeName } from './transformers/xml_transformer'
import { MetadataQuery } from './fetch_profile/metadata_query'

const { isDefined } = lowerDashValues
const { makeArray, splitDuplicates } = collections.array
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

const withFullPath = (props: FileProperties, folderPathByName: Record<string, string>): FileProperties => {
  // the split is required since the fullName for a record within folder is FolderName/RecordName
  const folderName = props.fullName.split('/')[0]
  const fullPath = folderPathByName[folderName]
  return isDefined(fullPath)
    ? {
      ...props,
      fileName: props.fileName.replace(folderName, fullPath),
    }
    : props
}

const removeDuplicateFileProps = (files: FileProperties[]): FileProperties[] => {
  const { duplicates, uniques } = splitDuplicates(files, fileProps => `${fileProps.namespacePrefix}__${fileProps.fullName}`)
  duplicates.forEach(props => {
    log.warn('Found duplicate file props with the same name in response to listMetadataObjects: %o', props)
  })
  return uniques.concat(duplicates.map(props => props[0]))
}

export const listMetadataObjects = async (
  client: SalesforceClient,
  metadataTypeName: string,
  isUnhandledError?: ErrorFilter,
): Promise<FetchElements<FileProperties[]>> => {
  const { result, errors } = await client.listMetadataObjects(
    { type: metadataTypeName },
    isUnhandledError,
  )

  // Salesforce quirk, we sometimes get the same metadata fullName more than once
  const elements = removeDuplicateFileProps(result)

  return {
    elements,
    configChanges: errors
      .map(e => e.input)
      .map(createListMetadataObjectsConfigChange),
  }
}

const getNamespace = (obj: FileProperties): string => (
  obj.namespacePrefix === undefined || obj.namespacePrefix === '' ? DEFAULT_NAMESPACE : obj.namespacePrefix
)
export const notInSkipList = (metadataQuery: MetadataQuery, file: FileProperties, isFolderType: boolean): boolean => (
  metadataQuery.isInstanceMatch({
    namespace: getNamespace(file),
    metadataType: file.type,
    name: file.fullName,
    isFolderType,
  })
)

const listMetadataObjectsWithinFolders = async (
  client: SalesforceClient,
  metadataQuery: MetadataQuery,
  type: string,
  folderType: string,
  isUnhandledError?: ErrorFilter,
): Promise<FetchElements<FileProperties[]>> => {
  const folderPathByName = metadataQuery.getFolderPathsByName(folderType)
  const folders = await listMetadataObjects(client, folderType)
  const includedFolderElements = folders.elements
    .map(props => withFullPath(props, folderPathByName))
    .filter(props => notInSkipList(metadataQuery, props, true))
  const folderNames = Object.keys(folderPathByName)
    .concat(includedFolderElements.map(props => props.fullName))

  const { result, errors } = await client.listMetadataObjects(
    folderNames.map(folderName => ({ type, folder: folderName })),
    isUnhandledError,
  )
  const elements = result
    .map(props => withFullPath(props, folderPathByName))
    .concat(includedFolderElements)
  const configChanges = errors
    .map(e => e.input)
    .map(createListMetadataObjectsConfigChange)
    .concat(folders.configChanges)
  return { elements, configChanges }
}

const getFullName = (obj: FileProperties, addNamespacePrefixToFullName?: boolean): string => {
  if (!obj.namespacePrefix) {
    return obj.fullName
  }

  const namePrefix = `${obj.namespacePrefix}${NAMESPACE_SEPARATOR}`

  if (obj.type === LAYOUT_TYPE_ID_METADATA_TYPE) {
  // Ensure layout name starts with the namespace prefix if there is one.
  // needed due to a SF quirk where sometimes layout metadata instances fullNames return as
  // <namespace>__<objectName>-<layoutName> where it should be
  // <namespace>__<objectName>-<namespace>__<layoutName>
    const [objectName, ...layoutName] = obj.fullName.split('-')
    if (layoutName.length !== 0 && !layoutName[0].startsWith(namePrefix)) {
      return `${objectName}-${namePrefix}${layoutName.join('-')}`
    }
    return obj.fullName
  }

  if (obj.fullName.startsWith(namePrefix)) {
    return obj.fullName
  }
  if (addNamespacePrefixToFullName) {
    // Instances of type InstalledPackage fullNames should never include the namespace prefix
    if (obj.type === INSTALLED_PACKAGE_METADATA) {
      return obj.fullName
    }

    // In some cases, obj.fullName does not contain the namespace prefix even though
    // obj.namespacePrefix is defined. In these cases, we want to add the prefix manually
    if (obj.fullName.includes(API_NAME_SEPARATOR)) {
    // Case for API name with an object <Object>.X where it should be <Object>.<namespace>__X
      const [parentName, instanceName] = obj.fullName.split(API_NAME_SEPARATOR)
      return `${parentName}${API_NAME_SEPARATOR}${namePrefix}${instanceName}`
    }
    return `${namePrefix}${obj.fullName}`
  }
  log.debug('obj.fullName %s is missing namespace %s. Not adding because addNamespacePrefixToFullName is false. FileProps: %o', obj.fullName, obj.namespacePrefix, obj)
  return obj.fullName
}

const getPropsWithFullName = (obj: FileProperties, addNamespacePrefixToFullName?: boolean): FileProperties => {
  const correctFullName = getFullName(obj, addNamespacePrefixToFullName)
  return {
    ...obj,
    fullName: correctFullName,
    fileName: obj.fileName.includes(correctFullName)
      ? obj.fileName
      : obj.fileName.replace(obj.fullName, correctFullName),
  }
}

const getInstanceFromMetadataInformation = (metadata: MetadataInfo,
  filePropertiesMap: Record<string, FileProperties>, metadataType: ObjectType): InstanceElement => {
  const newMetadata = filePropertiesMap[metadata.fullName]?.id
    ? { ...metadata, [INTERNAL_ID_FIELD]: filePropertiesMap[metadata.fullName]?.id } : metadata
  return createInstanceElement(newMetadata, metadataType,
    filePropertiesMap[newMetadata.fullName]?.namespacePrefix,
    getAuthorAnnotations(filePropertiesMap[newMetadata.fullName]))
}

export const fetchMetadataInstances = async ({
  client, metadataType, fileProps, metadataQuery,
  maxInstancesPerType = UNLIMITED_INSTANCES_VALUE, addNamespacePrefixToFullName,
}: {
  client: SalesforceClient
  fileProps: FileProperties[]
  metadataType: ObjectType
  metadataQuery: MetadataQuery
  maxInstancesPerType?: number
  addNamespacePrefixToFullName?: boolean
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

  const filePropsToRead = fileProps
    .map(prop => ({
      ...prop,
      fullName: getFullName(prop, addNamespacePrefixToFullName),
    }))
    .filter(prop => metadataQuery.isInstanceMatch({
      namespace: getNamespace(prop),
      metadataType: metadataTypeName,
      name: prop.fullName,
      isFolderType: isDefined(metadataType.annotations[FOLDER_CONTENT_TYPE]),
    }))


  const { result: metadataInfos, errors } = await client.readMetadata(
    metadataTypeName,
    filePropsToRead.map(({ fullName }) => fullName)
  )

  const fullNamesFromRead = new Set(metadataInfos.map(info => info?.fullName))
  const missingMetadata = filePropsToRead.filter(prop => !fullNamesFromRead.has(prop.fullName))
  if (missingMetadata.length > 0) {
    log.debug('Missing metadata with valid fileProps: %o', missingMetadata)
  }

  const filePropertiesMap = _.keyBy(filePropsToRead, 'fullName')
  const elements = metadataInfos
    .filter(m => !_.isEmpty(m))
    .filter(m => m.fullName !== undefined)
    .map(m => getInstanceFromMetadataInformation(m, filePropertiesMap, metadataType))
  return {
    elements,
    configChanges: makeArray(errors)
      .map(({ input, error }) => createSkippedListConfigChangeFromError({
        creatorInput: { metadataType: metadataTypeName, name: input },
        error,
      })),
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
  addNamespacePrefixToFullName?: boolean
}

export const retrieveMetadataInstances = async ({
  client,
  types,
  maxItemsInRetrieveRequest,
  metadataQuery,
  addNamespacePrefixToFullName,
}: RetrieveMetadataInstancesArgs): Promise<FetchElements<InstanceElement[]>> => {
  const configChanges: ConfigChangeSuggestion[] = []

  const listFilesOfType = async (type: MetadataObjectType): Promise<FileProperties[]> => {
    const typeName = await apiName(type)
    const { folderType } = type.annotations
    const { elements: res, configChanges: listObjectsConfigChanges } = isDefined(folderType)
      ? await listMetadataObjectsWithinFolders(client, metadataQuery, typeName, folderType)
      : await listMetadataObjects(client, typeName)
    configChanges.push(...listObjectsConfigChanges)
    return _(res)
      .uniqBy(file => file.fullName)
      .map(file => getPropsWithFullName(file, addNamespacePrefixToFullName))
      .value()
  }

  const typesByName = await keyByAsync(types, t => apiName(t))
  const typesWithMetaFile = await getTypesWithMetaFile(types)
  const typesWithContent = await getTypesWithContent(types)

  const retrieveInstances = async (
    fileProps: ReadonlyArray<FileProperties>,
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
        'retrieve request for types %s failed, zipFile is %o, Result is %o',
        typesToRetrieve, result.zipFile, result,
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
  const filesToRetrieve = _.flatten(await Promise.all(
    types
      // We get folders as part of getting the records inside them
      .filter(type => type.annotations.folderContentType === undefined)
      .map(listFilesOfType)
  )).filter(props => notInSkipList(metadataQuery, props, false))

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
