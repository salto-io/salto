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

import {
  TYPE_NAME_TO_READ_ONLY_FIELDS_ADDITION,
  TYPE_NAME_TO_READ_ONLY_FIELDS_MODIFICATION,
} from '../../../../../src/change_validators'
import { omitReadOnlyFields, omitReadOnlyFieldsWrapper } from '../../../../../src/definitions/deploy/shared/utils'
import { contextMock, modificationChangeMock, removalChangeMock } from '../../../../mocks'

const typeNamesWithReadOnlyFieldsOnAddition = Object.keys(TYPE_NAME_TO_READ_ONLY_FIELDS_ADDITION)
const readOnlyTypeNameAddition = typeNamesWithReadOnlyFieldsOnAddition[0]
const readOnlyTypeNameModificationOnly =
  Object.keys(TYPE_NAME_TO_READ_ONLY_FIELDS_MODIFICATION).find(
    typeName => !typeNamesWithReadOnlyFieldsOnAddition.includes(typeName),
  ) ?? ''

describe(`${omitReadOnlyFields.name}`, () => {
  it('should return the original value if the type name does not have readonly fields defined', async () => {
    const value = {
      a: 1,
      b: '2',
    }
    await expect(omitReadOnlyFields({ typeName: 'someType', value, context: contextMock })).resolves.toEqual({ value })
  })

  it('should return the original value if the action is delete', async () => {
    const value = {
      a: 1,
      b: '2',
    }
    await expect(
      omitReadOnlyFields({
        typeName: readOnlyTypeNameModificationOnly,
        value,
        context: { ...contextMock, change: removalChangeMock },
      }),
    ).resolves.toEqual({ value })
  })

  it('should return the original value if the readonly fields are not defined for the action', async () => {
    const value = {
      a: 1,
      b: '2',
    }
    await expect(
      omitReadOnlyFields({
        typeName: readOnlyTypeNameModificationOnly,
        value,
        context: contextMock,
      }),
    ).resolves.toEqual({ value })
  })

  it('should omit the read only fields on addition', async () => {
    const value = {
      a: 1,
      b: '2',
      [TYPE_NAME_TO_READ_ONLY_FIELDS_ADDITION[readOnlyTypeNameAddition][0]]: 'read only',
    }
    await expect(
      omitReadOnlyFields({ typeName: readOnlyTypeNameAddition, value, context: contextMock }),
    ).resolves.toEqual({
      value: { a: 1, b: '2' },
    })
  })

  it('should omit the read only fields on modification', async () => {
    const value = {
      a: 1,
      b: '2',
      [TYPE_NAME_TO_READ_ONLY_FIELDS_MODIFICATION[readOnlyTypeNameModificationOnly][0]]: 'read only',
    }
    await expect(
      omitReadOnlyFields({
        typeName: readOnlyTypeNameModificationOnly,
        value,
        context: { ...contextMock, change: modificationChangeMock },
      }),
    ).resolves.toEqual({ value: { a: 1, b: '2' } })
  })
})

describe(`${omitReadOnlyFieldsWrapper.name}`, () => {
  it('should omit the read only fields after calling the adjust function', async () => {
    const value = {
      a: 1,
      b: '2',
      [TYPE_NAME_TO_READ_ONLY_FIELDS_ADDITION[readOnlyTypeNameAddition][0]]: 'read only',
    }
    const adjustFunction = jest.fn().mockResolvedValue({ value: { a: 1, b: '2' } })
    const adjustWrapped = omitReadOnlyFieldsWrapper(adjustFunction)
    const result = await adjustWrapped({ value, typeName: readOnlyTypeNameAddition, context: contextMock })
    expect(adjustFunction).toHaveBeenCalled()
    expect(result.value).toEqual({ a: 1, b: '2' })
  })
})
