/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { PARENT_ID_FIELD_NAME } from '../../../../../src/constants'
import { IDENTIFIER_URIS_FIELD_NAME } from '../../../../../src/constants/entra'
import { adjustApplication } from '../../../../../src/definitions/fetch/entra/utils'

describe(`${adjustApplication.name}`, () => {
  it('should throw an error when value is not an object', async () => {
    await expect(adjustApplication({ value: 'not an object', typeName: 'typeName', context: {} })).rejects.toThrow()
  })

  describe('when value is an object', () => {
    describe('identifierUris field', () => {
      it('should throw an error when identifiersUri field is not an array', async () => {
        await expect(
          adjustApplication({
            value: { [IDENTIFIER_URIS_FIELD_NAME]: 'not an array' },
            typeName: 'typeName',
            context: {},
          }),
        ).rejects.toThrow()
      })

      it('should not throw an error when identifierUris field is missing', async () => {
        await expect(adjustApplication({ value: {}, typeName: 'typeName', context: {} })).resolves.not.toThrow()
      })

      it('should filter out identifierUris with of the form api://<appId>', async () => {
        const appId = 'appId'
        const identifierUris = [`api://${appId}`, 'otherUri', `api://not${appId}`]
        const result = await adjustApplication({
          value: { [IDENTIFIER_URIS_FIELD_NAME]: identifierUris, appId },
          typeName: 'typeName',
          context: {},
        })
        expect(result.value[IDENTIFIER_URIS_FIELD_NAME]).toEqual(['otherUri', `api://not${appId}`])
      })
    })

    describe('appRoles field', () => {
      it('should add parent id to appRoles field', async () => {
        const value = { id: 'testId', appRoles: [{ name: 'role1' }, { name: 'role2' }] }
        const result = await adjustApplication({ value, typeName: 'typeName', context: {} })
        expect(result.value.appRoles).toEqual([
          { [PARENT_ID_FIELD_NAME]: 'testId', name: 'role1' },
          { [PARENT_ID_FIELD_NAME]: 'testId', name: 'role2' },
        ])
      })
    })

    describe('api field', () => {
      describe('when the api field is missing', () => {
        it('should return the application object as is', async () => {
          const value = { id: 'testId' }
          const result = await adjustApplication({ value, typeName: 'typeName', context: {} })
          expect(result.value).toEqual(value)
        })
      })

      describe('when the api field is present', () => {
        describe('when the oauth2PermissionScopes field is missing', () => {
          it('should return the application object as is', async () => {
            const value = { id: 'testId', api: { someVal: 4 } }
            const result = await adjustApplication({ value, typeName: 'typeName', context: {} })
            expect(result.value).toEqual(value)
          })
        })

        describe('when the oauth2PermissionScopes field is present', () => {
          it('should add parent id to oauth2PermissionScopes field', async () => {
            const value = {
              id: 'testId',
              api: {
                oauth2PermissionScopes: [{ name: 'scope1' }, { name: 'scope2' }],
              },
            }
            const result = await adjustApplication({ value, typeName: 'typeName', context: {} })
            expect(result.value.api.oauth2PermissionScopes).toEqual([
              { [PARENT_ID_FIELD_NAME]: 'testId', name: 'scope1' },
              { [PARENT_ID_FIELD_NAME]: 'testId', name: 'scope2' },
            ])
          })
        })
      })
    })
  })
})
