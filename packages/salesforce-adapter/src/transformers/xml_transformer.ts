import { Value, Values } from 'adapter-api'
import _ from 'lodash'
import { MetadataInfo, RetrieveResult } from 'jsforce'
import JSZip, { JSZipObject } from 'jszip'
import parser from 'fast-xml-parser'
import { logger } from '@salto/logging'
import { strings } from '@salto/lowerdash'
import { API_VERSION, METADATA_NAMESPACE } from '../client/client'
import { toMetadataInfo } from './transformer'
import { MetadataWithContent } from '../client/types'

const { isEmptyString } = strings
const log = logger(module)

const PACKAGE = 'unpackaged'
const METADATA_XML_SUFFIX = '-meta.xml'

type ZipProps = {
  dir: string
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
}

const zipPropsMap: ZipPropsMap = {
  ApexClass: {
    dir: 'classes',
    fileSuffix: 'cls',
    isMetadataWithContent: true,
  },
  ApexTrigger: {
    dir: 'triggers',
    fileSuffix: 'trigger',
    isMetadataWithContent: true,
  },
  ApexPage: {
    dir: 'pages',
    fileSuffix: 'page',
    isMetadataWithContent: true,
  },
  ApexComponent: {
    dir: 'components',
    fileSuffix: 'component',
    isMetadataWithContent: true,
  },
  AssignmentRules: {
    dir: 'assignmentRules',
    fileSuffix: 'assignmentRules',
    isMetadataWithContent: false,
  },
  InstalledPackage: {
    dir: 'installedPackages',
    fileSuffix: 'installedPackage',
    isMetadataWithContent: false,
  },
}

const isSupportedType = (typeName: string): boolean => Object.keys(zipPropsMap).includes(typeName)

export const fromRetrieveResult = async (retrieveResult: RetrieveResult,
  metadataTypes: string[]): Promise<Record<string, MetadataInfo[]>> => {
  const BASE_64 = 'base64'

  const fromMetadataXml = async (zip: JSZip, type: keyof ZipPropsMap):
    Promise<MetadataInfo[]> => {
    const decodeContent = async (fileName: string): Promise<string> =>
      zip.file(fileName).async(BASE_64)
        .then(data => Buffer.from(data, BASE_64).toString())

    const getPathPrefix = (zipProps: ZipProps): string => `${PACKAGE}/${zipProps.dir}/`
    const getPathSuffix = (zipProps: ZipProps): string => `.${zipProps.fileSuffix}`

    const getFullName = (file: JSZip.JSZipObject, zipProps: ZipProps): string =>
      file.name.split(getPathPrefix(zipProps))[1].split(getPathSuffix(zipProps))[0]

    const decodeFileWithContent = async (file: JSZipObject, zipProps: ZipProps):
      Promise<MetadataInfo> => {
      const metadataXmlContent = await decodeContent(`${file.name}${METADATA_XML_SUFFIX}`)
      const parsedResult = parser.parse(metadataXmlContent)[type]
      const metadataInfo: MetadataWithContent = isEmptyString(parsedResult) ? {} : parsedResult
      metadataInfo.fullName = getFullName(file, zipProps)
      metadataInfo.content = await decodeContent(file.name)
      return metadataInfo
    }

    const decodeFile = async (file: JSZipObject, zipProps: ZipProps): Promise<MetadataInfo> => {
      const metadataXmlContent = await decodeContent(file.name)
      const parsedResult = parser.parse(metadataXmlContent)[type]
      const metadataInfo: MetadataInfo = isEmptyString(parsedResult) ? {} : parsedResult
      metadataInfo.fullName = getFullName(file, zipProps)
      return metadataInfo
    }

    const zipProps = zipPropsMap[type]
    const files = Object.values(zip.files)
      .filter(file => file.name.startsWith(getPathPrefix(zipProps)))
      .filter(file => file.name.endsWith(zipProps.fileSuffix))
    if (zipProps.isMetadataWithContent) {
      return Promise.all(files.map(file => decodeFileWithContent(file, zipProps)))
    }
    return Promise.all(files.map(file => decodeFile(file, zipProps)))
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
    .map(async t => ([t, await fromMetadataXml(zip, t as keyof ZipPropsMap)])))
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

const addDeletionFiles = (zip: JSZip, instanceName: string, type: keyof ZipPropsMap): void => {
  // describe the instances that are about to be deleted
  zip.file(`${PACKAGE}/destructiveChanges.xml`,
    toMetadataXml('Package', { types: { members: instanceName, name: type } }))
  // Add package "manifest" that specifies the content of the zip that should be deployed
  zip.file(`${PACKAGE}/package.xml`, toMetadataXml('Package', { version: API_VERSION }))
}

const addInstanceFiles = (zip: JSZip, instanceName: string, type: keyof ZipPropsMap,
  values: Values): void => {
  const toMetadataXmlContent = (): string => {
    const mdWithContent = toMetadataInfo(instanceName, values) as MetadataWithContent
    delete mdWithContent.fullName
    delete mdWithContent.content
    return toMetadataXml(type, mdWithContent)
  }

  const zipProps = zipPropsMap[type]
  const instanceContentPath = `${PACKAGE}/${zipProps.dir}/${instanceName}.${zipProps.fileSuffix}`
  if (zipProps.isMetadataWithContent) {
    // Add instance metadata
    zip.file(`${PACKAGE}/${zipProps.dir}/${instanceName}.${zipProps.fileSuffix}${METADATA_XML_SUFFIX}`,
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
      types: { members: instanceName, name: type },
    }))
}

export const toMetadataPackageZip = async (instanceName: string, typeName: string,
  instanceValues: Values, deletion: boolean): Promise<Buffer | undefined> => {
  if (!isSupportedType(typeName)) {
    log.warn('Deploying instances of type %s is not supported', typeName)
    return undefined
  }
  const zip = new JSZip()
  if (deletion) {
    addDeletionFiles(zip, instanceName, typeName as keyof ZipPropsMap)
  } else {
    addInstanceFiles(zip, instanceName, typeName as keyof ZipPropsMap, instanceValues)
  }

  return zip.generateAsync({ type: 'nodebuffer' })
}
