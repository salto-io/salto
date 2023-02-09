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
import ZendeskClient from '../../src/client/client'
import filterCreator from '../../src/filters/custom_statuses'
import { createFilterCreatorParams } from '../utils'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'
import { getIdByEmail } from '../../src/user_utils'
import {
  ARTICLE_TRANSLATION_TYPE_NAME,
  AUDIT_TIME_TYPE_NAME,
  AUTOMATION_TYPE_NAME,
  TICKET_FIELD_CUSTOM_FIELD_OPTION,
  TICKET_FIELD_TYPE_NAME,
  ZENDESK,
} from '../../src/constants'
import { AUDIT_TIME_TYPE_ID } from '../../src/filters/audit_logs'

const CURRENT_TIME = '2023-02-08T06:34:53Z'
jest.mock('../../src/user_utils', () => ({
  ...jest.requireActual<{}>('../../src/user_utils'),
  getIdByEmail: jest.fn(),
}))

describe('audit_logs filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'deploy'>
  let filter: FilterType
  let getIdByEmailMock: jest.MockedFunction<typeof getIdByEmail>
  let mockPut: jest.SpyInstance
  let mockPaginator: clientUtils.Paginator

  const createInstance = ({
    type, id, updatedAt, updatedBy, parent,
  }:{
    type: ObjectType
    id: number
    updatedAt: string
    updatedBy?: string
    parent?: InstanceElement
  }): InstanceElement =>
    new InstanceElement(
      `test_${id}`,
      type,
      {
        id,
        updated_at: updatedAt,
        // eslint-disable-next-line camelcase
        updated_by: updatedBy || undefined,
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

  const automationInstance = createInstance({ type: automationType, id: 1, updatedAt: '1' })
  const ticketFieldInstance = createInstance({ type: ticketFieldType, id: 2, updatedAt: '1' })
  const ticketFieldCustomOptionInstance = createInstance({ type: ticketFieldCustomOptionType, id: 3, updatedAt: '1', parent: ticketFieldInstance })
  const articleTranslationInstance = createInstance({ type: articleTranslationType, id: 4, updatedAt: '1' })


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
    getIdByEmailMock = getIdByEmail as jest.MockedFunction<typeof getIdByEmail>
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
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
          enableAudit: true,
        },
      },
    })) as FilterType
  })
  describe('onFetch', () => {
    it('should only add changed_at when flag is false', async () => {
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
            enableAudit: true,
          },
        },
      })) as FilterType
    })
    it('should do nothing if there is no updated_at in the instance', async () => {

    })
    it('should only add changed_by for translation when flag is true and it is fist fetch', async () => {

    })
    it('should add changed_at and change_by when flag is true and it is second fetch', async () => {

    })
    it('should do nothing if last audit time is undefined', async () => {
      // no res (400) + res is not valid
    })
    it('should do nothing if getUpdatedByID is undefined', async () => {
      // no res (400) + res is not valid
    })
    it('should not add changed_by for instances that are not supported in audit', async () => {
      // isBefore == true
    })
  })
})
