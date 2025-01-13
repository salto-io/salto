/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { filterUtils } from '@salto-io/adapter-components'
import { CORE_ANNOTATIONS, Element, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import _ from 'lodash'
import assetsObjectFieldConfigurationReferencesFilter from '../../../src/filters/assets/assets_object_field_configuration_references'
import { createEmptyType, getFilterParams } from '../../utils'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { FIELD_CONTEXT_TYPE_NAME } from '../../../src/filters/fields/constants'
import { OBJECT_SCHEMA_TYPE, OBJECT_TYPE_ATTRIBUTE_TYPE, OBJECT_TYPE_TYPE } from '../../../src/constants'

describe('assetsObjectFieldConfiguration', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let config: JiraConfig
  let elements: Element[]
  let contextInstance1: InstanceElement
  let objectSchemaInstance1: InstanceElement
  let objectSchemaInstance2: InstanceElement
  let objectTypeInstance1: InstanceElement
  let objectTypeInstance2: InstanceElement
  let objectTypeAttribute11: InstanceElement
  let objectTypeAttribute12: InstanceElement
  let objectTypeAttribute21: InstanceElement
  let objectTypeAttribute22: InstanceElement

  const createObjectTypeInstance = (name: string, parent: InstanceElement): InstanceElement =>
    new InstanceElement(name, createEmptyType(OBJECT_TYPE_TYPE), undefined, undefined, {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)],
    })

  const createObjectTypeAttributeInstance = (name: string, objectType: InstanceElement): InstanceElement =>
    new InstanceElement(name, createEmptyType(OBJECT_TYPE_ATTRIBUTE_TYPE), {
      objectType: new ReferenceExpression(objectType.elemID, objectType),
      name,
    })

  beforeEach(() => {
    objectSchemaInstance1 = new InstanceElement('objectSchema1', createEmptyType(OBJECT_SCHEMA_TYPE))
    objectSchemaInstance2 = new InstanceElement('objectSchema2', createEmptyType(OBJECT_SCHEMA_TYPE))

    objectTypeInstance1 = createObjectTypeInstance('objectType1', objectSchemaInstance1)
    objectTypeInstance2 = createObjectTypeInstance('objectType2', objectSchemaInstance1)

    objectTypeAttribute11 = createObjectTypeAttributeInstance('objectTypeAttribute11', objectTypeInstance1)
    objectTypeAttribute12 = createObjectTypeAttributeInstance('objectTypeAttribute12', objectTypeInstance1)
    objectTypeAttribute21 = createObjectTypeAttributeInstance('objectTypeAttribute21', objectTypeInstance2)
    objectTypeAttribute22 = createObjectTypeAttributeInstance('objectTypeAttribute22', objectTypeInstance2)

    contextInstance1 = new InstanceElement('context1', createEmptyType(FIELD_CONTEXT_TYPE_NAME), {
      assetsObjectFieldConfiguration: {
        objectSchemaId: new ReferenceExpression(objectSchemaInstance1.elemID, objectSchemaInstance1),
        attributesIncludedInAutoCompleteSearch: ['objectTypeAttribute11', 'objectTypeAttribute12', 'Label'],
        attributesDisplayedOnIssue: ['objectTypeAttribute21', 'objectTypeAttribute22'],
      },
    })
    elements = [
      objectSchemaInstance1,
      objectSchemaInstance2,
      objectTypeInstance1,
      objectTypeInstance2,
      objectTypeAttribute11,
      objectTypeAttribute12,
      objectTypeAttribute21,
      objectTypeAttribute22,
      contextInstance1,
    ]
  })
  describe('onFetch', () => {
    beforeEach(() => {
      config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableAssetsObjectFieldConfiguration = true
      filter = assetsObjectFieldConfigurationReferencesFilter(
        getFilterParams({
          config,
        }),
      ) as typeof filter
    })

    it('should create references to objectTypeAttribute instances', async () => {
      await filter.onFetch(elements)
      expect(contextInstance1.value.assetsObjectFieldConfiguration.attributesIncludedInAutoCompleteSearch).toEqual([
        new ReferenceExpression(objectTypeAttribute11.elemID, objectTypeAttribute11),
        new ReferenceExpression(objectTypeAttribute12.elemID, objectTypeAttribute12),
        'Label',
      ])
      expect(contextInstance1.value.assetsObjectFieldConfiguration.attributesDisplayedOnIssue).toEqual([
        new ReferenceExpression(objectTypeAttribute21.elemID, objectTypeAttribute21),
        new ReferenceExpression(objectTypeAttribute22.elemID, objectTypeAttribute22),
      ])
    })

    it('should not create references when the attribute is not a grand child of the relevant objectSchema', async () => {
      contextInstance1.value.assetsObjectFieldConfiguration.objectSchemaId = new ReferenceExpression(
        objectSchemaInstance2.elemID,
        objectSchemaInstance2,
      )
      await filter.onFetch(elements)
      expect(contextInstance1.value.assetsObjectFieldConfiguration.attributesIncludedInAutoCompleteSearch).toEqual([
        'objectTypeAttribute11',
        'objectTypeAttribute12',
        'Label',
      ])
      expect(contextInstance1.value.assetsObjectFieldConfiguration.attributesDisplayedOnIssue).toEqual([
        'objectTypeAttribute21',
        'objectTypeAttribute22',
      ])
    })

    it('should do nothing if enableAssetsObjectFieldConfiguration is false', async () => {
      config.fetch.enableAssetsObjectFieldConfiguration = false
      await filter.onFetch(elements)
      expect(contextInstance1.value.assetsObjectFieldConfiguration.attributesIncludedInAutoCompleteSearch).toEqual([
        'objectTypeAttribute11',
        'objectTypeAttribute12',
        'Label',
      ])
      expect(contextInstance1.value.assetsObjectFieldConfiguration.attributesDisplayedOnIssue).toEqual([
        'objectTypeAttribute21',
        'objectTypeAttribute22',
      ])
    })

    it('should not change the instance if there are no attributes', async () => {
      contextInstance1.value.assetsObjectFieldConfiguration.attributesIncludedInAutoCompleteSearch = undefined
      contextInstance1.value.assetsObjectFieldConfiguration.attributesDisplayedOnIssue = undefined
      await filter.onFetch(elements)
      expect(contextInstance1.value.assetsObjectFieldConfiguration.attributesIncludedInAutoCompleteSearch).toEqual(
        undefined,
      )
      expect(contextInstance1.value.assetsObjectFieldConfiguration.attributesDisplayedOnIssue).toEqual(undefined)
    })
  })
})
