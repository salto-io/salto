/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID } from '../src/element_id'
import {
  DependencyError,
  isAdapterSuccessInstallResult,
  isDependencyError,
  isUnresolvedReferenceError,
  setPartialFetchData,
  toServiceIdsString,
  UnresolvedReferenceError,
} from '../src/adapter'

describe('adapter', () => {
  describe('setPartialFetchData', () => {
    it('should return value when isPartial is true', () => {
      const result = setPartialFetchData(true, [])
      expect(result).toEqual({ isPartial: true, deletedElements: [] })
    })

    it('should return undefined when isPartial is false', () => {
      const result = setPartialFetchData(false, [])
      expect(result).toBeUndefined()
    })
  })

  describe('isDependencyError', () => {
    it('should return true for a dependency error', () => {
      const result = isDependencyError({
        elemID: new ElemID('adapter'),
        severity: 'Error',
        message: 'Error with causeID',
        detailedMessage: '',
        causeID: new ElemID('adapter', 'cause'),
      } as DependencyError)
      expect(result).toEqual(true)
    })

    it('should return false for a non-dependency error', () => {
      const result = isDependencyError({
        elemID: new ElemID('adapter'),
        severity: 'Error',
        message: 'Error without causeID',
        detailedMessage: '',
      })
      expect(result).toEqual(false)
    })
  })

  describe('isUnresolvedReferenceError', () => {
    it('should return true for an unresolved reference error', () => {
      const result = isUnresolvedReferenceError({
        elemID: new ElemID('adapter'),
        severity: 'Error',
        message: 'Error with causeID',
        detailedMessage: '',
        type: 'unresolvedReferences',
        unresolvedElemIds: [],
      } as UnresolvedReferenceError)
      expect(result).toEqual(true)
    })

    it('should return false when no type is defined', () => {
      const result = isUnresolvedReferenceError({
        elemID: new ElemID('adapter'),
        severity: 'Error',
        message: 'Error with causeID',
        detailedMessage: '',
        unresolvedElemIds: [],
      } as UnresolvedReferenceError)
      expect(result).toEqual(false)
    })

    it('should return false when no unresolvedElemIds are defined', () => {
      const result = isUnresolvedReferenceError({
        elemID: new ElemID('adapter'),
        severity: 'Error',
        message: 'Error with causeID',
        detailedMessage: '',
        type: 'unresolvedReferences',
      } as UnresolvedReferenceError)
      expect(result).toEqual(false)
    })

    it('should return false for a generic ChangeError', () => {
      const result = isUnresolvedReferenceError({
        elemID: new ElemID('adapter'),
        severity: 'Error',
        message: 'Error with causeID',
        detailedMessage: '',
      })
      expect(result).toEqual(false)
    })
  })

  describe('isAdapterSuccessInstallResult', () => {
    it('should return true for successful result', () => {
      const result = isAdapterSuccessInstallResult({
        success: true,
        installedVersion: 'version',
      })
      expect(result).toEqual(true)
    })

    it('should return false for unsuccessful result', () => {
      const result = isAdapterSuccessInstallResult({
        success: false,
        errors: [],
      })
      expect(result).toEqual(false)
    })
  })

  describe('toServiceIdsString', () => {
    it('should return a sorted service IDs string', () => {
      const result = toServiceIdsString({
        service3: 'my service',
        service1: 'my other service',
        service10: "someone else's service",
      })
      expect(result).toEqual("service1,my other service,service10,someone else's service,service3,my service")
    })
  })
})
