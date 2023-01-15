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
import { collections, values, serialize as lowerdashSerialize } from '@salto-io/lowerdash'
import { ElemID, Element, Value, Field, isObjectType, isInstanceElement,
  ObjectType, InstanceElement } from '@salto-io/adapter-api'
import { filterByID } from '@salto-io/adapter-utils'
import { RemoteMapEntry, RemoteMap } from './remote_map'

const { awu } = collections.asynciterable
const { getSerializedStream } = lowerdashSerialize

export type Path = readonly string[]

type Fragment<T> = {value: T; path: Path}
type PathHint = {key: string; value: Path[]}
export type PathIndex = RemoteMap<Path[]>

const getValuePathHints = (fragments: Fragment<Value>[], elemID: ElemID): PathHint[] => {
  // We only have 3 cases to handle: Object type (which can be split among files)
  // or a single list/primitive value.
  if (fragments.length === 1) {
    return [{
      key: elemID.getFullName(),
      value: [fragments[0].path],
    }]
  }
  if (_.every(fragments, f => _.isPlainObject(f.value))) {
    const allKeys = _.uniq(fragments.flatMap(f => Object.keys(f.value)))
    return allKeys.flatMap(key => getValuePathHints(
      fragments
        .filter(f => values.isDefined(f.value[key]))
        .map(f => ({ value: f.value[key], path: f.path })),
      elemID.createNestedID(key)
    ))
  }
  // This will only be called if we have problematic input - different value types, or a list which
  // is split between different fragments. In each case, a path hint makes no sense.
  return []
}

const getAnnotationTypesPathHints = (
  fragments: Fragment<Element>[],
): PathHint[] => {
  const fragmentsWithNonEmptyAnnoTypes = fragments.filter(
    f => !_.isEmpty(f.value.annotationRefTypes)
  )

  if (fragmentsWithNonEmptyAnnoTypes.length === 1) {
    return [{
      key: fragmentsWithNonEmptyAnnoTypes[0].value.elemID
        .createNestedID('annotation').getFullName(),
      value: [fragmentsWithNonEmptyAnnoTypes[0].path],
    }]
  }
  return fragmentsWithNonEmptyAnnoTypes
    .flatMap(f => Object.keys(f.value.annotationRefTypes).map(annoKey => ({
      key: f.value.elemID.createNestedID('annotation', annoKey).getFullName(),
      value: [f.path],
    })))
}

const getAnnotationPathHints = (
  fragments: Fragment<Element>[],
): PathHint[] => {
  const elem = fragments[0].value
  return getValuePathHints(
    fragments.map(f => ({ value: f.value.annotations, path: f.path })),
    isInstanceElement(elem) ? elem.elemID : elem.elemID.createNestedID('attr'),
  )
}

const getFieldPathHints = (
  fragments: Fragment<Field>[],
): PathHint[] => {
  if (fragments.length === 0) {
    return []
  }
  if (fragments.length === 1) {
    return [{
      key: fragments[0].value.elemID.getFullName(),
      value: [fragments[0].path],
    }]
  }
  return [...getValuePathHints(
    fragments.map(f => ({ value: f.value.annotations, path: f.path })),
    fragments[0].value.elemID
  ),
  {
    key: fragments[0].value.elemID.getFullName(),
    value: fragments.map(f => f.path),
  },
  ]
}

const getFieldsPathHints = (
  fragments: Fragment<ObjectType>[],
): PathHint[] => {
  const fragmentsWithFields = fragments.filter(f => !_.isEmpty(f.value.fields))
  if (fragmentsWithFields.length === 1) {
    return [{
      key: fragmentsWithFields[0].value.elemID.createNestedID('field').getFullName(),
      value: [fragmentsWithFields[0].path],
    }]
  }
  const fieldNames = _.uniq(fragmentsWithFields.flatMap(f => Object.keys(f.value.fields)))
  return fieldNames.flatMap(fieldName => getFieldPathHints(
    fragments.filter(f => values.isDefined(f.value.fields[fieldName]))
      .map(f => ({ value: f.value.fields[fieldName], path: f.path })),
  ))
}

