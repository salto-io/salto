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
import { MetadataInfo, RetrieveResult, FileProperties, RetrieveRequest } from 'jsforce'
import JSZip from 'jszip'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { Values, StaticFile } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { API_VERSION } from '../client/client'
import {
  INSTANCE_FULL_NAME_FIELD, METADATA_CONTENT_FIELD, SALESFORCE, XML_ATTRIBUTE_PREFIX,
} from '../constants'

const { isDefined } = lowerDashValues
const { makeArray } = collections.array

const log = logger(module)

const PACKAGE = 'unpackaged'
const HIDDEN_CONTENT_VALUE = '(hidden)'
const METADATA_XML_SUFFIX = '-meta.xml'
const CONTENT = 'content'

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

export type MetadataValues = MetadataInfo & Values

const addContentFieldAsStaticFile = (values: Values, valuePath: string[], content: Buffer,
  fileName: string): void => {
  _.set(values, valuePath, content.toString() === HIDDEN_CONTENT_VALUE
    ? content.toString()
    : new StaticFile({
      filepath: fileName.replace(PACKAGE, SALESFORCE),
      content,
    }))
}

type ComplexType = {
  addContentFields(fileNameToContent: Record<string, Buffer>, values: Values): void
  getMissingFields?(metadataFileName: string): Values
  mapContentFields(instanceName: string, values: Values):
    Record</* fieldName */string, Record</* fileName */string, /* content */string>>
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
    addContentFields: (fileNameToContent: Record<string, Buffer>, values: Values) => {
      Object.entries(fileNameToContent)
        .forEach(([contentFileName, content]) => {
          const fieldName = Object.entries(auraFileSuffixToFieldName)
            .find(([fileSuffix, _fieldName]) => contentFileName.endsWith(fileSuffix))?.[1]
          if (fieldName === undefined) {
            log.warn(`Could not extract field content from ${contentFileName}`)
            return
          }
          addContentFieldAsStaticFile(values, [fieldName], content, contentFileName)
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
      return _.fromPairs(Object.entries(auraFileSuffixToFieldName)
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
    addContentFields: (fileNameToContent: Record<string, Buffer>, values: Values) => {
      Object.entries(fileNameToContent)
        .forEach(([contentFileName, content], index) => {
          const resourcePath = [LWC_RESOURCES, LWC_RESOURCE, String(index)]
          addContentFieldAsStaticFile(values, [...resourcePath, 'source'], content, contentFileName)
          _.set(values, [...resourcePath, 'filePath'], contentFileName.split(`${PACKAGE}/`)[1])
        })
    },
    mapContentFields: (_instanceName: string, values: Values) => ({
      [LWC_RESOURCES]: _.fromPairs(makeArray(values[LWC_RESOURCES]?.[LWC_RESOURCE])
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

export const fromRetrieveResult = async (
  result: RetrieveResult,
  fileProps: ReadonlyArray<FileProperties>,
  typesWithMetaFile: Set<string>,
  typesWithContent: Set<string>,
): Promise<{ file: FileProperties; values: MetadataValues}[]> => {
  const fromZip = async (
    zip: JSZip, file: FileProperties,
  ): Promise<MetadataValues | undefined> => {
    const extractFileNameToData = async (fileName: string, withMetadataSuffix: boolean,
      complexType: boolean): Promise<Record<string, Buffer>> => {
      if (!complexType) { // this is a single file
        const zipFile = zip.file(`${PACKAGE}/${fileName}${withMetadataSuffix ? METADATA_XML_SUFFIX : ''}`)
        return zipFile === null ? {} : { [zipFile.name]: await zipFile.async('nodebuffer') }
      }
      // bring all matching files from the fileName directory
      const zipFiles = zip.file(new RegExp(`^${PACKAGE}/${fileName}/.*`))
        .filter(zipFile => zipFile.name.endsWith(METADATA_XML_SUFFIX) === withMetadataSuffix)
      return _.isEmpty(zipFiles)
        ? {}
        : _.fromPairs(await Promise.all(zipFiles.map(async zipFile => [zipFile.name, await zipFile.async('nodebuffer')])))
    }

    // extract metadata values
    const fileNameToValuesBuffer = await extractFileNameToData(file.fileName,
      typesWithMetaFile.has(file.type) || isComplexType(file.type), isComplexType(file.type))
    if (Object.values(fileNameToValuesBuffer).length !== 1) {
      log.warn(`Expected to retrieve only single values file for ${file.type}`)
      return undefined
    }
    const [[valuesFileName, instanceValuesBuffer]] = Object.entries(fileNameToValuesBuffer)
    const metadataValues = Object.assign(
      xmlToValues(instanceValuesBuffer.toString(), file.type) ?? {},
      { [INSTANCE_FULL_NAME_FIELD]: file.fullName }
    )

    // add content fields
    if (typesWithContent.has(file.type) || isComplexType(file.type)) {
      const fileNameToContent = await extractFileNameToData(file.fileName, false,
        isComplexType(file.type))
      if (_.isEmpty(fileNameToContent)) {
        log.warn(`Could not find content files for ${file.type}`)
        return undefined
      }
      if (isComplexType(file.type)) {
        const complexType = complexTypesMap[file.type]
        Object.assign(metadataValues, complexType.getMissingFields?.(valuesFileName) ?? {})
        complexType.addContentFields(fileNameToContent, metadataValues)
      } else {
        const [contentFileName, content] = Object.entries(fileNameToContent)[0]
        addContentFieldAsStaticFile(metadataValues, [METADATA_CONTENT_FIELD], content,
          contentFileName)
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
    const contentFieldsMapping = complexType.mapContentFields(instanceName, values)

    // Add instance metadata
    const metadataValues = _.omit(values, ...Object.keys(contentFieldsMapping))
    zip.file(complexType.getMetadataFilePath(instanceName, values),
      toMetadataXml(type, complexType.sortMetadataValues?.(metadataValues) ?? metadataValues))

    // Add instance content fields
    const fileNameToContentMaps = Object.values(contentFieldsMapping)
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

export const toMetadataPackageZip = async (instanceName: string, typeName: string,
  instanceValues: Values, deletion: boolean): Promise<Buffer | undefined> => {
  if (!isSupportedType(typeName)) {
    log.warn('Deploying instances of type %s is not supported', typeName)
    return undefined
  }
  const zip = new JSZip()
  if (deletion) {
    addDeletionFiles(zip, instanceName, typeName)
  } else {
    addInstanceFiles(zip, instanceName, typeName, instanceValues)
  }

  return zip.generateAsync({ type: 'nodebuffer' })
}
