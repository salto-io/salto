/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { groupAssignments } from '../../../../../src/definitions/deploy/intune/utils'

describe('Intune group assignments deploy utils', () => {
  describe(`${groupAssignments.createAssignmentsRequest.name} function`, () => {
    describe('when rootField is not provided', () => {
      it('should return a request with the default rootField', () => {
        const request = groupAssignments.createAssignmentsRequest({ resourcePath: '/test' })
        expect(request).toEqual({
          request: {
            endpoint: {
              path: '/test/{id}/assign',
              method: 'post',
            },
            transformation: {
              rename: [
                {
                  from: 'assignments',
                  to: 'assignments',
                  onConflict: 'skip',
                },
              ],
              pick: ['assignments'],
            },
          },
          condition: {
            custom: expect.any(Function),
          },
        })
      })
    })

    describe('when rootField is provided', () => {
      it('should return a request with the provided rootField', () => {
        const request = groupAssignments.createAssignmentsRequest({ resourcePath: '/test', rootField: 'testField' })
        expect(request).toEqual({
          request: {
            endpoint: {
              path: '/test/{id}/assign',
              method: 'post',
            },
            transformation: {
              rename: [
                {
                  from: 'assignments',
                  to: 'testField',
                  onConflict: 'skip',
                },
              ],
              pick: ['testField'],
            },
          },
          condition: {
            custom: expect.any(Function),
          },
        })
      })
    })
  })
})
