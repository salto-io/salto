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
import { collections, serialize as lowerdashSerialize, values } from '@salto-io/lowerdash'
import {
  Element,
  ElemID,
  InstanceElement,
  isInstanceElement,
  isObjectType,
  ObjectType,
  Value,
} from '@salto-io/adapter-api'
import { FILTER_FUNC_NEXT_STEP, filterByID } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { RemoteMap, RemoteMapEntry } from './remote_map'

const { awu } = collections.asynciterable
const { getSerializedStream } = lowerdashSerialize
const { makeArray } = collections.array

const log = logger(module)

export type Path = readonly string[]

type Fragment<T> = { value: T; path: Path }
type PathHint = { key: string; value: Path[] }
export type PathIndex = RemoteMap<Path[]>

const getValuePathHints = (fragments: Fragment<Value>[], elemID: ElemID): PathHint[] => {
  // We only have 3 cases to handle: Object type (which can be split among files)
  // or a single list/primitive value.
  if (fragments.length === 0) {
    // No fragments with this ID, so no path hints needed
    return []
  }
  const valueTopLevelKey = [
    {
      key: elemID.getFullName(),
      value: makeArray(fragments.map(f => f.path)),
    },
  ]
  if (fragments.length === 1) {
    return valueTopLevelKey
  }
  if (_.every(fragments, f => _.isPlainObject(f.value))) {
    const allKeys = _.uniq(fragments.flatMap(f => Object.keys(f.value)))
    return valueTopLevelKey.concat(
      allKeys.flatMap(key =>
        getValuePathHints(
          fragments.filter(f => values.isDefined(f.value[key])).map(f => ({ value: f.value[key], path: f.path })),
          elemID.createNestedID(key),
        ),
      ),
    )
  }
  // This will only be called if we have problematic input - different value types, or a list which
  // is split between different fragments. In each case, a path hint makes no sense.
  log.warn('getValuePathHints called with invalid input, values: %o', fragments)
  return []
}

const getAnnotationTypesPathHints = (fragments: Fragment<Element>[]): PathHint[] =>
  getValuePathHints(
    fragments
      .filter(fragment => !_.isEmpty(fragment.value.annotationRefTypes))
      .map(fragment => ({ value: fragment.value.annotationRefTypes, path: fragment.path })),
    fragments[0].value.elemID.createNestedID('annotation'),
  )

const getAnnotationPathHints = (fragments: Fragment<Element>[]): PathHint[] =>
  getValuePathHints(
    fragments.filter(f => !_.isEmpty(f.value.annotations)).map(f => ({ value: f.value.annotations, path: f.path })),
    fragments[0].value.elemID.createNestedID('attr'),
  )

const getFieldsPathHints = (fragments: Fragment<ObjectType>[]): PathHint[] =>
  getValuePathHints(
    fragments
      .filter(f => !_.isEmpty(f.value.fields))
      .map(f => ({ value: _.mapValues(f.value.fields, field => field.annotations), path: f.path })),
    fragments[0].value.elemID.createNestedID('field'),
  )

const isObjectTypeFragments = (fragments: Fragment<Element>[]): fragments is Fragment<ObjectType>[] =>
  fragments.every(fragment => isObjectType(fragment.value))

const getTypePathHints = (elementFragments: Fragment<Element>[]): PathHint[] => {
  const annoTypesHints = getAnnotationTypesPathHints(elementFragments)
  const annotationHints = getAnnotationPathHints(elementFragments)
  const fieldHints = isObjectTypeFragments(elementFragments) ? getFieldsPathHints(elementFragments) : []
  return [
    ...annoTypesHints,
    ...annotationHints,
    ...fieldHints,
    {
      key: elementFragments[0].value.elemID.getFullName(),
      value: elementFragments.map(f => f.path),
    },
  ]
}

const isInstanceElementFragments = (fragments: Fragment<Element>[]): fragments is Fragment<InstanceElement>[] =>
  fragments.every(fragment => isInstanceElement(fragment.value))

const getInstancePathHints = (elementFragments: Fragment<InstanceElement>[]): PathHint[] =>
  // In instances the elemIds of values and attributes are not separated
  getValuePathHints(
    elementFragments.map(f => ({ value: _.merge({}, f.value.value, f.value.annotations), path: f.path })),
    elementFragments[0].value.elemID,
  )

const getElementPathHints = (elementFragments: Fragment<Element>[]): PathHint[] => {
  if (elementFragments.length === 0) {
    return []
  }
  if (elementFragments.length === 1) {
    return [
      {
        key: elementFragments[0].value.elemID.getFullName(),
        value: [elementFragments[0].path],
      },
    ]
  }
  if (isInstanceElementFragments(elementFragments)) {
    return getInstancePathHints(elementFragments)
  }
  return getTypePathHints(elementFragments)
}

export const getElementsPathHints = (unmergedElements: Element[]): RemoteMapEntry<Path[]>[] => {
  const elementsByID = _.groupBy(unmergedElements, e => e.elemID.getFullName())
  return Object.values(elementsByID)
    .flatMap(elementFragments =>
      getElementPathHints(
        elementFragments
          .filter(element => values.isDefined(element.path))
          .map(element => ({ value: element, path: element.path as Path })),
      ),
    )
    .map(entry => ({ key: entry.key, value: _.uniqWith(entry.value, _.isEqual) }))
}

