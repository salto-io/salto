/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { Change, getAllChangeData, InstanceElement, toChange } from '@salto-io/adapter-api'
import { mockTypes } from '../mock_elements'
import filterCreator, {
  LAYOUT_ASSIGNMENTS_FIELD,
  LOGIN_IP_RANGES_FIELD,
  LOGIN_FLOWS_FIELD,
} from '../../src/filters/minify_deploy'
import { defaultFilterContext } from '../utils'
import { INSTANCE_FULL_NAME_FIELD } from '../../src/constants'
import { FilterWith } from './mocks'

describe('minifyDeployFilter', () => {
  describe('deploy flow', () => {
    const PROFILE_FULL_NAME = 'ProfileFullName'
    const AFTER_IP_RANGES = [
      {
        description: 'desc 2',
        endAddress: '94.188.162.210',
        startAddress: '94.188.162.1',
      },
      {
        description: 'desc 4',
        endAddress: '128.1.1.255',
        startAddress: '128.1.1.1',
      },
    ]

    let filter: FilterWith<'preDeploy' | 'onDeploy'>
    let profileChange: Change<InstanceElement>
    let afterPreDeployChanges: Change<InstanceElement>[]
    let afterOnDeployChanges: Change<InstanceElement>[]

    beforeAll(async () => {
      const beforeProfileInstance = new InstanceElement('TestProfile', mockTypes.Profile, {
        [INSTANCE_FULL_NAME_FIELD]: PROFILE_FULL_NAME,
        [LOGIN_FLOWS_FIELD]: {
          flow: 'Test',
          flowType: 'UI',
          friendlyName: 'Test Login',
          uiLoginFlowType: 'VisualWorkflow',
          useLightningRuntime: 'false',
        },
        layoutAssignments: {
          nonModifiedLayout: [{ layout: 'nonModifiedLayout' }],
          anotherNonModifiedLayout: [{ layout: 'anotherNonModifiedLayout' }],
        },
        nonModifiedField: '1',
        anotherNonModifiedField: '2',
        modifiedField: 'before',
        modifiedNestedField: {
          modifiedAttr: 'before',
          nonModifiedAttr: '1',
        },
        modifiedNestedNestedField: {
          modifiedNestedAttr: {
            modifiedAttr: 'before',
            nonModifiedAttr: '1',
          },
          nonModifiedAttr: '1',
        },
      })

      const afterProfileInstance = beforeProfileInstance.clone()
      afterProfileInstance.value.modifiedField = 'after'
      afterProfileInstance.value.modifiedNestedField.modifiedAttr = 'after'
      afterProfileInstance.value.modifiedNestedNestedField.modifiedNestedAttr.modifiedAttr = 'after'
      afterProfileInstance.value[LAYOUT_ASSIGNMENTS_FIELD].newLayoutAssignment = [{ layout: 'newLayoutAssignment' }]
      afterProfileInstance.value[LOGIN_IP_RANGES_FIELD] = AFTER_IP_RANGES
      profileChange = toChange({
        before: beforeProfileInstance,
        after: afterProfileInstance,
      })

      filter = filterCreator({
        config: defaultFilterContext,
      }) as FilterWith<'preDeploy' | 'onDeploy'>
      afterPreDeployChanges = [profileChange]
      await filter.preDeploy(afterPreDeployChanges)
      afterOnDeployChanges = [...afterPreDeployChanges]
      await filter.onDeploy(afterOnDeployChanges)
    })
    describe('on preDeploy', () => {
      it('should have a minified Profile changes', () => {
        expect(afterPreDeployChanges).toHaveLength(1)
        const [, afterProfile] = getAllChangeData(afterPreDeployChanges[0])
        expect(afterProfile.value).toEqual({
          [INSTANCE_FULL_NAME_FIELD]: PROFILE_FULL_NAME,
          [LOGIN_IP_RANGES_FIELD]: AFTER_IP_RANGES,
          [LOGIN_FLOWS_FIELD]: {
            flow: 'Test',
            flowType: 'UI',
            friendlyName: 'Test Login',
            uiLoginFlowType: 'VisualWorkflow',
            useLightningRuntime: 'false',
          },
          [LAYOUT_ASSIGNMENTS_FIELD]: {
            newLayoutAssignment: [{ layout: 'newLayoutAssignment' }],
          },
          modifiedField: 'after',
          modifiedNestedField: {
            modifiedAttr: 'after',
            nonModifiedAttr: '1',
          },
          modifiedNestedNestedField: {
            modifiedNestedAttr: {
              modifiedAttr: 'after',
              nonModifiedAttr: '1',
            },
          },
        })
      })
    })
    describe('on onDeploy', () => {
      it('should have the original change', () => {
        expect(afterOnDeployChanges).toHaveLength(1)
        expect(afterOnDeployChanges[0]).toEqual(profileChange)
      })
    })
  })
})
