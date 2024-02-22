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
  DependencyChanger,
  isInstanceChange,
  getChangeData,
  ElemID,
  Change,
  InstanceElement,
  DependencyChange,
  ChangeId,
  isAdditionOrModificationChange,
  isObjectType,
  isField,
  ObjectType,
  Field,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections, values } from '@salto-io/lowerdash'
import {
  isInstanceOfCustomObjectSync,
  isCustomObjectSync,
} from './filters/utils'

const { awu } = collections.asynciterable
const { isDefined } = values
const log = logger(module)

const generateInstanceToTypeDep = (
  changeId: ChangeId,
  instance: InstanceElement,
  typeToChangeIdMap: Map<ElemID, ChangeId>,
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

const dataRecordToAssociatedType: DependencyChanger = async (changes) => {
  const getAffectedType = (changedElement: Field | ObjectType): ObjectType =>
    isObjectType(changedElement) ? changedElement : changedElement.parent
  const isCustomObjectChange = (
    change: Change,
  ): change is Change<Field> | Change<ObjectType> => {
    const changedElement = getChangeData(change)
    if (!isObjectType(changedElement) && !isField(changedElement)) {
      return false
    }
    return isCustomObjectSync(getAffectedType(changedElement))
  }

  // Note that we don't handle removal yet. We should probably create a reverse dependency to ensure we delete all
  // records before we delete their type.
  const customObjectInstanceChanges: [ChangeId, Change<InstanceElement>][] =
    Array.from(changes.entries())
      .filter(([, change]) => isInstanceChange(change))
      .filter(([, change]) => isAdditionOrModificationChange(change))
      .filter(([, change]) =>
        isInstanceOfCustomObjectSync(getChangeData(change)),
      ) as [ChangeId, Change<InstanceElement>][]
  const typeChanges = Array.from(changes.entries()).filter(([, change]) =>
    isCustomObjectChange(change),
  )
  // There might be multiple changes on the same type (e.g. multiple Field changes), in which case only one of them will
  // make it into typeElemIdToChangeIdMap, and consequently there will only be a dependency on that one change instead
  // of on all the changes of that type. This should be OK as long as all metadata changes are in the same group.
  const typeElemIdToChangeIdMap = new Map<ElemID, ChangeId>(
    typeChanges.map(([changeId, change]) => [
      getAffectedType(getChangeData(change) as Field | ObjectType).elemID,
      changeId,
    ]),
  )

  const deps = customObjectInstanceChanges
    .map((instanceChange) =>
      generateInstanceToTypeDep(
        instanceChange[0],
        getChangeData(instanceChange[1]),
        typeElemIdToChangeIdMap,
      ),
    )
    .filter(isDefined)
  log.info('Created deps: %o', deps)
  return deps
}

const DEPENDENCY_CHANGERS: DependencyChanger[] = [dataRecordToAssociatedType]

export const dependencyChanger: DependencyChanger = async (changes, deps) =>
  awu(DEPENDENCY_CHANGERS)
    .flatMap((changer) => changer(changes, deps))
    .toArray()
