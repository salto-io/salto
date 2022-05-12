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
import path from 'path'
import { InstanceElement } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { applyforInstanceChangesOfType } from './utils'
import { CUSTOM_FIELD_OPTIONS_FIELD_NAME, ORG_FIELD_TYPE_NAME } from './organization_field'
import { USER_FIELD_TYPE_NAME } from './custom_field_options/user_field'

const { makeArray } = collections.array

const RELEVANT_TYPE_NAMES = [ORG_FIELD_TYPE_NAME, USER_FIELD_TYPE_NAME]

const filterCreator: FilterCreator = () => ({
  name: path.parse(path.basename(__filename)).name,
  preDeploy: async changes => {
    await applyforInstanceChangesOfType(
      changes,
      RELEVANT_TYPE_NAMES,
      (instance: InstanceElement) => {
        makeArray(instance.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME])
          .forEach(option => {
            if (option.id === undefined) {
              option.id = null
            }
          })
        return instance
      }
    )
  },
  onDeploy: async changes => {
    await applyforInstanceChangesOfType(
      changes,
      RELEVANT_TYPE_NAMES,
      (instance: InstanceElement) => {
        makeArray(instance.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME])
          .forEach(option => {
            if (option.id === null) {
              delete option.id
            }
          })
        return instance
      }
    )
  },
})

export default filterCreator
