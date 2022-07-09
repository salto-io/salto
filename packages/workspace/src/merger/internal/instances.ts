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
import { inspect } from 'util'
import { InstanceElement, ElemID, getTopLevelPath } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import {
  MergeResult, MergeError, mergeNoDuplicates, DuplicateAnnotationError,
} from './common'

export class DuplicateInstanceKeyError extends MergeError {
  readonly key: string
  readonly existingValue: unknown
  readonly newValue: unknown

  constructor({ elemID, key, existingValue, newValue }:
    { elemID: ElemID; key: string; existingValue: unknown; newValue: unknown}) {
    super({
      elemID,
      error: `duplicate key ${key} (values - ${inspect(existingValue)} & ${inspect(newValue)})`,
    })
    this.key = key
    this.existingValue = existingValue
    this.newValue = newValue
  }
}

const mergeInstanceDefinitions = (
  { elemID, refType }: InstanceElement,
  instanceDefs: InstanceElement[]
): MergeResult<InstanceElement> => {
  const valueMergeResult = instanceDefs.length > 1 ? mergeNoDuplicates({
    sources: instanceDefs.map(i => ({ source: i.value, pathIndex: i.pathIndex })),
    errorCreator: (key, existingValue, newValue) =>
      new DuplicateInstanceKeyError({ elemID, key, existingValue, newValue }),
    baseId: elemID,
  }) : {
    merged: instanceDefs[0].value,
    errors: [],
    pathIndex: instanceDefs[0].pathIndex,
  }

  const annotationsMergeResults = mergeNoDuplicates({
    sources: instanceDefs.map(o => ({ source: o.annotations, pathIndex: o.pathIndex })),
    errorCreator: (key, existingValue, newValue) =>
      new DuplicateAnnotationError({ elemID, key, existingValue, newValue }),
    baseId: elemID,
  })

  const instanceWithPath = instanceDefs.find(inst => !_.isEmpty(getTopLevelPath(inst)))
  const instPathIndex = new collections.treeMap.TreeMap<string>([
    ...((instanceWithPath
      ? [[elemID.getFullName(), getTopLevelPath(instanceWithPath)]]
      : []) as [string, string[]][]),
    ...(valueMergeResult.pathIndex?.entries() ?? []),
    ...(annotationsMergeResults.pathIndex?.entries() ?? []),
  ])

  return {
    merged: new InstanceElement(
      elemID.name, refType, valueMergeResult.merged, instPathIndex, annotationsMergeResults.merged,
    ),
    errors: [...valueMergeResult.errors, ...annotationsMergeResults.errors],
    pathIndex: instPathIndex,
  }
}

export const mergeInstances = (
  instances: InstanceElement[]
): MergeResult<InstanceElement> => (
  mergeInstanceDefinitions(instances[0], instances)
)
