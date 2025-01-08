/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Change, Field, InstanceElement, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { mockTypes } from '../mock_elements'
import { Types, createInstanceElement } from '../../src/transformers/transformer'
import layoutChangeValidator from '../../src/change_validators/layout_duplicate_fields'
import { API_NAME } from '../../src/constants'

describe('layout duplicate fields change validator', () => {
  let layoutChanges: Change
  let layoutInstance: InstanceElement
  describe('when layout has valid layout item fields', () => {
    beforeEach(() => {
      layoutInstance = createInstanceElement(
        {
          fullName: 'my-layout',
          layoutSections: [
            {
              layoutColumns: [
                {
                  layoutItems: [
                    {
                      behavior: 'Required',
                      field: 'Name',
                    },
                    {
                      behavior: 'Required',
                      field: 'Alias',
                    },
                    {
                      behavior: 'Required',
                      field: 'Username',
                    },
                  ],
                },
              ],
            },
          ],
        },
        mockTypes.Layout,
      )
    })

    it('should not return any error', async () => {
      layoutChanges = toChange({ after: layoutInstance })
      const changeErrors = await layoutChangeValidator([layoutChanges])
      expect(changeErrors).toBeEmpty()
    })
  })
  describe('when layout has duplicate layout item field', () => {
    describe('when layout item field is a string', () => {
      beforeEach(() => {
        layoutInstance = createInstanceElement(
          {
            fullName: 'my-layout',
            layoutSections: [
              {
                layoutColumns: [
                  {
                    layoutItems: [
                      {
                        behavior: 'Required',
                        field: 'Name',
                      },
                      {
                        behavior: 'Required',
                        field: 'Alias',
                      },
                      {
                        behavior: 'Required',
                        field: 'Alias',
                      },
                      {
                        behavior: 'Required',
                        field: 'Username',
                      },
                      {
                        behavior: 'Required',
                        field: 'Username',
                      },
                    ],
                  },
                ],
              },
            ],
          },
          mockTypes.Layout,
        )
      })

      it('should return error', async () => {
        layoutChanges = toChange({ after: layoutInstance })
        const changeErrors = await layoutChangeValidator([layoutChanges])
        expect(changeErrors).toHaveLength(1)
        const [changeError] = changeErrors
        expect(changeError.detailedMessage).toEqual(
          'The my-layout has duplicate items for the following fields: Alias,Username. Please remove the duplicate layout item in order to deploy.',
        )
        expect(changeError.severity).toEqual('Error')
      })
    })
    describe('when layout item field is a reference expression', () => {
      const RELATIVE_FIELD_API_NAME = 'TestField__c'
      let referencedField: Field

      beforeEach(() => {
        referencedField = new Field(mockTypes.Account, RELATIVE_FIELD_API_NAME, Types.primitiveDataTypes.Text, {
          [API_NAME]: `Account.${RELATIVE_FIELD_API_NAME}`,
        })
        layoutInstance = createInstanceElement(
          {
            fullName: 'my-layout',
            layoutSections: [
              {
                layoutColumns: [
                  {
                    layoutItems: [
                      {
                        behavior: 'Required',
                        field: new ReferenceExpression(referencedField.elemID, referencedField),
                      },
                      {
                        behavior: 'Required',
                        field: new ReferenceExpression(referencedField.elemID, referencedField),
                      },
                    ],
                  },
                ],
              },
            ],
          },
          mockTypes.Layout,
        )
      })

      it('should return error', async () => {
        layoutChanges = toChange({ after: layoutInstance })
        const changeErrors = await layoutChangeValidator([layoutChanges])
        expect(changeErrors).toHaveLength(1)
        const [changeError] = changeErrors
        expect(changeError.detailedMessage).toEqual(
          'The my-layout has duplicate items for the following fields: salesforce.Account.field.TestField__c. Please remove the duplicate layout item in order to deploy.',
        )
        expect(changeError.severity).toEqual('Error')
      })
    })
  })
})
