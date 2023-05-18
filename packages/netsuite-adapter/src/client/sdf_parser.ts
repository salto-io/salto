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
import osPath from 'path'
import he from 'he'
import xmlParser from 'fast-xml-parser'
import readdirp from 'readdirp'
import { logger } from '@salto-io/logging'
import { promises, collections } from '@salto-io/lowerdash'
import { exists, readDir, readFile } from '@salto-io/file'
import { CustomTypeInfo, CustomizationInfo, FileCabinetCustomizationInfo, FileCustomizationInfo, FolderCustomizationInfo, TemplateCustomTypeInfo } from './types'
import { CONFIG_FEATURES, FILE_CABINET_PATH_SEPARATOR } from '../constants'
import { ATTRIBUTE_PREFIX, CDATA_TAG_NAME } from './constants'
import { isFileCustomizationInfo } from './utils'

const log = logger(module)
const { withLimitedConcurrency } = promises.array
const { makeArray } = collections.array

export const SRC_DIR = 'src'
export const FILE_CABINET_DIR = 'FileCabinet'
export const OBJECTS_DIR = 'Objects'
export const ACCOUNT_CONFIGURATION_DIR = 'AccountConfiguration'

export const MANIFEST_XML = 'manifest.xml'
export const DEPLOY_XML = 'deploy.xml'
export const FEATURES_XML = 'features.xml'
export const FEATURES_TAG = 'features'
export const FEATURES_LIST_TAG = 'feature'

export const READ_CONCURRENCY = 100
export const ADDITIONAL_FILE_PATTERN = '.template.'
export const XML_FILE_SUFFIX = '.xml'
export const ATTRIBUTES_FOLDER_NAME = '.attributes'
export const FOLDER_ATTRIBUTES_FILE_SUFFIX = `.folder.attr${XML_FILE_SUFFIX}`
export const ATTRIBUTES_FILE_SUFFIX = `.attr${XML_FILE_SUFFIX}`
const FILE_SEPARATOR = '.'

const XML_PARSE_OPTIONS: xmlParser.J2xOptionsOptional = {
  attributeNamePrefix: ATTRIBUTE_PREFIX,
  ignoreAttributes: false,
  tagValueProcessor: val => he.decode(val),
}

export const getSrcDirPath = (projectPath: string): string =>
  osPath.resolve(projectPath, SRC_DIR)

export const getObjectsDirPath = (projectPath: string): string =>
  osPath.resolve(projectPath, SRC_DIR, OBJECTS_DIR)

export const getFileCabinetDirPath = (projectPath: string): string =>
  osPath.resolve(projectPath, SRC_DIR, FILE_CABINET_DIR)

export const getManifestFilePath = (projectPath: string): string =>
  osPath.resolve(projectPath, SRC_DIR, MANIFEST_XML)

export const getDeployFilePath = (projectPath: string): string =>
  osPath.resolve(projectPath, SRC_DIR, DEPLOY_XML)

export const getFeaturesXmlPath = (projectPath: string): string =>
  osPath.resolve(projectPath, SRC_DIR, ACCOUNT_CONFIGURATION_DIR, FEATURES_XML)

const convertToCustomizationInfo = (
  xmlContent: string
): CustomizationInfo => {
  const parsedXmlValues = xmlParser.parse(xmlContent, XML_PARSE_OPTIONS)
  const typeName = Object.keys(parsedXmlValues)[0]
  return { typeName, values: parsedXmlValues[typeName] }
}

const convertToCustomTypeInfo = (
  xmlContent: string,
  scriptId: string
): CustomTypeInfo =>
  Object.assign(
    convertToCustomizationInfo(xmlContent),
    { scriptId }
  )

const convertToTemplateCustomTypeInfo = (
  xmlContent: string,
  scriptId: string,
  fileExtension: string,
  fileContent: Buffer
): TemplateCustomTypeInfo =>
  Object.assign(
    convertToCustomizationInfo(xmlContent),
    { fileExtension, fileContent, scriptId }
  )

