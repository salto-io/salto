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
  BuiltinTypes,
  ChangeError,
  CORE_ANNOTATIONS,
  getChangeData,
  InstanceElement,
  ModificationChange,
  ObjectType,
  toChange,
} from '@salto-io/adapter-api'
import { createCustomObjectType, createField } from '../utils'
import { createInstanceElement } from '../../src/transformers/transformer'
import { FIELD_ANNOTATIONS } from '../../src/constants'
import changeValidator from '../../src/change_validators/deleted_non_queryable_fields'

describe('deletedNonQueryableFields', () => {
  let warnings: ReadonlyArray<ChangeError>

  const createTypeForTest = ({
    fieldIsQueryable,
    fieldIsReadOnly,
    fieldIsHidden,
  }: {
    fieldIsQueryable: boolean
    fieldIsReadOnly: boolean
    fieldIsHidden: boolean
  }): ObjectType => {
    const type = createCustomObjectType('SomeType', {})
    createField(type, BuiltinTypes.BOOLEAN, 'SomeField', {
      [FIELD_ANNOTATIONS.QUERYABLE]: fieldIsQueryable,
      [FIELD_ANNOTATIONS.CREATABLE]: !fieldIsReadOnly,
      [FIELD_ANNOTATIONS.UPDATEABLE]: !fieldIsReadOnly,
      [CORE_ANNOTATIONS.HIDDEN_VALUE]: fieldIsHidden,
    })
    return type
  }

  describe('addition change', () => {
    describe('some fields are non-queryable', () => {
      beforeEach(async () => {
        const objectType = createTypeForTest({
          fieldIsQueryable: false,
          fieldIsHidden: false,
          fieldIsReadOnly: false,
        })
        const instance = createInstanceElement(
          { fullName: 'SomeInstance', SomeField: true },
          objectType,
        )
        warnings = await changeValidator([toChange({ after: instance })])
      })
      it('should not warn', () => {
        expect(warnings).toBeEmpty()
      })
    })
  })

  describe('modification change', () => {
    const createInstanceChangeForType = (
      objectType: ObjectType,
    ): ModificationChange<InstanceElement> => {
      const instanceBefore = createInstanceElement(
        { fullName: 'SomeInstance', SomeField: true },
        objectType,
      )
      const instanceAfter = instanceBefore.clone()
      instanceAfter.value.SomeField = false
      return toChange({
        before: instanceBefore,
        after: instanceAfter,
      }) as ModificationChange<InstanceElement>
    }
    describe('all fields are queryable', () => {
      beforeEach(async () => {
        const objectType = createTypeForTest({
          fieldIsQueryable: true,
          fieldIsHidden: false,
          fieldIsReadOnly: false,
        })
        warnings = await changeValidator([
          createInstanceChangeForType(objectType),
        ])
      })
      it('should not warn', () => {
        expect(warnings).toBeEmpty()
      })
    })
    describe('the only non-queryable fields are hidden', () => {
      beforeEach(async () => {
        const typeWithQueryableFields = createTypeForTest({
          fieldIsQueryable: false,
          fieldIsHidden: true,
          fieldIsReadOnly: false,
        })
        warnings = await changeValidator([
          createInstanceChangeForType(typeWithQueryableFields),
        ])
      })
      it('should not warn', () => {
        expect(warnings).toBeEmpty()
      })
    })
    describe('the only non-queryable fields are read-only', () => {
      beforeEach(async () => {
        const typeWithQueryableFields = createTypeForTest({
          fieldIsQueryable: false,
          fieldIsHidden: false,
          fieldIsReadOnly: true,
        })
        warnings = await changeValidator([
          createInstanceChangeForType(typeWithQueryableFields),
        ])
      })
      it('should not warn', () => {
        expect(warnings).toBeEmpty()
      })
    })
    describe('there are non-system non-queryable fields', () => {
      let changes: ModificationChange<InstanceElement>[]
      beforeEach(async () => {
        const typeWithQueryableFields = createTypeForTest({
          fieldIsQueryable: false,
          fieldIsHidden: false,
          fieldIsReadOnly: false,
        })
        changes = [createInstanceChangeForType(typeWithQueryableFields)]
        warnings = await changeValidator(changes)
      })
      it('should warn', () => {
        expect(warnings).toEqual([
          {
            elemID: getChangeData(changes[0]).elemID,
            severity: 'Warning',
            message: expect.stringContaining('SomeType'),
            detailedMessage: expect.stringContaining('SomeField'),
          },
        ])
      })
    })
  })
})
