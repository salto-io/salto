/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, InstanceElement, Element } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/metadata_instances_aliases'
import { defaultFilterContext } from '../utils'
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

    instanceWithNamespaceAndLabel = new InstanceElement(`${NAMESPACE}__TestInstance`, mockTypes.Flow, {
      fullName: `${NAMESPACE}__TestInstance`,
      [LABEL]: LABEL_VALUE,
    })

    instances = [basicInstance, instanceWithLabel, instanceWithNamespaceAndLabel]
    fetchElements = [...instances]
  })

  beforeEach(() => {
    filter = filterCreator({
      config: defaultFilterContext,
    }) as typeof filter
  })

  it('should add correct aliases', async () => {
    await filter.onFetch(fetchElements)
    expect(basicInstance.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('TestInstance')
    expect(instanceWithLabel.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('Test Label')
    expect(instanceWithNamespaceAndLabel.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('Test Label (SBQQ)')
  })
})
