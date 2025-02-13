/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { filterUtils, elements as adapterElements } from '@salto-io/adapter-components'
import { DAG } from '@salto-io/dag'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { InstanceElement, ReferenceExpression, Element } from '@salto-io/adapter-api'
import { getDefaultConfig } from '../../../src/config/config'
import assetsObjectTypePath from '../../../src/filters/assets/assets_object_type_path'
import { createEmptyType, getFilterParams } from '../../utils'
import { OBJECT_SCHEMA_TYPE, OBJECT_TYPE_TYPE, JIRA } from '../../../src/constants'

describe('assetsObjectTypePathsFilter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  let elements: Element[]
  let parentInstance: InstanceElement
  let sonOneInstance: InstanceElement
  let sonTwoInstance: InstanceElement
  let grandsonOneInstance: InstanceElement
  let grandsonTwoInstance: InstanceElement
  let getDataSpy: jest.SpyInstance
  let logErrorSpy: jest.SpyInstance

  const assetSchemaInstance = new InstanceElement(
    'assetsSchema1',
    createEmptyType(OBJECT_SCHEMA_TYPE),
    {
      idAsInt: 5,
      name: 'assetsSchema',
    },
    [JIRA, adapterElements.RECORDS_PATH, 'ObjectSchema', 'assetsSchema1', 'assetsSchema1'],
  )
  describe('on fetch', () => {
    beforeEach(async () => {
      getDataSpy = jest.spyOn(DAG.prototype, 'getData')
      const logging = logger('jira-adapter/src/filters/assets/assets_object_type_path')
      logErrorSpy = jest.spyOn(logging, 'error')
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      config.fetch.enableJsmExperimental = true
      filter = assetsObjectTypePath(getFilterParams({ config })) as typeof filter
      parentInstance = new InstanceElement(
        'parentInstance',
        createEmptyType(OBJECT_TYPE_TYPE),
        {
          name: 'parentInstance',
          parentObjectTypeId: new ReferenceExpression(assetSchemaInstance.elemID, assetSchemaInstance),
        },
        [JIRA, adapterElements.RECORDS_PATH, 'ObjectSchema', 'assetsSchema1', 'objectTypes', 'parentInstance'],
      )
      sonOneInstance = new InstanceElement(
        'sonOneInstance',
        createEmptyType(OBJECT_TYPE_TYPE),
        {
          name: 'sonOneInstance',
          parentObjectTypeId: new ReferenceExpression(parentInstance.elemID, parentInstance),
        },
        [JIRA, adapterElements.RECORDS_PATH, 'ObjectSchema', 'assetsSchema1', 'objectTypes', 'sonOneInstance'],
      )
      sonTwoInstance = new InstanceElement(
        'sonTwoInstance',
        createEmptyType(OBJECT_TYPE_TYPE),
        {
          name: 'sonTwoInstance',
          parentObjectTypeId: new ReferenceExpression(parentInstance.elemID, parentInstance),
        },
        [JIRA, adapterElements.RECORDS_PATH, 'ObjectSchema', 'assetsSchema1', 'objectTypes', 'sonTwoInstance'],
      )
      grandsonOneInstance = new InstanceElement(
        'grandsonOneInstance',
        createEmptyType(OBJECT_TYPE_TYPE),
        {
          name: 'grandsonOneInstance',
          parentObjectTypeId: new ReferenceExpression(sonOneInstance.elemID, sonOneInstance),
        },
        [JIRA, adapterElements.RECORDS_PATH, 'ObjectSchema', 'assetsSchema1', 'objectTypes', 'grandsonOneInstance'],
      )
      grandsonTwoInstance = new InstanceElement(
        'grandsonTwoInstance',
        createEmptyType(OBJECT_TYPE_TYPE),
        {
          name: 'grandsonTwoInstance',
          parentObjectTypeId: new ReferenceExpression(sonOneInstance.elemID, sonOneInstance),
        },
        [JIRA, adapterElements.RECORDS_PATH, 'ObjectSchema', 'assetsSchema1', 'objectTypes', 'grandsonTwoInstance'],
      )

      elements = [
        parentInstance,
        sonOneInstance,
        sonTwoInstance,
        grandsonOneInstance,
        grandsonTwoInstance,
        assetSchemaInstance,
      ]
    })
    it('should change path to be subdirectory of parent', async () => {
      await filter.onFetch(elements)
      expect(parentInstance.path).toEqual([
        JIRA,
        adapterElements.RECORDS_PATH,
        'ObjectSchema',
        'assetsSchema1',
        'objectTypes',
        'parentInstance',
        'parentInstance',
      ])
      expect(sonOneInstance.path).toEqual([
        JIRA,
        adapterElements.RECORDS_PATH,
        'ObjectSchema',
        'assetsSchema1',
        'objectTypes',
        'parentInstance',
        'sonOneInstance',
        'sonOneInstance',
      ])
      expect(sonTwoInstance.path).toEqual([
        JIRA,
        adapterElements.RECORDS_PATH,
        'ObjectSchema',
        'assetsSchema1',
        'objectTypes',
        'parentInstance',
        'sonTwoInstance',
        'sonTwoInstance',
      ])
      expect(grandsonOneInstance.path).toEqual([
        JIRA,
        adapterElements.RECORDS_PATH,
        'ObjectSchema',
        'assetsSchema1',
        'objectTypes',
        'parentInstance',
        'sonOneInstance',
        'grandsonOneInstance',
        'grandsonOneInstance',
      ])
      expect(grandsonTwoInstance.path).toEqual([
        JIRA,
        adapterElements.RECORDS_PATH,
        'ObjectSchema',
        'assetsSchema1',
        'objectTypes',
        'parentInstance',
        'sonOneInstance',
        'grandsonTwoInstance',
        'grandsonTwoInstance',
      ])
    })
    it('should not fail the fetch if one instance throws an error', async () => {
      getDataSpy.mockImplementationOnce(() => {
        getDataSpy.mockClear()
        throw new Error('failed to get data')
      })
      await expect(filter.onFetch(elements)).resolves.not.toThrow()
      expect(sonOneInstance.path).toEqual([
        JIRA,
        adapterElements.RECORDS_PATH,
        'ObjectSchema',
        'assetsSchema1',
        'objectTypes',
        'sonOneInstance',
        'sonOneInstance',
      ])
      expect(sonTwoInstance.path).toEqual([
        JIRA,
        adapterElements.RECORDS_PATH,
        'ObjectSchema',
        'assetsSchema1',
        'objectTypes',
        'sonTwoInstance',
        'sonTwoInstance',
      ])
      expect(grandsonOneInstance.path).toEqual([
        JIRA,
        adapterElements.RECORDS_PATH,
        'ObjectSchema',
        'assetsSchema1',
        'objectTypes',
        'sonOneInstance',
        'grandsonOneInstance',
        'grandsonOneInstance',
      ])
      expect(grandsonTwoInstance.path).toEqual([
        JIRA,
        adapterElements.RECORDS_PATH,
        'ObjectSchema',
        'assetsSchema1',
        'objectTypes',
        'sonOneInstance',
        'grandsonTwoInstance',
        'grandsonTwoInstance',
      ])
      expect(logErrorSpy).toHaveBeenCalled()
    })
  })
})
