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
import { BuiltinTypes, ElemID, Field, InstanceElement, isMapType, ListType, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { mockClient } from '../utils'
import mapListsFilter from '../../src/filters/map_lists'
import { Filter } from '../../src/filter'
import { DEFAULT_CONFIG } from '../../src/config'
import { JIRA } from '../../src/constants'

describe('mapListsFilter', () => {
  let filter: Filter
  let type: ObjectType
  beforeEach(async () => {
    const { client, paginator } = mockClient()

    filter = mapListsFilter({
      client,
      paginator,
      config: DEFAULT_CONFIG,
      elementsSource: buildElementsSourceFromElements([]),
      fetchQuery: elementUtils.query.createMockQuery(),
    })

    type = new ObjectType({
      elemID: new ElemID(JIRA, 'FieldConfiguration'),
      fields: {
        fields: { refType: new ListType(BuiltinTypes.STRING) },
      },
    })
  })

  describe('onFetch', () => {
    it('should change the field in type to map', async () => {
      await filter.onFetch?.([type])
      expect(isMapType(await type.fields.fields.getType())).toBeTruthy()
    })

    it('if field does not exists on type should do nothing', async () => {
      delete type.fields.fields
      await filter.onFetch?.([type])
      expect(type.fields).toEqual({})
    })

    it('if field is not a list should do nothing', async () => {
      type.fields.fields = new Field(
        type,
        'fields',
        BuiltinTypes.STRING,
      )
      await filter.onFetch?.([type])
      expect(isMapType(await type.fields.fields.getType())).toBeFalsy()
    })

    it('should change the value in instance to map', async () => {
      const instance = new InstanceElement(
        'instance',
        type,
        {
          fields: [
            {
              id: new ReferenceExpression(new ElemID(JIRA, 'Field', 'instance', 'name1')),
            },
            {
              id: new ReferenceExpression(new ElemID(JIRA, 'Field', 'instance', 'name2')),
            },
          ],
        }
      )
      await filter.onFetch?.([instance])
      expect(instance.value).toEqual({
        fields: {
          name1: {
            id: new ReferenceExpression(new ElemID(JIRA, 'Field', 'instance', 'name1')),
          },
          name2: {
            id: new ReferenceExpression(new ElemID(JIRA, 'Field', 'instance', 'name2')),
          },
        },
      })
    })

    it('if value in instance is not a list should do nothing', async () => {
      const instance = new InstanceElement(
        'instance',
        type,
        {
          fields: 'string',
        }
      )
      await filter.onFetch?.([instance])
      expect(instance.value).toEqual({
        fields: 'string',
      })
    })
  })
})
