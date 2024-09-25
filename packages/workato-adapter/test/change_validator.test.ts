/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import changeValidator from '../src/change_validator'
import { RECIPE_TYPE, RLM_DEPLOY_SUPPORTED_TYPES, WORKATO } from '../src/constants'
import { DEFAULT_CONFIG, ENABLE_DEPLOY_SUPPORT_FLAG } from '../src/user_config'

describe('change validator creator', () => {
  describe('withDeploySupport', () => {
    const config = {
      ...DEFAULT_CONFIG,
      [ENABLE_DEPLOY_SUPPORT_FLAG]: true,
    }
    describe('notSupportedTypesVzalidator', () => {
      const nonInFolderType = new ObjectType({ elemID: new ElemID(WORKATO, 'nonRLM') })
      const anotherNonInFolderType = new ObjectType({ elemID: new ElemID(WORKATO, 'nonRLM1') })

      it('should not fail if there are no deploy changes', async () => {
        expect(await changeValidator(config)([])).toEqual([])
      })

      it('both should fail', async () => {
        expect(
          await changeValidator(config)([
            toChange({ after: new InstanceElement('inst1', nonInFolderType) }),
            toChange({
              before: new InstanceElement('inst1', anotherNonInFolderType),
              after: new InstanceElement('inst1', anotherNonInFolderType),
            }),
          ]),
        ).toMatchObject([
          {
            severity: 'Error',
            message: expect.stringContaining('not supported'),
          },
          {
            severity: 'Error',
            message: expect.stringContaining('not supported'),
          },
        ])
      })
    })

    describe('notSupportedRemovalValidator', () => {
      const InFolderType = new ObjectType({ elemID: new ElemID(WORKATO, RLM_DEPLOY_SUPPORTED_TYPES[0]) })
      it('should fail', async () => {
        const validations = (
          await changeValidator(config)([toChange({ before: new InstanceElement('inst1', InFolderType) })])
        ).filter(change => change.severity === 'Error')
        expect(validations).toHaveLength(1)
        expect(validations[0].severity).toEqual('Error')
        expect(validations[0].message).toContain('not supported')
      })
    })

    describe('notSupportedRecipeSettingsValidator', () => {
      const recipeType = new ObjectType({ elemID: new ElemID(WORKATO, RECIPE_TYPE) })
      it('should raise warning', async () => {
        expect(
          await changeValidator(config)([
            toChange({
              before: new InstanceElement('inst1', recipeType),
              after: new InstanceElement('inst1', recipeType),
            }),
          ]),
        ).toMatchObject([
          {
            severity: 'Warning',
            message: expect.stringContaining('private and concurrency'),
          },
        ])
      })
    })
  })
  describe('withoutDeploySupport', () => {
    describe('deployNotSupportedValidator', () => {
      it('should not fail if there are no deploy changes', async () => {
        expect(await changeValidator(DEFAULT_CONFIG)([])).toEqual([])
      })

      it('should fail each change individually', async () => {
        expect(
          await changeValidator(DEFAULT_CONFIG)([
            toChange({ after: new ObjectType({ elemID: new ElemID(WORKATO, 'obj') }) }),
            toChange({ before: new ObjectType({ elemID: new ElemID(WORKATO, 'obj2') }) }),
          ]),
        ).toEqual([
          {
            elemID: new ElemID(WORKATO, 'obj'),
            severity: 'Error',
            message: 'Salto does not support workato deployments.',
            detailedMessage:
              'Salto does not support workato deployments. Please see https://help.salto.io/en/articles/6927118-supported-business-applications for more details.',
          },
          {
            elemID: new ElemID(WORKATO, 'obj2'),
            severity: 'Error',
            message: 'Salto does not support workato deployments.',
            detailedMessage:
              'Salto does not support workato deployments. Please see https://help.salto.io/en/articles/6927118-supported-business-applications for more details.',
          },
        ])
      })
    })
  })
})
