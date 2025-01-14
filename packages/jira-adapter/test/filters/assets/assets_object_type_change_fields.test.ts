/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { InstanceElement, ReferenceExpression, Element, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { getDefaultConfig } from '../../../src/config/config'
import assetsObjectTypeChangeFields from '../../../src/filters/assets/assets_object_type_change_fields'
import { createEmptyType, getFilterParams } from '../../utils'
import { OBJECT_SCHEMA_TYPE, OBJECT_TYPE_TYPE } from '../../../src/constants'

describe('changeParentsFilter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  let elements: Element[]
  let parentInstance: InstanceElement
  let sonOneInstance: InstanceElement
  const assetSchemaInstance = new InstanceElement('assetsSchema1', createEmptyType(OBJECT_SCHEMA_TYPE), {
    idAsInt: 5,
    name: 'assetsSchema',
  })
  describe('on fetch', () => {
    beforeEach(async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      filter = assetsObjectTypeChangeFields(getFilterParams({ config })) as typeof filter
      parentInstance = new InstanceElement(
        'parentInstance',
        createEmptyType(OBJECT_TYPE_TYPE),
        {
          name: 'parentInstance',
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(assetSchemaInstance.elemID, assetSchemaInstance)],
        },
      )
      sonOneInstance = new InstanceElement(
        'sonOneInstance',
        createEmptyType(OBJECT_TYPE_TYPE),
        {
          name: 'sonOneInstance',
          parentObjectTypeId: new ReferenceExpression(parentInstance.elemID, parentInstance),
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(assetSchemaInstance.elemID, assetSchemaInstance)],
        },
      )

      elements = [parentInstance, sonOneInstance, assetSchemaInstance]
    })
    it('should change parentObjectTypeId of root only', async () => {
      await filter.onFetch(elements)
      expect(parentInstance.value.parentObjectTypeId).toEqual(
        new ReferenceExpression(assetSchemaInstance.elemID, assetSchemaInstance),
      )
      expect(sonOneInstance.value.parentObjectTypeId).toEqual(
        new ReferenceExpression(parentInstance.elemID, parentInstance),
      )
    })
  })
})
