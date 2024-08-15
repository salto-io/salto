/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { InstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { OBJECT_TYPE_ATTRIBUTE_TYPE, OBJECT_TYPE_TYPE, PROJECT_TYPE, SERVICE_DESK } from '../../src/constants'
import { createEmptyType, getFilterParams } from '../utils'
import changeJSMElementsFieldFilter from '../../src/filters/change_jsm_fields'

describe('changeJSMElementsFieldFilter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  let assetsObjectTypeInstance: InstanceElement
  let assetsAttributeInstance: InstanceElement
  let elements: InstanceElement[]
  const projectInstance = new InstanceElement('project1', createEmptyType(PROJECT_TYPE), {
    id: '11111',
    name: 'project1',
    projectTypeKey: SERVICE_DESK,
  })

  beforeEach(() => {
    assetsObjectTypeInstance = new InstanceElement('assetsObjectType', createEmptyType(OBJECT_TYPE_TYPE), {
      id: '11111',
      name: 'ObjectType',
      icon: {
        id: '12345',
      },
    })
    assetsAttributeInstance = new InstanceElement('assetsAttribute', createEmptyType(OBJECT_TYPE_ATTRIBUTE_TYPE), {
      id: '11111',
      name: 'AssetsAttribute',
      defaultType: {
        id: '1',
      },
      referenceType: {
        id: '5',
      },
      referenceObjectTypeId: '6',
    })
    elements = [projectInstance, assetsObjectTypeInstance, assetsAttributeInstance]
  })
  it('should change service desk Id from object to string', async () => {
    filter = changeJSMElementsFieldFilter(getFilterParams({})) as typeof filter
    await filter.onFetch(elements)
    expect(projectInstance.value).toEqual({
      id: '11111',
      name: 'project1',
      projectTypeKey: SERVICE_DESK,
    })
  })
  it('should change icon Id from object to string', async () => {
    filter = changeJSMElementsFieldFilter(getFilterParams({})) as typeof filter
    await filter.onFetch(elements)
    expect(assetsObjectTypeInstance.value).toEqual({
      id: '11111',
      name: 'ObjectType',
      iconId: '12345',
    })
  })
  it('should not change icon Id if icon isnt an object', async () => {
    assetsObjectTypeInstance = new InstanceElement('assetsObjectType', createEmptyType(OBJECT_TYPE_TYPE), {
      id: '11111',
      name: 'ObjectType',
      icon: '12345',
    })
    elements = [projectInstance, assetsObjectTypeInstance]
    filter = changeJSMElementsFieldFilter(getFilterParams({})) as typeof filter
    await filter.onFetch(elements)
    expect(assetsObjectTypeInstance.value).toEqual({
      id: '11111',
      name: 'ObjectType',
      iconId: '12345',
    })
  })
  it('should change defaultTypeId, additionalValue and typeValue from object to string', async () => {
    filter = changeJSMElementsFieldFilter(getFilterParams({})) as typeof filter
    await filter.onFetch(elements)
    expect(assetsAttributeInstance.value).toEqual({
      id: '11111',
      name: 'AssetsAttribute',
      defaultTypeId: '1',
      additionalValue: '5',
      typeValue: '6',
    })
  })
  it('should change defaultTypeId to -1 if defaultType isnt an object', async () => {
    assetsAttributeInstance.value.defaultType = '1'
    elements = [projectInstance, assetsAttributeInstance]
    filter = changeJSMElementsFieldFilter(getFilterParams({})) as typeof filter
    await filter.onFetch(elements)
    expect(assetsAttributeInstance.value.defaultTypeId).toEqual(-1)
  })
  it('should change additionalValue to undefined if referenceType isnt an object', async () => {
    assetsAttributeInstance.value.referenceType = '1'
    elements = [projectInstance, assetsAttributeInstance]
    filter = changeJSMElementsFieldFilter(getFilterParams({})) as typeof filter
    await filter.onFetch(elements)
    expect(assetsAttributeInstance.value.additionalValue).toBeUndefined()
  })
})
