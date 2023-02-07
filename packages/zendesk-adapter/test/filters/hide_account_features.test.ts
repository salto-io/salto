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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, isInstanceElement, ObjectType } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { ZENDESK, ACCOUNT_FEATURES_TYPE_NAME } from '../../src/constants'
import hideAccountFeatureInstanceFilter from '../../src/filters/hide_account_features'
import { createFilterCreatorParams } from '../utils'


describe('hideAccountFeatureInstanceFilter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  const filter = hideAccountFeatureInstanceFilter(createFilterCreatorParams({}))as FilterType
  const featureType = new ObjectType({ elemID: new ElemID(ZENDESK, ACCOUNT_FEATURES_TYPE_NAME) })
  const featureInstance = new InstanceElement(
    ElemID.CONFIG_NAME,
    featureType,
    {
      macro_preview: {
        enabled: true,
      },
      side_conversations_email: {
        enabled: false,
      },
      side_conversations_slack: {
        enabled: false,
      },
      side_conversations_tickets: {
        enabled: false,
      },
    },
  )

  it('should add "_hidden" annotation to account_features instance', async () => {
    const elements = [featureInstance, featureInstance]
    await filter.onFetch(elements)
    const featureInstanceAfterFilter = elements
      .filter(isInstanceElement)
      .find(i => i.elemID.typeName === ACCOUNT_FEATURES_TYPE_NAME)
    expect(featureInstanceAfterFilter).toBeDefined()
    expect(featureInstanceAfterFilter?.annotations[CORE_ANNOTATIONS.HIDDEN]).toEqual(true)
  })
})
