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
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { Value, Values, StaticFile } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { API_VERSION, METADATA_NAMESPACE } from '../client/client'
import { toMetadataInfo } from './transformer'
import { MetadataWithContent } from '../client/types'
import { INSTANCE_FULL_NAME_FIELD, METADATA_CONTENT_FIELD } from '../constants'

const { isDefined } = lowerDashValues

const log = logger(module)

const PACKAGE = 'unpackaged'
const HIDDEN_CONTENT_VALUE = '(hidden)'
const METADATA_XML_SUFFIX = '-meta.xml'

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

const isSupportedType = (typeName: string): boolean => Object.keys(zipPropsMap).includes(typeName)

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

export const fromRetrieveResult = async (
  result: RetrieveResult,
  fileProps: ReadonlyArray<FileProperties>,
  typesWithMetaFile: Set<string>,
  typesWithContent: Set<string>,
): Promise<{ file: FileProperties; values: MetadataValues}[]> => {
  const fromZip = async (
    zip: JSZip, file: FileProperties,
  ): Promise<MetadataValues | undefined> => {
    const getFileData = (name: string): Promise<Buffer | undefined> => {
      const zipFile = zip.file(`${PACKAGE}/${name}`)
      return zipFile === null
        ? Promise.resolve(undefined)
        : zipFile.async('nodebuffer')
    }

    const instanceFilename = typesWithMetaFile.has(file.type)
      ? `${file.fileName}${METADATA_XML_SUFFIX}`
      : file.fileName
    const instanceData = await getFileData(instanceFilename)
    if (instanceData === undefined) {
      return undefined
    }
    const parsedResult = parser.parse(instanceData.toString())[file.type]
    const metadataInfo = _.isEmpty(parsedResult) ? {} : parsedResult
    metadataInfo[INSTANCE_FULL_NAME_FIELD] = file.fullName
    if (typesWithContent.has(file.type)) {
      const content = await getFileData(file.fileName)
      if (content === undefined) {
        return undefined
      }
      metadataInfo[METADATA_CONTENT_FIELD] = content.toString() === HIDDEN_CONTENT_VALUE
        ? content.toString()
        : new StaticFile({
          filepath: `salesforce/${file.fileName}`,
          content,
        })
    }
    return metadataInfo
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

const toMetadataXml = (name: string, val: Value, inner = false): string => {
  if (_.isArray(val)) {
    return val.map(v => toMetadataXml(name, v, true)).join('')
  }
  const innerXml = _.isObject(val)
    ? _(val)
      .entries()
      .filter(([k]) => inner || k !== 'fullName')
      .map(([k, v]) => toMetadataXml(k, v, true))
      .value()
      .join('')
    : val
  const openName = inner ? name : `${name} xmlns="${METADATA_NAMESPACE}"`
  return `<${openName}>${innerXml}</${name}>`
}

const addDeletionFiles = (zip: JSZip, instanceName: string, zipProps: ZipProps,
  type: keyof ZipPropsMap): void => {
  // describe the instances that are about to be deleted
  zip.file(`${PACKAGE}/destructiveChanges.xml`,
    toMetadataXml('Package',
      { types: { members: instanceName, name: zipProps.folderType ?? type } }))
  // Add package "manifest" that specifies the content of the zip that should be deployed
  zip.file(`${PACKAGE}/package.xml`, toMetadataXml('Package', { version: API_VERSION }))
}

const addInstanceFiles = (zip: JSZip, instanceName: string, zipProps: ZipProps,
  type: keyof ZipPropsMap, values: Values): void => {
  const toMetadataXmlContent = (): string => {
    const mdWithContent = toMetadataInfo(instanceName, values) as MetadataWithContent
    delete mdWithContent.fullName
    delete mdWithContent.content
    return toMetadataXml(type, mdWithContent)
  }

  const instanceContentPath = `${PACKAGE}/${zipProps.dirName}/${instanceName}${zipProps.fileSuffix}`
  if (zipProps.isMetadataWithContent) {
    // Add instance metadata
    zip.file(`${PACKAGE}/${zipProps.dirName}/${instanceName}${zipProps.fileSuffix}${METADATA_XML_SUFFIX}`,
      toMetadataXmlContent())
    // Add instance content
    zip.file(instanceContentPath, values.content)
  } else {
    // Add instance content
    zip.file(instanceContentPath, toMetadataXml(type, toMetadataInfo(instanceName, values)))
  }
  // Add package "manifest" that specifies the content of the zip that should be deployed
  zip.file(`${PACKAGE}/package.xml`,
    toMetadataXml('Package', {
      version: API_VERSION,
      types: { members: instanceName, name: zipProps.folderType ?? type },
    }))
}

export const toMetadataPackageZip = async (instanceName: string, typeName: string,
  instanceValues: Values, deletion: boolean): Promise<Buffer | undefined> => {
  if (!isSupportedType(typeName)) {
    log.warn('Deploying instances of type %s is not supported', typeName)
    return undefined
  }
  const zip = new JSZip()
  const zipProps = zipPropsMap[typeName as keyof ZipPropsMap]
  if (deletion) {
    addDeletionFiles(zip, instanceName, zipProps, typeName as keyof ZipPropsMap)
  } else {
    addInstanceFiles(zip, instanceName, zipProps, typeName as keyof ZipPropsMap, instanceValues)
  }

  return zip.generateAsync({ type: 'nodebuffer' })
}
