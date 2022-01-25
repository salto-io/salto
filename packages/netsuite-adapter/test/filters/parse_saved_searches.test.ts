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
import { customTypes } from '../../src/types'
import NetsuiteClient from '../../src/client/client'
import { SAVED_SEARCH } from '../../src/constants'
import { savedSearchDependenciesElemID } from '../../src/saved_search_parsing/parsed_saved_search'

jest.mock('../../src/saved_search_parsing/saved_search_parser', () => ({
  parseDefinition: jest.fn().mockResolvedValue({
    test: 'test',
  }),
}))

describe('parse_saved_searches filter', () => {
  let instance: InstanceElement
  let sourceInstance: InstanceElement
  let fetchOpts = {
    client: {} as NetsuiteClient,
    elementsSourceIndex: {
      getIndexes: () => Promise.resolve({
        serviceIdsIndex: {},
        internalIdsIndex: {},
        customFieldsIndex: {},
      }),
    },
    elementsSource: buildElementsSourceFromElements([]),
    isPartial: false,
    dataTypeNames: new Set<string>(),
  }
  beforeEach(() => {
    instance = new InstanceElement(
      'someSearch',
      customTypes[SAVED_SEARCH],
      {}
    )
    sourceInstance = new InstanceElement(
      'someSearch',
      customTypes[SAVED_SEARCH],
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
    const dependencyObjectType = new ObjectType({ elemID: savedSearchDependenciesElemID,
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
        getIndexes: () => Promise.resolve({
          serviceIdsIndex: {},
          internalIdsIndex: {},
          customFieldsIndex: {},
        }),
      },
      elementsSource: buildElementsSourceFromElements([sourceInstance]),
      isPartial: false,
      dataTypeNames: new Set<string>(),
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
