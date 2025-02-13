/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { extname } from 'path'
import wu from 'wu'
import _ from 'lodash'
import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import { FileProperties, RetrieveRequest } from '@salto-io/jsforce'
import JSZip from 'jszip'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { Values, StaticFile, InstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import {
  MapKeyFunc,
  mapKeysRecursive,
  naclCase,
  safeJsonStringify,
  TransformFunc,
  transformValues,
} from '@salto-io/adapter-utils'
import { API_VERSION } from '../client/client'
import {
  INSTANCE_FULL_NAME_FIELD,
  IS_ATTRIBUTE,
  METADATA_CONTENT_FIELD,
  SALESFORCE,
  XML_ATTRIBUTE_PREFIX,
  RECORDS_PATH,
  INSTALLED_PACKAGES_PATH,
  NAMESPACE_SEPARATOR,
  INTERNAL_ID_FIELD,
  LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE,
  SETTINGS_METADATA_TYPE,
  SETTINGS_DIR_NAME,
  GEN_AI_FUNCTION_METADATA_TYPE,
  AURA_DEFINITION_BUNDLE_METADATA_TYPE,
} from '../constants'
import {
  apiName,
  metadataType,
  MetadataValues,
  MetadataInstanceElement,
  MetadataObjectType,
  toDeployableInstance,
  assertMetadataObjectType,
} from './transformer'
import { FetchProfile } from '../types'

const { isDefined } = lowerDashValues
const { isPlainObject } = lowerDashValues

const log = logger(module)

// if added to an instance, includes the content filename for the deploy package
// and maybe more nesting levels
export const CONTENT_FILENAME_OVERRIDE = 'deployPkgPartialPath'

export const metadataTypesWithAttributes = [LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE]

export const PACKAGE = 'unpackaged'
const HIDDEN_CONTENT_VALUE = '(hidden)'
export const METADATA_XML_SUFFIX = '-meta.xml'
const UNFILED_PUBLIC_FOLDER = 'unfiled$public'

// ComplexTypes used constants
const TYPE = 'type'
const MARKUP = 'markup'
const TARGET_CONFIGS = 'targetConfigs'
const LWC_RESOURCES = 'lwcResources'
const LWC_RESOURCE = 'lwcResource'
const GEN_AI_FUNCTION_SCHEMAS = 'schemas'

export const getManifestTypeName = (type: MetadataObjectType): string =>
  // Salesforce quirk - folder instances are listed under their content's type in the manifest

  // Salesforce quirk - settings instances should be deployed under Settings type,
  // although their received type is "<name>Settings"
  type.annotations.dirName === SETTINGS_DIR_NAME
    ? SETTINGS_METADATA_TYPE
    : type.annotations.folderContentType ?? type.annotations.metadataType

export const toRetrieveRequest = (files: ReadonlyArray<FileProperties>): RetrieveRequest => ({
  apiVersion: API_VERSION,
  singlePackage: false,
  [PACKAGE]: {
    version: API_VERSION,
    types: _(files)
      .groupBy(file => file.type)
      .entries()
      .map(([type, typeFiles]) => ({
        name: type,
        members: typeFiles.map(file => file.fullName),
      }))
      .value(),
  },
})

type AddContentFieldAsStaticFileArgs = {
  values: Values
  valuePath: string[]
  content: Buffer
  contentFileName: string
  type: string
  namespacePrefix?: string
  packagePath: string
}
const addContentFieldAsStaticFile = ({
  values,
  valuePath,
  content,
  contentFileName,
  type,
  namespacePrefix,
  packagePath,
}: AddContentFieldAsStaticFileArgs): void => {
  const folder =
    namespacePrefix === undefined
      ? `${SALESFORCE}/${RECORDS_PATH}/${type}`
      : `${SALESFORCE}/${INSTALLED_PACKAGES_PATH}/${namespacePrefix}/${RECORDS_PATH}/${type}`
  const filePathInPackage = packagePath ? contentFileName.replace(new RegExp(`^${packagePath}`), '') : contentFileName
  _.set(
    values,
    valuePath,
    content.toString() === HIDDEN_CONTENT_VALUE
      ? content.toString()
      : new StaticFile({
          // The first folder in the file path represents the type, that is already represented in the "folder" variable
          // so we remove the value for the file path here
          filepath: `${folder}/${filePathInPackage.split('/').slice(1).join('/')}`,
          content,
        }),
  )
}

type FieldName = string
type FileName = string
type Content = Buffer
type AddContentFieldsArgs = {
  fileNameToContent: Record<string, Buffer>
  values: Values
  type: string
  namespacePrefix?: string
  packagePath: string
}
type ComplexType = {
  addContentFields(args: AddContentFieldsArgs): void
  getMissingFields?(metadataFileName: string): Values
  mapContentFields(instanceName: string, values: Values): Record<FieldName, Record<FileName, Content>>
  sortMetadataValues?(metadataValues: Values): Values
  getMetadataFilePath(instanceName: string, values?: Values): string
}

type ComplexTypesMap = {
  [AURA_DEFINITION_BUNDLE_METADATA_TYPE]: ComplexType
  [LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE]: ComplexType
  [GEN_AI_FUNCTION_METADATA_TYPE]: ComplexType
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

/**
 * Convert a string value of a file path to a map key.
 * In this case, we want to use the last part of the path as the key, and it's
 * unknown how many levels the path has.
 * If there are less than two levels, take only the last.
 */
const pathToKey = (val: string): string => {
  const splitPath = val.split('/')
  if (splitPath.length >= 3) {
    return naclCase(splitPath.slice(2).join('/'))
  }
  log.warn(`Path ${val} has less than two levels, using only the last part as the key`)
  return naclCase(_.last(splitPath))
}

const addContentFieldsAsStaticFiles =
  (path: string[]): ComplexType['addContentFields'] =>
  ({ fileNameToContent, values, type, namespacePrefix, packagePath }) => {
    Object.entries(fileNameToContent).forEach(([contentFileName, content]) => {
      const filePath = packagePath ? contentFileName.replace(new RegExp(`^${packagePath}`), '') : contentFileName
      const resourcePath = path.concat(pathToKey(filePath))
      addContentFieldAsStaticFile({
        values,
        valuePath: [...resourcePath, 'source'],
        content,
        contentFileName,
        type,
        namespacePrefix,
        packagePath,
      })
      _.set(values, [...resourcePath, 'filePath'], filePath)
    })
  }

const isBuffer = (val: unknown): val is Buffer => _.isBuffer(val)

const mapStaticFilesContentFields =
  (field: string, path: string[]): ComplexType['mapContentFields'] =>
  (_instanceName: string, values: Values) => ({
    [field]: Object.fromEntries(
      Object.values(_.get(values, path))
        .filter(
          (val: unknown): val is { filePath: string; source: Buffer | string } =>
            isPlainObject(val) &&
            _.isString(_.get(val, 'filePath')) &&
            (isBuffer(_.get(val, 'source')) || _.isString(_.get(val, 'source'))),
        )
        .map(({ filePath, source }) => [`${PACKAGE}/${filePath}`, isBuffer(source) ? source : Buffer.from(source)]),
    ),
  })

export const complexTypesMap: ComplexTypesMap = {
  /**
   * AuraDefinitionBundle has several base64Binary content fields. We should use its content fields
   * suffix in order to set their content to the correct field
   */
  [AURA_DEFINITION_BUNDLE_METADATA_TYPE]: {
    addContentFields: ({ fileNameToContent, values, type, namespacePrefix, packagePath }) => {
      Object.entries(fileNameToContent).forEach(([contentFileName, content]) => {
        const fieldName = Object.entries(auraFileSuffixToFieldName).find(([fileSuffix, _fieldName]) =>
          contentFileName.endsWith(fileSuffix),
        )?.[1]
        if (fieldName === undefined) {
          log.warn(`Could not extract field content from ${contentFileName}`)
          return
        }
        addContentFieldAsStaticFile({
          values,
          valuePath: [fieldName],
          content,
          contentFileName,
          type,
          namespacePrefix,
          packagePath,
        })
      })
    },
    /**
     * TYPE field is not returned in the retrieve API and is necessary for future deploys logic
     */
    getMissingFields: (metadataFileName: string) => {
      const fileName = metadataFileName.split(METADATA_XML_SUFFIX)[0]
      const auraType = Object.entries(auraTypeToFileSuffix).find(([_typeName, fileSuffix]) =>
        fileName.endsWith(fileSuffix),
      )?.[0]
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
      return Object.fromEntries(
        Object.entries(auraFileSuffixToFieldName)
          .filter(([_fileSuffix, fieldName]) => fieldName !== MARKUP)
          .filter(([_fileSuffix, fieldName]) => isDefined(values[fieldName]))
          .map(([fileSuffix, fieldName]) => [
            fieldName,
            {
              [`${PACKAGE}/aura/${instanceName}/${instanceName}${fileSuffix}`]: values[fieldName],
            },
          ])
          .concat([
            [
              MARKUP,
              {
                [`${PACKAGE}/aura/${instanceName}/${instanceName}${auraTypeToFileSuffix[type]}`]: values[MARKUP],
              },
            ],
          ]),
      )
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
  [LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE]: {
    addContentFields: addContentFieldsAsStaticFiles([LWC_RESOURCES, LWC_RESOURCE]),
    mapContentFields: mapStaticFilesContentFields(LWC_RESOURCES, [LWC_RESOURCES, LWC_RESOURCE]),
    /**
     * Due to SF quirk, TARGET_CONFIGS field must be in the xml after the targets field
     */
    sortMetadataValues: (metadataValues: Values) =>
      Object.fromEntries(
        Object.entries(metadataValues)
          .filter(([name]) => name !== TARGET_CONFIGS)
          .concat([[TARGET_CONFIGS, metadataValues[TARGET_CONFIGS]]]),
      ),
    getMetadataFilePath: (instanceName: string) =>
      `${PACKAGE}/lwc/${instanceName}/${instanceName}.js${METADATA_XML_SUFFIX}`,
  },
  /**
   * GenAiFunctions have input and output folders
   */
  [GEN_AI_FUNCTION_METADATA_TYPE]: {
    addContentFields: addContentFieldsAsStaticFiles([GEN_AI_FUNCTION_SCHEMAS]),
    mapContentFields: mapStaticFilesContentFields(GEN_AI_FUNCTION_SCHEMAS, [GEN_AI_FUNCTION_SCHEMAS]),
    getMetadataFilePath: (instanceName: string) =>
      `${PACKAGE}/genAiFunctions/${instanceName}/${instanceName}.genAiFunction${METADATA_XML_SUFFIX}`,
  },
}

export const isComplexType = (typeName: string): typeName is keyof ComplexTypesMap =>
  Object.keys(complexTypesMap).includes(typeName)

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: XML_ATTRIBUTE_PREFIX,
  ignoreDeclaration: true,
  numberParseOptions: { hex: false, leadingZeros: false, eNotation: false, skipLike: /.*/ },
  tagValueProcessor: (_name, val) => val.replace(/&#xD;/g, '\r'),
})

export const xmlToValues = (xmlAsString: string): { values: Values; typeName: string } => {
  // SF do not encode their CRs and the XML parser converts them to LFs, so we preserve them.
  const parsedXml = parser.parse(xmlAsString.replace(/\r/g, '&#xD;'))

  const parsedEntries = Object.entries<Values>(parsedXml)
  if (parsedEntries.length !== 1) {
    // Should never happen.
    log.debug('Found %d root nodes in xml: %s', parsedEntries.length, Object.keys(parsedXml).join(','))
    if (parsedEntries.length === 0) {
      return { typeName: '', values: {} }
    }
  }
  const [typeName, values] = parsedEntries[0]
  if (!_.isPlainObject(values)) {
    log.debug('Could not find values for type %s in xml:\n%s', typeName, xmlAsString)
    return { typeName, values: {} }
  }
  const xmlnsAttributes = ['xmlns', 'xmlns:xsi'].map(attr => `${XML_ATTRIBUTE_PREFIX}${attr}`)
  return { typeName, values: _.omit(values, xmlnsAttributes) }
}

type ExtractFileNameToDataParams = {
  zip: JSZip
  fileName: string
  withMetadataSuffix: boolean
  complexType: boolean
  namespacePrefix?: string
  packagePath: string
}

const fixPath = (path: string): string =>
  // The fileName of Workflow instances on Custom Objects return as "Workflow/WorkflowName.workflow"
  // while the actual file in the zip is "workflows/WorkflowName.workflow"
  path.replace('Workflow/', 'workflows/')

const extractFileNameToData = async ({
  zip,
  fileName,
  withMetadataSuffix,
  complexType,
  namespacePrefix,
  packagePath,
}: ExtractFileNameToDataParams): Promise<Record<string, Buffer>> => {
  if (!complexType) {
    const path = `${packagePath}${fileName}${withMetadataSuffix ? METADATA_XML_SUFFIX : ''}`
    const fixedFilePath = fixPath(path)
    const zipFile = zip.file(fixedFilePath)
    if (zipFile === null) {
      log.warn('Could not find file %s in zip', fixedFilePath)
      return {}
    }
    return { [zipFile.name]: await zipFile.async('nodebuffer') }
  }
  // bring all matching files from the fileName directory
  let instanceFolderName = `${packagePath}${fileName.substring(0, fileName.length - extname(fileName).length)}`
  if (namespacePrefix !== undefined) {
    instanceFolderName = instanceFolderName.replace(`${namespacePrefix}${NAMESPACE_SEPARATOR}`, '')
  }
  const zipFiles = zip
    .file(new RegExp(`^${instanceFolderName}/.*`))
    .filter(zipFile => zipFile.name.endsWith(METADATA_XML_SUFFIX) === withMetadataSuffix)
  return _.isEmpty(zipFiles)
    ? {}
    : Object.fromEntries(
        await Promise.all(zipFiles.map(async zipFile => [zipFile.name, await zipFile.async('nodebuffer')])),
      )
}

type FromRetrieveResultArgs = {
  zip: JSZip
  fileProps: ReadonlyArray<FileProperties>
  typesWithMetaFile: Set<string>
  typesWithContent: Set<string>
  fetchProfile: FetchProfile
  packagePath?: string
}

export const fromRetrieveResult = async ({
  zip,
  fileProps,
  typesWithMetaFile,
  typesWithContent,
  packagePath = `${PACKAGE}/`,
}: FromRetrieveResultArgs): Promise<{ file: FileProperties; values: MetadataValues }[]> => {
  const typesWithDiff = new Set<string>()
  const fromZip = async (file: FileProperties): Promise<MetadataValues | undefined> => {
    // extract metadata values
    const fileNameToValuesBuffer = await extractFileNameToData({
      zip,
      fileName: file.fileName,
      withMetadataSuffix: typesWithMetaFile.has(file.type) || isComplexType(file.type),
      complexType: isComplexType(file.type),
      namespacePrefix: file.namespacePrefix,
      packagePath,
    })
    if (Object.values(fileNameToValuesBuffer).length !== 1) {
      if (file.fullName !== UNFILED_PUBLIC_FOLDER) {
        log.warn(
          `Expected to retrieve only single values file for instance (type:${file.type}, fullName:${file.fullName}), found ${Object.values(fileNameToValuesBuffer).length}`,
        )
      }
      return undefined
    }
    const [[valuesFileName, instanceValuesBuffer]] = Object.entries(fileNameToValuesBuffer)
    const xmlString = instanceValuesBuffer.toString()
    const valuesFromXml = xmlToValues(xmlString).values
    const metadataValues = Object.assign(valuesFromXml, {
      [INSTANCE_FULL_NAME_FIELD]: file.fullName,
    })

    // add content fields
    if (typesWithContent.has(file.type) || isComplexType(file.type)) {
      const fileNameToContent = await extractFileNameToData({
        zip,
        fileName: file.fileName,
        withMetadataSuffix: false,
        complexType: isComplexType(file.type),
        namespacePrefix: file.namespacePrefix,
        packagePath,
      })
      if (_.isEmpty(fileNameToContent)) {
        log.warn(`Could not find content files for instance (type:${file.type}, fullName:${file.fullName})`)
        return undefined
      }
      if (isComplexType(file.type)) {
        const complexType = complexTypesMap[file.type]
        Object.assign(metadataValues, complexType.getMissingFields?.(valuesFileName) ?? {})
        complexType.addContentFields({
          fileNameToContent,
          values: metadataValues,
          type: file.type,
          namespacePrefix: file.namespacePrefix,
          packagePath,
        })
      } else {
        const [contentFileName, content] = Object.entries(fileNameToContent)[0]
        addContentFieldAsStaticFile({
          values: metadataValues,
          valuePath: [METADATA_CONTENT_FIELD],
          content,
          contentFileName,
          type: file.type,
          namespacePrefix: file.namespacePrefix,
          packagePath,
        })
      }
    }
    if (file.id !== undefined && file.id !== '') {
      metadataValues[INTERNAL_ID_FIELD] = file.id
    }
    return metadataValues
  }

  log.debug(`retrieved zip contains the following files: ${safeJsonStringify(Object.keys(zip.files))}`)
  const instances = await Promise.all(
    fileProps.map(async file => {
      const values = await fromZip(file)
      return values === undefined ? undefined : { file, values }
    }),
  )
  log.debug('xml parsing types  with diffs: [%s]', Array.from(typesWithDiff).join(', '))
  return instances.filter(isDefined)
}

const builder = new XMLBuilder({
  attributeNamePrefix: XML_ATTRIBUTE_PREFIX,
  ignoreAttributes: false,
  format: true,
  indentBy: '    ',
})

const SALESFORCE_XML_NAMESPACE_URL = 'http://soap.sforce.com/2006/04/metadata'

const toMetadataXml = (name: string, values: Values): string =>
  builder.build({
    '?xml': {
      [`${XML_ATTRIBUTE_PREFIX}version`]: '1.0',
      [`${XML_ATTRIBUTE_PREFIX}encoding`]: 'UTF-8',
    },
    [name]: _.merge(_.omit(values, INSTANCE_FULL_NAME_FIELD), {
      [`${XML_ATTRIBUTE_PREFIX}xmlns`]: SALESFORCE_XML_NAMESPACE_URL,
    }),
  })

const cloneValuesWithAttributePrefixes = async (instance: InstanceElement): Promise<Values> => {
  const allAttributesPaths = new Set<string>()
  const trueValueAttributePaths: Set<string> = new Set<string>()
  const createPathsSetCallback: TransformFunc = ({ value, field, path }) => {
    if (path && field && field.annotations[IS_ATTRIBUTE]) {
      if (value === true || value === 'true') {
        trueValueAttributePaths.add(path.getFullName())
      } else {
        allAttributesPaths.add(path.getFullName())
      }
    }
    return value
  }

  await transformValues({
    values: instance.value,
    type: await instance.getType(),
    transformFunc: createPathsSetCallback,
    pathID: instance.elemID,
    strict: false,
    allowEmptyArrays: true,
    allowExistingEmptyObjects: true,
  })

  const addAttributePrefixFunc: MapKeyFunc = ({ key, pathID }) => {
    if (pathID && allAttributesPaths.has(pathID.getFullName())) {
      return XML_ATTRIBUTE_PREFIX + key
    }
    // Special handling since the fast-xml-parser implementation will omit the value "true" for attributes
    // As a workaround, we pass it as part of the key
    if (pathID && trueValueAttributePaths.has(pathID.getFullName())) {
      return `${XML_ATTRIBUTE_PREFIX}${key}="true"`
    }
    return key
  }
  return mapKeysRecursive(instance.value, addAttributePrefixFunc, instance.elemID)
}

// Create values with the XML_ATTRIBUTE_PREFIX for xml attributes fields
const getValuesToDeploy = async (instance: InstanceElement): Promise<Values> => {
  if (!metadataTypesWithAttributes.includes(await metadataType(instance))) {
    return instance.value
  }
  return cloneValuesWithAttributePrefixes(instance)
}

const toPackageXml = (manifest: Map<string, string[]>): string =>
  toMetadataXml('Package', {
    version: API_VERSION,
    types: [...manifest.entries()].map(([name, members]) => ({
      name,
      members,
    })),
  })

export type DeployPackage = {
  add(instance: MetadataInstanceElement, withManifest?: boolean): Promise<void>
  addToManifest(type: MetadataObjectType, name: string): void
  delete(type: MetadataObjectType, name: string): void
  getZip(): Promise<Buffer>
  getPackageXmlContent(): string
  getDeletionsPackageName(): string
  getZipContent(): Map<string, string | Buffer>
}

export const createDeployPackage = (deleteBeforeUpdate?: boolean): DeployPackage => {
  const addManifest = new collections.map.DefaultMap<string, string[]>(() => [])
  const deleteManifest = new collections.map.DefaultMap<string, string[]>(() => [])
  const zipContent = new Map<string, string | Buffer>()
  const deletionsPackageName = deleteBeforeUpdate ? 'destructiveChanges.xml' : 'destructiveChangesPost.xml'

  const addToManifest: DeployPackage['addToManifest'] = (type, name) => {
    const typeName = getManifestTypeName(type)
    addManifest.get(typeName).push(name)
  }
  return {
    add: async (instance, withManifest = true) => {
      const instanceName = await apiName(instance)
      const setAndLogZipFile = (fileName: string, content: string | Buffer): void => {
        zipContent.set(fileName, content)
        log.trace('Added XML file %s with content %s', fileName, content)
      }
      const removeNamespacePrefix = (name: string): string => name.replace(/^\w+__/g, '')
      try {
        if (withManifest) {
          addToManifest(assertMetadataObjectType(await instance.getType()), instanceName)
        }
        // Add instance file(s) to zip
        const typeName = await metadataType(instance)
        const values = await getValuesToDeploy(await toDeployableInstance(instance))
        if (isComplexType(typeName)) {
          const complexType = complexTypesMap[typeName]
          const fieldToFileToContent = complexType.mapContentFields(instanceName, values)

          // Add instance metadata
          const metadataValues = _.omit(values, ...Object.keys(fieldToFileToContent))
          setAndLogZipFile(
            complexType.getMetadataFilePath(removeNamespacePrefix(instanceName), values),
            toMetadataXml(typeName, complexType.sortMetadataValues?.(metadataValues) ?? metadataValues),
          )

          // Add instance content fields
          const fileNameToContentMaps = Object.values(fieldToFileToContent)
          fileNameToContentMaps.forEach(fileNameToContentMap =>
            Object.entries(fileNameToContentMap).forEach(([fileName, content]) => setAndLogZipFile(fileName, content)),
          )
        } else {
          const { dirName, suffix, hasMetaFile } = (await instance.getType()).annotations
          const instanceContentPath = [
            PACKAGE,
            dirName,
            ...(instance.annotations[CONTENT_FILENAME_OVERRIDE] ?? [
              `${instanceName}${suffix === undefined ? '' : `.${suffix}`}`,
            ]),
          ].join('/')
          if (hasMetaFile) {
            setAndLogZipFile(
              `${instanceContentPath}${METADATA_XML_SUFFIX}`,
              toMetadataXml(typeName, _.omit(values, METADATA_CONTENT_FIELD)),
            )
            if (values[METADATA_CONTENT_FIELD] !== undefined) {
              setAndLogZipFile(instanceContentPath, values[METADATA_CONTENT_FIELD])
            }
          } else {
            setAndLogZipFile(instanceContentPath, toMetadataXml(typeName, values))
          }
        }
      } catch (e) {
        log.error(
          'Error occurred when attempting to add the instance %s to the deploy package. Error: %o',
          instanceName,
          e,
        )
        throw e
      }
    },
    addToManifest,
    delete: (type, name) => {
      const typeName = getManifestTypeName(type)
      deleteManifest.get(typeName).push(name)
    },
    getZip: () => {
      zipContent.set(`${PACKAGE}/package.xml`, toPackageXml(addManifest))
      if (deleteManifest.size !== 0) {
        zipContent.set(`${PACKAGE}/${deletionsPackageName}`, toPackageXml(deleteManifest))
      }

      const zip = new JSZip()
      // Set a constant date for all files in the zip in order to keep the zip hash constant when
      // the contents are the same.
      // this is important for the "quickDeploy" feature
      const date = new Date('2023-06-15T00:00:00.000+01:00')
      wu(zipContent.entries()).forEach(([fileName, content]) => zip.file(fileName, content, { date }))

      // We need another iteration here to also set the date on all the folders
      Object.values(zip.files)
        .filter(info => info.dir)
        .forEach(info => {
          info.date = date
        })

      return zip.generateAsync({ type: 'nodebuffer' })
    },
    getDeletionsPackageName: () => deletionsPackageName,
    getPackageXmlContent: () => toPackageXml(addManifest),
    getZipContent: () => zipContent,
  }
}
