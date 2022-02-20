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
import { Change, ChangeDataType, getChangeData, InstanceElement,
  isAdditionOrModificationChange, isInstanceChange } from '@salto-io/adapter-api'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'

const { awu } = collections.asynciterable

export const applyforInstanceChangesOfType = async (
  changes: Change<ChangeDataType>[],
  typeNames: string[],
  func: (arg: InstanceElement) => Promise<InstanceElement> | InstanceElement,
): Promise<void> => {
  await awu(changes)
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(change => typeNames.includes(getChangeData(change).elemID.typeName))
    .forEach(change => applyFunctionToChangeData<Change<InstanceElement>>(
      change,
      func,
    ))
}
