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

import { elements as elementsUtils, client as clientUtils, filterUtils } from '@salto-io/adapter-components'
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import ZendeskClient from '../../src/client/client'
import filterCreator, { AUDIT_TIME_TYPE_ID, DELETED_USER } from '../../src/filters/audit_logs'
import { createFilterCreatorParams } from '../utils'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'
import { getIdByName } from '../../src/user_utils'
import {
  ARTICLE_TRANSLATION_TYPE_NAME,
  AUDIT_TIME_TYPE_NAME,
  AUTOMATION_TYPE_NAME,
  TICKET_FIELD_CUSTOM_FIELD_OPTION,
  TICKET_FIELD_TYPE_NAME,
  ZENDESK,
} from '../../src/constants'


const CURRENT_TIME = '2023-02-08T06:34:53Z'
const BEFORE_TIME = '2023-02-08T04:34:53Z'
const BETWEEN_TIME = '2023-02-08T08:34:53Z'
const AFTER_TIME = '2023-02-08T10:34:53Z'
const AFTER_AFTER_TIME = '2023-02-08T10:38:53Z'
jest.mock('../../src/user_utils', () => ({
  ...jest.requireActual<{}>('../../src/user_utils'),
  getIdByName: jest.fn(),
}))

describe('audit_logs filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  let getIdByNameMock: jest.MockedFunction<typeof getIdByName>
  let mockGet: jest.SpyInstance
  let mockPaginator: clientUtils.Paginator

  const createInstance = ({
    type, id, updatedAt, updatedBy, parent,
  }:{
    type: ObjectType
    id: number
    updatedAt?: string
    updatedBy?: number
    parent?: InstanceElement
  }): InstanceElement =>
    new InstanceElement(
      `test_${id}`,
      type,
      {
        id,
        updated_at: updatedAt || undefined,
        // eslint-disable-next-line camelcase
        updated_by_id: updatedBy || undefined,
      },
      [],
      parent
        ? { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)] }
        : undefined
    )

  const automationType = new ObjectType({ elemID: new ElemID(ZENDESK, AUTOMATION_TYPE_NAME) })
  const ticketFieldType = new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FIELD_TYPE_NAME) })
  const ticketFieldCustomOptionType = new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FIELD_CUSTOM_FIELD_OPTION) })
  const articleTranslationType = new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TRANSLATION_TYPE_NAME) })
  const auditTimeType = new ObjectType({
    elemID: AUDIT_TIME_TYPE_ID,
    isSettings: true,
    fields: {
      time: { refType: BuiltinTypes.STRING },
    },
    path: [ZENDESK, elementsUtils.TYPES_PATH, AUDIT_TIME_TYPE_NAME],
    annotations: {
      [CORE_ANNOTATIONS.HIDDEN]: true,
    },
  })

  const automationInstance = createInstance({ type: automationType, id: 1, updatedAt: BEFORE_TIME })
  const ticketFieldInstance = createInstance({ type: ticketFieldType, id: 5, updatedAt: BEFORE_TIME })
  const ticketFieldCustomOptionInstance = createInstance(
    { type: ticketFieldCustomOptionType, id: 6, parent: ticketFieldInstance }
  )
  const articleTranslationInstance = createInstance(
    { type: articleTranslationType, id: 2, updatedAt: BEFORE_TIME, updatedBy: 11 }
  )

  const auditTimeInstance = new InstanceElement(
    ElemID.CONFIG_NAME,
    auditTimeType,
    {
      time: CURRENT_TIME,
    },
    undefined,
    { [CORE_ANNOTATIONS.HIDDEN]: true },
  )


  beforeEach(async () => {
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    getIdByNameMock = getIdByName as jest.MockedFunction<typeof getIdByName>
    mockGet = jest.spyOn(client, 'getSinglePage')
    filter = filterCreator(createFilterCreatorParams({
      client,
      config: {
        ...DEFAULT_CONFIG,
        [FETCH_CONFIG]: {
          include: [{
            type: '.*',
          }],
          exclude: [],
          guide: {
            brands: ['.*'],
          },
          includeAuditDetails: true,
        },
      },
      paginator: mockPaginator,
      elementsSource: buildElementsSourceFromElements([]),
    })) as FilterType
    mockGet.mockImplementation(params => {
      if (params.url === '/api/v2/audit_logs') {
        return {
          status: 200,
          data: {
            audit_logs: [
              {
                created_at: CURRENT_TIME,
                actor_name: 'NOT IMPORTANT',
              },
            ],
          },
        }
      }
      throw new Error('Err')
    })
  })
  describe('onFetch', () => {
    it('should only add changed_at correctly when flag is false', async () => {
      filter = filterCreator(createFilterCreatorParams({
        client,
        config: {
          ...DEFAULT_CONFIG,
          [FETCH_CONFIG]: {
            include: [{
              type: '.*',
            }],
            exclude: [],
            guide: {
              brands: ['.*'],
            },
            includeAuditDetails: false,
          },
        },
        paginator: mockPaginator,
        elementsSource: buildElementsSourceFromElements([]),
      })) as FilterType
      const elements = [
        automationInstance,
        ticketFieldInstance,
        ticketFieldCustomOptionInstance,
        articleTranslationInstance,
      ].map(e => e.clone())
      await filter.onFetch(elements)
      expect(mockGet).toHaveBeenCalledTimes(1)
      expect(elements).toHaveLength(6)
      expect(elements.filter(e => e.elemID.typeName === AUDIT_TIME_TYPE_NAME)).toEqual([
        auditTimeType, auditTimeInstance,
      ])
      expect(elements.filter(e => e.elemID.typeName !== AUDIT_TIME_TYPE_NAME)
        .filter(e => e.annotations[CORE_ANNOTATIONS.CHANGED_AT] === BEFORE_TIME)).toHaveLength(4)
    })
    it('should do nothing if there is no updated_at in the instance or parent does not exist', async () => {
      const elements = [
        createInstance({ type: automationType, id: 1 }),
        createInstance({ type: ticketFieldCustomOptionType, id: 2 }),
        ticketFieldCustomOptionInstance,
      ].map(e => e.clone())
      await filter.onFetch(elements)
      expect(mockGet).toHaveBeenCalledTimes(1)
      expect(elements).toHaveLength(5)
      expect(elements.filter(e => e.elemID.typeName !== AUDIT_TIME_TYPE_NAME)
        .filter(e => e.annotations[CORE_ANNOTATIONS.CHANGED_AT] === undefined)).toHaveLength(3)
    })
    it('should do nothing if last audit time is undefined because of invalid return', async () => {
      // res is not valid
      mockGet.mockImplementation(params => {
        if (params.url === '/api/v2/audit_logs') {
          return {
            status: 200,
            data: { audit_logs: [{ a: 1 }] },
          }
        }
        throw new Error('Err')
      })
      const elements = [automationInstance].map(e => e.clone())
      await filter.onFetch(elements)
      expect(mockGet).toHaveBeenCalledTimes(1)
      expect(elements).toHaveLength(1)
      expect(elements.filter(e => e.annotations[CORE_ANNOTATIONS.CHANGED_AT] === BEFORE_TIME)).toHaveLength(1)
    })
    it('should do nothing if last audit time is undefined because of error', async () => {
      // no res (error)
      mockGet.mockImplementation(params => {
        if (params.url === '/api/v2') {
          return { status: 200 }
        }
        throw new Error('Err')
      })
      const elements = [automationInstance].map(e => e.clone())
      await filter.onFetch(elements)
      expect(mockGet).toHaveBeenCalledTimes(1)
      expect(elements).toHaveLength(1)
      expect(elements.filter(e => e.annotations[CORE_ANNOTATIONS.CHANGED_AT] === BEFORE_TIME)).toHaveLength(1)
    })
    it('should not add changed_by when flag is true and it is first fetch', async () => {
      const elements = [
        automationInstance,
        ticketFieldInstance,
        ticketFieldCustomOptionInstance,
        articleTranslationInstance,
      ].map(e => e.clone())
      await filter.onFetch(elements)
      expect(mockGet).toHaveBeenCalledTimes(1)
      expect(elements).toHaveLength(6)
      expect(elements.filter(e => e.elemID.typeName !== AUDIT_TIME_TYPE_NAME)
        .filter(e => e.annotations[CORE_ANNOTATIONS.CHANGED_BY] === undefined)).toHaveLength(4)
    })
    it('should add changed_at and change_by when flag is true and it is second fetch', async () => {
      const rawElements = [
        automationInstance,
        ticketFieldInstance,
        ticketFieldCustomOptionInstance,
        articleTranslationInstance,
      ]
      const notUpdatedAutomation = createInstance({ type: automationType, id: 3, updatedAt: BEFORE_TIME })
      filter = filterCreator(createFilterCreatorParams({
        client,
        config: {
          ...DEFAULT_CONFIG,
          [FETCH_CONFIG]: {
            include: [{
              type: '.*',
            }],
            exclude: [],
            guide: {
              brands: ['.*'],
            },
            includeAuditDetails: true,
          },
        },
        paginator: mockPaginator,
        elementsSource: buildElementsSourceFromElements(
          [auditTimeInstance, auditTimeType, ...rawElements, notUpdatedAutomation]
        ),
      })) as FilterType
      mockGet.mockImplementation(params => {
        if (params.url === '/api/v2/audit_logs') {
          if (params.queryParams['filter[source_id]'] > 4) { // will be ticket_filed and ticket_field_custom_option
            return {
              status: 200,
              data: {
                audit_logs: [],
              },
            }
          }
          if (params.queryParams['filter[source_id]'] !== undefined) {
            return {
              status: 200,
              data: {
                audit_logs: [
                  {
                    created_at: BETWEEN_TIME,
                    actor_name: 'new user',
                  },
                ],
              },
            }
          }
          return {
            status: 200,
            data: {
              audit_logs: [
                {
                  created_at: AFTER_TIME,
                  actor_name: 'NOT IMPORTANT',
                },
              ],
            },
          }
        }
        throw new Error('Err')
      })
      getIdByNameMock
        .mockResolvedValue({ 11: 'new user', 21: 'b', 31: 'c' },)
      const elements = [
        ...rawElements.map(e => e.clone())
          .map(e => {
            e.value.updated_at = e.value.updated_at !== undefined ? BETWEEN_TIME : undefined
            return e
          }),
        notUpdatedAutomation.clone(),
      ]
      await filter.onFetch(elements)
      expect(mockGet).toHaveBeenCalledTimes(4) // time, 1 automation, ticket_field, custom_field
      expect(elements).toHaveLength(7)
      // automation and translation
      expect(elements.filter(e => e.elemID.typeName !== AUDIT_TIME_TYPE_NAME)
        .filter(e => e.annotations[CORE_ANNOTATIONS.CHANGED_BY] === 'new user')).toHaveLength(2)
      // ticket_filed and custom and notUpdatedAutomation
      expect(elements.filter(e => e.elemID.typeName !== AUDIT_TIME_TYPE_NAME)
        .filter(e => e.annotations[CORE_ANNOTATIONS.CHANGED_BY] === undefined)).toHaveLength(3)
    })
    it('should do nothing if getUpdatedByID is undefined', async () => {
      // no res (400)
      filter = filterCreator(createFilterCreatorParams({
        client,
        config: {
          ...DEFAULT_CONFIG,
          [FETCH_CONFIG]: {
            include: [{
              type: '.*',
            }],
            exclude: [],
            guide: {
              brands: ['.*'],
            },
            includeAuditDetails: true,
          },
        },
        paginator: mockPaginator,
        elementsSource: buildElementsSourceFromElements([auditTimeInstance, auditTimeType, automationInstance]),
      })) as FilterType
      mockGet.mockImplementation(params => {
        if (params.url === '/api/v2/audit_logs' && params.queryParams['filter[source_id]'] !== undefined) {
          throw new Error('Err')
        }
        return {
          status: 200,
          data: {
            audit_logs: [
              {
                created_at: AFTER_TIME,
                actor_name: 'NOT IMPORTANT',
              },
            ],
          },
        }
      })
      getIdByNameMock
        .mockResolvedValue({ 11: 'new user', 21: 'b', 31: 'c' },)
      const elements = [automationInstance].map(e => e.clone()).map(e => {
        e.value.updated_at = BETWEEN_TIME
        return e
      })
      await filter.onFetch(elements)
      expect(mockGet).toHaveBeenCalledTimes(2) // time, 1 automation, ticket_field, custom_field
      expect(elements).toHaveLength(3)
      expect(elements.filter(e => e.elemID.typeName === AUTOMATION_TYPE_NAME)
        .filter(e => e.annotations[CORE_ANNOTATIONS.CHANGED_BY] === undefined)).toHaveLength(1)
    })
    it('should do nothing if res for getUpdatedByID is in invalid format', async () => {
      // no res (400)
      filter = filterCreator(createFilterCreatorParams({
        client,
        config: {
          ...DEFAULT_CONFIG,
          [FETCH_CONFIG]: {
            include: [{
              type: '.*',
            }],
            exclude: [],
            guide: {
              brands: ['.*'],
            },
            includeAuditDetails: true,
          },
        },
        paginator: mockPaginator,
        elementsSource: buildElementsSourceFromElements([auditTimeInstance, auditTimeType, automationInstance]),
      })) as FilterType
      mockGet.mockImplementation(params => {
        if (params.url === '/api/v2/audit_logs' && params.queryParams['filter[source_id]'] !== undefined) {
          return {
            status: 200,
            data: {
              audit_logs: [
                {
                  created_at: AFTER_TIME,
                  actor_name: '',
                },
              ],
            },
          }
        }
        return {
          status: 200,
          data: {
            audit_logs: [
              {
                created_at: AFTER_TIME,
                actor_name: 'NOT IMPORTANT',
              },
            ],
          },
        }
      })
      getIdByNameMock
        .mockResolvedValue({ 11: 'new user', 21: 'b', 31: 'c' },)
      const elements = [automationInstance].map(e => e.clone()).map(e => {
        e.value.updated_at = BETWEEN_TIME
        return e
      })
      await filter.onFetch(elements)
      expect(mockGet).toHaveBeenCalledTimes(2) // time, 1 automation, ticket_field, custom_field
      expect(elements).toHaveLength(3)
      expect(elements.filter(e => e.elemID.typeName === AUTOMATION_TYPE_NAME)
        .filter(e => e.annotations[CORE_ANNOTATIONS.CHANGED_BY] === undefined)).toHaveLength(1)
    })
    it('should set changed_by as undefined if res for getUpdatedByID is undefined', async () => {
      const newTicketField = ticketFieldInstance.clone()
      newTicketField.annotations[CORE_ANNOTATIONS.CHANGED_BY] = 'TEST'
      filter = filterCreator(createFilterCreatorParams({
        client,
        config: {
          ...DEFAULT_CONFIG,
          [FETCH_CONFIG]: {
            include: [{
              type: '.*',
            }],
            exclude: [],
            guide: {
              brands: ['.*'],
            },
            includeAuditDetails: true,
          },
        },
        paginator: mockPaginator,
        elementsSource: buildElementsSourceFromElements([auditTimeInstance, auditTimeType, newTicketField]),
      })) as FilterType
      mockGet.mockImplementation(params => {
        if (params.url === '/api/v2/audit_logs' && params.queryParams['filter[source_id]'] !== undefined) {
          return {
            status: 200,
            data: {
              audit_logs: [],
            },
          }
        }
        return {
          status: 200,
          data: {
            audit_logs: [
              {
                created_at: AFTER_TIME,
                actor_name: 'NOT IMPORTANT',
              },
            ],
          },
        }
      })
      getIdByNameMock
        .mockResolvedValue({ 11: 'new user', 21: 'b', 31: 'c' },)
      const elements = [ticketFieldInstance].map(e => e.clone()).map(e => {
        e.value.updated_at = BETWEEN_TIME
        return e
      })
      await filter.onFetch(elements)
      expect(mockGet).toHaveBeenCalledTimes(2) // time, ticket_field
      expect(elements).toHaveLength(3)
      expect(elements.filter(e => e.elemID.typeName === TICKET_FIELD_TYPE_NAME)
        .filter(e => e.annotations[CORE_ANNOTATIONS.CHANGED_BY] === undefined)).toHaveLength(1)
    })
    it('should set changed_by to undefined if changed_at is after audit_time', async () => {
      const newTicketField = ticketFieldInstance.clone()
      newTicketField.annotations[CORE_ANNOTATIONS.CHANGED_BY] = 'TEST'
      filter = filterCreator(createFilterCreatorParams({
        client,
        config: {
          ...DEFAULT_CONFIG,
          [FETCH_CONFIG]: {
            include: [{
              type: '.*',
            }],
            exclude: [],
            guide: {
              brands: ['.*'],
            },
            includeAuditDetails: true,
          },
        },
        paginator: mockPaginator,
        elementsSource: buildElementsSourceFromElements([auditTimeInstance, auditTimeType, newTicketField]),
      })) as FilterType
      mockGet.mockImplementation(params => {
        if (params.url === '/api/v2/audit_logs' && params.queryParams['filter[source_id]'] !== undefined) {
          return {
            status: 200,
            data: {
              audit_logs: [],
            },
          }
        }
        return {
          status: 200,
          data: {
            audit_logs: [
              {
                created_at: AFTER_TIME,
                actor_name: 'NOT IMPORTANT',
              },
            ],
          },
        }
      })
      getIdByNameMock
        .mockResolvedValue({ 11: 'new user', 21: 'b', 31: 'c' },)
      const elements = [ticketFieldInstance].map(e => e.clone()).map(e => {
        e.value.updated_at = AFTER_AFTER_TIME
        return e
      })
      await filter.onFetch(elements)
      expect(mockGet).toHaveBeenCalledTimes(1) // time
      expect(elements).toHaveLength(3)
      expect(elements.filter(e => e.elemID.typeName === TICKET_FIELD_TYPE_NAME)
        .filter(e => e.annotations[CORE_ANNOTATIONS.CHANGED_BY] === undefined)).toHaveLength(1)
    })
    it('should add changed_by from elements source', async () => {
      const rawElements = [automationInstance, articleTranslationInstance]
        .map(e => e.clone())
        .map(e => {
          e.annotations[CORE_ANNOTATIONS.CHANGED_BY] = 'new user'
          return e
        })
      filter = filterCreator(createFilterCreatorParams({
        client,
        config: {
          ...DEFAULT_CONFIG,
          [FETCH_CONFIG]: {
            include: [{
              type: '.*',
            }],
            exclude: [],
            guide: {
              brands: ['.*'],
            },
            includeAuditDetails: true,
          },
        },
        paginator: mockPaginator,
        elementsSource: buildElementsSourceFromElements(
          [auditTimeInstance, auditTimeType, ...rawElements]
        ),
      })) as FilterType
      mockGet.mockImplementation(params => {
        if (params.url === '/api/v2/audit_logs') {
          return {
            status: 200,
            data: {
              audit_logs: [
                {
                  created_at: AFTER_TIME,
                  actor_name: 'NOT IMPORTANT',
                },
              ],
            },
          }
        }
        throw new Error('Err')
      })
      const elements = rawElements.map(e => e.clone())

      await filter.onFetch(elements)
      expect(mockGet).toHaveBeenCalledTimes(1) // time, 1 automation, ticket_field, custom_field
      expect(elements).toHaveLength(4)
      // automation and translation
      expect(elements.filter(e => e.elemID.typeName !== AUDIT_TIME_TYPE_NAME)
        .filter(e => e.annotations[CORE_ANNOTATIONS.CHANGED_BY] === 'new user')).toHaveLength(2)
    })
    it('should add deleted_user for translation with an undefined user', async () => {
      filter = filterCreator(createFilterCreatorParams({
        client,
        config: {
          ...DEFAULT_CONFIG,
          [FETCH_CONFIG]: {
            include: [{
              type: '.*',
            }],
            exclude: [],
            guide: {
              brands: ['.*'],
            },
            includeAuditDetails: true,
          },
        },
        paginator: mockPaginator,
        elementsSource: buildElementsSourceFromElements(
          [auditTimeInstance, auditTimeType, articleTranslationInstance]
        ),
      })) as FilterType
      mockGet.mockImplementation(params => {
        if (params.url === '/api/v2/audit_logs') {
          return {
            status: 200,
            data: {
              audit_logs: [
                {
                  created_at: AFTER_TIME,
                  actor_name: 'NOT IMPORTANT',
                },
              ],
            },
          }
        }
        throw new Error('Err')
      })
      getIdByNameMock
        .mockResolvedValue({ 21: 'b', 31: 'c' },)
      const elements = [articleTranslationInstance].map(e => e.clone())
        .map(e => {
          e.value.updated_at = BETWEEN_TIME
          return e
        })

      await filter.onFetch(elements)
      expect(mockGet).toHaveBeenCalledTimes(1) // time
      expect(elements).toHaveLength(3)
      // automation and translation
      expect(elements.filter(e => e.elemID.typeName === ARTICLE_TRANSLATION_TYPE_NAME)
        .filter(e => e.annotations[CORE_ANNOTATIONS.CHANGED_BY] === DELETED_USER)).toHaveLength(1)
    })
  })
})
