/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import {
  FileProperties,
  MetadataInfo,
  MetadataObject,
} from '@salto-io/jsforce-types'
import { InstanceElement, ObjectType, TypeElement } from '@salto-io/adapter-api'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import {
  ConfigChangeSuggestion,
  FetchElements,
  FetchProfile,
  isMetadataConfigSuggestions,
  MAX_INSTANCES_PER_TYPE,
  MAX_ITEMS_IN_RETRIEVE_REQUEST,
  MetadataInstance,
  MetadataQuery,
} from './types'
import {
  CUSTOM_OBJECT,
  DEFAULT_NAMESPACE,
  FOLDER_CONTENT_TYPE,
  INTERNAL_ID_FIELD,
  METADATA_CONTENT_FIELD,
  PROFILE_METADATA_TYPE,
  RETRIEVE_SIZE_LIMIT_ERROR,
  UNLIMITED_INSTANCES_VALUE,
} from './constants'
import SalesforceClient, { ErrorFilter } from './client/client'
import {
  createListMetadataObjectsConfigChange,
  createRetrieveConfigChange,
  createSkippedListConfigChange,
  createSkippedListConfigChangeFromError,
} from './config_change'
import {
  apiName,
  createInstanceElement,
  createMetadataTypeElements,
  getAuthorAnnotations,
  MetadataObjectType,
} from './transformers/transformer'
import {
  fromRetrieveResult,
  getManifestTypeName,
  toRetrieveRequest,
} from './transformers/xml_transformer'
import {
  getFullName,
  isInstanceOfTypeSync,
  isProfileRelatedMetadataType,
  listMetadataObjects,
} from './filters/utils'
import { buildFilePropsMetadataQuery } from './fetch_profile/metadata_query'

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
  const folderType = typeInfo.inFolder
    ? typeDesc.parentField?.foreignKeyDomain
    : undefined
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
  const folderTypes =
    folderType === undefined
      ? []
      : await createMetadataTypeElements({
          name: folderType,
          fields: (await client.describeMetadataType(folderType))
            .valueTypeFields,
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

const withFullPath = (
  props: FileProperties,
  folderPathByName: Record<string, string>,
): FileProperties => {
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

const getNamespace = (obj: FileProperties): string =>
  obj.namespacePrefix === undefined || obj.namespacePrefix === ''
    ? DEFAULT_NAMESPACE
    : obj.namespacePrefix
export const notInSkipList = (
  metadataQuery: MetadataQuery,
  file: FileProperties,
  isFolderType: boolean,
): boolean =>
  isFolderType
    ? // We should always list folders, even if they were not modified.
      metadataQuery.isInstanceIncluded({
        namespace: getNamespace(file),
        metadataType: file.type,
        name: file.fullName,
        isFolderType,
        changedAt: file.lastModifiedDate,
      })
    : metadataQuery.isInstanceMatch({
        namespace: getNamespace(file),
        metadataType: file.type,
        name: file.fullName,
        isFolderType,
        changedAt: file.lastModifiedDate,
      })

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
    .map((props) => withFullPath(props, folderPathByName))
    .filter((props) => notInSkipList(metadataQuery, props, true))
  const folderNames = Object.keys(folderPathByName).concat(
    includedFolderElements.map((props) => props.fullName),
  )

  const { result, errors } = await client.listMetadataObjects(
    folderNames.map((folderName) => ({ type, folder: folderName })),
    isUnhandledError,
  )
  const elements = result
    .map((props) => withFullPath(props, folderPathByName))
    .concat(includedFolderElements)
  const configChanges = errors
    .map((e) => e.input)
    .map(createListMetadataObjectsConfigChange)
    .concat(folders.configChanges)
  return { elements, configChanges }
}

const getPropsWithFullName = (
  obj: FileProperties,
  addNamespacePrefixToFullName: boolean,
  orgNamespace?: string,
): FileProperties => {
  // Do not run getFullName logic if the namespace of the instance is the current org namespace.
  // If we couldn't determine the namespace of the org, we will run the logic for all the instances.
  const correctFullName =
    orgNamespace === undefined || obj.namespacePrefix !== orgNamespace
      ? getFullName(obj, addNamespacePrefixToFullName)
      : obj.fullName
  return {
    ...obj,
    fullName: correctFullName,
    fileName: obj.fileName.includes(correctFullName)
      ? obj.fileName
      : obj.fileName.replace(obj.fullName, correctFullName),
  }
}

const getInstanceFromMetadataInformation = (
  metadata: MetadataInfo,
  filePropertiesMap: Record<string, FileProperties>,
  metadataType: ObjectType,
): InstanceElement => {
  const newMetadata =
    filePropertiesMap[metadata.fullName]?.id !== undefined &&
    filePropertiesMap[metadata.fullName]?.id !== ''
      ? {
          ...metadata,
          [INTERNAL_ID_FIELD]: filePropertiesMap[metadata.fullName]?.id,
        }
      : metadata
  return createInstanceElement(
    newMetadata,
    metadataType,
    filePropertiesMap[newMetadata.fullName]?.namespacePrefix,
    getAuthorAnnotations(filePropertiesMap[newMetadata.fullName]),
  )
}

export const fetchMetadataInstances = async ({
  client,
  metadataType,
  fileProps,
  metadataQuery,
  maxInstancesPerType = UNLIMITED_INSTANCES_VALUE,
  addNamespacePrefixToFullName = true,
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
  if (
    typeName !== CUSTOM_OBJECT &&
    maxInstancesPerType !== UNLIMITED_INSTANCES_VALUE &&
    instancesCount > maxInstancesPerType
  ) {
    const reason = `'${typeName}' has ${instancesCount} instances so it was skipped and would be excluded from future fetch operations, as ${MAX_INSTANCES_PER_TYPE} is set to ${maxInstancesPerType}.
      If you wish to fetch it anyway, remove it from your app configuration exclude block and increase maxInstancePerType to the desired value (${UNLIMITED_INSTANCES_VALUE} for unlimited).`
    const skippedListConfigChange = createSkippedListConfigChange({
      type: typeName,
      reason,
    })
    return {
      elements: [],
      configChanges: [skippedListConfigChange],
    }
  }

  const metadataTypeName = await apiName(metadataType)

  const filePropsToRead = fileProps
    .map((prop) => ({
      ...prop,
      fullName: getFullName(prop, addNamespacePrefixToFullName),
    }))
    .filter((prop) =>
      metadataQuery.isInstanceMatch({
        namespace: getNamespace(prop),
        metadataType: metadataTypeName,
        name: prop.fullName,
        isFolderType: isDefined(metadataType.annotations[FOLDER_CONTENT_TYPE]),
        changedAt: prop.lastModifiedDate,
      }),
    )

  // Avoid sending empty requests for types that had no instances that were changed from the previous fetch
  // This is a common case for fetchWithChangesDetection mode for types that had no changes on their instances
  if (filePropsToRead.length === 0) {
    return { elements: [], configChanges: [] }
  }

  const { result: metadataInfos, errors } = await client.readMetadata(
    metadataTypeName,
    filePropsToRead.map(({ fullName }) => fullName),
  )

  const fullNamesFromRead = new Set(metadataInfos.map((info) => info?.fullName))
  const missingMetadata = filePropsToRead.filter(
    (prop) => !fullNamesFromRead.has(prop.fullName),
  )
  if (missingMetadata.length > 0) {
    log.debug('Missing metadata with valid fileProps: %o', missingMetadata)
  }

  const filePropertiesMap = _.keyBy(filePropsToRead, 'fullName')
  const elements = metadataInfos
    .filter((m) => !_.isEmpty(m))
    .filter((m) => m.fullName !== undefined)
    .map((m) =>
      getInstanceFromMetadataInformation(m, filePropertiesMap, metadataType),
    )
  return {
    elements,
    configChanges: makeArray(errors).map(({ input, error }) =>
      createSkippedListConfigChangeFromError({
        creatorInput: { metadataType: metadataTypeName, name: input },
        error,
      }),
    ),
  }
}

const getTypesWithContent = async (
  types: ReadonlyArray<ObjectType>,
): Promise<Set<string>> =>
  new Set(
    await awu(types)
      .filter((t) => Object.keys(t.fields).includes(METADATA_CONTENT_FIELD))
      .map((t) => apiName(t))
      .toArray(),
  )

const getTypesWithMetaFile = async (
  types: ReadonlyArray<MetadataObjectType>,
): Promise<Set<string>> =>
  new Set(
    await awu(types)
      .filter((t) => t.annotations.hasMetaFile === true)
      .map((t) => apiName(t))
      .toArray(),
  )

type RetrieveMetadataInstancesArgs = {
  client: SalesforceClient
  types: ReadonlyArray<MetadataObjectType>
  fetchProfile: FetchProfile
  // Some types are retrieved via filters and should not be fetched in the normal fetch flow. However, we need these
  // types as context for profiles - when fetching profiles using retrieve we only get information about the types that
  // are included in the same retrieve request as the profile. Thus typesToSkip - a list of types that will be retrieved
  // along with the profiles, but discarded.
  typesToSkip?: ReadonlySet<string>
  getFilesToRetrieveFunc?: (allProps: FileProperties[]) => FileProperties[]
}

type Partitions = {
  profileProps: FileProperties[]
  profilesRelatedProps: FileProperties[]
  nonProfileProps: FileProperties[]
}

const getPartitions = (includedProps: FileProperties[]): Partitions => {
  const [profileProps, otherProps] = _.partition(
    includedProps,
    (file) => file.type === PROFILE_METADATA_TYPE,
  )
  const [profilesRelatedProps, nonProfileProps] = _.partition(
    otherProps,
    (file) => isProfileRelatedMetadataType(file.type),
  )
  return { profileProps, profilesRelatedProps, nonProfileProps }
}

export const retrieveMetadataInstances = async ({
  client,
  types,
  fetchProfile,
  typesToSkip = new Set(),
  getFilesToRetrieveFunc,
}: RetrieveMetadataInstancesArgs): Promise<
  FetchElements<InstanceElement[]>
> => {
  const configChanges: ConfigChangeSuggestion[] = []
  const { metadataQuery, maxItemsInRetrieveRequest } = fetchProfile
  const getFilesToRetrieve =
    getFilesToRetrieveFunc ??
    ((allProps) =>
      allProps.filter((props) => notInSkipList(metadataQuery, props, false)))

  const listFilesOfType = async (
    type: MetadataObjectType,
  ): Promise<FileProperties[]> => {
    const typeName = await apiName(type)
    const { folderType } = type.annotations
    const { elements: res, configChanges: listObjectsConfigChanges } =
      isDefined(folderType)
        ? await listMetadataObjectsWithinFolders(
            client,
            metadataQuery,
            typeName,
            folderType,
          )
        : await listMetadataObjects(client, typeName)
    configChanges.push(...listObjectsConfigChanges)
    return _(res)
      .uniqBy((file) => file.fullName)
      .map((file) =>
        getPropsWithFullName(
          file,
          fetchProfile.addNamespacePrefixToFullName,
          client.orgNamespace,
        ),
      )
      .value()
  }

  const typesByName = await keyByAsync(types, (t) => apiName(t))
  const typesWithMetaFile = await getTypesWithMetaFile(types)
  const typesWithContent = await getTypesWithContent(types)

  const mergeProfileInstances = (
    instances: ReadonlyArray<InstanceElement>,
  ): InstanceElement => {
    const result = instances[0].clone()
    result.value = _.merge({}, ...instances.map((instance) => instance.value))
    return result
  }

  const configChangeAlreadyExists = (
    change: ConfigChangeSuggestion,
  ): boolean => {
    if (!isMetadataConfigSuggestions(change)) {
      return false
    }
    if (
      change.value.metadataType === undefined ||
      change.value.name === undefined
    ) {
      return false
    }
    // Note: we assume metadata exclusion config changes refer to a single instance and do not include regexes.
    const metadataInstance: MetadataInstance = {
      isFolderType: false,
      metadataType: change.value.metadataType,
      name: change.value.name,
      namespace: change.value.namespace ?? '',
      changedAt: undefined,
    }
    if (!fetchProfile.metadataQuery.isInstanceIncluded(metadataInstance)) {
      log.debug(
        'Would have ignored config change %o because the instance is already excluded',
        change,
      )
    }
    return false
  }

  const retrieveInstances = async (
    fileProps: ReadonlyArray<FileProperties>,
    filePropsToSendWithEveryChunk: ReadonlyArray<FileProperties> = [],
  ): Promise<InstanceElement[]> => {
    const allFileProps = fileProps.concat(filePropsToSendWithEveryChunk)
    // Salesforce quirk - folder instances are listed under their content's type in the manifest
    const filesToRetrieve = allFileProps.map((inst) => ({
      ...inst,
      type: getManifestTypeName(typesByName[inst.type]),
    }))
    const typesToRetrieve = [
      ...new Set(filesToRetrieve.map((prop) => prop.type)),
    ].join(',')
    log.debug('retrieving types %s', typesToRetrieve)
    const request = toRetrieveRequest(filesToRetrieve)
    const result = await client.retrieve(request)

    log.debug(
      'retrieve result for types %s: %o',
      typesToRetrieve,
      _.omit(result, ['zipFile', 'fileProperties']),
    )

    if (result.errorStatusCode === RETRIEVE_SIZE_LIMIT_ERROR) {
      if (fileProps.length <= 1) {
        if (filePropsToSendWithEveryChunk.length > 0) {
          log.warn(
            'retrieve request for %s failed with %d elements that can`t be removed from the request',
            typesToRetrieve,
            filePropsToSendWithEveryChunk.length,
          )
          throw new Error('Retrieve size limit exceeded')
        }

        configChanges.push(
          ...fileProps.map((fileProp) =>
            createSkippedListConfigChange({
              type: fileProp.type,
              instance: fileProp.fullName,
            }),
          ),
        )
        log.warn(
          `retrieve request for ${typesToRetrieve} failed: ${result.errorStatusCode} ${result.errorMessage}, adding to skip list`,
        )
        return []
      }

      const chunkSize = Math.ceil(fileProps.length / 2)
      log.debug(
        'reducing retrieve item count %d -> %d',
        fileProps.length,
        chunkSize,
      )
      configChanges.push({
        type: MAX_ITEMS_IN_RETRIEVE_REQUEST,
        value: chunkSize,
      })
      return (
        await Promise.all(
          _.chunk(
            fileProps,
            chunkSize - filePropsToSendWithEveryChunk.length,
          ).map((chunk) =>
            retrieveInstances(chunk, filePropsToSendWithEveryChunk),
          ),
        )
      ).flat()
    }

    const newConfigChanges = createRetrieveConfigChange(result).filter(
      (change) => !configChangeAlreadyExists(change),
    )
    configChanges.push(...newConfigChanges)
    // if we get an error then result.zipFile will be a single 'nil' XML element, which will be parsed as an object by
    // our XML->json parser. Since we only deal with RETRIEVE_SIZE_LIMIT_ERROR above, here is where we handle all other
    // errors.
    if (!_.isString(result.zipFile)) {
      log.warn(
        'retrieve request for types %s failed, zipFile is %o, Result is %o',
        typesToRetrieve,
        result.zipFile,
        result,
      )
      throw new Error(
        `Retrieve request for ${typesToRetrieve} failed. messages: ${makeArray(safeJsonStringify(result.messages)).concat(result.errorMessage ?? [])}`,
      )
    }

    const allValues = await fromRetrieveResult(
      result,
      allFileProps,
      typesWithMetaFile,
      typesWithContent,
      fetchProfile.isFeatureEnabled('fixRetrieveFilePaths'),
    )
    return allValues.map(({ file, values }) =>
      createInstanceElement(
        values,
        typesByName[file.type],
        file.namespacePrefix,
        getAuthorAnnotations(file),
      ),
    )
  }

  const retrieveProfilesWithContextTypes = async (
    profileFileProps: ReadonlyArray<FileProperties>,
    contextFileProps: ReadonlyArray<FileProperties>,
  ): Promise<Array<InstanceElement>> => {
    const allInstances = await Promise.all(
      _.chunk(
        contextFileProps,
        maxItemsInRetrieveRequest - profileFileProps.length,
      )
        .filter((filesChunk) => filesChunk.length > 0)
        .map((filesChunk) => retrieveInstances(filesChunk, profileFileProps)),
    )

    const [partialProfileInstances, contextInstances] = _(allInstances)
      .flatten()
      .partition(
        (instance) => instance.elemID.typeName === PROFILE_METADATA_TYPE,
      )
      .value()

    const profileInstances = _(partialProfileInstances)
      .filter((instance) => instance.elemID.typeName === PROFILE_METADATA_TYPE)
      .groupBy((instance) => instance.value.fullName)
      .mapValues(mergeProfileInstances)
      .value()

    return contextInstances.concat(Object.values(profileInstances))
  }

  const allProps = _.flatten(
    await Promise.all(
      types
        // We get folders as part of getting the records inside them
        .filter((type) => type.annotations.folderContentType === undefined)
        .map(listFilesOfType),
    ),
  )
  const filesToRetrieve = getFilesToRetrieve(allProps)
  const [profileFiles, nonProfileFiles] = _.partition(
    filesToRetrieve,
    (file) => file.type === PROFILE_METADATA_TYPE,
  )
  // Avoid sending empty requests for types that had no instances that were changed from the previous fetch
  // This is a common case for fetchWithChangesDetection mode for types that had no changes on their instances
  if (nonProfileFiles.length === 0) {
    log.debug('No files to retrieve, skipping')
    return { elements: [], configChanges }
  }

  log.info('going to retrieve %d files', filesToRetrieve.length)

  const instances = await retrieveProfilesWithContextTypes(
    profileFiles,
    nonProfileFiles,
  )

  return {
    elements: instances.filter(
      (instance) => !typesToSkip.has(instance.elemID.typeName),
    ),
    configChanges,
  }
}

export const retrieveMetadataInstanceForFetchWithChangesDetection: typeof retrieveMetadataInstances =
  async (params) => {
    const metadataQuery = buildFilePropsMetadataQuery(
      params.fetchProfile.metadataQuery,
    )

    const retrievePartialProfileInstances = retrieveMetadataInstances({
      ...params,
      getFilesToRetrieveFunc: (allProps) => {
        const { profileProps, profilesRelatedProps } = getPartitions(
          allProps.filter(metadataQuery.isInstanceIncluded),
        )
        const modifiedProfilesRelatedProps = profilesRelatedProps.filter(
          (props) => metadataQuery.isInstanceMatch(props),
        )
        if (modifiedProfilesRelatedProps.length === 0) {
          log.debug('No profile related props were changed')
          return []
        }
        const nonModifiedProfilesProps = profileProps.filter(
          (props) => !metadataQuery.isInstanceMatch(props),
        )
        log.debug(
          'Profiles modified related props: %s',
          safeJsonStringify(modifiedProfilesRelatedProps),
        )
        log.debug(
          'going to retrieve %d Profiles with related props of the following types: %s',
          profileProps.length,
          safeJsonStringify(
            _.uniq(modifiedProfilesRelatedProps.map((p) => p.type)),
          ),
        )
        return nonModifiedProfilesProps.concat(modifiedProfilesRelatedProps)
      },
    })

    const retrieveChangedProfileInstances = retrieveMetadataInstances({
      ...params,
      getFilesToRetrieveFunc: (allProps) => {
        const { profileProps, profilesRelatedProps } = getPartitions(
          allProps.filter(metadataQuery.isInstanceIncluded),
        )
        const modifiedProfilesProps = profileProps.filter((props) =>
          metadataQuery.isInstanceMatch(props),
        )
        if (modifiedProfilesProps.length === 0) {
          log.debug('No profiles were changed')
          return []
        }
        return modifiedProfilesProps.concat(profilesRelatedProps)
      },
    }).then((result) => ({
      ...result,
      // We only want to handle Profile instances
      elements: result.elements.filter(
        isInstanceOfTypeSync(PROFILE_METADATA_TYPE),
      ),
    }))
    const retrieveNonProfileInstances = retrieveMetadataInstances({
      ...params,
      getFilesToRetrieveFunc: (allProps) =>
        getPartitions(allProps.filter(metadataQuery.isInstanceMatch))
          .nonProfileProps,
    })
    const result = await Promise.all([
      retrievePartialProfileInstances,
      retrieveChangedProfileInstances,
      retrieveNonProfileInstances,
    ])
    return {
      elements: result.flatMap((r) => r.elements),
      configChanges: result.flatMap((r) => r.configChanges),
    }
  }
