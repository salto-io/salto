/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { InstanceElement, ReferenceExpression, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { getDefaultConfig } from '../../../src/config/config'
import assetsStatusAdditionFilter from '../../../src/filters/assets/assets_instances_deployment'
import { createEmptyType, getFilterParams } from '../../utils'
import { OBJECT_SCHEMA_TYPE, OBJECT_SCHEMA_STATUS_TYPE, OBJECT_TYPE_TYPE } from '../../../src/constants'

describe('assetsInstancesDeployment', () => {
  type FilterType = filterUtils.FilterWith<'preDeploy' | 'onDeploy'>
  let filter: FilterType
  let assetsStatusInstance: InstanceElement
  let objectTypeInstance: InstanceElement
  const assetSchemaInstance = new InstanceElement('assetsSchema1', createEmptyType(OBJECT_SCHEMA_TYPE), {
    id: 5,
    name: 'assetsSchema',
  })
  describe('preDeploy', () => {
    beforeEach(async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      config.fetch.enableJsmExperimental = true
      filter = assetsStatusAdditionFilter(getFilterParams({ config })) as typeof filter
      assetsStatusInstance = new InstanceElement(
        'assetsStatusInstance',
        createEmptyType(OBJECT_SCHEMA_STATUS_TYPE),
        {
          name: 'assetsStatusInstance',
          description: 'test Description',
          category: 2,
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(assetSchemaInstance.elemID, assetSchemaInstance)],
        },
      )
      objectTypeInstance = new InstanceElement(
        'objectTypeInstance',
        createEmptyType(OBJECT_TYPE_TYPE),
        {
          name: 'objectTypeInstance',
          description: 'test Description',
          category: 2,
          parentObjectTypeId: new ReferenceExpression(assetSchemaInstance.elemID, assetSchemaInstance),
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(assetSchemaInstance.elemID, assetSchemaInstance)],
        },
      )
    })
    it('should add objectSchemaId on addition', async () => {
      await filter.preDeploy([{ action: 'add', data: { after: assetsStatusInstance } }])
      expect(assetsStatusInstance.value.objectSchemaId).toEqual(5)
    })
    it('should delete parentObjectTypeId for root object type', async () => {
      await filter.preDeploy([{ action: 'add', data: { after: objectTypeInstance } }])
      expect(objectTypeInstance.value.parentObjectTypeId).toBeUndefined()
    })
    it('should delete parentObjectTypeId for root object type modification', async () => {
      const objectTypeInstanceAfter = objectTypeInstance.clone()
      objectTypeInstanceAfter.value.description = 'new description'
      await filter.preDeploy([
        { action: 'modify', data: { before: objectTypeInstance, after: objectTypeInstanceAfter } },
      ])
      expect(objectTypeInstanceAfter.value.parentObjectTypeId).toBeUndefined()
    })
    it('should do nothing if not parent object type Id', async () => {
      const childObjectType = new InstanceElement(
        'childObjectType',
        createEmptyType(OBJECT_TYPE_TYPE),
        {
          name: 'childObjectType',
          description: 'test Description',
          category: 2,
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(assetSchemaInstance.elemID, assetSchemaInstance)],
        },
      )
      await filter.preDeploy([{ action: 'add', data: { after: childObjectType } }])
      expect(childObjectType.value.parentObjectTypeId).toBeUndefined()
    })
  })
  describe('onDeploy', () => {
    beforeEach(async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      config.fetch.enableJsmExperimental = true
      filter = assetsStatusAdditionFilter(getFilterParams({ config })) as typeof filter
      assetsStatusInstance = new InstanceElement(
        'assetsStatusInstance',
        createEmptyType(OBJECT_SCHEMA_STATUS_TYPE),
        {
          name: 'assetsStatusInstance',
          description: 'test Description',
          category: 2,
          objectSchemaId: 5,
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(assetSchemaInstance.elemID, assetSchemaInstance)],
        },
      )
      objectTypeInstance = new InstanceElement(
        'objectTypeInstance',
        createEmptyType(OBJECT_TYPE_TYPE),
        {
          name: 'objectTypeInstance',
          description: 'test Description',
          category: 2,
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(assetSchemaInstance.elemID, assetSchemaInstance)],
        },
      )
    })
    it('should delete objectSchemaId', async () => {
      await filter.onDeploy([{ action: 'add', data: { after: assetsStatusInstance } }])
      expect(assetsStatusInstance.value.objectSchemaId).toBeUndefined()
    })
    it('should add parentObjectTypeId for root object type', async () => {
      await filter.onDeploy([{ action: 'add', data: { after: objectTypeInstance } }])
      expect(objectTypeInstance.value.parentObjectTypeId).toEqual(
        new ReferenceExpression(assetSchemaInstance.elemID, assetSchemaInstance),
      )
    })
    it('should add parentObjectTypeId for root object type modification', async () => {
      const objectTypeInstanceAfter = objectTypeInstance.clone()
      objectTypeInstanceAfter.value.description = 'new description'
      await filter.onDeploy([
        { action: 'modify', data: { before: objectTypeInstance, after: objectTypeInstanceAfter } },
      ])
      expect(objectTypeInstanceAfter.value.parentObjectTypeId).toEqual(
        new ReferenceExpression(assetSchemaInstance.elemID, assetSchemaInstance),
      )
    })
    it('should do nothing if there is not parentObjectId', async () => {
      const childObjectType = new InstanceElement(
        'childObjectType',
        createEmptyType(OBJECT_TYPE_TYPE),
        {
          name: 'childObjectType',
          description: 'test Description',
          category: 2,
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(assetSchemaInstance.elemID, assetSchemaInstance)],
        },
      )
      await filter.preDeploy([{ action: 'add', data: { after: childObjectType } }])
      expect(childObjectType.value.parentObjectTypeId).toBeUndefined()
    })
    it('should set parentObjectTypeId to undefined if there is no parent', async () => {
      delete objectTypeInstance.annotations[CORE_ANNOTATIONS.PARENT]
      const objectTypeInstanceAfter = objectTypeInstance.clone()
      await filter.onDeploy([
        { action: 'modify', data: { before: objectTypeInstance, after: objectTypeInstanceAfter } },
      ])
      expect(objectTypeInstanceAfter.value.parentObjectTypeId).toBeUndefined()
    })
  })
})
