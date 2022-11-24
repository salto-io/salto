/*
*                      Copyright 2022 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import { Change, getAllChangeData, InstanceElement, toChange } from '@salto-io/adapter-api'
import { mockTypes } from '../mock_elements'
import { FilterWith } from '../../src/filter'
import filterCreator, { LAYOUT_ASSIGNMENTS_FIELD, LOGIN_IP_RANGES_FIELD } from '../../src/filters/minify_deploy'
import { defaultFilterContext } from '../utils'
import { INSTANCE_FULL_NAME_FIELD, LABEL } from '../../src/constants'

describe('minifyDeployFilter', () => {
  describe('deploy flow', () => {
    const PROFILE_FULL_NAME = 'ProfileFullName'
    const PERMISSION_SET_FULL_NAME = 'PermissionSetFullName'
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
    let permissionSetChange: Change<InstanceElement>
    let afterPreDeployChanges: Change<InstanceElement>[]
    let afterOnDeployChanges: Change<InstanceElement>[]

    beforeAll(async () => {
      const beforeProfileInstance = new InstanceElement(
        'TestProfile',
        mockTypes.Profile,
        {
          [INSTANCE_FULL_NAME_FIELD]: PROFILE_FULL_NAME,
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
        }
      )
      const beforePermissionSetInstance = new InstanceElement(
        'TestPermissionSet',
        mockTypes.PermissionSet,
        {
          [INSTANCE_FULL_NAME_FIELD]: PERMISSION_SET_FULL_NAME,
          [LABEL]: PERMISSION_SET_FULL_NAME,
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
        }
      )

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
      const afterPermissionSetInstance = beforePermissionSetInstance.clone()
      afterPermissionSetInstance.value.modifiedField = 'after'
      afterPermissionSetInstance.value.modifiedNestedField.modifiedAttr = 'after'
      afterPermissionSetInstance.value.modifiedNestedNestedField.modifiedNestedAttr.modifiedAttr = 'after'
      permissionSetChange = toChange({
        before: beforePermissionSetInstance,
        after: afterPermissionSetInstance,
      })

      filter = filterCreator({
        config: defaultFilterContext,
      }) as FilterWith<'preDeploy' | 'onDeploy'>
      afterPreDeployChanges = [profileChange, permissionSetChange]
      await filter.preDeploy(afterPreDeployChanges)
      afterOnDeployChanges = [...afterPreDeployChanges]
      await filter.onDeploy(afterOnDeployChanges)
    })
    describe('on preDeploy', () => {
      it('should have a minified Profile and PermissionSet changes', () => {
        expect(afterPreDeployChanges).toHaveLength(2)
        const [, afterProfile] = getAllChangeData(afterPreDeployChanges[0])
        expect(afterProfile.value).toEqual({
          [INSTANCE_FULL_NAME_FIELD]: PROFILE_FULL_NAME,
          [LOGIN_IP_RANGES_FIELD]: AFTER_IP_RANGES,
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
        const [, afterPermissionSet] = getAllChangeData(afterPreDeployChanges[1])
        expect(afterPermissionSet.value).toEqual({
          [INSTANCE_FULL_NAME_FIELD]: PERMISSION_SET_FULL_NAME,
          [LABEL]: PERMISSION_SET_FULL_NAME,
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
        expect(afterOnDeployChanges).toHaveLength(2)
        expect(afterOnDeployChanges[0]).toEqual(profileChange)
        expect(afterOnDeployChanges[1]).toEqual(permissionSetChange)
      })
    })
  })
})
