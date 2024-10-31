/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import path from 'path'
import JSZip from 'jszip'
import { filter } from '@salto-io/adapter-utils'
import type { FileProperties } from '@salto-io/jsforce-types'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { AdapterFormat, BuiltinTypes } from '@salto-io/adapter-api'
import { fromRetrieveResult, isComplexType, METADATA_XML_SUFFIX } from '../transformers/xml_transformer'
import {
  createInstanceElement,
  createMetadataObjectType,
  MetadataObjectType,
  isMetadataObjectType,
  metadataType,
  MetadataInstanceElement,
} from '../transformers/transformer'
import { API_NAME, METADATA_CONTENT_FIELD, SYSTEM_FIELDS, UNSUPPORTED_SYSTEM_FIELDS } from '../constants'
import { ComponentSet, ConvertResult, MetadataConverter, SourceComponent } from './salesforce_imports'
import { UNSUPPORTED_TYPES } from './sfdx_dump'
import { allFilters } from '../adapter'
import { buildFetchProfile } from '../fetch_profile/fetch_profile'
import { metadataTypeSync } from '../filters/utils'
import { getTypesWithContent, getTypesWithMetaFile } from '../fetch'
import { detailedMessageFromSfError } from './errors'

const log = logger(module)
const { awu, keyByAsync } = collections.asynciterable

const getXmlDestination = (component: SourceComponent): string | undefined => {
  const { folderContentType, suffix } = component.type
  if (!component.xml) {
    // Should never happen
    log.error('getXmlDestination - got component without xml: %o', component)
    return undefined
  }
  let xmlDestination = component.getPackageRelativePath(component.xml, 'metadata')

  // A few cases that don't seem to be handled properly in getPackageRelativePath
  if (folderContentType) {
    // Folder types do not have the suffix in their file name
    xmlDestination = xmlDestination.replace(`.${suffix}`, '')
  } else if (suffix && component.type.name === 'Document' && component.content) {
    // Document files include the original document extension instead of the type's suffix
    // e.g - bla.txt will be in bla.txt-meta.xml and not in bla.document-meta.xml
    // Note - it is valid to have no extension in the document (e.g, just "bla"), but it seems like the SFDX
    // code does not fully support that
    xmlDestination = xmlDestination.replace(
      new RegExp(`.${suffix}${METADATA_XML_SUFFIX}$`),
      `${path.extname(component.content)}${METADATA_XML_SUFFIX}`,
    )
  }

  // Even though most of the time it is correct to have the suffix, the current code in fromRetrieveResult
  // assumes all the names we get don't have this suffix, so, in order to mimic responses from the API
  // we always remove the suffix here, and we let fromRetrieveResult add it back where needed
  if (xmlDestination.endsWith(METADATA_XML_SUFFIX)) {
    xmlDestination = xmlDestination.slice(0, xmlDestination.lastIndexOf(METADATA_XML_SUFFIX))
  }

  if (isComplexType(component.type.name)) {
    // When working with complex types, the API seems to return the folder name as the file name whereas the SFDX code
    // returns the correct file name.
    // So we remove the file name and keep only to folder name here
    xmlDestination = path.dirname(xmlDestination)
  }

  return xmlDestination
}

