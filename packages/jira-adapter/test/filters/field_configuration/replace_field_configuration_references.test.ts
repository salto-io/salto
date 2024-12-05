/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, MapType, ObjectType, toChange } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { FIELD_CONFIGURATION_ITEM_TYPE_NAME, FIELD_CONFIGURATION_TYPE_NAME, JIRA } from '../../../src/constants'
import FieldConfigurationFilter from '../../../src/filters/field_configuration/field_configuration'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'

import { createMockElementsSource, getFilterParams } from '../../utils'

describe('replaceFieldConfigurationReferencesFilter', () => {
  let filter: filterUtils.FilterWith<'deploy'>
  let fieldConfigType: ObjectType
  let fieldConfigItemType: ObjectType
  let fieldType: ObjectType
  let instance: InstanceElement
  let fieldInstance: InstanceElement
  let config: JiraConfig

  beforeEach(async () => {
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.splitFieldConfiguration = false

    fieldConfigItemType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONFIGURATION_ITEM_TYPE_NAME),
    })

    fieldConfigType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONFIGURATION_TYPE_NAME),
      fields: {
        fields: {
          refType: new MapType(fieldConfigItemType),
        },
      },
    })

    instance = new InstanceElement('instance', fieldConfigType, {
      fields: [
        {
          id: 'fieldInstance',
          isRequired: true,
        },
      ],
    })

    fieldType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_TYPE_NAME),
    })

    fieldInstance = new InstanceElement('fieldInstance', fieldType, {
      id: 'fieldInstance',
    })

    const elementsSource = createMockElementsSource([fieldInstance])
    filter = FieldConfigurationFilter(
      getFilterParams({
        config,
        elementsSource,
      }),
    ) as typeof filter
  })

  describe('fetch', () => {
    it('should convert fields to a map', async () => {
      await filter.onFetch?.([instance, fieldConfigType, fieldInstance])
      expect(instance.value.fields).toEqual({
        fieldInstance: {
          isRequired: true,
        },
      })
    })

    it('should convert the fields field', async () => {
      await filter.onFetch?.([instance, fieldConfigType])
      expect(await fieldConfigType.fields.fields.getType()).toBeInstanceOf(MapType)
    })
  })

  describe('preDeploy onDeploy', () => {
    beforeEach(() => {
      instance = new InstanceElement('instance', fieldConfigType, {
        fields: {
          fieldInstance: {
            isRequired: true,
          },
        },
      })
    })
    it('should convert fields to a list', async () => {
      await filter.preDeploy?.([toChange({ after: instance })])
      expect(instance.value.fields).toBeArrayOfSize(1)
      await filter.onDeploy?.([toChange({ after: instance })])
      expect(instance.value.fields).toEqual({
        fieldInstance: {
          isRequired: true,
        },
      })
    })
    it('should not fail if the field does not exist', async () => {
      const emptySource = createMockElementsSource([])
      const emptyFilter = FieldConfigurationFilter(
        getFilterParams({
          config,
          elementsSource: emptySource,
        }),
      ) as typeof filter
      await emptyFilter.preDeploy?.([toChange({ after: instance })])
      expect(instance.value.fields).toBeArrayOfSize(0)
    })
    it('should not fail if the fields value is deleted', async () => {
      instance.value.fields = undefined
      await filter.preDeploy?.([toChange({ after: instance })])
      expect(instance.value.fields).toBeUndefined()
    })

    it('should do nothing if fields is corrupted', async () => {
      instance.value.fields = 'invalid'
      await filter.preDeploy?.([toChange({ after: instance })])
      expect(instance.value.fields).toEqual('invalid')
    })

    it('should omit corrupted fields', async () => {
      instance.value.fields.anotherField = 'invalid'
      await filter.preDeploy?.([toChange({ after: instance })])
      expect(instance.value.fields).toBeArrayOfSize(1)
    })
  })
})
