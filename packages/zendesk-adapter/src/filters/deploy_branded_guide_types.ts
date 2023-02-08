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
  getChangeData, isInstanceChange, Change, InstanceElement,
} from '@salto-io/adapter-api'
import { deployChange, deployChanges } from '../deployment'
import { FilterCreator } from '../filter'
import { GUIDE_TYPES_TO_HANDLE_BY_BRAND } from '../config'

/**
 * Deploys Guide types which relate to a certain brand
 */
const filterCreator: FilterCreator = ({ config, client }) => ({
  name: 'deployBrandedGuideTypesFilter',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [guideBrandedTypesChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        GUIDE_TYPES_TO_HANDLE_BY_BRAND.includes(getChangeData(change).elemID.typeName)
        && isInstanceChange(change)
    )
    const deployResult = await deployChanges(
      guideBrandedTypesChanges,
      async change => {
        await deployChange(change, client, config.apiDefinitions, ['brand'])
      }
    )
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
