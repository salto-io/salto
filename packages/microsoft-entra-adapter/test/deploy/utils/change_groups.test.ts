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

import { getChangeData, toChange } from '@salto-io/adapter-api'
import { groupChangeWithItsParent } from '../../../src/definitions/deploy/utils'
import {
  additionChangeMock,
  instanceElementMock,
  instanceElementWithParentMock,
  objectTypeChangeMock,
} from '../../mocks'

describe(`${groupChangeWithItsParent.name}`, () => {
  it('should return the element full name if it is not an instance element', async () => {
    const result = await groupChangeWithItsParent(objectTypeChangeMock)
    expect(result).toEqual(getChangeData(objectTypeChangeMock).elemID.getFullName())
  })

  it('should return the element full name if it is an instance element without a parent', async () => {
    const result = await groupChangeWithItsParent(additionChangeMock)
    expect(result).toEqual(getChangeData(additionChangeMock).elemID.getFullName())
  })

  it('should return the parent full name if it is an instance element with a parent', async () => {
    const result = await groupChangeWithItsParent(
      toChange({
        after: instanceElementWithParentMock,
      }),
    )
    expect(result).toEqual(instanceElementMock.elemID.getFullName())
  })
})
