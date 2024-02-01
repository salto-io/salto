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
import {
  DependencyChanger, isInstanceChange, getChangeData, ElemID, Change, InstanceElement, DependencyChange, ChangeId,
  isAdditionOrModificationChange,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { isInstanceOfCustomObjectSync, isCustomObjectSync } from './filters/utils'

const { awu } = collections.asynciterable
const { isDefined } = values

const generateInstanceToTypeDep = (
  changeId: ChangeId,
  instance: InstanceElement,
  typeToChangeIdMap: Map<ElemID, ChangeId>
): DependencyChange | undefined => {
  const type = instance.getTypeSync()
  const typeChangeId = typeToChangeIdMap.get(type.elemID)
  if (typeChangeId === undefined) {
    return undefined
  }
  return {
    action: 'add',
    dependency: {
      source: changeId,
      target: typeChangeId,
    },
  }
}

const dataRecordToAssociatedType: DependencyChanger = async changes => {
  // Note that we don't handle removal yet. We should probably create a reverse dependency to ensure we delete all
  // records before we delete their type.
  const customObjectInstanceChanges: [ChangeId, Change<InstanceElement>][] = Array.from(changes.entries())
    .filter(([, change]) => isInstanceChange(change))
    .filter(([, change]) => isAdditionOrModificationChange((change)))
    .filter(([, change]) => (
      isInstanceOfCustomObjectSync(getChangeData(change))
    )) as [ChangeId, Change<InstanceElement>][]
  const typeChanges = Array.from(changes.entries())
    .filter(([, change]) => isCustomObjectSync(getChangeData(change)))
  const typeElemIdToChangeIdMap = new Map<ElemID, ChangeId>(typeChanges
    .map(([changeId, change]) => [getChangeData(change).elemID, changeId]))

  return customObjectInstanceChanges
    .map(instanceChange => generateInstanceToTypeDep(
      instanceChange[0],
      getChangeData(instanceChange[1]),
      typeElemIdToChangeIdMap
    ))
    .filter(isDefined)
}

const DEPENDENCY_CHANGERS: DependencyChanger[] = [
  dataRecordToAssociatedType,
]

export const dependencyChanger: DependencyChanger = async (changes, deps) => (
  awu(DEPENDENCY_CHANGERS)
    .flatMap(changer => changer(changes, deps))
    .toArray()
)
