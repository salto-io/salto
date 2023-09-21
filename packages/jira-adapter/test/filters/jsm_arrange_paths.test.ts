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
import { filterUtils, elements as adapterElements } from '@salto-io/adapter-components'
import _ from 'lodash'
import { InstanceElement, ReferenceExpression, Element, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { getDefaultConfig } from '../../src/config/config'
import jsmArrangePathsFilter from '../../src/filters/jsm_arrange_paths'
import { createEmptyType, getFilterParams } from '../utils'
import { JIRA, PROJECT_TYPE, QUEUE_TYPE } from '../../src/constants'

describe('jsmArrangePathsFilter', () => {
    type FilterType = filterUtils.FilterWith<'deploy' | 'onFetch'>
    let filter: FilterType
    let elements: Element[]
    const projectType = createEmptyType(PROJECT_TYPE)
    let projectInstance: InstanceElement
    const queueType = createEmptyType(QUEUE_TYPE)
    let queueInstance: InstanceElement

    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      filter = jsmArrangePathsFilter(getFilterParams({ config })) as typeof filter
      projectInstance = new InstanceElement(
        'project1',
        projectType,
        {
          id: 11111,
          name: 'project1',
          projectTypeKey: 'service_desk',
        },
        [JIRA, adapterElements.RECORDS_PATH, PROJECT_TYPE, 'project1', 'project1']
      )
    })
    describe('on fetch', () => {
      beforeEach(async () => {
        queueInstance = new InstanceElement(
          'queue1',
          queueType,
          {
            id: 11111,
            name: 'All open',

          },
          [JIRA, adapterElements.RECORDS_PATH, QUEUE_TYPE, 'queue1'],
          {
            [CORE_ANNOTATIONS.PARENT]: [
              new ReferenceExpression(projectInstance.elemID, projectInstance),
            ],
          },
        )
        elements = [projectType, projectInstance, queueType, queueInstance]
      })
      it('should change path to be subdirectory of parent', async () => {
        await filter.onFetch(elements)
        expect(queueInstance.path).toEqual([JIRA, adapterElements.RECORDS_PATH, PROJECT_TYPE, 'project1', 'queues', 'queue1'])
      })
      it('should not change path to be subdirectory of parent if enableJSM is false', async () => {
        const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
        config.fetch.enableJSM = false
        filter = jsmArrangePathsFilter(getFilterParams({ config })) as typeof filter
        await filter.onFetch(elements)
        expect(queueInstance.path).toEqual([JIRA, adapterElements.RECORDS_PATH, QUEUE_TYPE, 'queue1'])
      })
    })
})
