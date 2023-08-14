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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { LazyElementsSourceIndexes } from '../../src/elements_source_index/types'
import { getDefaultAdapterConfig } from '../utils'
import { NETSUITE, WORKFLOW } from '../../src/constants'
import filterCreator from '../../src/filters/omit_sdf_untyped_values'
import { LocalFilterOpts } from '../../src/filter'

describe('omit sdf untyped values filter', () => {
  let instance: InstanceElement
  let defaultOpts: LocalFilterOpts
  beforeEach(async () => {
    instance = new InstanceElement(
      'test',
      new ObjectType({
        elemID: new ElemID(NETSUITE, WORKFLOW),
        fields: { someField: { refType: BuiltinTypes.BOOLEAN } },
      }),
      {
        someField: true,
        untypedField: 'test',
      }
    )
    defaultOpts = {
      elementsSourceIndex: {} as LazyElementsSourceIndexes,
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
    }
  })
  it('should not omit untyped values by default', async () => {
    await filterCreator(defaultOpts).onFetch?.([instance])
    expect(instance.value).toEqual({ someField: true, untypedField: 'test' })
  })
  it('should omit untyped values when enable=true', async () => {
    await filterCreator({
      ...defaultOpts,
      config: { fetch: {
        include: { types: [{ name: '.*' }], fileCabinet: ['.*'] },
        exclude: { types: [], fileCabinet: [] },
        strictInstanceStructure: true,
      } },
    }).onFetch?.([instance])
    expect(instance.value).toEqual({ someField: true })
  })
  it('should not omit untyped values when enable=false', async () => {
    await filterCreator({
      ...defaultOpts,
      config: { fetch: {
        include: { types: [{ name: '.*' }], fileCabinet: ['.*'] },
        exclude: { types: [], fileCabinet: [] },
        strictInstanceStructure: false,
      } },
    }).onFetch?.([instance])
    expect(instance.value).toEqual({ someField: true, untypedField: 'test' })
  })
})
