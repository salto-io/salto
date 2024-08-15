/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { filterUtils, elements as elementsDeprecated } from '@salto-io/adapter-components'
import _ from 'lodash'
import { InstanceElement, ReferenceExpression, Element, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { getDefaultConfig } from '../../../src/config/config'
import addAttributesAsFieldsFilter from '../../../src/filters/assets/change_attributes_path'
import { createEmptyType, getFilterParams } from '../../utils'
import { OBJECT_SCHEMA_TYPE, OBJECT_TYPE_ATTRIBUTE_TYPE, OBJECT_TYPE_TYPE, JIRA } from '../../../src/constants'

const { RECORDS_PATH } = elementsDeprecated

describe('ChangeAttributesPath', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  let elements: Element[]
  let parentInstance: InstanceElement
  let sonInstance: InstanceElement
  let attributeInstance: InstanceElement
  let attributeInstance2: InstanceElement
  const assetSchemaInstance = new InstanceElement('assetsSchema1', createEmptyType(OBJECT_SCHEMA_TYPE), {
    idAsInt: 5,
    name: 'assetsSchema',
  })
  describe('on fetch', () => {
    beforeEach(async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      config.fetch.enableJsmExperimental = true
      filter = addAttributesAsFieldsFilter(getFilterParams({ config })) as typeof filter
      parentInstance = new InstanceElement(
        'parentInstance',
        createEmptyType(OBJECT_TYPE_TYPE),
        {
          name: 'parentInstance',
        },
        [
          JIRA,
          RECORDS_PATH,
          OBJECT_SCHEMA_TYPE,
          assetSchemaInstance.elemID.name,
          'objectTypes',
          'parentInstance',
          'parentInstance',
        ],
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(assetSchemaInstance.elemID, assetSchemaInstance)],
        },
      )
      sonInstance = new InstanceElement(
        'sonOneInstance',
        createEmptyType(OBJECT_TYPE_TYPE),
        {
          name: 'sonOneInstance',
          parentObjectTypeId: new ReferenceExpression(parentInstance.elemID, parentInstance),
        },
        [
          JIRA,
          RECORDS_PATH,
          OBJECT_SCHEMA_TYPE,
          assetSchemaInstance.elemID.name,
          'objectTypes',
          'parentInstance',
          'sonOneInstance',
          'sonOneInstance',
        ],
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(assetSchemaInstance.elemID, assetSchemaInstance)],
        },
      )
      attributeInstance = new InstanceElement(
        'attributeInstance',
        createEmptyType(OBJECT_TYPE_ATTRIBUTE_TYPE),
        {
          name: 'attributeInstance',
          objectType: new ReferenceExpression(parentInstance.elemID, parentInstance),
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(assetSchemaInstance.elemID, assetSchemaInstance)],
        },
      )
      attributeInstance2 = new InstanceElement(
        'attributeInstance2',
        createEmptyType(OBJECT_TYPE_ATTRIBUTE_TYPE),
        {
          name: 'attributeInstance2',
          objectType: new ReferenceExpression(sonInstance.elemID, sonInstance),
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(assetSchemaInstance.elemID, assetSchemaInstance)],
        },
      )
      elements = [parentInstance, sonInstance, assetSchemaInstance, attributeInstance, attributeInstance2]
    })
    it('should change each attribute path to the objectType that created it', async () => {
      await filter.onFetch(elements)
      expect(attributeInstance.path).toEqual([
        JIRA,
        RECORDS_PATH,
        OBJECT_SCHEMA_TYPE,
        assetSchemaInstance.elemID.name,
        'objectTypes',
        'parentInstance',
        'attributes',
        'attributeInstance',
      ])
      expect(attributeInstance2.path).toEqual([
        JIRA,
        RECORDS_PATH,
        OBJECT_SCHEMA_TYPE,
        assetSchemaInstance.elemID.name,
        'objectTypes',
        'parentInstance',
        'sonOneInstance',
        'attributes',
        'attributeInstance2',
      ])
    })
  })
})
