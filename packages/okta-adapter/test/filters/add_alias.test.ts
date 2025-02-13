/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ObjectType,
  ElemID,
  InstanceElement,
  isInstanceElement,
  CORE_ANNOTATIONS,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { APPLICATION_TYPE_NAME, GROUP_TYPE_NAME, OKTA, PROFILE_MAPPING_TYPE_NAME } from '../../src/constants'
import addAliasFilter from '../../src/filters/add_alias'
import { getFilterParams } from '../utils'

describe('addAliasFilter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  const groupType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_TYPE_NAME) })
  const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  const profileMappingType = new ObjectType({ elemID: new ElemID(OKTA, PROFILE_MAPPING_TYPE_NAME) })
  const groupInstance = new InstanceElement('groupTest', groupType, {
    id: '123',
    type: 'OKTA_GROUP',
    profile: { name: 'test_group' },
  })
  const appAInstance = new InstanceElement('app1', appType, {
    id: '1',
    label: 'app A',
    status: 'INACTIVE',
  })
  const appBInstance = new InstanceElement('app2', appType, {
    id: '2',
    label: 'app B',
    status: 'ACTIVE',
  })
  const mappingInstance = new InstanceElement('mappings', profileMappingType, {
    source: {
      id: new ReferenceExpression(appAInstance.elemID, appAInstance),
      name: 'something',
      type: 'appuser',
    },
    target: {
      id: new ReferenceExpression(appBInstance.elemID, appBInstance),
      name: 'something',
      type: 'appuser',
    },
  })
  const elements = [
    groupType,
    appType,
    profileMappingType,
    groupInstance,
    appAInstance,
    appBInstance,
    profileMappingType,
    mappingInstance,
  ]
  const filter = addAliasFilter(getFilterParams()) as FilterType

  beforeEach(async () => {
    jest.clearAllMocks()
  })

  it('should add alias for instances', async () => {
    await filter.onFetch(elements)
    const aliases = elements
      .filter(isInstanceElement)
      .map(instance => instance.annotations[CORE_ANNOTATIONS.ALIAS])
      .sort()
    const expectedAliases = ['app A', 'app A : app B', 'app B', 'test_group']
    expect(aliases).toEqual(expectedAliases)
  })
})
