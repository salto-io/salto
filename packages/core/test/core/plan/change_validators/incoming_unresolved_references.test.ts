/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { errors as wsErrors } from '@salto-io/workspace'
import { incomingUnresolvedReferencesValidator } from '../../../../src/core/plan/change_validators/incoming_unresolved_references'

describe('incomingUnresolvedReferencesValidator', () => {
  let type: ObjectType
  let firstInstance: InstanceElement
  let firstInstanceError: wsErrors.UnresolvedReferenceValidationError

  beforeEach(() => {
    type = new ObjectType({
      elemID: new ElemID('adapter', 'type'),
      annotations: {
        [CORE_ANNOTATIONS.CREATABLE]: false,
      },
    })
    firstInstance = new InstanceElement('instance1', type)

    firstInstanceError = new wsErrors.UnresolvedReferenceValidationError({
      elemID: firstInstance.elemID,
      target: firstInstance.elemID,
    })
  })

  describe('when unresolved reference is not in the plan', () => {
    let secondInstance: InstanceElement

    beforeEach(() => {
      secondInstance = new InstanceElement('instance2', type)
    })
    it('should not return an error', async () => {
      const errors = await incomingUnresolvedReferencesValidator([firstInstanceError])([
        toChange({ before: secondInstance }),
      ])
      expect(errors).toEqual([])
    })
  })

  describe('when unresolved reference is in the plan', () => {
    it('should return an error for deleted elements', async () => {
      const errors = await incomingUnresolvedReferencesValidator([firstInstanceError])([
        toChange({ before: firstInstance }),
      ])
      expect(errors.length).toEqual(1)
      expect(errors[0].elemID).toEqual(firstInstance.elemID)
      expect(errors[0].severity).toEqual('Warning')
    })

    it('should return an error for modified elements', async () => {
      const after = firstInstance.clone()
      after.value.label = 'modified'
      const errors = await incomingUnresolvedReferencesValidator([firstInstanceError])([
        toChange({ before: firstInstance, after }),
      ])
      expect(errors.length).toEqual(1)
      expect(errors[0].elemID).toEqual(firstInstance.elemID)
      expect(errors[0].severity).toEqual('Warning')
    })

    it('should filter addition errors', async () => {
      const errors = await incomingUnresolvedReferencesValidator([firstInstanceError])([
        toChange({ after: firstInstance }),
      ])
      expect(errors).toEqual([])
    })
  })

  describe('when referencing nested elements', () => {
    let nestedElemID: ElemID
    let nestedInstanceError: wsErrors.UnresolvedReferenceValidationError

    beforeEach(() => {
      nestedElemID = firstInstance.elemID.createNestedID('nested', 'innerInstance1')
      nestedInstanceError = new wsErrors.UnresolvedReferenceValidationError({
        elemID: firstInstance.elemID,
        target: nestedElemID,
      })
    })

    it('should return an error on the nested element with a reference if a parent was removed', async () => {
      const errors = await incomingUnresolvedReferencesValidator([nestedInstanceError])([
        toChange({ before: firstInstance }),
      ])
      expect(errors.length).toEqual(1)
      expect(errors[0].elemID).toEqual(firstInstance.elemID)
      expect(errors[0].severity).toEqual('Warning')
    })
  })
})
