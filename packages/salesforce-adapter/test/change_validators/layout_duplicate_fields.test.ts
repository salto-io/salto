/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Change, InstanceElement, toChange } from '@salto-io/adapter-api'
import { mockTypes } from '../mock_elements'
import { createInstanceElement } from '../../src/transformers/transformer'
import layoutChangeValidator from '../../src/change_validators/layout_duplicate_fields'

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

    it('should not throw any error', async () => {
      layoutChanges = toChange({ after: layoutInstance })
      const changeErrors = await layoutChangeValidator([layoutChanges])
      expect(changeErrors).toHaveLength(0)
    })
  })
  describe('when layout has duplicate layout item field', () => {
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

    it('should throw error', async () => {
      layoutChanges = toChange({ after: layoutInstance })
      const changeErrors = await layoutChangeValidator([layoutChanges])
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.severity).toEqual('Error')
    })
  })
})
