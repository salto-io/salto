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

import { filterUtils, elements as adapterElements, client as clientUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { InstanceElement, Element, isInstanceElement } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { getDefaultConfig } from '../../../src/config/config'
import formsFilter from '../../../src/filters/forms/forms'
import { createEmptyType, getFilterParams, mockClient } from '../../utils'
import { FORM_TYPE, JIRA, PROJECT_TYPE } from '../../../src/constants'
import JiraClient from '../../../src/client/client'
import { CLOUD_RESOURCE_FIELD } from '../../../src/filters/automation/cloud_id'


describe('forms filter', () => {
    type FilterType = filterUtils.FilterWith<'onFetch'>
    let filter: FilterType
    let connection: MockInterface<clientUtils.APIConnection>
    let client: JiraClient
    const projectType = createEmptyType(PROJECT_TYPE)
    let projectInstance: InstanceElement
    let elements: Element[]
    describe('on fetch', () => {
      beforeEach(async () => {
        const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
        config.fetch.enableJSM = true
        const { client: cli, connection: conn } = mockClient(true)
        connection = conn
        client = cli
        filter = formsFilter(getFilterParams({ config, client })) as typeof filter
        projectInstance = new InstanceElement(
          'project1',
          projectType,
          {
            id: 11111,
            name: 'project1',
            projectTypeKey: 'service_desk',
            key: 'project1Key',
          },
          [JIRA, adapterElements.RECORDS_PATH, PROJECT_TYPE, 'project1']
        )
        connection.post.mockResolvedValueOnce({
          status: 200,
          data: {
            unparsedData: {
              [CLOUD_RESOURCE_FIELD]: safeJsonStringify({
                tenantId: 'cloudId',
              }),
            },
          },
        })

        connection.get.mockResolvedValueOnce({
          status: 200,
          data: [{
            id: 1,
            name: 'form1',
          }],
        })

        connection.get.mockResolvedValueOnce({
          status: 200,
          data: {
            updated: '2023-09-28T08:20:31.552322Z',
            uuid: 'uuid',
            design: {
              settings: {
                templateId: 6,
                name: 'form6',
                submit: {
                  lock: false,
                  pdf: false,
                },
              },
              layout: [
                {
                  version: 1,
                  type: 'doc',
                  content: [
                    {
                      type: 'paragraph',
                      content: [
                        {
                          type: 'text',
                          text: 'form 6 content',
                        },
                      ],
                    },
                  ],
                },
              ],
              conditions: {},
              sections: {},
              questions: {},
            },
          },
        })
        elements = [projectInstance, projectType]
      })
      it('should add forms to elements when enableJSM is true', async () => {
        await filter.onFetch(elements)
        const instances = elements.filter(isInstanceElement)
        const formInstance = instances.find(e => e.elemID.typeName === FORM_TYPE)
        expect(formInstance).toBeDefined()
        expect(formInstance?.value).toEqual({
          id: 1,
          uuid: 'uuid',
          updated: '2023-09-28T08:20:31.552322Z',
          design: {
            settings: {
              templateId: 6,
              name: 'form6',
              submit: {
                lock: false,
                pdf: false,
              },
            },
            layout: [
              {
                version: 1,
                type: 'doc',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        type: 'text',
                        text: 'form 6 content',
                      },
                    ],
                  },
                ],
              },
            ],
            conditions: [],
            sections: [],
            questions: [],
          },
        })
      })
      it('should not add forms to elements when enableJSM is false', async () => {
        const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
        config.fetch.enableJSM = false
        filter = formsFilter(getFilterParams({ config, client })) as typeof filter
        await filter.onFetch(elements)
        const instances = elements.filter(isInstanceElement)
        const formInstance = instances.find(e => e.elemID.typeName === FORM_TYPE)
        expect(formInstance).toBeUndefined()
      })
    })
})
