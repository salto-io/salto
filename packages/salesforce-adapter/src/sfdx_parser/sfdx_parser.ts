/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { ObjectType, StaticFile, isObjectType, ReadOnlyElementsSource, ElemID, Element, isInstanceElement } from '@salto-io/adapter-api'
import { readTextFile, readFile } from '@salto-io/file'
import { allSystemFields, allFilters, RemoteFilterCreatorDefinition, LocalFilterCreatorDefinition, unsupportedSystemFields } from '../adapter'
import { xmlToValues, isComplexType, complexTypesMap, PACKAGE } from '../transformers/xml_transformer'
import { METADATA_TYPES_TO_RENAME, createInstanceElement, createMetadataObjectType, MetadataValues } from '../transformers/transformer'
import { buildFetchProfile } from '../fetch_profile/fetch_profile'


import { CUSTOM_OBJECT, CUSTOM_FIELD, METADATA_CONTENT_FIELD, SALESFORCE, RECORDS_PATH } from '../constants'


const log = logger(module)
const { awu } = collections.asynciterable

const isLocalFilterCreator = (
  filterDef: LocalFilterCreatorDefinition | RemoteFilterCreatorDefinition
): filterDef is LocalFilterCreatorDefinition => (
  filterDef.addsNewInformation !== true
)

const supportedTypeNames = [
  'CustomApplication',
  'AssignmentRules',
  'AuraDefinitionBundle',
  'ApexClass',
  'ContentAsset',
  // 'EmailTemplate', // TODO: add folder name to fullName
  'FlexiPage',
  'Flow',
  'InstalledPackage',
  'Layout',
  'LightningComponentBundle',
  'CustomObject',
  'ApexPage',
  'Profile',
  // 'LanguageSettings', // TODO: generally handle settings
  'StaticResource',
  'CustomTab',
  // 'Territory2Rule', // TODO: add folder name to fullName (should be <FolderName>.<FullName>)
  'Territory2Type',
  // 'TopicsForObjects', // TODO: handle this
  'ApexTrigger',
]

const CUSTOM_FIELD_OBJECT_NAME = '__objectName'

const getElementsFromFile = async (
  packageDir: string,
  fileName: string,
  resolvedTypes: Record<string, ObjectType>,
  staticFileNames: string[],
): Promise<Element[]> => {
  // Turns out we cannot rely on the folder name for most of the types
  // some of the types (specifically aura definition bundle, but maybe other types as well...) do
  // require to be in a specific folder, so we also cannot ignore the folder name unfortunately
  const fileContent = await readTextFile.notFoundAsUndefined(path.join(packageDir, fileName))
  if (fileContent === undefined) {
    // Should never happen
    log.warn('skipping %s because we could not get its content', fileName)
    return []
  }
  const { typeName, values } = xmlToValues(fileContent)
  const fullNameWithSuffix = path.basename(fileName).slice(0, -'-meta.xml'.length) as string
  const fullName = fullNameWithSuffix.split('.').slice(0, -1).join('.')
  values.fullName = fullName
  if (typeName === CUSTOM_FIELD) {
    // After A LOT of messing around with SFDX, it seems like the way it determines which
    // object a field belongs to is that it expects a specific level of nesting.
    // it is assumed objects are under "<package>/something/something/something/<object name>"
    // where the default is "<package>/main/default/objects/<object name>" but the specific names
    // do not seem to matter, only the number of nesting levels
    //
    // funnily enough, the object definition itself can be pretty much anywhere as long as it is in
    // a folder with the same name as the object. but the fields must be under the structure
    // as described above
    const [/* pkgName */, /* appName */, /* typeFolder */, objectName] = fileName.split(path.sep)
    // This is a hack so that we can later push all the custom fields into the right custom object
    values[CUSTOM_FIELD_OBJECT_NAME] = objectName
  }

  // Check for static files
  if (isComplexType(typeName)) {
    const complexType = complexTypesMap[typeName]
    const fileDir = path.dirname(fileName)
    const relevantFileNames = staticFileNames
      .filter(name => name.startsWith(path.join(fileDir, fullName)))
      .sort()
      .reverse() // TODO: remove this sort, it is just here as a workaround to the order bug in lwc
    const relevantFiles = Object.fromEntries(await Promise.all(
      relevantFileNames.map(async name => [
        path.join(PACKAGE, complexType.folderName, path.relative(path.dirname(fileDir), name)),
        await readFile(path.join(packageDir, name)),
      ])
    ))
    Object.assign(values, complexType.getMissingFields?.(fullNameWithSuffix) ?? {})
    complexType.addContentFields(relevantFiles, values, typeName)
  } else {
    // Handle simple case for single content static file
    const contentFileName = path.join(path.dirname(fileName), fullNameWithSuffix)
    // TODO: handle static resources that have their content unzipped by SFDX (StaticResources)
    const contentFile = await readFile(
      path.join(packageDir, contentFileName)
    ).catch(() => undefined)
    if (contentFile !== undefined) {
      values[METADATA_CONTENT_FIELD] = new StaticFile({
        // TODO: make this path less hard-coded
        filepath: path.join(SALESFORCE, RECORDS_PATH, typeName, fullNameWithSuffix),
        content: contentFile,
      })
    }
  }

  const type = resolvedTypes[typeName]
  if (!isObjectType(type)) {
    log.warn('Could not find type %s, skipping instance %s', typeName, fullName)
    return []
  }

  return [
    createInstanceElement(values as MetadataValues, type),
  ]
}

