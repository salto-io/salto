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
} from '../../../src/change_validators'
import { omitReadOnlyFields } from '../../../src/definitions/deploy/utils'
import { contextMock, removalChangeMock } from '../../mocks'

const typeNamesWithReadOnlyFieldsOnAddition = Object.keys(TYPE_NAME_TO_READ_ONLY_FIELDS_ADDITION)
const readOnlyTypeNameAddition = typeNamesWithReadOnlyFieldsOnAddition[0]
const readOnlyTypeNameModificationOnly =
  Object.keys(TYPE_NAME_TO_READ_ONLY_FIELDS_MODIFICATION).find(
    typeName => !typeNamesWithReadOnlyFieldsOnAddition.includes(typeName),
  ) ?? ''

describe(`${omitReadOnlyFields.name}`, () => {
  it('should return the original value if the type name does not have readonly fields defined', () => {
    const value = {
      a: 1,
      b: '2',
    }
    expect(omitReadOnlyFields({ typeName: 'someType', value, context: contextMock })).toEqual({ value })
  })

  it('should return the original value if the action is delete', () => {
    const value = {
      a: 1,
      b: '2',
    }
    expect(
      omitReadOnlyFields({
        typeName: readOnlyTypeNameModificationOnly,
        value,
        context: { ...contextMock, change: removalChangeMock },
      }),
    ).toEqual({ value })
  })

  it('should return the original value if the readonly fields are not defined for the action', () => {
    const value = {
      a: 1,
      b: '2',
    }
    expect(
      omitReadOnlyFields({
        typeName: readOnlyTypeNameModificationOnly,
        value,
        context: { ...contextMock, action: 'add' },
      }),
    ).toEqual({ value })
  })

  it('should omit the read only fields on addition', () => {
    const value = {
      a: 1,
      b: '2',
      [TYPE_NAME_TO_READ_ONLY_FIELDS_ADDITION[readOnlyTypeNameAddition][0]]: 'read only',
    }
    expect(
      omitReadOnlyFields({ typeName: readOnlyTypeNameAddition, value, context: { ...contextMock, action: 'add' } }),
    ).toEqual({ value: { a: 1, b: '2' } })
  })

  it('should omit the read only fields on modification', () => {
    const value = {
      a: 1,
      b: '2',
      [TYPE_NAME_TO_READ_ONLY_FIELDS_MODIFICATION[readOnlyTypeNameModificationOnly][0]]: 'read only',
    }
    expect(
      omitReadOnlyFields({
        typeName: readOnlyTypeNameModificationOnly,
        value,
        context: { ...contextMock, action: 'modify' },
      }),
    ).toEqual({ value: { a: 1, b: '2' } })
  })
})
