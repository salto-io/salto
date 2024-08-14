/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator, ChangeError, ObjectType, ElemID, Change, toChange } from '@salto-io/adapter-api'
import { mockFunction } from '@salto-io/test-utils'
import { createChangeValidator } from '../../../src/deployment/change_validators'

describe('change_validator', () => {
  const testElem = new ObjectType({ elemID: new ElemID('test', 'type') })

  let mockValidators: Record<string, jest.MockedFunction<ChangeValidator>>
  let changes: ReadonlyArray<Change>
  let errors: ChangeError[]

  beforeEach(async () => {
    errors = [
      {
        elemID: testElem.elemID,
        severity: 'Error',
        message: 'test',
        detailedMessage: 'test',
      },
      {
        elemID: testElem.elemID,
        severity: 'Error',
        message: 'test2',
        detailedMessage: 'test2',
      },
    ]
    mockValidators = {
      mock1: mockFunction<ChangeValidator>().mockResolvedValue(errors.slice(0, 1)),
      mock2: mockFunction<ChangeValidator>().mockResolvedValue(errors.slice(1)),
    }
    changes = [toChange({ after: testElem })]
  })

  describe('with active validators', () => {
    let result: ReadonlyArray<ChangeError>
    beforeEach(async () => {
      const mainValidator = createChangeValidator({ validators: mockValidators })
      result = await mainValidator(changes)
    })
    it('should call all validators', () => {
      Object.values(mockValidators).forEach(validator => expect(validator).toHaveBeenCalledWith(changes, undefined))
    })
    it('should return errors from all validators', () => {
      expect(result).toEqual(errors)
    })
  })

  describe('with disabled validators', () => {
    let disabledError: ChangeError
    let disabledValidator: Record<string, jest.MockedFunction<ChangeValidator>>
    let result: ReadonlyArray<ChangeError>
    beforeEach(async () => {
      disabledError = {
        elemID: testElem.elemID,
        severity: 'Error',
        message: 'test3',
        detailedMessage: 'test3',
      }
      disabledValidator = { disabled: mockFunction<ChangeValidator>().mockResolvedValue([disabledError]) }
      const mainValidator = createChangeValidator({
        validators: { ...mockValidators, ...disabledValidator },
        validatorsActivationConfig: { disabled: false },
      })
      result = await mainValidator(changes)
    })
    it('should not call disabled validator', () => {
      expect(disabledValidator.disabled).not.toHaveBeenCalled()
    })
    it('should not return error from disabled validator', () => {
      expect(result).not.toContainEqual(disabledError)
    })
  })
})
