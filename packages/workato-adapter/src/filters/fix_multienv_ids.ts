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
import { Element, isInstanceElement, Values, InstanceElement, ReferenceExpression, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { config as configUtils } from '@salto-io/adapter-components'
import { getParents, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { API_DEFINITIONS_CONFIG, WorkatoApiConfig } from '../config'
import { RECIPE_TYPE, RECIPE_CODE_TYPE, FOLDER_TYPE } from '../constants'
import { ROOT_FOLDER_NAME } from './add_root_folder'

const log = logger(module)
const { getConfigWithDefault } = configUtils

const DEREFERENCE_PLACEHOLDER = '&' // should move to adapter-components in SALTO-1687

/**
 * Get an updated instance name with a single dereferenced field,
 * using the provided lookup mapping.
 * based on getInstanceName in adapter-components.
 */
const getDereferencedInstanceName = (
  instanceValues: Values,
  idFields: string[],
  lookup: Record<string, string>
): string | undefined => {
  const nameParts = idFields.map(
    fieldName => {
      if (fieldName.startsWith(DEREFERENCE_PLACEHOLDER)) {
        return lookup[_.get(instanceValues, fieldName.substring(1))]
      }
      return _.get(instanceValues, fieldName)
    }
  )
  if (nameParts.includes(undefined)) {
    log.warn(`could not find id for entry - expected id fields ${idFields}, available fields ${Object.keys(instanceValues)}`)
  }
  return nameParts.every(part => part !== undefined && part !== '') ? nameParts.map(String).join('_') : undefined
}

/**
 * Create an instance with a new name and path
 * Note: does not change any references
 */
const toRenamedInstance = (inst: InstanceElement, newName: string): InstanceElement => (
  new InstanceElement(
    naclCase(newName),
    inst.refType,
    inst.value,
    // not allowing customizing paths in this case
    [
      ...(inst.path?.slice(0, -1) ?? []),
      pathNaclCase(naclCase(newName)),
    ],
    inst.annotations,
  )
)

/**
 * Ensure the id fields are as expected, otherwise do not change anything.
 */
const getValidatedIdFields = (
  typeName: string,
  expectedReferencedFields: string[],
  apiDefinitions: WorkatoApiConfig,
): string[] | undefined => {
  const { idFields } = getConfigWithDefault(
    apiDefinitions.types[typeName]?.transformation ?? {},
    apiDefinitions.typeDefaults.transformation
  )

  if (_.isEqual(
    idFields.filter(f => f.startsWith(DEREFERENCE_PLACEHOLDER)),
    expectedReferencedFields.map(name => `${DEREFERENCE_PLACEHOLDER}${name}`)
  )) {
    return idFields
  }
  log.debug('unexpected %s id fields %s', typeName, idFields)
  return undefined
}

// sort folders by parent
const getSortedFolders = (
  folders: InstanceElement[],
  rootFolderId: number,
): InstanceElement[] => {
  const ROOT_PARENT_PLACEHOLDER_ID = 0

  const foldersById = _.keyBy(
    folders.filter(f => f.value.id !== undefined),
    f => f.value.id as number,
  )

  const foldersByParent = _.groupBy(
    folders.map(f => ({
      parentId: f.value.parent_id ?? ROOT_PARENT_PLACEHOLDER_ID,
      id: f.value.id,
    })),
    f => f.parentId,
  )
  if (
    foldersByParent[0] === undefined
    || foldersByParent[0][0]?.id !== rootFolderId
  ) {
    log.warn('could not find root folder, not changing folder ids')
    return []
  }

  const sortedFolders = []
  const visited = new Set<number>()
  const queue = [ROOT_PARENT_PLACEHOLDER_ID]
  while (queue.length > 0) {
    const cur = queue.shift()
    if (cur === undefined) {
      break // can never happen
    }
    if (visited.has(cur)) {
      log.warn('folder dependency cycle detected, ignoring repeating folder id %s', cur)
      // eslint-disable-next-line no-continue
      continue
    }
    visited.add(cur)
    if (foldersById[cur] !== undefined) {
      sortedFolders.push(foldersById[cur])
    }
    queue.push(...(foldersByParent[cur] ?? []).map(f => f.id))
  }

  return sortedFolders
}

/**
 * If folders use their parent_id as an id field, update it recursively to include the paths.
 */
const fixFolderIDs = (elements: Element[], apiDefinitions: WorkatoApiConfig): void => {
  const idFields = getValidatedIdFields(FOLDER_TYPE, ['parent_id'], apiDefinitions)
  if (idFields === undefined) {
    log.info('unexpected id fields, not changing folder ids: %s', idFields)
    return
  }

  const folders = elements.filter(isInstanceElement).filter(e => e.elemID.typeName === FOLDER_TYPE)
  const rootFolderId = folders.find(f => f.elemID.name === ROOT_FOLDER_NAME)?.value.id
  if (rootFolderId === undefined) {
    log.warn('could not find root folder, not changing folders')
    return
  }
  const sortedFolders = getSortedFolders(folders, rootFolderId)
  if (sortedFolders.length === 0) {
    return
  }

  const oldFolders = _.remove(elements, e =>
    isInstanceElement(e)
    && e.elemID.typeName === FOLDER_TYPE)

  if (sortedFolders.length !== oldFolders.length) {
    log.warn('unexpected inconsistency found, not changing folders')
    elements.push(...oldFolders)
    return
  }

  const folderNameMapping = { [rootFolderId]: ROOT_FOLDER_NAME }
  const newFolders = sortedFolders.map(inst => {
    const newName = getDereferencedInstanceName(inst.value, idFields, folderNameMapping)
    if (inst.value.id === rootFolderId || newName === undefined) {
      return inst
    }
    folderNameMapping[inst.value.id] = newName
    return toRenamedInstance(inst, newName)
  })
  elements.push(...newFolders)
}

/**
 * If recipes use their folder_id as an id field, update the recipes and corresponding recipe_codes.
 */
const fixRecipeIDs = (elements: Element[], apiDefinitions: WorkatoApiConfig): void => {
  const recipeIdFields = getValidatedIdFields(RECIPE_TYPE, ['folder_id'], apiDefinitions)
  const codeIdFields = getValidatedIdFields(RECIPE_CODE_TYPE, [], apiDefinitions)
  if (recipeIdFields === undefined || codeIdFields === undefined) {
    log.debug('unexpected id fields, not changing recipes')
    return
  }

  const instances = elements.filter(isInstanceElement)
  const folders = instances.filter(e => e.elemID.typeName === FOLDER_TYPE)
  const folderLookup: Record<number, string> = Object.fromEntries(
    folders.map(f => [f.value.id, f.elemID.name])
  )
  const recipes = instances.filter(e => e.elemID.typeName === RECIPE_TYPE)

  const recipeNameMapping = Object.fromEntries(
    recipes
      .map(inst => [
        inst.elemID.name,
        getDereferencedInstanceName(inst.value, recipeIdFields, folderLookup),
      ])
      .filter(([_key, value]) => value !== undefined)
  )
  const oldRecipes = _.remove(elements, e =>
    isInstanceElement(e)
    && e.elemID.typeName === RECIPE_TYPE
    && recipeNameMapping[e.elemID.name] !== undefined)

  const newRecipesByOldName = Object.fromEntries(
    oldRecipes.filter(isInstanceElement).map(inst => [
      inst.elemID.name,
      toRenamedInstance(inst, recipeNameMapping[inst.elemID.name]),
    ])
  )
  elements.push(...Object.values(newRecipesByOldName))

  const getRecipeFromCode = (codeInst: InstanceElement): string => (
    getParents(codeInst)?.[0]?.elemID.name ?? ''
  )

  const oldCodes = _.remove(elements, e =>
    isInstanceElement(e)
    && e.elemID.typeName === RECIPE_CODE_TYPE
    && recipeNameMapping[getRecipeFromCode(e)] !== undefined)

  const newRecipeCodeName = (inst: InstanceElement): string => {
    const parentNewName = recipeNameMapping[getRecipeFromCode(inst)]
    const nestedName = getDereferencedInstanceName(inst.value, codeIdFields, {})
    return naclCase(`${parentNewName}_${nestedName}`)
  }

  const newCodes = oldCodes.filter(isInstanceElement).map(inst => {
    const oldRecipeName = getRecipeFromCode(inst)
    const newCode = toRenamedInstance(inst, newRecipeCodeName(inst))
    newCode.annotations[CORE_ANNOTATIONS.PARENT] = [new ReferenceExpression(
      newRecipesByOldName[oldRecipeName].elemID,
      newRecipesByOldName[oldRecipeName],
    )]
    newRecipesByOldName[oldRecipeName].value.code = new ReferenceExpression(
      newCode.elemID,
      newCode,
    )
    return newCode
  })
  elements.push(...newCodes)
}

/**
 * Temporary filter to fix the ids of folders and recipes and make them multienv-friendly.
 * Will be replaced by SALTO-1687 and a config change.
 *
 */
const filter: FilterCreator = ({ config }) => ({
  onFetch: async (elements: Element[]) => {
    fixFolderIDs(elements, config[API_DEFINITIONS_CONFIG])
    fixRecipeIDs(elements, config[API_DEFINITIONS_CONFIG])
  },
})

export default filter
