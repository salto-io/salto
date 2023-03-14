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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { getFileCabinetTypes } from '../src/types/file_cabinet_types'
import { entitycustomfieldType } from '../src/autogen/types/standard_types/entitycustomfield'
import { CUSTOM_RECORD_TYPE, INTERNAL_ID, METADATA_TYPE, NETSUITE, SCRIPT_ID } from '../src/constants'
import { createElementsSourceIndex } from '../src/elements_source_index/elements_source_index'

describe('createElementsSourceIndex', () => {
  const getAllMock = jest.fn()
  const getMock = jest.fn()
  const elementsSource = {
    getAll: getAllMock,
    get: getMock,
  } as unknown as ReadOnlyElementsSource
  const entitycustomfield = entitycustomfieldType().type

  const { file, folder } = getFileCabinetTypes()

  beforeEach(() => {
    getAllMock.mockReset()
    getMock.mockReset()
    getAllMock.mockImplementation(buildElementsSourceFromElements([]).getAll)
  })
  it('should create the index only once and cache it', async () => {
    const elementsSourceIndex = createElementsSourceIndex(elementsSource)
    const index = await elementsSourceIndex.getIndexes()
    const anotherIndex = await elementsSourceIndex.getIndexes()
    expect(index).toBe(anotherIndex)
    expect(getAllMock).toHaveBeenCalledTimes(1)
  })
  it('should create the right internal ids index', async () => {
    const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'someType') })
    getMock.mockImplementation(buildElementsSourceFromElements([
      type,
    ]).get)
    getAllMock.mockImplementation(buildElementsSourceFromElements([
      new InstanceElement(
        'name',
        type,
        { internalId: '4' },
      ),
      new InstanceElement(
        'name2',
        type,
        { internalId: '5', isSubInstance: true },
      ),
      type,
      new ObjectType({
        elemID: new ElemID(NETSUITE, 'customrecord1'),
        annotations: {
          [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
          [SCRIPT_ID]: 'customrecord1',
          [INTERNAL_ID]: '2',
        },
      }),
    ]).getAll)

    const elementsSourceIndex = createElementsSourceIndex(elementsSource)
    const index = (await elementsSourceIndex.getIndexes()).internalIdsIndex
    expect(index).toEqual({
      'someType-4': new ElemID(NETSUITE, 'someType', 'instance', 'name'),
      'customrecordtype-2': new ElemID(NETSUITE, 'customrecord1'),
      '-123-2': new ElemID(NETSUITE, 'customrecord1'),
    })
  })

  it('should create the right custom fields index', async () => {
    const instance1 = new InstanceElement('name1', entitycustomfield, { appliestocontact: true, appliestocustomer: false, appliestoemployee: true })
    const instance2 = new InstanceElement('name2', entitycustomfield, { appliestocontact: true, appliestocustomer: false, appliestoemployee: false })
    getAllMock.mockImplementation(buildElementsSourceFromElements([
      instance1,
      instance2,
    ]).getAll)

    const elementsSourceIndex = createElementsSourceIndex(elementsSource)
    const index = (await elementsSourceIndex.getIndexes()).customFieldsIndex
    expect(index.Contact.map(e => e.elemID.getFullName())).toEqual([instance1, instance2]
      .map(e => e.elemID.getFullName()))

    expect(index.Employee.map(e => e.elemID.getFullName()))
      .toEqual([instance1.elemID.getFullName()])
  })

  it('should create the right pathToInternalIds index', async () => {
    const folderInstance = new InstanceElement('folder1', folder, { path: '/folder1', internalId: 0 })
    const fileInstance = new InstanceElement('file1', file, { path: '/folder1/file1', internalId: 1 })
    getAllMock.mockImplementation(buildElementsSourceFromElements([
      folderInstance,
      fileInstance,
    ]).getAll)

    expect((await createElementsSourceIndex(elementsSource).getIndexes()).pathToInternalIdsIndex)
      .toEqual({
        '/folder1': 0,
        '/folder1/file1': 1,
      })
  })

  it('should create the right elemIdToChangeByIndex index', async () => {
    const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'someType') })
    getAllMock.mockImplementation(buildElementsSourceFromElements([
      new InstanceElement(
        'inst',
        type,
        {},
        undefined,
        { [CORE_ANNOTATIONS.CHANGED_BY]: 'user name' }
      ),
      new ObjectType({
        elemID: new ElemID(NETSUITE, 'customrecord1'),
        annotations: {
          [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
          [CORE_ANNOTATIONS.CHANGED_BY]: 'user name2',
        },
      }),
    ]).getAll)

    expect((await createElementsSourceIndex(elementsSource).getIndexes()).elemIdToChangeByIndex)
      .toEqual({
        'netsuite.someType.instance.inst': 'user name',
        'netsuite.customrecord1': 'user name2',
      })
  })
  it('should create the right elemIdToChangeAtIndex index', async () => {
    const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'someType') })
    getAllMock.mockImplementation(buildElementsSourceFromElements([
      new InstanceElement(
        'inst',
        type,
        {},
        undefined,
        { [CORE_ANNOTATIONS.CHANGED_AT]: '03/23/2022' }
      ),
      new ObjectType({
        elemID: new ElemID(NETSUITE, 'customrecord1'),
        annotations: {
          [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
          [CORE_ANNOTATIONS.CHANGED_AT]: '05/26/2022',
        },
      }),
    ]).getAll)

    expect((await createElementsSourceIndex(elementsSource).getIndexes()).elemIdToChangeAtIndex)
      .toEqual({
        'netsuite.someType.instance.inst': '03/23/2022',
        'netsuite.customrecord1': '05/26/2022',
      })
  })
})
