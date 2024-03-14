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
import _ from 'lodash'
import { isInstanceChange, getChangeData, isRemovalChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { PROFILE_MAPPING_TYPE_NAME } from '../constants'

const log = logger(module)

const filterCreator: FilterCreator = ({ client, config }) => ({
  // If a ProfileMapping is removed, mark the result as success without actually using the endpoint.
  name: 'profileMappingRemovalFilter',
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        isInstanceChange(change) &&
        isRemovalChange(change) &&
        getChangeData(change).elemID.typeName === PROFILE_MAPPING_TYPE_NAME,
    )
    return {
      leftoverChanges,
      // Mark the removal as success
      deployResult: { errors: [], appliedChanges: relevantChanges },
    }
  },
})

export default filterCreator
