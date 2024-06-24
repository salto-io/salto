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
import { ObjectType, ElemID, InstanceElement, Element, ReferenceExpression, BuiltinTypes } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { SUPPORTED_TYPES } from '../../src/config'
import ZuoraClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import {
  ZUORA_BILLING,
  TASK_TYPE,
  STANDARD_OBJECT,
  METADATA_TYPE,
  SETTINGS_TYPE_PREFIX,
  OBJECT_TYPE,
} from '../../src/constants'
import filterCreator from '../../src/filters/object_references'

/* eslint-disable camelcase */

describe('object references filter', () => {
  let client: ZuoraClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  const generateElements = (): Element[] => {
    const taskType = new ObjectType({
      elemID: new ElemID(ZUORA_BILLING, TASK_TYPE),
    })

    const task1 = new InstanceElement('task1', taskType, {
      id: 13,
      name: 'do one thing',
      action_type: 'Export',
      object: 'account',
      call_type: 'SOAP',
    })
    const task2 = new InstanceElement('task2', taskType, {
      id: 23,
      name: 'do one more thing',
      object: 'invalid',
      call_type: 'SOAP',
    })

    const task3 = new InstanceElement('task3', taskType, {
      id: 23,
      name: 'do one more thing',
      call_type: 'SOAP',
    })

    const segmentType = new ObjectType({
      elemID: new ElemID(ZUORA_BILLING, `${SETTINGS_TYPE_PREFIX}Segment`),
    })

    const segment1 = new InstanceElement('segment1', segmentType, {
      object: 'account',
      field: 'Id',
    })

    const segment2 = new InstanceElement('segment2', segmentType, {
      object: 'account',
      field: 'notId',
    })

    const segment3 = new InstanceElement('segment3', segmentType, {
      object: 'account',
    })

    const standardObjects = [
      new ObjectType({
        elemID: new ElemID(ZUORA_BILLING, 'account'),
        fields: {
          Id: { refType: BuiltinTypes.STRING },
        },
        annotations: {
          [METADATA_TYPE]: STANDARD_OBJECT,
          [OBJECT_TYPE]: 'account',
        },
      }),
    ]

    return [taskType, task1, task2, task3, segmentType, segment1, segment2, segment3, ...standardObjects]
  }

  beforeAll(() => {
    client = new ZuoraClient({
      credentials: { baseURL: 'http://localhost', clientId: 'id', clientSecret: 'secret' },
    })
    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFuncCreator: paginate,
      }),
      config: {
        fetch: {
          include: [],
          exclude: [],
        },
        apiDefinitions: {
          swagger: { url: 'ignore' },
          typeDefaults: {
            transformation: {
              idFields: ['name'],
            },
          },
          types: {},
          supportedTypes: SUPPORTED_TYPES,
        },
      },
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as FilterType
  })

  describe('object references', () => {
    let origElements: Element[]
    let elements: Element[]
    beforeAll(async () => {
      origElements = generateElements()
      elements = generateElements()
      await filter.onFetch(elements)
    })
    it('should add references', () => {
      expect(elements).not.toEqual(origElements)
      expect(elements.length).toEqual(origElements.length)

      const task1 = elements.find(e => e.elemID.name === 'task1') as InstanceElement
      expect(task1.value.object).toBeInstanceOf(ReferenceExpression)
      expect(task1.value.object.elemID.getFullName()).toEqual('zuora_billing.account')

      const segment1 = elements.find(e => e.elemID.name === 'segment1') as InstanceElement
      expect(segment1.value.object).toBeInstanceOf(ReferenceExpression)
      expect(segment1.value.field).toBeInstanceOf(ReferenceExpression)
      expect(segment1.value.object.elemID.getFullName()).toEqual('zuora_billing.account')
      expect(segment1.value.field.elemID.getFullName()).toEqual('zuora_billing.account.field.Id')
    })
    it("shouldn't add references if invalid", () => {
      const task2 = elements.find(e => e.elemID.name === 'task2') as InstanceElement
      expect(task2.value.object).toEqual('invalid')

      const segment2 = elements.find(e => e.elemID.name === 'segment2') as InstanceElement
      expect(segment2.value.object).toBeInstanceOf(ReferenceExpression)
      expect(segment2.value.object.elemID.getFullName()).toEqual('zuora_billing.account')
      expect(segment2.value.field).toEqual('notId')
    })
  })
  it('should return without doing nothing when there are no instances', async () => {
    const origElements = generateElements().filter(e => e.elemID.idType !== 'instance')
    const elements = generateElements().filter(e => e.elemID.idType !== 'instance')
    await filter.onFetch(elements)
    expect(elements).toEqual(origElements)
  })
})
