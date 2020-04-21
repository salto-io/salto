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

import { Element } from '@salto-io/adapter-api'
import { createChangeValidator } from '../src/change_validator'

describe('change_validator', () => {
  const mockOnUpdate = jest.fn()
  const mockOnAdd = jest.fn()
  const mockOnRemove = jest.fn()

  const mockSingleChangeValidator = {
    onUpdate: mockOnUpdate,
    onAdd: mockOnAdd,
    onRemove: mockOnRemove,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('onAdd', async () => {
    const changeValidator = createChangeValidator([mockSingleChangeValidator])
    await changeValidator.onAdd({} as Element)
    expect(mockOnAdd).toHaveBeenCalled()
  })

  it('onUpdate', async () => {
    const changeValidator = createChangeValidator([mockSingleChangeValidator])
    await changeValidator.onUpdate([])
    expect(mockOnUpdate).toHaveBeenCalled()
  })

  it('onRemove', async () => {
    const changeValidator = createChangeValidator([mockSingleChangeValidator])
    await changeValidator.onRemove({} as Element)
    expect(mockOnRemove).toHaveBeenCalled()
  })
})
