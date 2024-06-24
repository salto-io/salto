/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import {
  CORE_ANNOTATIONS,
  InstanceElement,
  Element,
} from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/metadata_instances_aliases'
import { defaultFilterContext } from '../utils'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import { mockTypes } from '../mock_elements'
import { FilterWith } from './mocks'
import { LABEL } from '../../src/constants'

describe('metadataInstancesAliases filter', () => {
  const LABEL_VALUE = 'Test Label'
  const NAMESPACE = 'SBQQ'

  let basicInstance: InstanceElement
  let instanceWithNamespaceAndLabel: InstanceElement
  let instanceWithLabel: InstanceElement
  let instances: InstanceElement[]
  let fetchElements: Element[]
  let filter: FilterWith<'onFetch'>
  beforeEach(() => {
    // Instance that we shouldn't create alias for, as the calculated alias is the same as it's fullName
    basicInstance = new InstanceElement('TestInstance', mockTypes.CustomLabel, {
      fullName: 'TestInstance',
    })
    instanceWithLabel = new InstanceElement('TestInstance', mockTypes.Flow, {
      fullName: 'TestInstance',
      [LABEL]: LABEL_VALUE,
    })

    instanceWithNamespaceAndLabel = new InstanceElement(
      `${NAMESPACE}__TestInstance`,
      mockTypes.Flow,
      {
        fullName: `${NAMESPACE}__TestInstance`,
        [LABEL]: LABEL_VALUE,
      },
    )

    instances = [
      basicInstance,
      instanceWithLabel,
      instanceWithNamespaceAndLabel,
    ]
    fetchElements = [...instances]
  })
  describe('when skipAliases is enabled', () => {
    beforeEach(() => {
      filter = filterCreator({
        config: {
          ...defaultFilterContext,
          fetchProfile: buildFetchProfile({
            fetchParams: { optionalFeatures: { skipAliases: true } },
          }),
        },
      }) as typeof filter
    })
    it('should not add aliases', async () => {
      await filter.onFetch(fetchElements)
      expect(instances).toSatisfyAll(
        (instance) =>
          instance.annotations[CORE_ANNOTATIONS.ALIAS] === undefined,
      )
    })
  })

  describe('when skipAliases is disabled', () => {
    beforeEach(() => {
      filter = filterCreator({
        config: {
          ...defaultFilterContext,
          fetchProfile: buildFetchProfile({
            fetchParams: { optionalFeatures: { skipAliases: false } },
          }),
        },
      }) as typeof filter
    })
    it('should add correct aliases', async () => {
      await filter.onFetch(fetchElements)
      expect(basicInstance.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual(
        'TestInstance',
      )
      expect(instanceWithLabel.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual(
        'Test Label',
      )
      expect(
        instanceWithNamespaceAndLabel.annotations[CORE_ANNOTATIONS.ALIAS],
      ).toEqual('Test Label (SBQQ)')
    })
    describe('when useLabelAsAlias is disabled', () => {
      beforeEach(() => {
        filter = filterCreator({
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              fetchParams: {
                optionalFeatures: {
                  skipAliases: false,
                  useLabelAsAlias: false,
                },
              },
            }),
          },
        }) as typeof filter
      })
      it('should add correct aliases', async () => {
        await filter.onFetch(fetchElements)
        expect(basicInstance.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual(
          'TestInstance',
        )
        expect(instanceWithLabel.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual(
          'TestInstance',
        )
        expect(
          instanceWithNamespaceAndLabel.annotations[CORE_ANNOTATIONS.ALIAS],
        ).toEqual('SBQQ__TestInstance')
      })
    })
  })
})