type LoadElementsFromFolderFunc = NonNullable<AdapterFormat['loadElementsFromFolder']>
export const loadElementsFromFolder: LoadElementsFromFolderFunc = async ({ baseDir, elementsSource }) => {
  try {
    // Load current SFDX project
    // SFDX code has some issues when working with relative paths (some custom object files may get the wrong path)
    // normalizing the base dir to be an absolute path to work around those issues
    const absBaseDir = path.resolve(baseDir)
    const currentComponents = ComponentSet.fromSource(absBaseDir)
    const converter = new MetadataConverter()
    let convertResult: ConvertResult
    try {
      convertResult = await converter.convert(
        currentComponents.filter(component => !UNSUPPORTED_TYPES.has(component.type.name)),
        'metadata',
        { type: 'zip' },
      )
    } catch (error) {
      return {
        elements: [],
        errors: [
          {
            severity: 'Error',
            message: 'Failed to load project',
            detailedMessage: detailedMessageFromSfError(error),
          },
        ],
      }
    }
    if (convertResult.zipBuffer === undefined) {
      return {
        elements: [],
        errors: [
          {
            severity: 'Error',
            message: 'Failed to load project',
            detailedMessage: `Failed to load project in path ${baseDir}`,
          },
        ],
      }
    }

    const typesFromWorkspace = (
      await awu(await elementsSource.list())
        .filter(id => id.idType === 'type')
        .map(id => elementsSource.get(id))
        .toArray()
    )
      .filter(isMetadataObjectType)
      // Things that have an api name are instances that we converted to types (CustomObject / CustomMetadata)
      .filter(type => type.annotations[API_NAME] === undefined)

    const typesByName = await keyByAsync(typesFromWorkspace, metadataType)

    const zip = await new JSZip().loadAsync(convertResult.zipBuffer)
    const zipFileNames = new Set(Object.keys(zip.files))
    const componentExamplePerType = Object.values(
      _.keyBy(currentComponents.getSourceComponents().toArray(), component => component.type.name),
    )
    // Some components may be of a type that is excluded in the workspace
    // in these cases we need to infer the type from the component information
    componentExamplePerType
      .filter(component => typesByName[component.type.name] === undefined)
      .forEach(component => {
        const { name: metadataTypeName, folderType, folderContentType } = component.type
        const xmlFileName = getXmlDestination(component)
        const hasMetaFile = xmlFileName !== undefined && zipFileNames.has(`${xmlFileName}${METADATA_XML_SUFFIX}`)
        const hasContentField = folderContentType === undefined && hasMetaFile && zipFileNames.has(xmlFileName)
        typesByName[metadataTypeName] = createMetadataObjectType({
          annotations: {
            metadataType: metadataTypeName,
            hasMetaFile,
            folderType,
            folderContentType,
          },
          fields: hasContentField
            ? {
                [METADATA_CONTENT_FIELD]: { refType: BuiltinTypes.STRING },
              }
            : undefined,
        })
      })

    const allTypes = Object.values(typesByName)

    const fileProps = currentComponents
      .getSourceComponents()
      .filter(component => component.xml !== undefined)
      .map(
        component =>
          ({
            fullName: component.fullName,
            fileName: getXmlDestination(component) ?? '',
            type: component.type.name,
          }) as FileProperties,
      )
      .toArray()

    const typesWithMetaFile = await getTypesWithMetaFile(allTypes)
    const typesWithContent = await getTypesWithContent(allTypes)

    const fetchProfile = buildFetchProfile({
      fetchParams: {
        // We set a fetch target here to make the filters think we are in partial fetch
        // this should make the filters not assume all elements are in the elements list
        // this is needed because, for example, we want to search for references to elements outside of the folder elements
        target: allTypes.map(metadataTypeSync),
      },
    })

    const propsAndValues = await fromRetrieveResult({
      zip,
      fileProps,
      typesWithMetaFile,
      typesWithContent,
      packagePath: '',
      fetchProfile,
    })

    const instancesFromZip = propsAndValues.map(({ values, file }) =>
      createInstanceElement(values, typesByName[file.type]),
    )

    const filterRunner = filter.filtersRunner(
      {
        config: {
          unsupportedSystemFields: UNSUPPORTED_SYSTEM_FIELDS,
          systemFields: SYSTEM_FIELDS,
          fetchProfile,
          elementsSource,
          flsProfiles: [],
        },
      },
      allFilters,
      results => ({ errors: results.flatMap(res => collections.array.makeArray(res.errors)) }),
    )
    // Some filters assume the types have to come from the elements list
    // so when running the filters we must provide the types as well
    const elements = (instancesFromZip as (MetadataInstanceElement | MetadataObjectType)[]).concat(allTypes)
    const res = await filterRunner.onFetch(elements)
    const errors = collections.array.makeArray(res?.errors)

    return { elements, errors }
  } catch (e) {
    log.error(e)
    return {
      elements: [],
      errors: [
        {
          severity: 'Error',
          message: 'Failed to load project',
          detailedMessage: `Failed to load project due to error ${e}`,
        },
      ],
    }
  }
}
