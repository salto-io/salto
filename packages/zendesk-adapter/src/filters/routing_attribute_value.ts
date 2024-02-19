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
import { Change, getChangeData, InstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { deployChange, deployChangesSequentially } from '../deployment'
import { ROUTING_ATTRIBUTE_VALUE_TYPE_NAME } from '../constants'

/**
 * Deploys routing attribute value one by one as zendesk does not support parallel deploy
 */
const filterCreator: FilterCreator = ({ config, client }) => ({
  name: 'routingAttributeValueFilter',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === ROUTING_ATTRIBUTE_VALUE_TYPE_NAME,
    )
    const deployResult = await deployChangesSequentially(relevantChanges, async change => {
      await deployChange(change, client, config.apiDefinitions)
    })
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
