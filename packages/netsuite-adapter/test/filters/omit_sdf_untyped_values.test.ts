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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { LazyElementsSourceIndexes } from '../../src/elements_source_index/types'
import { getDefaultAdapterConfig } from '../utils'
import { NETSUITE, WORKFLOW } from '../../src/constants'
import filterCreator from '../../src/filters/omit_sdf_untyped_values'
import { LocalFilterOpts } from '../../src/filter'
import { emptyQueryParams, fullQueryParams } from '../../src/config/config_creator'

describe('omit sdf untyped values filter', () => {
  let instance: InstanceElement
  let defaultOpts: LocalFilterOpts
  beforeEach(async () => {
    instance = new InstanceElement(
      'test',
      new ObjectType({
        elemID: new ElemID(NETSUITE, WORKFLOW),
        fields: { someField: { refType: BuiltinTypes.BOOLEAN } },
        annotations: {
          [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
        },
      }),
      {
        someField: true,
        untypedField: 'test',
      },
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
      config: {
        fetch: {
          include: fullQueryParams(),
          exclude: emptyQueryParams(),
          strictInstanceStructure: true,
        },
      },
    }).onFetch?.([instance])
    expect(instance.value).toEqual({ someField: true })
  })
  it('should not omit untyped values when enable=false', async () => {
    await filterCreator({
      ...defaultOpts,
      config: {
        fetch: {
          include: fullQueryParams(),
          exclude: emptyQueryParams(),
          strictInstanceStructure: false,
        },
      },
    }).onFetch?.([instance])
    expect(instance.value).toEqual({ someField: true, untypedField: 'test' })
  })
})