const getElementPathHints = (
  elementFragments: Fragment<Element>[]
): PathHint[] => {
  if (elementFragments.length === 0) {
    return []
  }
  if (elementFragments.length === 1) {
    return [{
      key: elementFragments[0].value.elemID.getFullName(),
      value: [elementFragments[0].path],
    }]
  }
  const annoTypesHints = getAnnotationTypesPathHints(elementFragments)
  const annotationHints = getAnnotationPathHints(elementFragments)
  const fieldHints = elementFragments.every(f => isObjectType(f.value))
    ? getFieldsPathHints(elementFragments as Fragment<ObjectType>[])
    : []
  const valueHints = elementFragments.every(f => isInstanceElement(f.value))
    ? getValuePathHints(
      (elementFragments as Fragment<InstanceElement>[])
        .map(f => ({ value: f.value.value, path: f.path })),
      elementFragments[0].value.elemID
    ) : []
  return [
    ...annoTypesHints,
    ...annotationHints,
    ...fieldHints,
    ...valueHints,
    {
      key: elementFragments[0].value.elemID.getFullName(),
      value: elementFragments.map(f => f.path),
    },
  ]
}

export const getElementsPathHints = (unmergedElements: Element[]):
RemoteMapEntry<Path[]>[] => {
  const elementsByID = _.groupBy(unmergedElements, e => e.elemID.getFullName())
  return Object.values(elementsByID)
    .flatMap(elementFragments => getElementPathHints(
      elementFragments
        .filter(element => values.isDefined(element.path))
        .map(element => ({ value: element, path: element.path as Path }))
    ))
}

export const overridePathIndex = async (
  current: PathIndex,
  unmergedElements: Element[],
): Promise<void> => {
  const entries = getElementsPathHints(unmergedElements)
  await current.clear()
  await current.setAll(entries)
}

export const updatePathIndex = async (
  current: PathIndex,
  unmergedElements: Element[],
  accountsToMaintain: string[]
): Promise<void> => {
  if (accountsToMaintain.length === 0) {
    await overridePathIndex(current, unmergedElements)
    return
  }
  const entries = getElementsPathHints(unmergedElements)
  const oldPathHintsToMaintain = await awu(current.entries())
    .filter(e => accountsToMaintain.includes(ElemID.fromFullName(e.key).adapter))
    .concat(entries)
    .toArray()
  await current.clear()
  await current.setAll(awu(oldPathHintsToMaintain))
}

export const loadPathIndex = (parsedEntries: [string, Path[]][]): RemoteMapEntry<Path[], string>[] =>
  parsedEntries.flatMap(e => ({ key: e[0], value: e[1] }))

export const serializedPathIndex = (entries: RemoteMapEntry<Path[], string>[]): AsyncIterable<string> => (
  getSerializedStream(Array.from(entries.map(e => [e.key, e.value] as [string, Path[]])))
)
export const serializePathIndexByAccount = (entries: RemoteMapEntry<Path[], string>[]):
Record<string, AsyncIterable<string>> =>
  _.mapValues(
    _.groupBy(Array.from(entries), entry => ElemID.fromFullName(entry.key).adapter),
    e => serializedPathIndex(e),
  )
export const getFromPathIndex = async (
  elemID: ElemID,
  index: PathIndex
): Promise<Path[]> => {
  const idParts = elemID.getFullNameParts()
  const topLevelKey = elemID.createTopLevelParentID().parent.getFullName()
  let key: string
  do {
    key = idParts.join('.')
    // eslint-disable-next-line no-await-in-loop
    const pathHints = await index.get(key)
    if (pathHints !== undefined) {
      return pathHints
    }
    idParts.pop()
  } while (idParts.length > 0 && key !== topLevelKey)
  return []
}

export const splitElementByPath = async (
  element: Element,
  index: PathIndex
): Promise<Element[]> => {
  const pathHints = await getFromPathIndex(element.elemID, index)
  if (pathHints.length <= 1) {
    const clonedElement = element.clone()
    const [pathToSet] = pathHints
    clonedElement.path = pathToSet
    return [clonedElement]
  }
  return (await Promise.all(pathHints.map(async hint => {
    const filterByPathHint = async (id: ElemID): Promise<boolean> => {
      const idHints = await getFromPathIndex(id, index)
      return idHints.some(idHint => _.isEqual(idHint, hint))
    }
    const filteredElement = await filterByID(
      element.elemID,
      element,
      filterByPathHint
    )

    if (filteredElement) {
      filteredElement.path = hint
      return filteredElement
    }
    return undefined
  }))).filter(values.isDefined)
}