const getElementsFromDXFolder = async (
  packageDir: string,
  workspaceElements: ReadOnlyElementsSource
): Promise<Element[]> => {
  const typeNames = Object.fromEntries(
    supportedTypeNames
      .map(typeName => [typeName, METADATA_TYPES_TO_RENAME.get(typeName) ?? typeName])
  )
  const types = _.pickBy(
    await promises.object.mapValuesAsync(
      typeNames,
      name => workspaceElements.get(new ElemID(SALESFORCE, name))
    ),
    isObjectType,
  )

  // We need to create explicit types for CustomObject and CustomField because
  // we remove them when we fetch
  types.CustomObject = createMetadataObjectType({ annotations: { metadataType: CUSTOM_OBJECT } })
  types.CustomField = createMetadataObjectType({ annotations: { metadataType: CUSTOM_FIELD } })

  const allFiles = await readdirp.promise(
    packageDir,
    {
      directoryFilter: e => e.basename[0] !== '.',
      type: 'files',
    }
  )
  const fileNames = allFiles.map(entry => path.relative(packageDir, entry.fullPath))
  const [sourceFileNames, staticFileNames] = _.partition(fileNames, name => name.endsWith('-meta.xml'))

  const elements = await awu(sourceFileNames)
    .flatMap(name => getElementsFromFile(packageDir, name, types, staticFileNames))
    .toArray()

  // Remove field instances from elements and add them to custom objects
  const fieldsByObject = _.groupBy(
    _.remove(elements, e => e.elemID.typeName === CUSTOM_FIELD).filter(isInstanceElement),
    inst => inst.value[CUSTOM_FIELD_OBJECT_NAME],
  )
  elements
    .filter(isInstanceElement)
    .filter(e => e.elemID.typeName === CUSTOM_OBJECT)
    .forEach(objInst => {
      const objectFields = fieldsByObject[objInst.value.fullName] ?? []
      objInst.value.fields = objectFields.map(x => _.omit(x.value, CUSTOM_FIELD_OBJECT_NAME))
    })

  const localFilters = allFilters
    .filter(isLocalFilterCreator)
    .map(({ creator }) => creator)
  const filterRunner = filter.filtersRunner(
    {
      config: {
        unsupportedSystemFields,
        systemFields: allSystemFields,
        fetchProfile: buildFetchProfile({ target: ['hack to make filters think this is partial fetch'] }),
        elementsSource: workspaceElements,
      },
    },
    localFilters,
  )
  await filterRunner.onFetch(elements)
  return elements
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
    path.join(baseDir, PROJECT_MANIFEST_FILENAME)
  )
  if (projectFile === undefined) {
    return []
  }
  // TODO: actually validate the JSON structure
  const project = JSON.parse(projectFile) as SFDXProject
  return project.packageDirectories
    .map(packageDir => path.join(baseDir, packageDir.path))
}

export const loadElementsFromFolder = async (
  dxBaseDir: string,
  elementSource: ReadOnlyElementsSource,
): Promise<Element[]> => {
  const packages = await getDXPackageDirs(dxBaseDir)
  return awu(packages)
    .flatMap(pkg => getElementsFromDXFolder(pkg, elementSource))
    .toArray()
}
