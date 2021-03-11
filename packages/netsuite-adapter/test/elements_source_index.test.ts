/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { ElemID, InstanceElement, ObjectType, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { LAST_FETCH_TIME, NETSUITE, PATH } from '../src/constants'
import { createElementsSourceIndex } from '../src/elements_source_index/elements_source_index'


describe('createElementsSourceIndex', () => {
  const getAllMock = jest.fn()
  const elementsSource = {
    getAll: getAllMock,
  } as unknown as ReadOnlyElementsSource

  beforeEach(() => {
    getAllMock.mockReset()
    getAllMock.mockImplementation(buildElementsSourceFromElements([]).getAll)
  })
  it('should create the index only once and cache it', async () => {
    const elementsSourceIndex = createElementsSourceIndex(elementsSource)
    const index = await elementsSourceIndex.getIndex()
    const anotherIndex = await elementsSourceIndex.getIndex()
    expect(index).toBe(anotherIndex)
    expect(getAllMock).toHaveBeenCalledTimes(1)
  })

  it('should create the right index', async () => {
    getAllMock.mockImplementation(buildElementsSourceFromElements([
      new InstanceElement(
        'name',
        new ObjectType({ elemID: new ElemID(NETSUITE, 'someType') }),
        { [PATH]: 'path', [LAST_FETCH_TIME]: '2021-02-22T18:55:17.949Z' },
        [],
      ),
    ]).getAll)

    const elementsSourceIndex = createElementsSourceIndex(elementsSource)
    const index = await elementsSourceIndex.getIndex()
    expect(index.path).toEqual({ lastFetchTime: new Date('2021-02-22T18:55:17.949Z'), elemID: new ElemID(NETSUITE, 'someType', 'instance', 'name', PATH) })
  })
})
