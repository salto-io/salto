/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { getChangeData, InstanceElement, isInstanceChange, isModificationChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FilterWith } from '../filter'
import { isDataObjectType } from '../types'
import { CUSTOM_FIELD_PREFIX } from './data_types_custom_fields'

const { awu } = collections.asynciterable

const filterCreator = (): FilterWith<'onFetch' | 'preDeploy'> => ({
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onFetch: async () => {},
  preDeploy: async changes => {
    await awu(changes)
      .filter(isModificationChange)
      .filter(isInstanceChange)
      .filter(async change => isDataObjectType(
        await getChangeData<InstanceElement>(change).getType()
      ))
      .forEach(async change => {
        const nullFields = _(change.data.before.value)
          .keys()
          .filter(key => change.data.after.value[key] === undefined)
          .map(key => (key.startsWith(CUSTOM_FIELD_PREFIX)
            ? key.slice(CUSTOM_FIELD_PREFIX.length, key.length)
            : key))
          .value()
        change.data.after.value['platformCore:nullFieldList'] = { 'platformCore:name': nullFields }
      })
  },
})

export default filterCreator
