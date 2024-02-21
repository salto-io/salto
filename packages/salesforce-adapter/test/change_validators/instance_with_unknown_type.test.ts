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
  ChangeError,
  InstanceElement,
  toChange,
  TypeReference,
} from '@salto-io/adapter-api'
import changeValidator from '../../src/change_validators/instance_with_unknown_type'
import { mockTypes } from '../mock_elements'

describe('instanceWithUnknownType', () => {
  let errors: ReadonlyArray<ChangeError>
  describe('When an instance is added along with its type', () => {
    beforeEach(async () => {
      errors = await changeValidator([
        toChange({ after: mockTypes.Account }),
        toChange({
          after: new InstanceElement('SomeAccount', mockTypes.Account),
        }),
      ])
    })
    it('Should not raise an error', () => {
      expect(errors).toBeEmpty()
    })
  })
  describe('When an instance is modified without its type', () => {
    const instance = new InstanceElement('SomeAccount', mockTypes.Account)
    beforeEach(async () => {
      errors = await changeValidator([
        toChange({ before: instance, after: instance }),
      ])
    })
    it('Should not raise an error', () => {
      expect(errors).toBeEmpty()
    })
  })
  describe('When an instance is added and its type is modified', () => {
    beforeEach(async () => {
      errors = await changeValidator([
        toChange({ before: mockTypes.Account, after: mockTypes.Account }),
        toChange({
          after: new InstanceElement('SomeAccount', mockTypes.Account),
        }),
      ])
    })
    it('Should not raise an error', () => {
      expect(errors).toBeEmpty()
    })
  })
  describe('When an instance is added without its type', () => {
    const instance = new InstanceElement(
      'SomeAccount',
      new TypeReference(mockTypes.Account.elemID),
    )
    beforeEach(async () => {
      errors = await changeValidator([toChange({ after: instance })])
    })
    it('Should raise an error', () => {
      expect(errors).toHaveLength(1)
      expect(errors[0]).toSatisfy((error) =>
        error.elemID.isEqual(instance.elemID),
      )
    })
  })
  describe('When an instance is added and its type is deleted', () => {
    const instance = new InstanceElement(
      'SomeAccount',
      new TypeReference(mockTypes.Account.elemID),
    )
    beforeEach(async () => {
      errors = await changeValidator([
        toChange({ after: instance }),
        toChange({ before: mockTypes.Account }),
      ])
    })
    it('Should raise an error', () => {
      expect(errors).toHaveLength(1)
      expect(errors).toSatisfyAll((error) =>
        error.elemID.isEqual(instance.elemID),
      )
    })
  })
  describe('When an instance is modified and its type is deleted', () => {
    const instance = new InstanceElement(
      'SomeAccount',
      new TypeReference(mockTypes.Account.elemID),
    )
    beforeEach(async () => {
      errors = await changeValidator([
        toChange({ before: instance, after: instance }),
        toChange({ before: mockTypes.Account }),
      ])
    })
    it('Should raise an error', () => {
      expect(errors).toHaveLength(1)
      expect(errors).toSatisfyAll((error) =>
        error.elemID.isEqual(instance.elemID),
      )
    })
  })
})
