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
  ObjectType,
  ElemID,
  BuiltinTypes,
} from '@salto-io/adapter-api'
import { FilterResult } from '../../../src/filter'
import { getDefaultConfig } from '../../../src/config/config'
import formsFilter from '../../../src/filters/forms/forms'
import { createEmptyType, getFilterParams, mockClient } from '../../utils'
import { FORM_TYPE, JIRA, PROJECT_TYPE, REQUEST_TYPE_NAME } from '../../../src/constants'
import JiraClient from '../../../src/client/client'

describe('forms filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch' | 'deploy' | 'onDeploy' | 'preDeploy', FilterResult>
  let filter: FilterType
  let mockSendRequest: jest.SpyInstance
  let client: JiraClient
  const projectType = createEmptyType(PROJECT_TYPE)
  let projectInstance: InstanceElement
  let elements: Element[]
  afterEach(() => {
    jest.clearAllMocks()
  })
  describe('on fetch', () => {
    beforeEach(async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      const { client: cli } = mockClient(false)
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
      mockSendRequest = jest.spyOn(client, 'atlassianApiSendRequest')
      mockSendRequest.mockResolvedValueOnce({
        status: 200,
        data: [
          {
            id: 'uuid-1',
            name: 'form1',
          },
        ],
      })

      mockSendRequest.mockResolvedValueOnce({
        status: 200,
        data: {
          updated: '2023-09-28T08:20:31.552322Z',
          id: 'uuid-1',
          design: {
            settings: {
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
        id: 'uuid-1',
        updated: '2023-09-28T08:20:31.552322Z',
        design: {
          settings: {
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
    let projectInstanceTwo: InstanceElement
    const goodDetailedResponse = {
      updated: '2023-09-28T08:20:31.552322Z',
      id: 'uuid-1',
      design: {
        settings: {
          name: 'name',
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
    }
    const badDetailedResponse = {
      updated: '2023-09-28T08:20:31.552322Z',
      id: 'uuid-1',
      design: {
        settings: {
          name: '',
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
    }
    beforeEach(async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      const { client: cli } = mockClient(false)
      client = cli
      mockSendRequest = jest.spyOn(client, 'atlassianApiSendRequest')
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
      projectInstanceTwo = new InstanceElement(
        'project2',
        projectType,
        {
          id: 22222,
          name: 'project2',
          projectTypeKey: 'service_desk',
          key: 'project2Key',
        },
        [JIRA, adapterElements.RECORDS_PATH, PROJECT_TYPE, 'project1'],
      )
      elements = [projectInstance, projectInstanceTwo, projectType]
    })
    afterEach(() => {
      jest.clearAllMocks()
    })
    it("should return single saltoError when failed to fetch form because it doesn't have a title", async () => {
      mockSendRequest.mockImplementation(async (_method, params) => {
        if (params.url === 'project/11111/form') {
          return {
            status: 200,
            data: [
              {
                id: 'uuid-1',
                name: '',
              },
            ],
          }
        }
        if (params.url === 'project/11111/form/uuid-1') {
          return {
            status: 200,
            data: badDetailedResponse,
          }
        }
        if (params.url === 'project/22222/form') {
          return {
            status: 200,
            data: [
              {
                id: 'uuid-2',
                name: '',
              },
            ],
          }
        }
        if (params.url === 'project/22222/form/uuid-2') {
          return {
            status: 200,
            data: badDetailedResponse,
          }
        }
        throw new Error('Unexpected url')
      })
      const res = (await filter.onFetch(elements)) as FilterResult
      expect(res.errors).toHaveLength(1)
      expect(res.errors?.[0].message).toEqual(
        'Salto does not support fetching untitled forms, found in the following projects: project1, project2',
      )
    })
    it('should return single saltoError when failed to fetch form because data is empty', async () => {
      mockSendRequest.mockImplementation(async (_method, params) => {
        if (params.url === 'project/11111/form') {
          throw new clientUtils.HTTPError('insufficient permissions', {
            status: 403,
            data: {},
          })
        }
        if (params.url === 'project/22222/form') {
          throw new clientUtils.HTTPError('insufficient permissions', {
            status: 403,
            data: {},
          })
        }
        throw new Error('Unexpected url')
      })
      const res = (await filter.onFetch(elements)) as FilterResult
      expect(res.errors).toHaveLength(1)
      expect(res.errors?.[0].message).toEqual(
        'Unable to fetch forms for the following projects: project1, project2. This issue is likely due to insufficient permissions.',
      )
    })
    it('should add form1 to the elements and add saltoError when failed to fetch form2 data for projectTwo', async () => {
      mockSendRequest.mockImplementation(async (_method, params) => {
        if (params.url === 'project/11111/form') {
          return {
            status: 200,
            data: [
              {
                id: 'uuid-1',
                name: 'form1',
              },
            ],
          }
        }
        if (params.url === 'project/11111/form/uuid-1') {
          return {
            status: 200,
            data: goodDetailedResponse,
          }
        }
        if (params.url === 'project/22222/form') {
          throw new clientUtils.HTTPError('insufficient permissions', {
            status: 403,
            data: {},
          })
        }
        throw new Error('Unexpected url')
      })
      const res = (await filter.onFetch(elements)) as FilterResult
      expect(res.errors).toHaveLength(1)
      expect(res.errors?.[0].message).toEqual(
        'Unable to fetch forms for the following projects: project2. This issue is likely due to insufficient permissions.',
      )
      const instances = elements.filter(isInstanceElement)
      const formInstances = instances.filter(e => e.elemID.typeName === FORM_TYPE)
      expect(formInstances).toHaveLength(1)
      expect(formInstances[0]?.elemID.name).toEqual('project1Key_form1')
    })
    it('should not add forms to elements and not add an error for a bad unexpected response', async () => {
      mockSendRequest.mockResolvedValue({
        status: 404,
        data: {
          message: 'not found',
        },
      })
      const res = (await filter.onFetch(elements)) as FilterResult
      expect(res.errors).toHaveLength(0)
      const instances = elements.filter(isInstanceElement)
      const formInstance = instances.find(e => e.elemID.typeName === FORM_TYPE)
      expect(formInstance).toBeUndefined()
    })
    it('should add saltoError response when 403 error is thrown from jira client', async () => {
      mockSendRequest.mockRejectedValue({
        response: {
          status: 403,
          data: 'insufficient permissions',
        },
      })
      const res = (await filter.onFetch(elements)) as FilterResult
      expect(res.errors).toHaveLength(1)
      expect(res.errors?.[0].message).toEqual(
        'Unable to fetch forms for the following projects: project1, project2. This issue is likely due to insufficient permissions.',
      )
    })
  })
  describe('deploy', () => {
    let formInstance: InstanceElement
    const requestTypeType = new ObjectType({
      elemID: new ElemID(JIRA, REQUEST_TYPE_NAME),
      fields: {
        id: { refType: BuiltinTypes.STRING },
      },
    })
    const requestTypeInstance = new InstanceElement('requestTypeInstanceName', requestTypeType, {
      id: '999',
    })
    const formPortalType = new ObjectType({
      elemID: new ElemID(JIRA, 'FormPortal'),
      fields: {
        portalRequestTypeIds: { refType: BuiltinTypes.STRING },
      },
    })

    const formPublishType = new ObjectType({
      elemID: new ElemID(JIRA, 'FormPublish'),
      fields: {
        portal: { refType: formPortalType },
      },
    })

    const formType = new ObjectType({
      elemID: new ElemID(JIRA, FORM_TYPE),
      fields: {
        publish: { refType: formPublishType },
      },
    })

    beforeEach(async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      const { client: cli } = mockClient(false)
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
        formType,
        {
          id: 'uuid-1',
          updated: '2023-09-28T08:20:31.552322Z',
          publish: {
            portal: {
              portalRequestTypeIds: [new ReferenceExpression(requestTypeInstance.elemID, requestTypeInstance)],
            },
          },
          design: {
            settings: {
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
      mockSendRequest = jest.spyOn(client, 'atlassianApiSendRequest')
      mockSendRequest.mockImplementation(async (method, params) => {
        if (method === 'post') {
          if (params.url === 'project/11111/form') {
            return {
              status: 200,
              data: {
                id: 'uuid-1',
                name: 'form1',
              },
            }
          }
          throw new Error('Unexpected url')
        } else {
          return {
            status: 200,
            data: {},
          }
        }
      })
      elements = [projectInstance, projectType, formPortalType, formPublishType, formType, requestTypeType]
    })
    it('should add form', async () => {
      const res = await filter.deploy([{ action: 'add', data: { after: formInstance } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
    })
    it('should modify form', async () => {
      const formInstanceAfter = formInstance.clone()
      formInstanceAfter.value.design.settings.name = 'newName'
      const res = await filter.deploy([{ action: 'modify', data: { before: formInstance, after: formInstanceAfter } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
    })
    it('should delete form', async () => {
      const res = await filter.deploy([{ action: 'remove', data: { before: formInstance } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
    })
    it('should not deploy if form name is missing', async () => {
      const formInstanceAfter = formInstance.clone()
      delete formInstanceAfter.value.design.settings.name
      const res = await filter.deploy([{ action: 'modify', data: { before: formInstance, after: formInstanceAfter } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
    it('should not deploy if enableJSM is false', async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = false
      filter = formsFilter(getFilterParams({ config, client })) as typeof filter
      const res = await filter.deploy([{ action: 'add', data: { after: formInstance } }])
      expect(res.leftoverChanges).toHaveLength(1)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
    it('should throw error if bad response in form creation from jira', async () => {
      mockSendRequest.mockImplementation(async (method, params) => {
        if (method === 'post') {
          if (params.url === 'project/11111/form') {
            return {
              status: 200,
              data: {
                name: 'wrong response',
              },
            }
          }
          throw new Error('Unexpected url')
        } else {
          return {
            status: 200,
            data: {},
          }
        }
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
      const { client: cli } = mockClient(false)
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
          id: 'uuid-1',
          design: {
            settings: {
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
      const { client: cli } = mockClient(false)
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
          id: 'uuid-1',
          updated: '2023-09-28T08:20:31.552322Z',
          design: {
            settings: {
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
