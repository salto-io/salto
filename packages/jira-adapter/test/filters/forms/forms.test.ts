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

import { filterUtils, elements as adapterElements, client as clientUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import {
  InstanceElement,
  Element,
  isInstanceElement,
  CORE_ANNOTATIONS,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { FilterResult } from '../../../src/filter'
import { getDefaultConfig } from '../../../src/config/config'
import formsFilter from '../../../src/filters/forms/forms'
import { createEmptyType, getFilterParams, mockClient } from '../../utils'
import { FORM_TYPE, JIRA, PROJECT_TYPE } from '../../../src/constants'
import JiraClient from '../../../src/client/client'
import { CLOUD_RESOURCE_FIELD } from '../../../src/filters/automation/cloud_id'

describe('forms filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch' | 'deploy' | 'onDeploy' | 'preDeploy', FilterResult>
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
      const { client: cli, connection: conn } = mockClient(false)
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
        [JIRA, adapterElements.RECORDS_PATH, PROJECT_TYPE, 'project1'],
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
        data: [
          {
            id: 1,
            name: 'form1',
          },
        ],
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
              templateFormUuid: 'templateFormUuid',
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
            sections: {
              36: {
                t: 'sh',
                i: {
                  co: {
                    cIds: {
                      3: ['2'],
                    },
                  },
                },
                o: {
                  sIds: ['4'],
                },
              },
            },
            questions: {
              3: {
                type: 'cm',
                label: 'Items to be verified',
                description: '',
                choices: [
                  {
                    id: '1',
                    label: 'Education',
                    other: false,
                  },
                  {
                    id: '2',
                    label: 'Licenses',
                    other: false,
                  },
                ],
                questionKey: '',
              },
            },
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
            templateFormUuid: 'templateFormUuid',
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
          sections: {
            '36@': {
              t: 'sh',
              i: {
                co: {
                  cIds: {
                    '3@': ['2'],
                  },
                },
              },
              o: {
                sIds: ['4'],
              },
            },
          },
          questions: {
            '3@': {
              type: 'cm',
              label: 'Items to be verified',
              description: '',
              choices: [
                {
                  id: '1',
                  label: 'Education',
                  other: false,
                },
                {
                  id: '2',
                  label: 'Licenses',
                  other: false,
                },
              ],
              questionKey: '',
            },
          },
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
  describe('on fetch errors', () => {
    beforeEach(async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      const { client: cli, connection: conn } = mockClient(false)
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
        [JIRA, adapterElements.RECORDS_PATH, PROJECT_TYPE, 'project1'],
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
        data: [
          {
            id: 1,
            name: '',
          },
        ],
      })

      connection.get.mockResolvedValueOnce({
        status: 200,
        data: {
          updated: '2023-09-28T08:20:31.552322Z',
          uuid: 'uuid',
          design: {
            settings: {
              templateId: 6,
              name: '',
              submit: {
                lock: false,
                pdf: false,
              },
              templateFormUuid: 'templateFormUuid',
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
            sections: {
              36: {
                t: 'sh',
                i: {
                  co: {
                    cIds: {
                      3: ['2'],
                    },
                  },
                },
                o: {
                  sIds: ['4'],
                },
              },
            },
            questions: {
              3: {
                type: 'cm',
                label: 'Items to be verified',
                description: '',
                choices: [
                  {
                    id: '1',
                    label: 'Education',
                    other: false,
                  },
                  {
                    id: '2',
                    label: 'Licenses',
                    other: false,
                  },
                ],
                questionKey: '',
              },
            },
          },
        },
      })
      elements = [projectInstance, projectType]
    })
    it("should return saltoError when failed to fetch form becuase it doesn't have name", async () => {
      const res = (await filter.onFetch(elements)) as FilterResult
      expect(res.errors).toHaveLength(1)
      expect(res.errors?.[0].message).toEqual('Unable to fetch form for project project1 as it is missing a title.')
    })
  })
  describe('deploy', () => {
    let formInstance: InstanceElement
    beforeEach(async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      const { client: cli, connection: conn } = mockClient(false)
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
        [JIRA, adapterElements.RECORDS_PATH, PROJECT_TYPE, 'project1'],
      )
      formInstance = new InstanceElement(
        'formInstanceName',
        createEmptyType(FORM_TYPE),
        {
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
              templateFormUuid: 'templateFormUuid',
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
            conditions: {
              10: {
                t: 'sh',
                i: {
                  co: {
                    cIds: {
                      2: ['2'],
                    },
                  },
                },
                o: {
                  sIds: ['1'],
                },
              },
            },
            sections: {
              1: {
                name: 'Ido section',
                conditions: ['10'],
              },
            },
            questions: {
              2: {
                type: 'cs',
                label: 'What is the impact on IT resources?',
                description: '',
                validation: {
                  rq: false,
                },
                choices: [
                  {
                    id: '1',
                    label: 'No Risk – Involves a single IT resource from a workgroup',
                  },
                  {
                    id: '2',
                    label: 'Low Risk – Involves one workgroup from the same IT division',
                  },
                ],
                questionKey: '',
              },
            },
          },
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
        },
      )
      connection.post.mockImplementation(async url => {
        if (url === '/gateway/api/proforma/cloudid/cloudId/api/2/projects/11111/forms') {
          return {
            status: 200,
            data: {
              id: 1,
            },
          }
        }
        if (url === '/rest/webResources/1.0/resources') {
          return {
            status: 200,
            data: {
              unparsedData: {
                [CLOUD_RESOURCE_FIELD]: safeJsonStringify({
                  tenantId: 'cloudId',
                }),
              },
            },
          }
        }
        throw new Error('Unexpected url')
      })

      elements = [projectInstance, projectType]
    })
    it('should add form', async () => {
      const res = await filter.deploy([{ action: 'add', data: { after: formInstance } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.post).toHaveBeenCalledTimes(2)
    })
    it('should modify form', async () => {
      const formInstanceAfter = formInstance.clone()
      formInstanceAfter.value.design.settings.name = 'newName'
      const res = await filter.deploy([{ action: 'modify', data: { before: formInstance, after: formInstanceAfter } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.put).toHaveBeenCalledTimes(1)
      expect(connection.post).toHaveBeenCalledTimes(1)
    })
    it('should delete form', async () => {
      const res = await filter.deploy([{ action: 'remove', data: { before: formInstance } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.delete).toHaveBeenCalledTimes(1)
      expect(connection.post).toHaveBeenCalledTimes(1)
    })
    it('should not deploy if form name is missing', async () => {
      const formInstanceAfter = formInstance.clone()
      delete formInstanceAfter.value.design.settings.name
      const res = await filter.deploy([{ action: 'modify', data: { before: formInstance, after: formInstanceAfter } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(connection.put).toHaveBeenCalledTimes(0)
      expect(connection.post).toHaveBeenCalledTimes(0)
    })
    it('should not deploy if enableJSM is false', async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = false
      filter = formsFilter(getFilterParams({ config, client })) as typeof filter
      const res = await filter.deploy([{ action: 'add', data: { after: formInstance } }])
      expect(res.leftoverChanges).toHaveLength(1)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(connection.post).toHaveBeenCalledTimes(0)
    })
    it('should throw error if bad response in form creation from jira', async () => {
      connection.post.mockImplementation(async url => {
        if (url === '/gateway/api/proforma/cloudid/cloudId/api/2/projects/11111/forms') {
          return {
            status: 200,
            data: {
              name: 'wrong response',
            },
          }
        }
        if (url === '/rest/webResources/1.0/resources') {
          return {
            status: 200,
            data: {
              unparsedData: {
                [CLOUD_RESOURCE_FIELD]: safeJsonStringify({
                  tenantId: 'cloudId',
                }),
              },
            },
          }
        }
        throw new Error('Unexpected url')
      })
      const res = await filter.deploy([{ action: 'add', data: { after: formInstance } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(res.deployResult.errors[0].message).toEqual('Error: Failed to create form')
    })
  })
  describe('preDeploy', () => {
    let formInstance: InstanceElement
    beforeEach(async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      const { client: cli, connection: conn } = mockClient(false)
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
        [JIRA, adapterElements.RECORDS_PATH, PROJECT_TYPE, 'project1'],
      )
      formInstance = new InstanceElement(
        'formInstanceName',
        createEmptyType(FORM_TYPE),
        {
          uuid: 'uuid',
          design: {
            settings: {
              templateId: 6,
              name: 'form6',
              submit: {
                lock: false,
                pdf: false,
              },
              templateFormUuid: 'templateFormUuid',
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
            conditions: {
              10: {
                t: 'sh',
                i: {
                  co: {
                    cIds: {
                      2: ['2'],
                    },
                  },
                },
                o: {
                  sIds: ['1'],
                },
              },
            },
            sections: {
              1: {
                name: 'Ido section',
                conditions: ['10'],
              },
            },
            questions: {
              2: {
                type: 'cs',
                label: 'What is the impact on IT resources?',
                description: '',
                validation: {
                  rq: false,
                },
                choices: [
                  {
                    id: '1',
                    label: 'No Risk – Involves a single IT resource from a workgroup',
                  },
                  {
                    id: '2',
                    label: 'Low Risk – Involves one workgroup from the same IT division',
                  },
                ],
                questionKey: '',
              },
            },
          },
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
        },
      )
      elements = [projectInstance, projectType]
    })
    it('should add the current updated time', async () => {
      const timeBeforeFilter = new Date()
      await filter.preDeploy([{ action: 'add', data: { after: formInstance } }])
      const timeAfterFilter = new Date()
      const updatedTime = new Date(formInstance.value.updated)
      const isBetween = updatedTime >= timeBeforeFilter && updatedTime <= timeAfterFilter
      expect(isBetween).toBeTruthy()
    })
  })
  describe('onDeploy', () => {
    let formInstance: InstanceElement
    beforeEach(async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      const { client: cli, connection: conn } = mockClient(false)
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
        [JIRA, adapterElements.RECORDS_PATH, PROJECT_TYPE, 'project1'],
      )
      formInstance = new InstanceElement(
        'formInstanceName',
        createEmptyType(FORM_TYPE),
        {
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
              templateFormUuid: 'templateFormUuid',
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
            conditions: {
              10: {
                t: 'sh',
                i: {
                  co: {
                    cIds: {
                      2: ['2'],
                    },
                  },
                },
                o: {
                  sIds: ['1'],
                },
              },
            },
            sections: {
              1: {
                name: 'Ido section',
                conditions: ['10'],
              },
            },
            questions: {
              2: {
                type: 'cs',
                label: 'What is the impact on IT resources?',
                description: '',
                validation: {
                  rq: false,
                },
                choices: [
                  {
                    id: '1',
                    label: 'No Risk – Involves a single IT resource from a workgroup',
                  },
                  {
                    id: '2',
                    label: 'Low Risk – Involves one workgroup from the same IT division',
                  },
                ],
                questionKey: '',
              },
            },
          },
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
        },
      )
      elements = [projectInstance, projectType]
    })
    it('should delete updated field', async () => {
      await filter.onDeploy([{ action: 'add', data: { after: formInstance } }])
      expect(formInstance.value.updated).toBeUndefined()
    })
  })
})
