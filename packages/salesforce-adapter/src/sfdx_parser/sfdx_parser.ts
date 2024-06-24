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
import path from 'path'
import readdirp from 'readdirp'
import { logger } from '@salto-io/logging'
import { collections, promises } from '@salto-io/lowerdash'
import { filter } from '@salto-io/adapter-utils'
import {
  ObjectType,
  StaticFile,
  isObjectType,
  ReadOnlyElementsSource,
  ElemID,
  Element,
  FetchResult,
  LoadElementsFromFolderArgs,
} from '@salto-io/adapter-api'
import { readTextFile, readFile } from '@salto-io/file'
import { allFilters } from '../adapter'
import {
  xmlToValues,
  isComplexType,
  complexTypesMap,
  PACKAGE,
} from '../transformers/xml_transformer'
import {
  METADATA_TYPES_TO_RENAME,
  createInstanceElement,
  createMetadataObjectType,
  MetadataValues,
} from '../transformers/transformer'
import { buildFetchProfile } from '../fetch_profile/fetch_profile'
import {
  CUSTOM_OBJECT,
  METADATA_CONTENT_FIELD,
  SALESFORCE,
  RECORDS_PATH,
  SYSTEM_FIELDS,
  UNSUPPORTED_SYSTEM_FIELDS,
} from '../constants'
import { sfdxFilters } from './filters'

const log = logger(module)
const { awu } = collections.asynciterable

const SUPPORTED_TYPE_NAMES = [
  'ApexClass',
  'ApexPage',
  'ApexTrigger',
  'AssignmentRules',
  'AuraDefinitionBundle',
  // 'CompactLayout', // TODO: handle instances that are nested under custom object
  'ContentAsset',
  'CustomApplication',
  'CustomObject',
  'CustomTab',
  // 'EmailTemplate', // TODO: add folder name to fullName
  // 'FieldSet', // TODO: handle instances that are nested under custom object
  'FlexiPage',
  'Flow',
  'InstalledPackage',
  // 'LanguageSettings', // TODO: generally handle settings
  'Layout',
  'LightningComponentBundle',
  // 'ListView', // TODO: handle instances that are nested under custom object
  'Profile',
  // 'StaticResource', // TODO: handle static resources that have their content unzipped by SFDX
  // 'Territory2Rule', // TODO: add folder name to fullName (should be <FolderName>.<FullName>)
  'Territory2Type',
  // 'TopicsForObjects', // TODO: handle this
  // 'WebLink', // TODO: handle instances that are nested under custom object
]

const getElementsFromFile = async (
  packageDir: string,
  fileName: string,
  resolvedTypes: Record<string, ObjectType>,
  staticFileNames: string[],
): Promise<Element[]> => {
  // Turns out we cannot rely on the folder name for most of the types
  // some of the types (specifically aura definition bundle, but maybe other types as well...) do
  // require to be in a specific folder, so we also cannot ignore the folder name unfortunately
  const fileContent = await readTextFile.notFoundAsUndefined(
    path.join(packageDir, fileName),
  )
  if (fileContent === undefined) {
    // Should never happen
    log.warn('skipping %s because we could not get its content', fileName)
    return []
  }
  const { typeName, values } = xmlToValues(fileContent)
  const fullNameWithSuffix = path
    .basename(fileName)
    .slice(0, -'-meta.xml'.length) as string
  const fullName = fullNameWithSuffix.split('.').slice(0, -1).join('.')
  values.fullName = fullName

  // Check for static files
  if (isComplexType(typeName)) {
    const complexType = complexTypesMap[typeName]
    const fileDir = path.dirname(fileName)
    const relevantFileNames = staticFileNames.filter((name) =>
      name.startsWith(path.join(fileDir, fullName)),
    )
    const relevantFiles = Object.fromEntries(
      await Promise.all(
        relevantFileNames.map(async (name) => [
          path.join(
            PACKAGE,
            complexType.folderName,
            path.relative(path.dirname(fileDir), name),
          ),
          await readFile(path.join(packageDir, name)),
        ]),
      ),
    )
    Object.assign(
      values,
      complexType.getMissingFields?.(fullNameWithSuffix) ?? {},
    )
    complexType.addContentFields(relevantFiles, values, typeName)
  } else {
    // Handle simple case for single content static file
    const contentFileName = path.join(
      path.dirname(fileName),
      fullNameWithSuffix,
    )
    const contentFile = await readFile(
      path.join(packageDir, contentFileName),
    ).catch(() => undefined)
    if (contentFile !== undefined) {
      values[METADATA_CONTENT_FIELD] = new StaticFile({
        filepath: path.join(
          SALESFORCE,
          RECORDS_PATH,
          typeName,
          fullNameWithSuffix,
        ),
        content: contentFile,
      })
    }
  }

  const type = resolvedTypes[typeName]
  if (!isObjectType(type)) {
    log.warn('Could not find type %s, skipping instance %s', typeName, fullName)
    return []
  }

  return [createInstanceElement(values as MetadataValues, type)]
}

