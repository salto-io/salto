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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import NetsuiteClient from '../../src/client/client'
import { LazyElementsSourceIndexes } from '../../src/elements_source_index/types'
import { getDefaultAdapterConfig } from '../utils'
import { NETSUITE } from '../../src/constants'
import filterCreator from '../../src/filters/omit_fields'
import { FilterOpts } from '../../src/filter'

describe('omit fields filter', () => {
  let type: ObjectType
  let innerType: ObjectType
  let instance: InstanceElement
  let defaultOpts: FilterOpts
  beforeEach(async () => {
    innerType = new ObjectType({ elemID: new ElemID(NETSUITE, 'innerType') })
    type = new ObjectType({
      elemID: new ElemID(NETSUITE, 'someType'),
      fields: {
        field1: { refType: BuiltinTypes.BOOLEAN },
        field2: { refType: innerType },
      },
    })
    instance = new InstanceElement('test', type, {
      field1: true,
      field2: { nested1: 'test', nested2: 'test2' },
    })
    defaultOpts = {
      client: {} as NetsuiteClient,
      elementsSourceIndex: {} as LazyElementsSourceIndexes,
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
    }
  })
  it('should not omit fields by default', async () => {
    await filterCreator(defaultOpts).onFetch?.([instance])
    expect(instance.value).toEqual({
      field1: true,
      field2: { nested1: 'test', nested2: 'test2' },
    })
  })
  it('should not omit when no rule matches', async () => {
    await filterCreator({
      ...defaultOpts,
      config: { fetch: { fieldsToOmit: [{ type: 'notSome.*', fields: ['.*'] }] } },
    }).onFetch?.([instance, type, innerType])
    expect(instance.value).toEqual({
      field1: true,
      field2: { nested1: 'test', nested2: 'test2' },
    })
  })
  it('should omit fields in top level element', async () => {
    await filterCreator({
      ...defaultOpts,
      config: { fetch: { fieldsToOmit: [{ type: 'some.*', fields: ['.*2'] }] } },
    }).onFetch?.([instance, type, innerType])
    expect(instance.value).toEqual({ field1: true })
  })
  it('should omit fields in inner type', async () => {
    await filterCreator({
      ...defaultOpts,
      config: { fetch: { fieldsToOmit: [{ type: 'inner.*', fields: ['.*2'] }] } },
    }).onFetch?.([instance, type, innerType])
    expect(instance.value).toEqual({
      field1: true,
      field2: { nested1: 'test' },
    })
  })
})
