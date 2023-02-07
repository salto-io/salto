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
import { Change, getChangeData, InstanceElement, isInstanceChange } from '@salto-io/adapter-api'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { IDENTIFIER_FIELD } from '../data_elements/types'
import { FilterWith } from '../filter'
import { isDataObjectType } from '../types'

const { awu } = collections.asynciterable

const filterCreator = (): FilterWith<'preDeploy'> => ({
  name: 'dataInstancesIdentifiers',
  preDeploy: async changes => {
    await awu(changes)
      .filter(isInstanceChange)
      .filter(async change => isDataObjectType(
        await getChangeData<InstanceElement>(change).getType()
      ))
      .forEach(change =>
        applyFunctionToChangeData<Change<InstanceElement>>(
          change,
          element => {
            delete element.value[IDENTIFIER_FIELD]
            return element
          }
        ))
  },
})

export default filterCreator