const getElementsFromDXFolder = async (
  packageDir: string,
  workspaceElements: ReadOnlyElementsSource,
  types: Record<string, ObjectType>,
): Promise<Element[]> => {
  const allFiles = await readdirp.promise(packageDir, {
    directoryFilter: (e) => e.basename[0] !== '.',
    type: 'files',
  })
  const fileNames = allFiles.map((entry) =>
    path.relative(packageDir, entry.fullPath),
  )
  const [sourceFileNames, staticFileNames] = _.partition(fileNames, (name) =>
    name.endsWith('-meta.xml'),
  )

  const elements = await awu(sourceFileNames)
    .flatMap((name) =>
      getElementsFromFile(packageDir, name, types, staticFileNames),
    )
    .toArray()

  const localFilters = allFilters
    .filter(filter.isLocalFilterCreator)
    .map(({ creator }) => creator)
  const filtersToRun = sfdxFilters.concat(localFilters)
  const filterRunner = filter.filtersRunner(
    {
      config: {
        unsupportedSystemFields: UNSUPPORTED_SYSTEM_FIELDS,
        systemFields: SYSTEM_FIELDS,
        fetchProfile: buildFetchProfile({
          fetchParams: {
            target: ['hack to make filters think this is partial fetch'],
          },
        }),
        elementsSource: workspaceElements,
        flsProfiles: [],
      },
      files: {
        baseDirName: packageDir,
        sourceFileNames,
        staticFileNames,
      },
    },
    filtersToRun,
  )
  // Some filters assume the types have to come from the elements list
  // so when running the filters we must provide the types as well
  // we omit the CustomObject type because we faked it here so it is not compatible
  const result = elements.concat(Object.values(_.omit(types, CUSTOM_OBJECT)))
  await filterRunner.onFetch(result)
  return result
}

const getElementTypesForSFDX = async (
  elementSource: ReadOnlyElementsSource,
): Promise<Record<string, ObjectType>> => {
  const typeNames = Object.fromEntries(
    SUPPORTED_TYPE_NAMES.map((typeName) => [
      typeName,
      METADATA_TYPES_TO_RENAME.get(typeName) ?? typeName,
    ]),
  )
  const types = _.pickBy(
    await promises.object.mapValuesAsync(typeNames, (name) =>
      elementSource.get(new ElemID(SALESFORCE, name)),
    ),
    isObjectType,
  )

  // We need to create explicit types for CustomObject and CustomField because
  // we remove them when we fetch
  types.CustomObject = createMetadataObjectType({
    annotations: { metadataType: CUSTOM_OBJECT },
  })

  return types
}

type SFDXProjectPackageDir = {
  path: string
  default?: boolean
}

type SFDXProject = {
  packageDirectories: SFDXProjectPackageDir[]
}

const PROJECT_MANIFEST_FILENAME = 'sfdx-project.json'

const getDXPackageDirs = async (baseDir: string): Promise<string[]> => {
  const projectFile = await readTextFile.notFoundAsUndefined(
    path.join(baseDir, PROJECT_MANIFEST_FILENAME),
  )
  if (projectFile === undefined) {
    return []
  }
  // TODO: actually validate the JSON structure
  const project = JSON.parse(projectFile) as SFDXProject
  return project.packageDirectories.map((packageDir) =>
    path.join(baseDir, packageDir.path),
  )
}

export const loadElementsFromFolder = async ({
  baseDir,
  elementsSource,
}: LoadElementsFromFolderArgs): Promise<FetchResult> => {
  const packages = await getDXPackageDirs(baseDir)
  const types = await getElementTypesForSFDX(elementsSource)
  return {
    elements: await awu(packages)
      .flatMap((pkg) => getElementsFromDXFolder(pkg, elementsSource, types))
      .toArray(),
  }
}