const convertToFileCustomizationInfo = (
  xmlContent: string,
  path: string[],
  fileContent: Buffer
): FileCustomizationInfo =>
  Object.assign(
    convertToCustomizationInfo(xmlContent),
    { path, fileContent }
  )

const convertToFolderCustomizationInfo = (
  xmlContent: string,
  path: string[]
): FolderCustomizationInfo =>
  Object.assign(
    convertToCustomizationInfo(xmlContent),
    { path }
  )

export const convertToXmlContent = (
  customizationInfo: CustomizationInfo
): string =>
  // eslint-disable-next-line new-cap
  new xmlParser.j2xParser({
    attributeNamePrefix: ATTRIBUTE_PREFIX,
    // We convert to an not formatted xml since the CDATA transformation is wrong when having format
    format: false,
    ignoreAttributes: false,
    cdataTagName: CDATA_TAG_NAME,
    tagValueProcessor: val => he.encode(val),
  }).parse({ [customizationInfo.typeName]: customizationInfo.values })

const transformCustomObject = async (
  scriptId: string,
  objectFileNames: string[],
  objectsDirPath: string
): Promise<CustomTypeInfo> => {
  const [[additionalFilename], [contentFilename]] = _.partition(
    objectFileNames,
    filename => filename.includes(ADDITIONAL_FILE_PATTERN)
  )
  const xmlContent = await readFile(osPath.resolve(objectsDirPath, contentFilename))
  if (additionalFilename === undefined) {
    return convertToCustomTypeInfo(
      xmlContent.toString(),
      scriptId
    )
  }
  const additionalFileContent = await readFile(osPath.resolve(objectsDirPath, additionalFilename))
  return convertToTemplateCustomTypeInfo(
    xmlContent.toString(),
    scriptId,
    additionalFilename.split(FILE_SEPARATOR)[2],
    additionalFileContent
  )
}

export const parseObjectsDir = async (
  projectPath: string
): Promise<CustomTypeInfo[]> => {
  const objectsDirPath = getObjectsDirPath(projectPath)
  const filenames = await readDir(objectsDirPath)
  const scriptIdToFiles = _.groupBy(
    filenames,
    filename => filename.split(FILE_SEPARATOR)[0]
  )

  return withLimitedConcurrency(
    Object.entries(scriptIdToFiles).map(([scriptId, objectFileNames]) =>
      () => transformCustomObject(scriptId, objectFileNames, objectsDirPath)),
    READ_CONCURRENCY
  )
}

const transformFiles = (
  filePaths: string[],
  fileAttrsPaths: string[],
  fileCabinetDirPath: string
): Promise<FileCustomizationInfo[]> => {
  const filePathToAttrsPath = Object.fromEntries(
    fileAttrsPaths.map(fileAttrsPath => {
      const fileName = fileAttrsPath
        .split(FILE_CABINET_PATH_SEPARATOR)
        .slice(-1)[0]
        .slice(0, -ATTRIBUTES_FILE_SUFFIX.length)

      const folderName = fileAttrsPath.split(ATTRIBUTES_FOLDER_NAME)[0]
      return [`${folderName}${fileName}`, fileAttrsPath]
    })
  )

  const transformFile = async (filePath: string): Promise<FileCustomizationInfo> => {
    const attrsPathParts = filePathToAttrsPath[filePath].split(FILE_CABINET_PATH_SEPARATOR)
    const filePathParts = filePath.split(FILE_CABINET_PATH_SEPARATOR)
    const [xmlContent, fileContent] = await Promise.all([
      readFile(osPath.resolve(fileCabinetDirPath, ...attrsPathParts)),
      readFile(osPath.resolve(fileCabinetDirPath, ...filePathParts)),
    ])
    return convertToFileCustomizationInfo(
      xmlContent.toString(),
      filePathParts.slice(1),
      fileContent
    )
  }

  return withLimitedConcurrency(
    filePaths.map(filePath => () => transformFile(filePath)),
    READ_CONCURRENCY
  )
}

