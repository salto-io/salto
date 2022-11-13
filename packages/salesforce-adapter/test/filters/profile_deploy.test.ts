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
import { INSTANCE_FULL_NAME_FIELD } from '../../src/constants'

describe('profileDeployFilter', () => {
  describe('deploy flow', () => {
    const FULL_NAME = 'ProfileFullName'
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
    let originalChange: Change<InstanceElement>
    let afterPreDeployChanges: Change<InstanceElement>[]
    let afterOnDeployChanges: Change<InstanceElement>[]

    beforeAll(async () => {
      const beforeInstance = new InstanceElement(
        'TestProfile',
        mockTypes.Profile,
        {
          [INSTANCE_FULL_NAME_FIELD]: FULL_NAME,
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

      const afterInstance = beforeInstance.clone()
      afterInstance.value.modifiedField = 'after'
      afterInstance.value.modifiedNestedField.modifiedAttr = 'after'
      afterInstance.value.modifiedNestedNestedField.modifiedNestedAttr.modifiedAttr = 'after'
      afterInstance.value[LAYOUT_ASSIGNMENTS_FIELD].newLayoutAssignment = [{ layout: 'newLayoutAssignment' }]
      afterInstance.value[LOGIN_IP_RANGES_FIELD] = AFTER_IP_RANGES
      originalChange = toChange({
        before: beforeInstance,
        after: afterInstance,
      })

      filter = filterCreator({
        config: defaultFilterContext,
      }) as FilterWith<'preDeploy' | 'onDeploy'>
      afterPreDeployChanges = [originalChange]
      await filter.preDeploy(afterPreDeployChanges)
      afterOnDeployChanges = [...afterPreDeployChanges]
      await filter.onDeploy(afterOnDeployChanges)
    })
    describe('on preDeploy', () => {
      it('should have a minified Profile change', () => {
        expect(afterPreDeployChanges).toHaveLength(1)
        const [, after] = getAllChangeData(afterPreDeployChanges[0])
        expect(after.value).toEqual({
          [INSTANCE_FULL_NAME_FIELD]: FULL_NAME,
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
      })
    })
    describe('on onDeploy', () => {
      it('should have the original change', () => {
        expect(afterOnDeployChanges).toHaveLength(1)
        expect(afterOnDeployChanges[0]).toEqual(originalChange)
      })
    })
  })
})
