/*
*                      Copyright 2020 Salto Labs Ltd.
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
import {
  CORE_ANNOTATIONS,
  ElemID,
  isEqualElements,
  isType,
  ObjectType,
} from '@salto-io/adapter-api'
import { OnFetchFilter } from 'src/filter'
import mockClient from '../client'
import filterCreator from '../../src/filters/hide_types'
import { Types } from '../../src/transformers/transformer'
import {
  valuePropInstance,
  datePropInstance,
  g1PropInstance,
  formInstance,
} from '../common/mock_elements'
import { OBJECTS_NAMES } from '../../src/constants'

describe('hide_types filter', () => {
  let filter: OnFetchFilter

  // mockType: every Type should be hidden
  const regTypeID = new ElemID('dummy', 'regType')
  const mockType = new ObjectType({
    elemID: regTypeID,
  })

  const hubElements = [
    formInstance.clone(),
    valuePropInstance.clone(),
    datePropInstance.clone(),
    g1PropInstance.clone(),
    Types.hubspotObjects[OBJECTS_NAMES.FORM],
    Types.hubspotObjects[OBJECTS_NAMES.CONTACT_PROPERTY],
    Types.hubspotObjects[OBJECTS_NAMES.WORKFLOW],
    mockType,
  ]

  beforeAll(() => {
    const { client } = mockClient()
    filter = filterCreator({ client })
    filter.onFetch(hubElements)
  })

  it('should not change element list length', () => {
    expect(hubElements).toHaveLength(8)
  })

  it('should not change instances', () => {
    expect(isEqualElements(hubElements[0], formInstance)).toBeTruthy()
    expect(isEqualElements(hubElements[1], valuePropInstance)).toBeTruthy()
    expect(isEqualElements(hubElements[2], datePropInstance)).toBeTruthy()
    expect(isEqualElements(hubElements[3], g1PropInstance)).toBeTruthy()
  })

  it('should add hidden annotation to types', () => {
    expect(hubElements.filter(isType).every(e => e.annotations[CORE_ANNOTATIONS.HIDDEN]))
      .toBeTruthy()
  })

  it('should not change type fields', () => {
    expect(isEqualElements(hubElements[4], Types.hubspotObjects[OBJECTS_NAMES.FORM]))
      .toBeTruthy()

    expect(isEqualElements(hubElements[5], Types.hubspotObjects[OBJECTS_NAMES.CONTACT_PROPERTY]))
      .toBeTruthy()

    expect(isEqualElements(hubElements[6], Types.hubspotObjects[OBJECTS_NAMES.WORKFLOW]))
      .toBeTruthy()

    expect(isEqualElements(hubElements[7], mockType))
      .toBeTruthy()
  })
})
