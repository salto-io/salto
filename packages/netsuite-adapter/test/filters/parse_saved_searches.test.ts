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
import { AdditionChange, ElemID, InstanceElement, isObjectType, ObjectType, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import filterCreator from '../../src/filters/parse_saved_searchs'
import { savedsearchType } from '../../src/autogen/types/standard_types/savedsearch'
import NetsuiteClient from '../../src/client/client'
import { NETSUITE, SAVED_SEARCH } from '../../src/constants'
import { FilterOpts } from '../../src/filter'
import { createEmptyElementsSourceIndexes, getDefaultAdapterConfig } from '../utils'

jest.mock('../../src/saved_search_parsing/saved_search_parser', () => ({
  parseDefinition: jest.fn().mockResolvedValue({
    test: 'test',
  }),
}))

describe('parse_saved_searches filter', () => {
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

    const savedsearch = savedsearchType().type
    instance = new InstanceElement(
      'someSearch',
      savedsearch,
      {}
    )
    sourceInstance = new InstanceElement(
      'someSearch',
      savedsearch,
      {}
    )
    sourceInstance.value.definition = 'testDefinition'
  })
  it('test onFetch removes old saved search object type', async () => {
    const savedSearchObject = new ObjectType({ elemID: new ElemID('netsuite', SAVED_SEARCH), fields: {} })
    const elements = [savedSearchObject]
    await filterCreator(fetchOpts).onFetch?.(elements)
    expect(elements.filter(isObjectType)
      .filter(e => e.elemID.typeName === SAVED_SEARCH))
      .not.toEqual(savedSearchObject)
  })
  it('test onFetch removes doubled dependency object type', async () => {
    const dependencyObjectType = new ObjectType({ elemID: new ElemID(NETSUITE, 'savedsearch_dependencies'),
      fields: {} })
    const elements = [dependencyObjectType]
    await filterCreator(fetchOpts).onFetch?.(elements)
    expect(elements.filter(isObjectType)
      .filter(e => e.elemID.typeName === SAVED_SEARCH))
      .not.toEqual(dependencyObjectType)
  })
  it('test onFetch adds definition values', async () => {
    await filterCreator(fetchOpts).onFetch?.([instance])
    expect(instance.value.test).toEqual('test')
  })
  it('test onFetch keeps old definition', async () => {
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
    expect(instance.value.definition).toEqual('testDefinition')
  })
  it('test preDeploy removes values', async () => {
    instance.value.test = 'toBeRemoved'
    const change = toChange({ after: instance }) as AdditionChange<InstanceElement>
    expect(change.data.after.value.test).toEqual('toBeRemoved')
    await filterCreator(fetchOpts).preDeploy?.([change])
    expect(change.data.after.value.test).toBeUndefined()
  })
})