export const getTopLevelPathHints = (unmergedElements: Element[]): PathHint[] => {
  const topLevelElementsWithPath = unmergedElements.filter(e => e.path !== undefined)
  const elementsByID = _.groupBy(topLevelElementsWithPath, e => e.elemID.getFullName())
  return Object.entries(elementsByID).map(([key, value]) => ({
    key,
    value: _.uniqWith(
      value.map(e => e.path as Path),
      _.isEqual,
    ),
  }))
}

export type PathIndexArgs = {
  pathIndex: PathIndex
  unmergedElements: Element[]
  removedElementsFullNames?: Set<string>
}

/**
 *  Because currently a change in an element's path doesn't create a change, we are unable to detect it
 *  We have to override the path index with all the elements, and delete the elements that were removed
 * */
const updateIndex = async ({
  pathIndex,
  unmergedElements,
  removedElementsFullNames = new Set<string>(),
  getHintsFunction,
}: PathIndexArgs & { getHintsFunction: (unmergedElements: Element[]) => RemoteMapEntry<Path[]>[] }): Promise<void> => {
  const entriesToSet = getHintsFunction(unmergedElements)

  // Entries that are related to an element that was removed should be deleted
  const entriesToDelete = await awu(pathIndex.keys())
    .filter(key => {
      if (removedElementsFullNames.has(key)) {
        return true
      }
      const keyElemId = ElemID.fromFullName(key)
      // If any of the levels above the key was removed, delete the key
      return keyElemId
        .createAllElemIdParents()
        .map(id => id.getFullName())
        .some(fullName => removedElementsFullNames.has(fullName))
    })
    .toArray()

  await pathIndex.deleteAll(entriesToDelete)
  await pathIndex.setAll(entriesToSet)
}

export const updatePathIndex = async (args: PathIndexArgs): Promise<void> =>
  log.time(async () => {
    await updateIndex({ ...args, getHintsFunction: getElementsPathHints })
  }, 'updatePathIndex')

export const updateTopLevelPathIndex = async (args: PathIndexArgs): Promise<void> =>
  log.time(async () => {
    await updateIndex({ ...args, getHintsFunction: getTopLevelPathHints })
  }, 'updateTopLevelPathIndex')

export const loadPathIndex = (parsedEntries: [string, Path[]][]): RemoteMapEntry<Path[], string>[] =>
  parsedEntries.flatMap(e => ({ key: e[0], value: e[1] }))

export const serializedPathIndex = (entries: RemoteMapEntry<Path[], string>[]): AsyncIterable<string> =>
  getSerializedStream(Array.from(entries.map(e => [e.key, e.value] as [string, Path[]])))
export const serializePathIndexByAccount = (
  entries: RemoteMapEntry<Path[], string>[],
): Record<string, AsyncIterable<string>> =>
  _.mapValues(
    _.groupBy(Array.from(entries), entry => ElemID.fromFullName(entry.key).adapter),
    e => serializedPathIndex(e),
  )
export const getFromPathIndex = async (elemID: ElemID, index: PathIndex): Promise<Path[]> => {
  const idParts = elemID.getFullNameParts()
  const topLevelKey = elemID.createTopLevelParentID().parent.getFullName()
  let isExactMatch = true
  let key: string
  do {
    key = idParts.join('.')
    // eslint-disable-next-line no-await-in-loop
    const pathHints = await index.get(key)
    if (pathHints !== undefined && pathHints.length > 0) {
      // We want to return only unique path hints for every key
      // because otherwise, multiple fragments will appear in the same file
      // and it will cause merge errors.
      const uniquePathHints = _.uniqWith(pathHints, _.isEqual)
      // If we found this elemID in the pathIndex we want to return all the hints.
      // If this is not an exact match we want to return a single hint
      // because otherwise, splitElementByPath will make it appear in multiple fragments
      // and cause merge errors.
      return isExactMatch ? uniquePathHints : [uniquePathHints[0]]
    }
    idParts.pop()
    isExactMatch = false
  } while (idParts.length > 0 && key !== topLevelKey)
  return []
}

export const filterByPathHint = async (index: PathIndex, hint: Path, id: ElemID): Promise<FILTER_FUNC_NEXT_STEP> => {
  const idHints = await getFromPathIndex(id, index)
  const isHintMatch = idHints.some(idHint => _.isEqual(idHint, hint))
  if (!isHintMatch) {
    // This case will be removed, when we fix the .annotation and .field keys in the path index
    if (
      idHints.length === 0 &&
      ((id.isIDNestedInType() && id.nestingLevel === 0) || (id.isAnnotationTypeID() && id.nestingLevel === 1))
    ) {
      return FILTER_FUNC_NEXT_STEP.RECURSE
    }
    return FILTER_FUNC_NEXT_STEP.EXCLUDE
  }
  if (idHints.length === 1) {
    return FILTER_FUNC_NEXT_STEP.INCLUDE
  }
  return FILTER_FUNC_NEXT_STEP.RECURSE
}

export const splitElementByPath = async (element: Element, index: PathIndex): Promise<Element[]> => {
  const pathHints = await getFromPathIndex(element.elemID, index)
  if (pathHints.length <= 1) {
    const clonedElement = element.clone()
    const [pathToSet] = pathHints
    clonedElement.path = pathToSet
    return [clonedElement]
  }
  return (
    await Promise.all(
      pathHints.map(async hint => {
        const filteredElement = await filterByID(element.elemID, element, id => filterByPathHint(index, hint, id))

        if (filteredElement) {
          filteredElement.path = hint
          return filteredElement
        }
        return undefined
      }),
    )
  ).filter(values.isDefined)
}
