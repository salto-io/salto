import { Value, Values } from 'adapter-api'
import _ from 'lodash'
import { MetadataInfo, RetrieveResult } from 'jsforce'
import JSZip, { JSZipObject } from 'jszip'
import parser from 'fast-xml-parser'
import { logger } from '@salto/logging'
import { API_VERSION, METADATA_NAMESPACE } from '../client/client'
import { toMetadataInfo } from './transformer'
import { MetadataWithContent } from '../client/types'

const log = logger(module)

const PACKAGE = 'unpackaged'
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
}

const isSupportedType = (typeName: string): boolean => Object.keys(zipPropsMap).includes(typeName)

export const fromRetrieveResult = async (retrieveResult: RetrieveResult,
  metadataTypes: string[]): Promise<Record<string, MetadataInfo[]>> => {
  const BASE_64 = 'base64'

  const fromMetadataXml = async (zip: JSZip, zipProps: ZipProps, xmlMetadataType: string):
    Promise<MetadataInfo[]> => {
    const decodeContent = async (fileName: string): Promise<string> =>
      zip.file(fileName).async(BASE_64)
        .then(data => Buffer.from(data, BASE_64).toString())

    const getPathPrefix = (): string => `${PACKAGE}/${zipProps.dirName}/`

    const getFullName = (file: JSZip.JSZipObject): string =>
      file.name.split(getPathPrefix())[1].split(zipProps.fileSuffix)[0]

    const decodeFileWithContent = async (file: JSZipObject):
      Promise<MetadataInfo> => {
      const metadataXmlContent = await decodeContent(`${file.name}${METADATA_XML_SUFFIX}`)
      const parsedResult = parser.parse(metadataXmlContent)[xmlMetadataType]
      const metadataInfo: MetadataWithContent = parsedResult === '' ? {} : parsedResult
      metadataInfo.fullName = getFullName(file)
      metadataInfo.content = await decodeContent(file.name)
      return metadataInfo
    }

    const decodeFile = async (file: JSZipObject):
      Promise<MetadataInfo> => {
      const metadataXmlContent = await decodeContent(file.name)
      const parsedResult = parser.parse(metadataXmlContent)[xmlMetadataType]
      const metadataInfo: MetadataInfo = parsedResult === '' ? {} : parsedResult
      metadataInfo.fullName = getFullName(file)
      return metadataInfo
    }

    const files = Object.values(zip.files)
      .filter(file => file.name.startsWith(getPathPrefix()))
      .filter(file => file.name.endsWith(zipProps.fileSuffix))
      .filter(file => !zipProps.folderType || file.name.split('/').length === 3)

    if (zipProps.isMetadataWithContent) {
      return Promise.all(files.map(file => decodeFileWithContent(file)))
    }
    return Promise.all(files.map(file => decodeFile(file)))
  }

  const loadZip = async (zip: string): Promise<JSZip> =>
    new JSZip().loadAsync(Buffer.from(zip, BASE_64))

  const zip = await loadZip(retrieveResult.zipFile)

  const types = metadataTypes
    .filter(typeName => {
      if (!isSupportedType(typeName)) {
        log.warn('Retrieving instances of type %s is not supported', typeName)
        return false
      }
      return true
    })
  return Promise.all(types
    .map(async type =>
      [type, await fromMetadataXml(zip, zipPropsMap[type as keyof ZipPropsMap], type)]))
    .then(res => _(res).fromPairs().value())
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
