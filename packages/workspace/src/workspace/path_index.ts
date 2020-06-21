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
import { treeMap } from '@salto-io/lowerdash/dist/src/collections'
import { ElemID, Element } from '@salto-io/adapter-api'
import { TransformFunc, transformElement } from '@salto-io/adapter-utils'
import _ from 'lodash'
import wu from 'wu'

type Path = readonly string[]
export class PathIndex extends treeMap.PartialTreeMap<Path> {
  constructor(entries: Iterable<[string, Path[]]> = []) {
    super(entries, ElemID.NAMESPACE_SEPARATOR)
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
    return value
  }
  transformElement({ element, transformFunc })
  return wu(_.entries(pathHints))
}

export const createPathIndex = (unmergedElements: Element[]): PathIndex => {
  const pathHints = wu(unmergedElements.map(getElementPathHints)).flatten(true)
  const pathIndex = new PathIndex(pathHints)
  pathIndex.compact()
  return pathIndex
}
