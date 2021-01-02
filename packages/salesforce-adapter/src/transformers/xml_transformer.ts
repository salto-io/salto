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
import _ from 'lodash'
import he from 'he'
import parser from 'fast-xml-parser'
import { RetrieveResult, FileProperties, RetrieveRequest } from 'jsforce'
import JSZip from 'jszip'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { Values, StaticFile, InstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { MapKeyFunc, mapKeysRecursive, TransformFunc, transformValues } from '@salto-io/adapter-utils'
import { API_VERSION } from '../client/client'
import {
  INSTANCE_FULL_NAME_FIELD, IS_ATTRIBUTE, METADATA_CONTENT_FIELD, SALESFORCE, XML_ATTRIBUTE_PREFIX,
  RECORDS_PATH, INSTALLED_PACKAGES_PATH, NAMESPACE_SEPARATOR, INTERNAL_ID_FIELD,
  LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE, SETTINGS_METADATA_TYPE,
} from '../constants'
import {
  apiName, metadataType, MetadataValues, MetadataInstanceElement, MetadataObjectType,
  toDeployableInstance,
} from './transformer'

const { isDefined } = lowerDashValues
const { makeArray } = collections.array

const log = logger(module)

export const metadataTypesWithAttributes = [
  LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE,
]

const PACKAGE = 'unpackaged'
const HIDDEN_CONTENT_VALUE = '(hidden)'
const METADATA_XML_SUFFIX = '-meta.xml'
const UNFILED_PUBLIC_FOLDER = 'unfiled$public'

// ComplexTypes used constants
const TYPE = 'type'
const MARKUP = 'markup'
const TARGET_CONFIGS = 'targetConfigs'
const LWC_RESOURCES = 'lwcResources'
const LWC_RESOURCE = 'lwcResource'

export const getManifestTypeName = (type: MetadataObjectType): string => (
  // Salesforce quirk - folder instances are listed under their content's type in the manifest

  // Salesforce quirk - settings intances should be deployed under Settings type,
  // although their recieved type is "<name>Settings"
  type.annotations.dirName === 'settings'
    ? SETTINGS_METADATA_TYPE
    : (type.annotations.folderContentType ?? type.annotations.metadataType)
)

export const toRetrieveRequest = (files: ReadonlyArray<FileProperties>): RetrieveRequest => ({
  apiVersion: API_VERSION,
  singlePackage: false,
  [PACKAGE]: {
    version: API_VERSION,
    types: _(files)
      .groupBy(file => file.type)
      .entries()
      .map(([type, typeFiles]) => ({ name: type, members: typeFiles.map(file => file.fullName) }))
      .value(),
  },
})

const addContentFieldAsStaticFile = (values: Values, valuePath: string[], content: Buffer,
  fileName: string, type: string, namespacePrefix?: string): void => {
  const folder = namespacePrefix === undefined
    ? `${SALESFORCE}/${RECORDS_PATH}/${type}`
    : `${SALESFORCE}/${INSTALLED_PACKAGES_PATH}/${namespacePrefix}/${RECORDS_PATH}/${type}`
  _.set(values, valuePath, content.toString() === HIDDEN_CONTENT_VALUE
    ? content.toString()
    : new StaticFile({
      filepath: `${folder}/${fileName.split('/').slice(2).join('/')}`,
      content,
    }))
}

type FieldName = string
type FileName = string
type Content = Buffer
type ComplexType = {
  addContentFields(fileNameToContent: Record<string, Buffer>, values: Values,
    type: string, namespacePrefix?: string): void
  getMissingFields?(metadataFileName: string): Values
  mapContentFields(instanceName: string, values: Values):
    Record<FieldName, Record<FileName, Content>>
  sortMetadataValues?(metadataValues: Values): Values
  getMetadataFilePath(instanceName: string, values?: Values): string
}

type ComplexTypesMap = {
  AuraDefinitionBundle: ComplexType
  LightningComponentBundle: ComplexType
}

const auraFileSuffixToFieldName: Record<string, string> = {
  'Controller.js': 'controllerContent',
  '.design': 'designContent',
  '.auradoc': 'documentationContent',
  'Helper.js': 'helperContent',
  '.app': MARKUP,
  '.cmp': MARKUP,
  '.evt': MARKUP,
  '.intf': MARKUP,
  '.tokens': MARKUP,
  'Renderer.js': 'rendererContent',
  '.css': 'styleContent',
  '.svg': 'SVGContent',
}

const auraTypeToFileSuffix: Record<string, string> = {
  Application: '.app',
  Component: '.cmp',
  Event: '.evt',
  Interface: '.intf',
  Tokens: '.tokens',
}

const complexTypesMap: ComplexTypesMap = {
  /**
   * AuraDefinitionBundle has several base64Binary content fields. We should use its content fields
   * suffix in order to set their content to the correct field
   */
  AuraDefinitionBundle: {
    addContentFields: (fileNameToContent: Record<string, Buffer>, values: Values, type: string,
      namespacePrefix?: string) => {
      Object.entries(fileNameToContent)
        .forEach(([contentFileName, content]) => {
          const fieldName = Object.entries(auraFileSuffixToFieldName)
            .find(([fileSuffix, _fieldName]) => contentFileName.endsWith(fileSuffix))?.[1]
          if (fieldName === undefined) {
            log.warn(`Could not extract field content from ${contentFileName}`)
            return
          }
          addContentFieldAsStaticFile(values, [fieldName], content, contentFileName, type,
            namespacePrefix)
        })
    },
    /**
     * TYPE field is not returned in the retrieve API and is necessary for future deploys logic
     */
    getMissingFields: (metadataFileName: string) => {
      const fileName = metadataFileName.split(METADATA_XML_SUFFIX)[0]
      const auraType = Object.entries(auraTypeToFileSuffix)
        .find(([_typeName, fileSuffix]) => fileName.endsWith(fileSuffix))?.[0]
      if (auraType === undefined) {
        throw new Error('failed to extract AuraDefinitionBundle type')
      }
      return { [TYPE]: auraType }
    },
    mapContentFields: (instanceName: string, values: Values) => {
      const type = values[TYPE]
      if (!Object.keys(auraTypeToFileSuffix).includes(type)) {
        throw new Error(`${type} is an invalid AuraDefinitionBundle type`)
      }
      return Object.fromEntries(Object.entries(auraFileSuffixToFieldName)
        .filter(([_fileSuffix, fieldName]) => fieldName !== MARKUP)
        .map(([fileSuffix, fieldName]) => [fieldName, { [`${PACKAGE}/aura/${instanceName}/${instanceName}${fileSuffix}`]: values[fieldName] }])
        .concat([[MARKUP, { [`${PACKAGE}/aura/${instanceName}/${instanceName}${auraTypeToFileSuffix[type]}`]: values[MARKUP] }]]))
    },
    getMetadataFilePath: (instanceName: string, values: Values) => {
      const type = values[TYPE]
      if (!Object.keys(auraTypeToFileSuffix).includes(type)) {
        throw new Error(`${type} is an invalid AuraDefinitionBundle type`)
      }
      return `${PACKAGE}/aura/${instanceName}/${instanceName}${auraTypeToFileSuffix[type]}${METADATA_XML_SUFFIX}`
    },
  },
  /**
   * LightningComponentBundle has array of base64Binary content fields under LWC_RESOURCES field.
   */
  LightningComponentBundle: {
    addContentFields: (fileNameToContent: Record<string, Buffer>, values: Values, type: string,
      namespacePrefix?: string) => {
      Object.entries(fileNameToContent)
        .forEach(([contentFileName, content], index) => {
          const resourcePath = [LWC_RESOURCES, LWC_RESOURCE, String(index)]
          addContentFieldAsStaticFile(values, [...resourcePath, 'source'], content, contentFileName,
            type, namespacePrefix)
          _.set(values, [...resourcePath, 'filePath'], contentFileName.split(`${PACKAGE}/`)[1])
        })
    },
    mapContentFields: (_instanceName: string, values: Values) => ({
      [LWC_RESOURCES]: Object.fromEntries(makeArray(values[LWC_RESOURCES]?.[LWC_RESOURCE])
        .map(lwcResource => [`${PACKAGE}/${lwcResource.filePath}`, lwcResource.source])),
    }),
    /**
     * Due to SF quirk, TARGET_CONFIGS field must be in the xml after the targets field
     */
    sortMetadataValues: (metadataValues: Values) =>
      Object.fromEntries(Object.entries(metadataValues)
        .filter(([name]) => name !== TARGET_CONFIGS)
        .concat([[TARGET_CONFIGS, metadataValues[TARGET_CONFIGS]]])),
    getMetadataFilePath: (instanceName: string) =>
      `${PACKAGE}/lwc/${instanceName}/${instanceName}.js${METADATA_XML_SUFFIX}`,
  },
}

const isComplexType = (typeName: string): typeName is keyof ComplexTypesMap =>
  Object.keys(complexTypesMap).includes(typeName)

const xmlToValues = (xmlAsString: string, type: string): Values => {
  const parsedXml = parser.parse(
    xmlAsString,
    {
      ignoreAttributes: false,
      attributeNamePrefix: XML_ATTRIBUTE_PREFIX,
      tagValueProcessor: val => he.decode(val),
    }
  )

  const values = parsedXml[type]
  if (!_.isPlainObject(values)) {
    log.debug('Could not find values for type %s in xml:\n%s', type, xmlAsString)
    return {}
  }
  const xmlnsAttributes = ['xmlns', 'xmlns:xsi'].map(attr => `${XML_ATTRIBUTE_PREFIX}${attr}`)
  return _.omit(values, xmlnsAttributes)
}

const extractFileNameToData = async (zip: JSZip, fileName: string, withMetadataSuffix: boolean,
  complexType: boolean, namespacePrefix?: string): Promise<Record<string, Buffer>> => {
  if (!complexType) { // this is a single file
    const zipFile = zip.file(`${PACKAGE}/${fileName}${withMetadataSuffix ? METADATA_XML_SUFFIX : ''}`)
    return zipFile === null ? {} : { [zipFile.name]: await zipFile.async('nodebuffer') }
  }
  // bring all matching files from the fileName directory
  const instanceFolderName = namespacePrefix === undefined ? fileName : fileName.replace(`${namespacePrefix}${NAMESPACE_SEPARATOR}`, '')
  const zipFiles = zip.file(new RegExp(`^${PACKAGE}/${instanceFolderName}/.*`))
    .filter(zipFile => zipFile.name.endsWith(METADATA_XML_SUFFIX) === withMetadataSuffix)
  return _.isEmpty(zipFiles)
    ? {}
    : Object.fromEntries(await Promise.all(zipFiles.map(async zipFile => [zipFile.name, await zipFile.async('nodebuffer')])))
}

export const fromRetrieveResult = async (
  result: RetrieveResult,
  fileProps: ReadonlyArray<FileProperties>,
  typesWithMetaFile: Set<string>,
  typesWithContent: Set<string>,
): Promise<{ file: FileProperties; values: MetadataValues}[]> => {
  const fromZip = async (zip: JSZip, file: FileProperties): Promise<MetadataValues | undefined> => {
    // extract metadata values
    const fileNameToValuesBuffer = await extractFileNameToData(zip, file.fileName,
      typesWithMetaFile.has(file.type) || isComplexType(file.type), isComplexType(file.type),
      file.namespacePrefix)
    if (Object.values(fileNameToValuesBuffer).length !== 1) {
      if (file.fullName !== UNFILED_PUBLIC_FOLDER) {
        log.warn(`Expected to retrieve only single values file for instance (type:${file.type}, fullName:${file.fullName}), found ${Object.values(fileNameToValuesBuffer).length}`)
      }
      return undefined
    }
    const [[valuesFileName, instanceValuesBuffer]] = Object.entries(fileNameToValuesBuffer)
    const metadataValues = Object.assign(
      xmlToValues(instanceValuesBuffer.toString(), file.type),
      { [INSTANCE_FULL_NAME_FIELD]: file.fullName }
    )

    // add content fields
    if (typesWithContent.has(file.type) || isComplexType(file.type)) {
      const fileNameToContent = await extractFileNameToData(zip, file.fileName, false,
        isComplexType(file.type), file.namespacePrefix)
      if (_.isEmpty(fileNameToContent)) {
        log.warn(`Could not find content files for instance (type:${file.type}, fullName:${file.fullName})`)
        return undefined
      }
      if (isComplexType(file.type)) {
        const complexType = complexTypesMap[file.type]
        Object.assign(metadataValues, complexType.getMissingFields?.(valuesFileName) ?? {})
        complexType.addContentFields(fileNameToContent, metadataValues, file.type,
          file.namespacePrefix)
      } else {
        const [contentFileName, content] = Object.entries(fileNameToContent)[0]
        addContentFieldAsStaticFile(metadataValues, [METADATA_CONTENT_FIELD], content,
          contentFileName, file.type, file.namespacePrefix)
      }
    }
    if (file.id !== undefined) {
      metadataValues[INTERNAL_ID_FIELD] = file.id
    }
    return metadataValues
  }

  const zip = await new JSZip().loadAsync(Buffer.from(result.zipFile, 'base64'))
  const instances = await Promise.all(fileProps.map(
    async file => {
      const values = await fromZip(zip, file)
      return values === undefined ? undefined : { file, values }
    }
  ))
  return instances.filter(isDefined)
}

const toMetadataXml = (name: string, values: Values): string =>
  // eslint-disable-next-line new-cap
  new parser.j2xParser({
    attributeNamePrefix: XML_ATTRIBUTE_PREFIX,
    ignoreAttributes: false,
    tagValueProcessor: val => he.encode(String(val)),
  }).parse({ [name]: _.omit(values, INSTANCE_FULL_NAME_FIELD) })

const cloneValuesWithAttributePrefixes = (instance: InstanceElement): Values => {
  const allAttributesPaths = new Set<string>()
  const createPathsSetCallback: TransformFunc = ({ value, field, path }) => {
    if (path && field && field.annotations[IS_ATTRIBUTE]) {
      allAttributesPaths.add(path.getFullName())
    }
    return value
  }

  transformValues({
    values: instance.value,
    type: instance.type,
    transformFunc: createPathsSetCallback,
    pathID: instance.elemID,
    strict: false,
  })

  const addAttributePrefixFunc: MapKeyFunc = ({ key, pathID }) => {
    if (pathID && allAttributesPaths.has(pathID.getFullName())) {
      return XML_ATTRIBUTE_PREFIX + key
    }
    return key
  }

  return mapKeysRecursive(instance.value, addAttributePrefixFunc, instance.elemID)
}

// Create values with the XML_ATTRIBUTE_PREFIX for xml attributes fields
const getValuesToDeploy = (instance: InstanceElement): Values => {
  if (!metadataTypesWithAttributes.includes(metadataType(instance))) {
    return instance.value
  }
  return cloneValuesWithAttributePrefixes(instance)
}

const toPackageXml = (manifest: Map<string, string[]>): string => (
  toMetadataXml('Package', {
    version: API_VERSION,
    types: [...manifest.entries()].map(([name, members]) => ({ name, members })),
  })
)

export type DeployPackage = {
  add(instance: MetadataInstanceElement, withManifest?: boolean): void
  addToManifest(type: MetadataObjectType, name: string): void
  delete(type: MetadataObjectType, name: string): void
  getZip(): Promise<Buffer>
  getDeletionsPackageName(): string
}

export const createDeployPackage = (deleteBeforeUpdate?: boolean): DeployPackage => {
  const zip = new JSZip()
  const addManifest = new collections.map.DefaultMap<string, string[]>(() => [])
  const deleteManifest = new collections.map.DefaultMap<string, string[]>(() => [])
  const deletionsPackageName = deleteBeforeUpdate ? 'destructiveChanges.xml' : 'destructiveChangesPost.xml'

  const addToManifest: DeployPackage['addToManifest'] = (type, name) => {
    const typeName = getManifestTypeName(type)
    addManifest.get(typeName).push(name)
  }
  return {
    add: (instance, withManifest = true) => {
      const instanceName = apiName(instance)
      if (withManifest) {
        addToManifest(instance.type, instanceName)
      }
      // Add instance file(s) to zip
      const typeName = metadataType(instance)
      const values = getValuesToDeploy(toDeployableInstance(instance))
      if (isComplexType(typeName)) {
        const complexType = complexTypesMap[typeName]
        const fieldToFileToContent = complexType.mapContentFields(instanceName, values)

        // Add instance metadata
        const metadataValues = _.omit(values, ...Object.keys(fieldToFileToContent))
        zip.file(
          complexType.getMetadataFilePath(instanceName, values),
          toMetadataXml(
            typeName,
            complexType.sortMetadataValues?.(metadataValues) ?? metadataValues
          )
        )

        // Add instance content fields
        const fileNameToContentMaps = Object.values(fieldToFileToContent)
        fileNameToContentMaps.forEach(fileNameToContentMap =>
          Object.entries(fileNameToContentMap)
            .forEach(([fileName, content]) => zip.file(fileName, content)))
      } else {
        const { dirName, suffix, hasMetaFile } = instance.type.annotations
        const instanceContentPath = [
          PACKAGE,
          dirName,
          `${instanceName}${suffix === undefined ? '' : `.${suffix}`}`,
        ].join('/')
        if (hasMetaFile) {
          zip.file(
            `${instanceContentPath}${METADATA_XML_SUFFIX}`,
            toMetadataXml(typeName, _.omit(values, METADATA_CONTENT_FIELD))
          )
          if (values[METADATA_CONTENT_FIELD] !== undefined) {
            zip.file(instanceContentPath, values[METADATA_CONTENT_FIELD])
          }
        } else {
          zip.file(instanceContentPath, toMetadataXml(typeName, values))
        }
      }
    },
    addToManifest,
    delete: (type, name) => {
      const typeName = getManifestTypeName(type)
      deleteManifest.get(typeName).push(name)
    },
    getZip: () => {
      zip.file(`${PACKAGE}/package.xml`, toPackageXml(addManifest))
      if (deleteManifest.size !== 0) {
        zip.file(`${PACKAGE}/${deletionsPackageName}`, toPackageXml(deleteManifest))
      }
      return zip.generateAsync({ type: 'nodebuffer' })
    },
    getDeletionsPackageName: () => deletionsPackageName,
  }
}
