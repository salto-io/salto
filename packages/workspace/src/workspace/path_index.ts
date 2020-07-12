/*
*                      Copyright 2020 Salto Labs Ltd.
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
import wu from 'wu'
import { collections } from '@salto-io/lowerdash'
import { ElemID, Element } from '@salto-io/adapter-api'
import { TransformFunc, transformElement, safeJsonStringify } from '@salto-io/adapter-utils'

type Path = readonly string[]
export class PathIndex extends collections.treeMap.PartialTreeMap<Path> {
  constructor(entries: Iterable<[string, Path[]]> = []) {
    super(entries, ElemID.NAMESPACE_SEPARATOR)
    this.compact()
  }

  private compact(): void {
    const compactEntry = (
      entry: collections.treeMap.TreeMapEntry<Path>
    ): collections.treeMap.TreeMapEntry<Path> => {
      const shouldDrop = (child: collections.treeMap.TreeMapEntry<Path>): boolean => (
        _.isEmpty(child.children) && _.isEqual(entry.value, child.value)
      )
      const newChildren = _(entry.children)
        .mapValues(compactEntry)
        .omitBy(shouldDrop)
        .value() as Record<string, collections.treeMap.TreeMapEntry<Path>>
      return { value: entry.value, children: newChildren }
    }
    this.data = compactEntry(this.data)
  }

  // Not - since compact is run the complexity of this set is O(N) where N is
  // the number of keys in the map. When  inserting multiple values - use set All.
  set(id: string, source: Path[]): this {
    super.set(id, source)
    this.compact()
    return this
  }

  setAll(entries: Iterable<[string, Path[]]>): void {
    wu(entries).forEach(entry => this.push(entry[0], ...entry[1]))
    this.compact()
  }

  get(id: string): Path[] | undefined {
    const path = id.split(this.seperator)
    const entry = collections.treeMap.TreeMap.getFromPath(this.data, path, false, true)
    return entry?.value
  }
}

const getElementPathHints = (element: Element): Iterable<[string, Path[]]> => {
  if (element.path === undefined) {
    return []
  }
  const pathHints = {
    [element.elemID.getFullName()]: [element.path],
  }
  _.keys(element.annotationTypes).forEach(key => {
    const id = element.elemID.createNestedID('annotation').createNestedID(key)
    if (element.path) {
      pathHints[id.getFullName()] = [element.path]
    }
  })
  const transformFunc: TransformFunc = ({ path, value }) => {
    if (path && element.path) {
      pathHints[path.getFullName()] = [element.path]
    }
    return _.isArrayLikeObject(value) ? undefined : value
  }
  transformElement({ element, transformFunc, strict: false })
  return wu(_.entries(pathHints))
}

export const createPathIndex = (unmergedElements: Element[]): PathIndex => {
  const pathHints = wu(unmergedElements.map(getElementPathHints)).flatten(true)
  const pathIndex = new PathIndex(pathHints)
  return pathIndex
}

export const deserializedPathIndex = (data: string): PathIndex => new PathIndex(JSON.parse(data))
export const serializedPathIndex = (index: PathIndex): string => (
  safeJsonStringify(Array.from(index.entries()))
)
