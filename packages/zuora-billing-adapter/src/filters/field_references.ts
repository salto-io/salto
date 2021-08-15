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
import { Element } from '@salto-io/adapter-api'
import { references as referenceUtils } from '@salto-io/adapter-components'
import { WORKFLOW_TYPE, TASK_TYPE, SETTINGS_TYPE_PREFIX } from '../constants'
import { FilterCreator } from '../filter'

const fieldNameToTypeMappingDefs: referenceUtils.FieldReferenceDefinition<never>[] = [
  {
    src: { field: 'source_workflow_id', parentTypes: ['Linkage'] },
    serializationStrategy: 'id',
    target: { type: WORKFLOW_TYPE },
  },
  {
    src: { field: 'target_task_id', parentTypes: ['Linkage'] },
    serializationStrategy: 'id',
    target: { type: TASK_TYPE },
  },
  {
    src: { field: 'source_task_id', parentTypes: ['Linkage'] },
    serializationStrategy: 'id',
    target: { type: TASK_TYPE },
  },
  {
    src: { field: 'profileId', parentTypes: [`${SETTINGS_TYPE_PREFIX}Notification`] },
    serializationStrategy: 'id',
    target: { type: `${SETTINGS_TYPE_PREFIX}CommunicationProfile` },
  },
  {
    src: { field: 'revenueRecognitionRuleName', parentTypes: ['GETProductRatePlanChargeType'] },
    serializationStrategy: 'name',
    target: { type: `${SETTINGS_TYPE_PREFIX}RevenueRecognitionRule` },
  },
]

/**
 * Convert field values into references, based on predefined rules.
 *
 */
const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    await referenceUtils.addReferences(elements, fieldNameToTypeMappingDefs, ['id', 'name'])
  },
})

export default filter
