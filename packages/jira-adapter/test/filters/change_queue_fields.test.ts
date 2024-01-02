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

import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { InstanceElement } from '@salto-io/adapter-api'
import { getDefaultConfig } from '../../src/config/config'
import changeQueueFieldsFilter from '../../src/filters/change_queue_fields'
import { createEmptyType, getFilterParams } from '../utils'
import { QUEUE_TYPE } from '../../src/constants'


describe('changeQueueFields filter', () => {
    type FilterType = filterUtils.FilterWith<'onFetch'>
    let filter: FilterType
    const queueType = createEmptyType(QUEUE_TYPE)
    let queueInstance: InstanceElement
    describe('on Fetch', () => {
      beforeEach(() => {
        const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
        config.fetch.enableJSM = true
        filter = changeQueueFieldsFilter(getFilterParams({ config })) as typeof filter
        queueInstance = new InstanceElement(
          'queue1',
          queueType,
          {
            id: 11,
            name: 'queue1',
            fields: ['Summary'],
          },
        )
      })
      it('should delete fields field and add columns field', async () => {
        await filter.onFetch([queueInstance])
        expect(queueInstance.value.fields).toBeUndefined()
        expect(queueInstance.value.columns).toEqual(['Summary'])
      })
      it('should not delete fields field and add columns field if enableJSM is false', async () => {
        const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
        config.fetch.enableJSM = false
        filter = changeQueueFieldsFilter(getFilterParams({ config })) as typeof filter
        await filter.onFetch([queueInstance])
        expect(queueInstance.value.fields).toBeDefined()
        expect(queueInstance.value.columns).toBeUndefined()
      })
    })
})
