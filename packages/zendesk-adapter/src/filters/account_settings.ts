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
import _ from 'lodash'
import {
  Change, getChangeData, InstanceElement,
} from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'

export const ACCOUNT_SETTING_TYPE_NAME = 'account_setting'

/**
 * Deploys account settings
 */
const filterCreator: FilterCreator = ({ config, client }) => ({
  name: 'accountSettingsFilter',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [accountSettingChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === ACCOUNT_SETTING_TYPE_NAME,
    )
    if (accountSettingChanges.length > 1) {
      return {
        deployResult: {
          appliedChanges: [],
          errors: [
            new Error(`${ACCOUNT_SETTING_TYPE_NAME} element is a singleton and should have only on instance. Found multiple: ${accountSettingChanges.length}`),
          ],
        },
        leftoverChanges,
      }
    }
    const deployResult = await deployChanges(
      accountSettingChanges,
      async change => {
        const fieldsToIgnore = getChangeData(change).value.routing?.autorouting_tag === ''
          ? ['routing.autorouting_tag']
          : []
        await deployChange(change, client, config.apiDefinitions, fieldsToIgnore)
      }
    )
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
