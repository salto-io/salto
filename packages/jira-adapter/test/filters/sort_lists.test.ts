/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { BuiltinTypes, ElemID, InstanceElement, ListType, ObjectType, ReferenceExpression, Values } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { mockClient } from '../utils'
import sortListsFilter from '../../src/filters/sort_lists'
import { Filter } from '../../src/filter'
import { DEFAULT_CONFIG } from '../../src/config'
import { JIRA } from '../../src/constants'

describe('sortListsFilter', () => {
  let filter: Filter
  let permissionSchemeType: ObjectType
  let instance: InstanceElement
  let sortedValues: Values
  beforeEach(async () => {
    const { client, paginator } = mockClient()

    filter = sortListsFilter({
      client,
      paginator,
      config: DEFAULT_CONFIG,
      elementsSource: buildElementsSourceFromElements([]),
      fetchQuery: elementUtils.query.createMockQuery(),
    })

    permissionSchemeType = new ObjectType({
      elemID: new ElemID(JIRA, 'PermissionScheme'),
      fields: {
        permissions: { refType: new ListType(BuiltinTypes.UNKNOWN) },
      },
    })

    instance = new InstanceElement(
      'instance',
      permissionSchemeType,
      {
        permissions: [
          {
            permission: 'A',
          },
          {
            permission: 'A',
            holder: {
              type: 'B',
            },
          },
          {
            permission: 'A',
            holder: {
              type: 'A',
            },
          },
          {
            permission: 'C',
            holder: {
              type: 'A',
              parameter: new ReferenceExpression(new ElemID(JIRA, 'B')),
            },
          },
          {
            permission: 'C',
            holder: {
              type: 'A',
              parameter: new ReferenceExpression(new ElemID(JIRA, 'A')),
            },
          },
          {
            permission: 'B',
          },
        ],
      }
    )

    sortedValues = {
      permissions: [
        {
          permission: 'A',
          holder: {
            type: 'A',
          },
        },
        {
          permission: 'A',
          holder: {
            type: 'B',
          },
        },
        {
          permission: 'A',
        },
        {
          permission: 'B',
        },
        {
          permission: 'C',
          holder: {
            type: 'A',
            parameter: new ReferenceExpression(new ElemID(JIRA, 'A')),
          },
        },
        {
          permission: 'C',
          holder: {
            type: 'A',
            parameter: new ReferenceExpression(new ElemID(JIRA, 'B')),
          },
        },
      ],
    }
  })

  describe('onFetch', () => {
    it('should sort the permissions', async () => {
      await filter.onFetch?.([instance])
      expect(instance.value).toEqual(sortedValues)
    })

    it('should do nothing when field is undefined', async () => {
      delete instance.value.permissions
      await filter.onFetch?.([instance])
      expect(instance.value).toEqual({})
    })

    it('should sort inner lists', async () => {
      const type = new ObjectType({
        elemID: new ElemID(JIRA, 'someType'),
        fields: {
          schemes: {
            refType: new ListType(permissionSchemeType),
          },
        },
      })

      const inst = new InstanceElement(
        'instance',
        type,
        {
          schemes: [
            {
              permissions: [
                {
                  permission: 'B',
                },
                {
                  permission: 'A',
                },
              ],
            },
          ],
        }
      )

      await filter.onFetch?.([inst])
      expect(inst.value).toEqual({
        schemes: [
          {
            permissions: [
              {
                permission: 'A',
              },
              {
                permission: 'B',
              },
            ],
          },
        ],
      })
    })
  })
})
