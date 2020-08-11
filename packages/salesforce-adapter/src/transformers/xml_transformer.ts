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
import parser from 'fast-xml-parser'
import { RetrieveResult, FileProperties, RetrieveRequest } from 'jsforce'
import JSZip from 'jszip'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { Values, StaticFile, InstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import {
  MapKeyFunc, mapKeysRecursive, TransformFunc, transformValues,
} from '@salto-io/adapter-utils'
import { API_VERSION } from '../client/client'
import {
  INSTANCE_FULL_NAME_FIELD, IS_ATTRIBUTE, METADATA_CONTENT_FIELD, SALESFORCE, XML_ATTRIBUTE_PREFIX,
  NAMESPACE_SEPARATOR, INSTALLED_PACKAGES_PATH, RECORDS_PATH,
} from '../constants'
import { apiName, metadataType, MetadataValues } from './transformer'

const { isDefined } = lowerDashValues
const { makeArray } = collections.array

const log = logger(module)

export const metadataTypesWithAttributes = [
  'LightningComponentBundle',
]

const PACKAGE = 'unpackaged'
const HIDDEN_CONTENT_VALUE = '(hidden)'
const METADATA_XML_SUFFIX = '-meta.xml'
const CONTENT = 'content'
const UNFILED_PUBLIC_FOLDER = 'unfiled$public'

// ComplexTypes used constants
const TYPE = 'type'
const MARKUP = 'markup'
const TARGET_CONFIGS = 'targetConfigs'
const LWC_RESOURCES = 'lwcResources'
const LWC_RESOURCE = 'lwcResource'

type ZipProps = {
  folderType?: keyof ZipPropsMap
  dirName: string
  fileSuffix: string
  isMetadataWithContent: boolean
}

type ZipPropsMap = {
  ApexClass: ZipProps
  ApexTrigger: ZipProps
  ApexPage: ZipProps
  ApexComponent: ZipProps
  AssignmentRules: ZipProps
  InstalledPackage: ZipProps
  EmailTemplate: ZipProps
  EmailFolder: ZipProps
  ReportType: ZipProps
  Report: ZipProps
  ReportFolder: ZipProps
  Dashboard: ZipProps
  DashboardFolder: ZipProps
  SharingRules: ZipProps
  Territory2: ZipProps
  Territory2Rule: ZipProps
  Territory2Model: ZipProps
  Territory2Type: ZipProps
  StaticResource: ZipProps
}

const zipPropsMap: ZipPropsMap = {
  ApexClass: {
    dirName: 'classes',
    fileSuffix: '.cls',
    isMetadataWithContent: true,
  },
  ApexTrigger: {
    dirName: 'triggers',
    fileSuffix: '.trigger',
    isMetadataWithContent: true,
  },
  ApexPage: {
    dirName: 'pages',
    fileSuffix: '.page',
    isMetadataWithContent: true,
  },
  ApexComponent: {
    dirName: 'components',
    fileSuffix: '.component',
    isMetadataWithContent: true,
  },
  AssignmentRules: {
    dirName: 'assignmentRules',
    fileSuffix: '.assignmentRules',
    isMetadataWithContent: false,
  },
  InstalledPackage: {
    dirName: 'installedPackages',
    fileSuffix: '.installedPackage',
    isMetadataWithContent: false,
  },
  EmailTemplate: {
    dirName: 'email',
    fileSuffix: '.email',
    isMetadataWithContent: true,
  },
  EmailFolder: {
    folderType: 'EmailTemplate',
    dirName: 'email',
    fileSuffix: METADATA_XML_SUFFIX,
    isMetadataWithContent: false,
  },
  ReportType: {
    dirName: 'reportTypes',
    fileSuffix: '.reportType',
    isMetadataWithContent: false,
  },
  Report: {
    dirName: 'reports',
    fileSuffix: '.report',
    isMetadataWithContent: false,
  },
  ReportFolder: {
    folderType: 'Report',
    dirName: 'reports',
    fileSuffix: METADATA_XML_SUFFIX,
    isMetadataWithContent: false,
  },
  Dashboard: {
    dirName: 'dashboards',
    fileSuffix: '.dashboard',
    isMetadataWithContent: false,
  },
  DashboardFolder: {
    folderType: 'Dashboard',
    dirName: 'dashboards',
    fileSuffix: METADATA_XML_SUFFIX,
    isMetadataWithContent: false,
  },
  SharingRules: {
    dirName: 'sharingRules',
    fileSuffix: '.sharingRules',
    isMetadataWithContent: false,
  },
  Territory2: {
    dirName: 'territory2Models',
    fileSuffix: '.territory2',
    isMetadataWithContent: false,
  },
  Territory2Rule: {
    dirName: 'territory2Models',
    fileSuffix: '.territory2Rule',
    isMetadataWithContent: false,
  },
  Territory2Model: {
    dirName: 'territory2Models',
    fileSuffix: '.territory2Model',
    isMetadataWithContent: false,
  },
  Territory2Type: {
    dirName: 'territory2Types',
    fileSuffix: '.territory2Type',
    isMetadataWithContent: false,
  },
  StaticResource: {
    dirName: 'staticresources',
    fileSuffix: '.resource',
    isMetadataWithContent: true,
  },
}

const hasZipProps = (typeName: string): typeName is keyof ZipPropsMap =>
  Object.keys(zipPropsMap).includes(typeName)

export const toRetrieveRequest = (files: ReadonlyArray<FileProperties>): RetrieveRequest => ({
  apiVersion: API_VERSION,
  singlePackage: false,
  [PACKAGE]: {
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

const xmlToValues = (xmlAsString: string, type: string): Values => parser.parse(
  xmlAsString,
  { ignoreAttributes: false, attributeNamePrefix: XML_ATTRIBUTE_PREFIX }
)[type]

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
      xmlToValues(instanceValuesBuffer.toString(), file.type) ?? {},
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
  }).parse({ [name]: _.omit(values, INSTANCE_FULL_NAME_FIELD) })

const addDeletionFiles = (zip: JSZip, instanceName: string, type: string): void => {
  const zipProps = hasZipProps(type) ? zipPropsMap[type] : undefined
  // describe the instances that are about to be deleted
  zip.file(`${PACKAGE}/destructiveChanges.xml`,
    toMetadataXml('Package',
      { types: { members: instanceName, name: zipProps?.folderType ?? type } }))
  // Add package "manifest" that specifies the content of the zip that should be deployed
  zip.file(`${PACKAGE}/package.xml`, toMetadataXml('Package', { version: API_VERSION }))
}

const addInstanceFiles = (zip: JSZip, instanceName: string, type: string, values: Values): void => {
  const zipProps = hasZipProps(type) ? zipPropsMap[type] : undefined
  if (zipProps) {
    const instanceContentPath = `${PACKAGE}/${zipProps.dirName}/${instanceName}${zipProps.fileSuffix}`
    if (zipProps.isMetadataWithContent) {
      // Add instance metadata
      zip.file(`${instanceContentPath}${METADATA_XML_SUFFIX}`,
        toMetadataXml(type, _.omit(values, CONTENT)))
      // Add instance content
      zip.file(instanceContentPath, values[CONTENT])
    } else {
      // Add instance content
      zip.file(instanceContentPath, toMetadataXml(type, values))
    }
  } else { // Complex type
    const complexType = complexTypesMap[type as keyof ComplexTypesMap]
    const fieldToFileToContent = complexType.mapContentFields(instanceName, values)

    // Add instance metadata
    const metadataValues = _.omit(values, ...Object.keys(fieldToFileToContent))
    zip.file(complexType.getMetadataFilePath(instanceName, values),
      toMetadataXml(type, complexType.sortMetadataValues?.(metadataValues) ?? metadataValues))

    // Add instance content fields
    const fileNameToContentMaps = Object.values(fieldToFileToContent)
    fileNameToContentMaps.forEach(fileNameToContentMap =>
      Object.entries(fileNameToContentMap)
        .forEach(([fileName, content]) => zip.file(fileName, content)))
  }
  // Add package "manifest" that specifies the content of the zip that should be deployed
  zip.file(`${PACKAGE}/package.xml`,
    toMetadataXml('Package', {
      version: API_VERSION,
      types: { members: instanceName, name: zipProps?.folderType ?? type },
    }))
}

const isSupportedType = (typeName: string): boolean =>
  hasZipProps(typeName) || isComplexType(typeName)

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

export const toMetadataPackageZip = async (instance: InstanceElement, deletion: boolean):
  Promise<Buffer | undefined> => {
  const typeName = metadataType(instance)
  if (!isSupportedType(typeName)) {
    log.warn('Deploying instances of type %s is not supported', typeName)
    return undefined
  }
  const zip = new JSZip()
  if (deletion) {
    addDeletionFiles(zip, apiName(instance), typeName)
  } else {
    addInstanceFiles(zip, apiName(instance), typeName, getValuesToDeploy(instance))
  }

  return zip.generateAsync({ type: 'nodebuffer' })
}