const transformFolders = (
  folderAttrsPaths: string[],
  fileCabinetDirPath: string
): Promise<FolderCustomizationInfo[]> => {
  const transformFolder = async (folderAttrsPath: string): Promise<FolderCustomizationInfo> => {
    const folderPathParts = folderAttrsPath.split(FILE_CABINET_PATH_SEPARATOR)
    const xmlContent = await readFile(osPath.resolve(fileCabinetDirPath, ...folderPathParts))
    return convertToFolderCustomizationInfo(
      xmlContent.toString(),
      folderPathParts.slice(1, -2)
    )
  }

  return withLimitedConcurrency(
    folderAttrsPaths.map(folderAttrsPath => () => transformFolder(folderAttrsPath)),
    READ_CONCURRENCY
  )
}

const listFilesRecursive = async (dirPath: string): Promise<string[]> =>
  // TODO: SALTO-4200 support also windows path style
  (await readdirp.promise(dirPath, { type: 'files' }))
    .map(file => `${FILE_CABINET_PATH_SEPARATOR}${file.path}`)

export const parseFileCabinetDir = async (
  projectPath: string,
  pathsToImport?: string[]
): Promise<FileCabinetCustomizationInfo[]> => {
  const fileCabinetDirPath = getFileCabinetDirPath(projectPath)
  const [attributesPaths, filePaths] = _.partition(
    pathsToImport ?? await listFilesRecursive(fileCabinetDirPath),
    p => p.endsWith(ATTRIBUTES_FILE_SUFFIX)
  )
  const [folderAttrsPaths, fileAttrsPaths] = _.partition(
    attributesPaths,
    p => p.endsWith(FOLDER_ATTRIBUTES_FILE_SUFFIX)
  )

  const [filesRes, foldersRes] = await Promise.all([
    transformFiles(filePaths, fileAttrsPaths, fileCabinetDirPath),
    transformFolders(folderAttrsPaths, fileCabinetDirPath),
  ])
  return [...filesRes, ...foldersRes]
}

export const parseFeaturesXml = async (
  projectPath: string
): Promise<CustomizationInfo | undefined> => {
  const filePath = getFeaturesXmlPath(projectPath)
  if (!await exists(filePath)) {
    log.debug('features xml does not exists')
    return undefined
  }
  const xmlContent = await readFile(filePath)
  const featuresXml = xmlParser.parse(xmlContent.toString(), XML_PARSE_OPTIONS)

  const featuresList = makeArray(featuresXml[FEATURES_TAG]?.[FEATURES_LIST_TAG])
  return {
    typeName: CONFIG_FEATURES,
    values: {
      [FEATURES_LIST_TAG]: featuresList,
    },
  }
}

export const parseSdfProjectDir = async (projectPath: string): Promise<CustomizationInfo[]> => {
  const customObjects = await parseObjectsDir(projectPath)
  const fileCabinetObjects = await parseFileCabinetDir(projectPath)
  const featuresObject = await parseFeaturesXml(projectPath)
  return [
    ...customObjects,
    ...fileCabinetObjects,
    ...(featuresObject !== undefined ? [featuresObject] : []),
  ]
}

export const convertToFeaturesXmlContent = (
  customizationInfo: CustomizationInfo
): string => {
  const featuresList = customizationInfo.values[FEATURES_LIST_TAG]
  return convertToXmlContent({
    typeName: FEATURES_TAG,
    values: {
      [FEATURES_LIST_TAG]: featuresList,
    },
  })
}

export const getFileCabinetCustomInfoPath = (
  dirPath: string,
  fileCabinetCustTypeInfo: FileCabinetCustomizationInfo
): string => {
  if (isFileCustomizationInfo(fileCabinetCustTypeInfo)) {
    return osPath.resolve(dirPath, FILE_CABINET_DIR, ...fileCabinetCustTypeInfo.path.slice(0, -1))
  }
  return osPath.resolve(dirPath, FILE_CABINET_DIR, ...fileCabinetCustTypeInfo.path)
}

export const getCustomTypeInfoPath = (
  dirPath: string,
  customTypeInfo: CustomTypeInfo,
  fileExtension = XML_FILE_SUFFIX
): string =>
  osPath.resolve(dirPath, OBJECTS_DIR, `${customTypeInfo.scriptId}${fileExtension}`)
