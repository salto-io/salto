/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { CORE_ANNOTATIONS, InstanceElement, Element, ReferenceExpression } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/metadata_instances_aliases'
import { defaultFilterContext } from '../utils'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import { mockTypes } from '../mock_elements'
import { FilterWith } from './mocks'

describe('metadataInstancesAliases filter', () => {
  let basicInstance: InstanceElement
  let instanceWithCustomSuffix: InstanceElement
  let instanceWithParent: InstanceElement
  let layoutInstanceWithNamespace: InstanceElement
  let instanceWithLodash: InstanceElement
  let instances: InstanceElement[]
  let fetchElements: Element[]
  let filter: FilterWith<'onFetch'>
  beforeEach(() => {
    // Instance that we shouldn't create alias for, as the calculated alias is the same as it's fullName
    basicInstance = new InstanceElement(
      'TestInstance',
      mockTypes.CustomLabel,
      { fullName: 'TestInstance' }
    )
    instanceWithCustomSuffix = new InstanceElement(
      'TestValueSet__gvs',
      mockTypes.GlobalValueSet,
      { fullName: 'TestValueSet__gvs' }
    )
    // Instances with parents use-cases
    const layoutType = mockTypes.Layout
    layoutType.annotations[CORE_ANNOTATIONS.ALIAS] = 'Layout'
    const accountType = mockTypes.Account
    accountType.annotations[CORE_ANNOTATIONS.ALIAS] = 'Account'
    instanceWithParent = new InstanceElement(
      'Account_Billing',
      mockTypes.WebLink,
      { fullName: 'Account.Billing' },
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(accountType.elemID)] }
    )
    layoutInstanceWithNamespace = new InstanceElement(
      'Account_SBQQ__Amend_Assets',
      mockTypes.Layout,
      { fullName: 'Account-SBQQ__CPQ Account Layout' },
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(accountType.elemID)] }
    )
    instanceWithLodash = new InstanceElement(
      'Test_Instance',
      mockTypes.CustomLabel,
      { fullName: 'Test_Instance_Name' }
    )
    instances = [
      basicInstance,
      instanceWithCustomSuffix,
      instanceWithParent,
      layoutInstanceWithNamespace,
      instanceWithLodash,
    ]
    fetchElements = [...instances, accountType, layoutType]
  })
  describe('when skipAliases is enabled', () => {
    beforeEach(() => {
      filter = filterCreator({
        config: {
          ...defaultFilterContext,
          fetchProfile: buildFetchProfile({
            optionalFeatures: { skipAliases: true },
          }),
        },
      }) as typeof filter
    })
    it('should not add aliases', async () => {
      await filter.onFetch(fetchElements)
      expect(instances).toSatisfyAll(instance => instance.annotations[CORE_ANNOTATIONS.ALIAS] === undefined)
    })
  })

  describe('when skipAliases is disabled', () => {
    beforeEach(() => {
      filter = filterCreator({
        config: {
          ...defaultFilterContext,
          fetchProfile: buildFetchProfile({
            optionalFeatures: { skipAliases: false },
          }),
        },
      }) as typeof filter
    })
    it('should add correct aliases', async () => {
      await filter.onFetch(fetchElements)
      expect(basicInstance.annotations[CORE_ANNOTATIONS.ALIAS]).toBeUndefined()
      expect(instanceWithCustomSuffix.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('TestValueSet')
      expect(instanceWithParent.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('Billing (Account)')
      expect(layoutInstanceWithNamespace.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('SBQQ: CPQ Account Layout (Account)')
      expect(instanceWithLodash.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('Test Instance Name')
    })
  })
})
