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
import { ElemID, ObjectType, TypeElement } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import filterCreator from '../../src/filters/remove_unsupported_types'
import { NETSUITE } from '../../src/constants'
import NetsuiteClient from '../../src/client/client'
import { FilterOpts } from '../../src/filter'
import { customrecordtype } from '../../src/autogen/types/custom_types/customrecordtype'

describe('remove_unsupported_types', () => {
  let filterOpts: FilterOpts
  let elements: TypeElement[]
  const sdfType = customrecordtype
  const supportedSoapType = new ObjectType({ elemID: new ElemID(NETSUITE, 'subsidiary'), annotations: { source: 'soap' } })
  const unsupportedSoapType = new ObjectType({ elemID: new ElemID(NETSUITE, 'someType'), annotations: { source: 'soap' } })
  const sdfSoapType = new ObjectType({ elemID: new ElemID(NETSUITE, 'CustomRecordType'), annotations: { source: 'soap' } })
  const isSuiteAppConfiguredMock = jest.fn()

  beforeEach(() => {
    elements = [sdfType, supportedSoapType, unsupportedSoapType, sdfSoapType]
    isSuiteAppConfiguredMock.mockReset()
    isSuiteAppConfiguredMock.mockReturnValue(true)
    filterOpts = {
      client: { isSuiteAppConfigured: isSuiteAppConfiguredMock } as unknown as NetsuiteClient,
      elementsSourceIndex: { getIndexes: () => Promise.resolve({
        serviceIdsIndex: {},
        internalIdsIndex: {},
        customFieldsIndex: {},
      }) },
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
    }
  })

  it('should remove the unsupported types', async () => {
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(elements.map(e => e.elemID.name)).toEqual(['customrecordtype', 'subsidiary'])
  })

  it('should do nothing if suiteApp is not installed', async () => {
    isSuiteAppConfiguredMock.mockReturnValue(false)
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(elements.map(e => e.elemID.name)).toEqual(['customrecordtype', 'subsidiary', 'someType', 'CustomRecordType'])
  })
})
