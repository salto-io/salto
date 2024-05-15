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
  ChangeValidator,
  ElemID,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { SPACE_TYPE_NAME } from '../constants'

const log = logger(module)
const { awu } = collections.asynciterable

export const uniqueSpaceKeyValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.warn('elementSource is undefined, skipping uniqueSpaceKeyValidator')
    return []
  }
  const spaceChangeInstances = changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === SPACE_TYPE_NAME)

  const spaceKeyToElemId = await awu(await elementSource.getAll())
    .filter(isInstanceElement)
    .filter(inst => inst.elemID.typeName === SPACE_TYPE_NAME)
    .reduce<Record<string, ElemID[]>>((record, inst) => {
      const { key } = inst.value
      if (record[key]) {
        record[key].push(inst.elemID)
      } else {
        record[key] = [inst.elemID]
      }
      return record
    }, {})
  return spaceChangeInstances.flatMap(spaceFromChange => {
    const spaceWithTheSameKey = spaceKeyToElemId[spaceFromChange.value.key]?.find(
      elemId => !elemId.isEqual(spaceFromChange.elemID),
    )
    if (spaceWithTheSameKey === undefined) {
      return []
    }
    return [
      {
        elemID: spaceFromChange.elemID,
        severity: 'Error',
        message: 'Space key must be unique',
        detailedMessage: `key: ${spaceFromChange.value.key} is already in use in space: ${spaceWithTheSameKey.getFullName()}`,
      },
    ]
  })
}
