/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { SfError } from '@salesforce/core'
import { detailedMessageFromSfError } from '../../src/sfdx_parser/errors'

describe('detailedMessageFromSfError', () => {
  let message: string

  describe('with an SfError', () => {
    describe('without actions', () => {
      beforeEach(() => {
        message = detailedMessageFromSfError(new SfError('Error message', 'ErrorName'))
      })

      it('should return a formatted message', () => {
        expect(message).toEqual('ErrorName: Error message')
      })
    })

    describe('with actions', () => {
      beforeEach(() => {
        message = detailedMessageFromSfError(new SfError('Error message', 'ErrorName', ['Action 1', 'Action 2']))
      })

      it('should return a formatted message', () => {
        expect(message).toEqual('ErrorName: Error message\nSuggested actions:\n* Action 1\n* Action 2')
      })
    })
  })

  describe('with an Error', () => {
    beforeEach(() => {
      message = detailedMessageFromSfError(new Error('Error message'))
    })

    it('should return the error message', () => {
      expect(message).toEqual('Error message')
    })
  })

  describe('with a different type', () => {
    beforeEach(() => {
      message = detailedMessageFromSfError('A string')
    })

    it('should return a const message', () => {
      expect(message).toEqual('Internal error in Salesforce library: A string')
    })
  })
})
