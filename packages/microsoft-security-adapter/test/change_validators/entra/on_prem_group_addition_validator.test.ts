/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { MICROSOFT_SECURITY, entraConstants } from '../../../src/constants'
import { onPremGroupAdditionValidator } from '../../../src/change_validators/entra/on_prem_group_addition_validator'

const { GROUP_TYPE_NAME } = entraConstants.TOP_LEVEL_TYPES

describe(onPremGroupAdditionValidator.name, () => {
  describe('when the change is a group change', () => {
    describe.each([true, false])('when the group has onPremisesSyncEnabled set to %s', onPremisesSyncEnabled => {
      describe('when the change is an addition change', () => {
        it('should return an error', async () => {
          const groupType = new ObjectType({
            elemID: new ElemID(MICROSOFT_SECURITY, GROUP_TYPE_NAME),
          })
          const group = new InstanceElement('testGroup', groupType, { onPremisesSyncEnabled })
          const changes = [
            toChange({
              after: group.clone(),
            }),
          ]
          const res = await onPremGroupAdditionValidator(changes)
          expect(res).toHaveLength(1)
          expect(res).toEqual([
            {
              elemID: group.elemID,
              severity: 'Error',
              message: 'Creation of on-premises groups is not supported',
              detailedMessage:
                'Creation of on-premises groups is not supported. Please use the Entra admin center to sync on-premises groups.',
            },
          ])
        })
      })

      describe.each(['modification', 'removal'])('when the change is a %s change', changeType => {
        it('should not return an error', async () => {
          const groupType = new ObjectType({
            elemID: new ElemID(MICROSOFT_SECURITY, GROUP_TYPE_NAME),
          })
          const group = new InstanceElement('testGroup', groupType, { onPremisesSyncEnabled })
          const changes =
            changeType === 'modification'
              ? [
                  toChange({
                    before: group.clone(),
                    after: group.clone(),
                  }),
                ]
              : [
                  toChange({
                    before: group.clone(),
                  }),
                ]
          const res = await onPremGroupAdditionValidator(changes)
          expect(res).toEqual([])
        })
      })
    })

    describe('when the group does not have onPremisesSyncEnabled set', () => {
      it('should not return an error', async () => {
        const groupType = new ObjectType({
          elemID: new ElemID(MICROSOFT_SECURITY, GROUP_TYPE_NAME),
        })
        const group = new InstanceElement('testGroup', groupType, { someField: 'someValue' })
        const changes = [
          toChange({
            after: group.clone(),
          }),
        ]
        const res = await onPremGroupAdditionValidator(changes)
        expect(res).toEqual([])
      })
    })
  })

  describe('when the change is not a group change', () => {
    it('should not return an error', async () => {
      const objectType = new ObjectType({
        elemID: new ElemID(MICROSOFT_SECURITY, 'someType'),
      })
      const instance = new InstanceElement('testInstance', objectType, { onPremisesSyncEnabled: true })
      const changes = [
        toChange({
          after: instance.clone(),
        }),
      ]
      const res = await onPremGroupAdditionValidator(changes)
      expect(res).toEqual([])
    })
  })
})
