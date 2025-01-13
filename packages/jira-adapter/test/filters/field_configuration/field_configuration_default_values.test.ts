/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, toChange } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { FIELD_CONFIGURATION_TYPE_NAME } from '../../../src/constants'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'
import fieldConfiguration from '../../../src/filters/field_configuration/field_configuration'

import { createEmptyType, createMockElementsSource, getFilterParams } from '../../utils'

describe('fieldConfigurationDefaultValues', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let instance: InstanceElement
  let config: JiraConfig
  let fieldInstances: InstanceElement[]
  let instanceAfterFetch: InstanceElement

  beforeEach(async () => {
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.removeFieldConfigurationDefaultValues = true

    instance = new InstanceElement('instance', createEmptyType(FIELD_CONFIGURATION_TYPE_NAME), {
      fields: [
        {
          id: 'fieldInstance1',
          description: 'same description',
          isRequired: false,
          isHidden: false,
        },
        {
          id: 'fieldInstance2',
          description: 'bla bla',
          isRequired: true,
          isHidden: true,
        },
      ],
    })
    instanceAfterFetch = new InstanceElement('instanceAfterFetch', createEmptyType(FIELD_CONFIGURATION_TYPE_NAME), {
      fields: {
        fieldInstance1: {},
        fieldInstance2: {
          description: 'bla bla',
          isRequired: true,
          isHidden: true,
        },
      },
    })
    fieldInstances = [
      new InstanceElement('fieldInstance1', createEmptyType(FIELD_TYPE_NAME), {
        id: 'fieldInstance1',
        description: 'same description',
      }),
      new InstanceElement('fieldInstance2', createEmptyType(FIELD_TYPE_NAME), {
        id: 'fieldInstance2',
        description: 'different description',
      }),
    ]
    filter = fieldConfiguration(
      getFilterParams({
        config,
        elementsSource: createMockElementsSource(fieldInstances),
      }),
    ) as typeof filter
  })

  describe('onFetch', () => {
    it('should remove default values', async () => {
      await filter.onFetch?.([instance, ...fieldInstances])
      expect(instance.value.fields.fieldInstance1).toBeDefined()
      expect(instance.value.fields.fieldInstance1).toEqual({})
    })

    it('should not remove non-default values', async () => {
      await filter.onFetch?.([instance, ...fieldInstances])
      expect(instance.value.fields.fieldInstance2).toBeDefined()
      expect(instance.value.fields.fieldInstance2).toEqual({
        description: 'bla bla',
        isRequired: true,
        isHidden: true,
      })
    })

    it('should do nothing if removeFieldConfigurationDefaultValues is false', async () => {
      config.fetch.removeFieldConfigurationDefaultValues = false
      await filter.onFetch?.([instance, ...fieldInstances])
      expect(instance.value.fields).toEqual({
        fieldInstance1: {
          description: 'same description',
          isRequired: false,
          isHidden: false,
        },
        fieldInstance2: {
          description: 'bla bla',
          isRequired: true,
          isHidden: true,
        },
      })
    })
  })
  describe('preDeploy', () => {
    it('should add default values', async () => {
      await filter.preDeploy?.([toChange({ after: instanceAfterFetch })])
      expect(instanceAfterFetch.value.fields[0]).toEqual({
        id: 'fieldInstance1',
        description: 'same description',
        isRequired: false,
        isHidden: false,
      })
    })

    it('should do nothing when values are already set', async () => {
      await filter.preDeploy?.([toChange({ after: instanceAfterFetch })])
      expect(instanceAfterFetch.value.fields[1]).toEqual({
        id: 'fieldInstance2',
        description: 'bla bla',
        isRequired: true,
        isHidden: true,
      })
    })
    it('should do nothing if the fields are not available', async () => {
      const emptySource = createMockElementsSource([])
      const emptyFilter = fieldConfiguration(
        getFilterParams({
          config,
          elementsSource: emptySource,
        }),
      ) as typeof filter
      await emptyFilter.preDeploy?.([toChange({ after: instanceAfterFetch })])
      expect(instanceAfterFetch.value.fields).toEqual([])
    })

    it('should do nothing if removeFieldConfigurationDefaultValues is false', async () => {
      config.fetch.removeFieldConfigurationDefaultValues = false
      await filter.preDeploy?.([toChange({ after: instanceAfterFetch })])
      expect(instanceAfterFetch.value.fields).toEqual([
        {
          id: 'fieldInstance1',
        },
        {
          id: 'fieldInstance2',
          description: 'bla bla',
          isRequired: true,
          isHidden: true,
        },
      ])
    })
  })

  describe('onDeploy', () => {
    it('should remove default values', async () => {
      await filter.onDeploy?.([toChange({ after: instance })])
      expect(instance.value.fields.fieldInstance1).toBeDefined()
      expect(instance.value.fields.fieldInstance1).toEqual({})
    })
    it('should not remove non-default values', async () => {
      await filter.onDeploy?.([toChange({ after: instance })])
      expect(instance.value.fields.fieldInstance2).toBeDefined()
      expect(instance.value.fields.fieldInstance2).toEqual({
        description: 'bla bla',
        isRequired: true,
        isHidden: true,
      })
    })
  })
})
