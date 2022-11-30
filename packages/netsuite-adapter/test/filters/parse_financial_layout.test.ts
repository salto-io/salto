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

import { ElemID, InstanceElement, isObjectType, ObjectType, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { FINANCIAL_LAYOUT, NETSUITE } from '../../src/constants'
import { createEmptyElementsSourceIndexes, getDefaultAdapterConfig } from '../utils'
import { FilterOpts } from '../../src/filter'
import NetsuiteClient from '../../src/client/client'
import { financiallayoutType } from '../../src/autogen/types/standard_types/financiallayout'
import filterCreator from '../../src/filters/parse_financial_layout'

jest.mock('../../src/financial_layout_parsing/financial_layout_parser', () => ({
  parseDefinition: jest.fn().mockReturnValue({
    test: 'test',
  }),
}))

describe('parse financial layout filter tests', () => {
  let instance: InstanceElement
  let sourceInstance: InstanceElement
  let fetchOpts: FilterOpts
  beforeEach(async () => {
    fetchOpts = {
      client: {} as NetsuiteClient,
      elementsSourceIndex: {
        getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
      },
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
    }

    const financiallayout = financiallayoutType().type
    instance = new InstanceElement(
      'testLayout',
      financiallayout,
      {}
    )
    sourceInstance = new InstanceElement(
      'testLayout',
      financiallayout,
      {}
    )
    sourceInstance.value.layout = 'testLayout'
  })
  it('should remove old financial layout object type', async () => {
    const financialLayoutObject = new ObjectType({ elemID: new ElemID('netsuite', FINANCIAL_LAYOUT), fields: {} })
    const elements = [financialLayoutObject]
    await filterCreator(fetchOpts).onFetch?.(elements)
    expect(elements.filter(isObjectType)
      .filter(e => e.elemID.typeName === FINANCIAL_LAYOUT))
      .not.toEqual(financialLayoutObject)
  })
  it('should remove doubled dependency object type', async () => {
    const dependencyObjectType = new ObjectType({ elemID: new ElemID(NETSUITE, 'financiallayout_dependencies'),
      fields: {} })
    const elements = [dependencyObjectType]
    await filterCreator(fetchOpts).onFetch?.(elements)
    expect(elements.filter(isObjectType)
      .filter(e => e.elemID.typeName === FINANCIAL_LAYOUT))
      .not.toEqual(dependencyObjectType)
  })
  it('should add definition values', async () => {
    await filterCreator(fetchOpts).onFetch?.([instance])
    expect(instance.value.test).toEqual('test')
  })
  it('should keep old definition', async () => {
    fetchOpts = {
      client: {} as NetsuiteClient,
      elementsSourceIndex: {
        getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
      },
      elementsSource: buildElementsSourceFromElements([sourceInstance]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
    }
    await filterCreator(fetchOpts).onFetch?.([instance])
    expect(instance.value.layout).toEqual('testLayout')
  })
  it('should remove fields on predeploy', async () => {
    instance.value.test = 'removeMe'
    await filterCreator(fetchOpts).preDeploy?.([toChange({ after: instance })])
    expect(instance.value.test).toBeUndefined()
  })
})
