/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
import { FIELD_CONTEXT_OPTION_TYPE_NAME } from '../../../src/filters/fields/constants'

describe('forms filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch' | 'deploy' | 'onDeploy' | 'preDeploy', FilterResult>
  let filter: FilterType
  let mockAtlassianApiGet: jest.SpyInstance
  let mockAtlassianApiPost: jest.SpyInstance
  let client: JiraClient
  const projectType = createEmptyType(PROJECT_TYPE)
  const CustomFieldContextOptionType = createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME)
  const CustomFieldContextOptionInstance = new InstanceElement('project1', CustomFieldContextOptionType, {
    id: '123456',
    name: 'project1',
  })
  const CustomFieldContextOptionInstance2 = new InstanceElement('choices1', CustomFieldContextOptionType, {
    id: '123',
  })
  let projectInstance: InstanceElement
  let elements: Element[]
  afterEach(() => {
    jest.clearAllMocks()
  })
  describe('on fetch', () => {
    beforeEach(async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      config.fetch.splitFieldContextOptions = true
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
      mockAtlassianApiGet = jest.spyOn(client, 'atlassianApiGet')
      mockAtlassianApiGet.mockResolvedValueOnce({
        status: 200,
        data: [
          {
            id: 'uuid-1',
            name: 'form1',
          },
        ],
      })

      mockAtlassianApiGet.mockResolvedValueOnce({
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
            conditions: {
              8: {
                i: {
                  co: {
                    cIds: {
                      3: ['123456'],
                    },
                  },
                },
              },
            },
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
                defaultAnswer: {
                  choices: ['123'],
                },
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
          conditions: {
            '8@': {
              i: {
                co: {
                  cIds: [
                    {
                      key: '3',
                      value: ['123456'],
                    },
                  ],
                },
              },
            },
          },
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
              defaultAnswer: [
                {
                  key: 'choices',
                  value: ['123'],
                },
              ],
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
      mockAtlassianApiGet = jest.spyOn(client, 'atlassianApiGet')
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
      mockAtlassianApiGet.mockImplementation(async params => {
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
      expect(res.errors?.[0].message).toEqual('Other issues')
      expect(res.errors?.[0].detailedMessage).toEqual(
        'Salto does not support fetching untitled forms, found in the following projects: project1, project2',
      )
    })
    it('should return single saltoError when failed to fetch form because data is empty', async () => {
      mockAtlassianApiGet.mockImplementation(async params => {
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
      expect(res.errors?.[0].message).toEqual('Other issues')
      expect(res.errors?.[0].detailedMessage).toEqual(
        'Unable to fetch forms for the following projects: project1, project2. This issue is likely due to insufficient permissions.',
      )
    })
    it('should add form1 to the elements and add saltoError when failed to fetch form2 data for projectTwo', async () => {
      mockAtlassianApiGet.mockImplementation(async params => {
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
      expect(res.errors?.[0].message).toEqual('Other issues')
      expect(res.errors?.[0].detailedMessage).toEqual(
        'Unable to fetch forms for the following projects: project2. This issue is likely due to insufficient permissions.',
      )
      const instances = elements.filter(isInstanceElement)
      const formInstances = instances.filter(e => e.elemID.typeName === FORM_TYPE)
      expect(formInstances).toHaveLength(1)
      expect(formInstances[0]?.elemID.name).toEqual('project1Key_form1')
    })
    it('should not add forms to elements and not add an error for a bad unexpected response', async () => {
      mockAtlassianApiGet.mockResolvedValue({
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
      mockAtlassianApiGet.mockRejectedValue({
        response: {
          status: 403,
          data: 'insufficient permissions',
        },
      })
      const res = (await filter.onFetch(elements)) as FilterResult
      expect(res.errors).toHaveLength(1)
      expect(res.errors?.[0].message).toEqual('Other issues')
      expect(res.errors?.[0].detailedMessage).toEqual(
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
                      2: [
                        new ReferenceExpression(
                          CustomFieldContextOptionInstance.elemID,
                          CustomFieldContextOptionInstance,
                        ),
                      ],
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
                defaultAnswer: [
                  {
                    choices: [
                      new ReferenceExpression(
                        CustomFieldContextOptionInstance2.elemID,
                        CustomFieldContextOptionInstance2,
                      ),
                    ],
                  },
                ],
              },
            },
          },
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
        },
      )
      mockAtlassianApiPost = jest.spyOn(client, 'atlassianApiPost')
      mockAtlassianApiPost.mockImplementation(async params => {
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
      })
      elements = [projectInstance, projectType, formPortalType, formPublishType, formType, requestTypeType]
    })
    it('should add form', async () => {
      const res = await filter.deploy([{ action: 'add', data: { after: formInstance } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(mockAtlassianApiPost).toHaveBeenCalledTimes(1)
      // Check that it resolved the reference inside conditions
      expect(mockAtlassianApiPost).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            design: expect.objectContaining({
              conditions: {
                '10': {
                  i: {
                    co: {
                      cIds: {
                        '2': ['123456'],
                      },
                    },
                  },
                  o: {
                    sIds: ['1'],
                  },
                  t: 'sh',
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
                  defaultAnswer: [
                    {
                      choices: ['123'],
                    },
                  ],
                },
              },
            }),
          }),
        }),
      )
    })
    it('should modify form', async () => {
      const mockAtlassianApiPut = jest.spyOn(client, 'atlassianApiPut')
      const formInstanceAfter = formInstance.clone()
      formInstanceAfter.value.design.settings.name = 'newName'
      const res = await filter.deploy([{ action: 'modify', data: { before: formInstance, after: formInstanceAfter } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(mockAtlassianApiPut).toHaveBeenCalledTimes(1)
      // Check that it resolved the reference inside conditions
      expect(mockAtlassianApiPut).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            design: expect.objectContaining({
              conditions: {
                '10': {
                  i: {
                    co: {
                      cIds: {
                        '2': ['123456'],
                      },
                    },
                  },
                  o: {
                    sIds: ['1'],
                  },
                  t: 'sh',
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
                  defaultAnswer: [
                    {
                      choices: ['123'],
                    },
                  ],
                },
              },
            }),
          }),
        }),
      )
    })
    it('should delete form', async () => {
      const mockAtlassianApiDelete = jest.spyOn(client, 'atlassianApiDelete')
      const res = await filter.deploy([{ action: 'remove', data: { before: formInstance } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(mockAtlassianApiDelete).toHaveBeenCalledTimes(1)
    })
    it('should not deploy if form name is missing', async () => {
      const mockAtlassianApiPut = jest.spyOn(client, 'atlassianApiPut')
      const formInstanceAfter = formInstance.clone()
      delete formInstanceAfter.value.design.settings.name
      const res = await filter.deploy([{ action: 'modify', data: { before: formInstance, after: formInstanceAfter } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(mockAtlassianApiPut).toHaveBeenCalledTimes(0)
    })
    it('should not deploy if enableJSM is false', async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = false
      filter = formsFilter(getFilterParams({ config, client })) as typeof filter
      const res = await filter.deploy([{ action: 'add', data: { after: formInstance } }])
      expect(res.leftoverChanges).toHaveLength(1)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(mockAtlassianApiPost).toHaveBeenCalledTimes(0)
    })
    it('should throw error if bad response in form creation from jira', async () => {
      mockAtlassianApiPost.mockImplementation(async params => {
        if (params.url === 'project/11111/form') {
          return {
            status: 200,
            data: {
              name: 'wrong response',
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
                    cIds: [
                      {
                        key: '3',
                        value: ['123456'],
                      },
                    ],
                  },
                },
                o: [
                  {
                    key: 'sIds',
                    value: ['1'],
                  },
                ],
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
                defaultAnswer: [
                  {
                    key: 'choices',
                    value: ['123'],
                  },
                ],
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
    it('should return the conditions field to its original structure', async () => {
      await filter.preDeploy([{ action: 'add', data: { after: formInstance } }])
      expect(formInstance.value.design.conditions).toEqual({
        10: {
          t: 'sh',
          i: {
            co: {
              cIds: {
                3: ['123456'],
              },
            },
          },
          o: {
            sIds: ['1'],
          },
        },
      })
      expect(formInstance.value.design.questions).toEqual({
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
          defaultAnswer: {
            choices: ['123'],
          },
        },
      })
    })
  })
  describe('onDeploy', () => {
    let formInstance: InstanceElement
    beforeEach(async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      config.fetch.splitFieldContextOptions = true
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
    it('should return the conditions field to its modified structure', async () => {
      await filter.onDeploy([{ action: 'add', data: { after: formInstance } }])
      expect(formInstance.value.design.conditions).toEqual({
        '10': { i: { co: { cIds: [{ key: '2', value: ['2'] }] } }, o: [{ key: 'sIds', value: ['1'] }], t: 'sh' },
      })
    })
  })
})
