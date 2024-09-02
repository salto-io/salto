/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { filterUtils } from '@salto-io/adapter-components'
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import schemaDeploymentFilter from '../../src/filters/schema_deployment'
import { getFilterParams } from '../utils'
import { APP_USER_SCHEMA_TYPE_NAME, GROUP_SCHEMA_TYPE_NAME, OKTA, USER_SCHEMA_TYPE_NAME } from '../../src/constants'

type FilterType = filterUtils.FilterWith<'preDeploy' | 'onDeploy'>

describe('schemaDeploymentFilter', () => {
  let filter: FilterType
  const logging = logger('okta-adapter/src/filters/schema_deployment')
  const logSpy = jest.spyOn(logging, 'error')

  const groupSchemaType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_SCHEMA_TYPE_NAME) })
  const appUserSchemaType = new ObjectType({ elemID: new ElemID(OKTA, APP_USER_SCHEMA_TYPE_NAME) })
  const userSchemaType = new ObjectType({ elemID: new ElemID(OKTA, USER_SCHEMA_TYPE_NAME) })

  beforeEach(async () => {
    filter = schemaDeploymentFilter(getFilterParams()) as typeof filter
    logSpy.mockClear()
  })
  describe('base field', () => {
    let groupSchemaInstance: InstanceElement
    let appUserSchemaInstance: InstanceElement
    let userSchemaInstance: InstanceElement
    const instanceValue = {
      field1: 'someString',
      definitions: {
        custom: {
          properties: {
            custProperty1: { title: 'custProperty1' },
            custProperty2: { title: 'custProperty2' },
          },
        },
        base: {
          properties: {
            baseProperty1: { title: 'baseProperty1' },
            baseProperty2: { title: 'baseProperty2' },
          },
        },
      },
    }
    beforeEach(() => {
      groupSchemaInstance = new InstanceElement('groupSchemaInstance', groupSchemaType, _.cloneDeep(instanceValue))
      appUserSchemaInstance = new InstanceElement(
        'appUserSchemaInstance',
        appUserSchemaType,
        _.cloneDeep(instanceValue),
      )
      userSchemaInstance = new InstanceElement('userSchemaInstance', userSchemaType, _.cloneDeep(instanceValue))
    })
    it("shouldn't edit addition change", async () => {
      const changes = [
        toChange({ after: groupSchemaInstance }),
        toChange({ after: appUserSchemaInstance }),
        toChange({ after: userSchemaInstance }),
      ]
      const beforePreDeployChanges = _.cloneDeep(changes)
      await filter.preDeploy(changes)
      expect(changes).toEqual(beforePreDeployChanges)

      await filter.onDeploy(changes)
      expect(changes).toEqual(beforePreDeployChanges)
    })
    it("shouldn't edit removal change", async () => {
      const changes = [
        toChange({ before: groupSchemaInstance }),
        toChange({ before: appUserSchemaInstance }),
        toChange({ before: userSchemaInstance }),
      ]
      const beforePreDeployChanges = _.cloneDeep(changes)
      await filter.preDeploy(changes)
      expect(changes).toEqual(beforePreDeployChanges)

      await filter.onDeploy(changes)
      expect(changes).toEqual(beforePreDeployChanges)
    })
    it('should log an error when original after value is not found', async () => {
      const changes = [toChange({ after: groupSchemaInstance })]
      await filter.onDeploy(changes)
      expect(logSpy).toHaveBeenCalledTimes(1)
      expect(logSpy).toHaveBeenCalledWith(
        'Could not find original after value in the onDeploy for okta.GroupSchema.instance.groupSchemaInstance',
      )
    })
    describe('modification changes', () => {
      it("shouldn't edit modification change if the base haven't changed", async () => {
        const groupSchemaAfterInstance = groupSchemaInstance.clone()
        groupSchemaAfterInstance.value.field1 = 'changed'

        const appUserSchemaAfterInstance = appUserSchemaInstance.clone()
        appUserSchemaAfterInstance.value.field1 = 'changed'

        const userSchemaAfterInstance = userSchemaInstance.clone()
        userSchemaAfterInstance.value.field1 = 'changed'
        const changes = [
          toChange({ before: groupSchemaInstance, after: groupSchemaAfterInstance }),
          toChange({ before: appUserSchemaInstance, after: appUserSchemaAfterInstance }),
          toChange({ before: userSchemaInstance, after: userSchemaAfterInstance }),
        ]
        const beforePreDeployChanges = _.cloneDeep(changes)
        await filter.preDeploy(changes)
        expect(changes).toEqual(beforePreDeployChanges)

        await filter.onDeploy(changes)
        expect(changes).toEqual(beforePreDeployChanges)
      })
      it("should make the after's base same as before's base on preDeploy and return to original on onDeploy", async () => {
        const groupSchemaAfterInstance = groupSchemaInstance.clone()
        delete groupSchemaAfterInstance.value.definitions.base.properties.baseProperty2
        groupSchemaAfterInstance.value.definitions.base.properties.baseProperty3 = { title: 'baseProperty3' }
        groupSchemaAfterInstance.value.definitions.base.properties.baseProperty1.title = 'changed'

        const appUserSchemaAfterInstance = appUserSchemaInstance.clone()
        delete appUserSchemaAfterInstance.value.definitions.base.properties.baseProperty2
        appUserSchemaAfterInstance.value.definitions.base.properties.baseProperty3 = { title: 'baseProperty3' }
        appUserSchemaAfterInstance.value.definitions.base.properties.baseProperty1.title = 'changed'

        const userSchemaAfterInstance = userSchemaInstance.clone()
        delete userSchemaAfterInstance.value.definitions.base.properties.baseProperty2
        userSchemaAfterInstance.value.definitions.base.properties.baseProperty3 = { title: 'baseProperty3' }
        userSchemaAfterInstance.value.definitions.base.properties.baseProperty1.title = 'changed'

        const changes = [
          toChange({ before: groupSchemaInstance, after: groupSchemaAfterInstance }),
          toChange({ before: appUserSchemaInstance, after: appUserSchemaAfterInstance }),
          toChange({ before: userSchemaInstance, after: userSchemaAfterInstance }),
        ]
        const originalGroupSchemaAfterInstance = groupSchemaAfterInstance.clone()
        const originalAppUserSchemaAfterInstance = appUserSchemaAfterInstance.clone()
        const originalUserSchemaAfterInstance = userSchemaAfterInstance.clone()

        const beforeBase = groupSchemaInstance.value.definitions.base

        await filter.preDeploy(changes)
        expect(groupSchemaAfterInstance.value.definitions.base).toEqual(beforeBase)
        expect(appUserSchemaAfterInstance.value.definitions.base).toEqual(beforeBase)
        expect(userSchemaAfterInstance.value.definitions.base).toEqual(beforeBase)

        await filter.onDeploy(changes)
        expect(groupSchemaAfterInstance.value.definitions.base).toEqual(
          originalGroupSchemaAfterInstance.value.definitions.base,
        )
        expect(appUserSchemaAfterInstance.value.definitions.base).toEqual(
          originalAppUserSchemaAfterInstance.value.definitions.base,
        )
        expect(userSchemaAfterInstance.value.definitions.base).toEqual(
          originalUserSchemaAfterInstance.value.definitions.base,
        )
      })
    })
  })

  describe('properties', () => {
    describe('schemas with additional properties ', () => {
      const groupSchemaBeforeInstance = new InstanceElement('defaultGroupSchema', groupSchemaType, {
        definitions: {
          custom: {
            properties: {
              property1: {},
              property2: {},
            },
          },
        },
      })
      const groupSchemaAfterInstance = new InstanceElement('defaultGroupSchema', groupSchemaType, {
        definitions: {
          custom: {
            properties: {
              property1: {},
            },
          },
        },
      })
      it('should add null to removed Properties on preDeploy and remove it on onDeploy', async () => {
        const groupSchemaBeforeInstanceCopy = groupSchemaBeforeInstance.clone()
        const groupSchemaAfterInstanceCopy = groupSchemaAfterInstance.clone()
        const changes = [toChange({ before: groupSchemaBeforeInstanceCopy, after: groupSchemaAfterInstanceCopy })]
        await filter.preDeploy(changes)
        expect(groupSchemaAfterInstanceCopy.value.definitions.custom.properties.property2).toBeNull()
        await filter.onDeploy(changes)
        expect(groupSchemaAfterInstanceCopy.value.definitions.custom.properties.property2).toBeUndefined()
      })
      it('should add null to all properties when removing custom properties on preDeploy and remove it on onDeploy', async () => {
        const groupSchemaBeforeInstanceCopy = groupSchemaBeforeInstance.clone()
        const groupSchemaAfterInstanceCopy = groupSchemaAfterInstance.clone()
        delete groupSchemaAfterInstanceCopy.value.definitions.custom.properties
        const changes = [toChange({ before: groupSchemaBeforeInstanceCopy, after: groupSchemaAfterInstanceCopy })]
        await filter.preDeploy(changes)
        expect(groupSchemaAfterInstanceCopy.value.definitions.custom.properties.property1).toBeNull()
        expect(groupSchemaAfterInstanceCopy.value.definitions.custom.properties.property2).toBeNull()
        await filter.onDeploy(changes)
        expect(groupSchemaAfterInstanceCopy.value.definitions.custom.properties).toBeUndefined()
      })
      it('should add null when changing property name', async () => {
        const groupSchemaAfterModifyedInstance = new InstanceElement('defaultGroupSchema', groupSchemaType, {
          definitions: {
            custom: {
              properties: {
                property1: {},
                property3: {},
              },
            },
          },
        })
        await filter.preDeploy([
          toChange({ before: groupSchemaBeforeInstance, after: groupSchemaAfterModifyedInstance }),
        ])
        expect(groupSchemaAfterModifyedInstance.value.definitions.custom.properties.property2).toBeNull()
      })
      it('should log an error when custom properties is not a record', async () => {
        const groupSchemaAfterInstanceThree = new InstanceElement('defaultGroupSchema', groupSchemaType, {
          definitions: {
            custom: {
              properties: 'not a record',
            },
          },
        })
        await filter.preDeploy([toChange({ before: groupSchemaBeforeInstance, after: groupSchemaAfterInstanceThree })])
        expect(logSpy).toHaveBeenCalledTimes(1)
        expect(logSpy).toHaveBeenCalledWith(
          'Custom properties should be a record. Instance: okta.GroupSchema.instance.defaultGroupSchema',
        )
      })
      it('should create an object with nulls if the custom properties field is undefined on preDeploy and delete it on onDeploy', async () => {
        const groupSchemaAfterInstanceFour = new InstanceElement('defaultGroupSchema', groupSchemaType, {
          definitions: {
            custom: {},
          },
        })
        const changes = [toChange({ before: groupSchemaBeforeInstance, after: groupSchemaAfterInstanceFour })]
        await filter.preDeploy(changes)
        expect(groupSchemaAfterInstanceFour.value.definitions.custom.properties).toEqual({
          property1: null,
          property2: null,
        })
        await filter.onDeploy(changes)
        expect(groupSchemaAfterInstanceFour.value.definitions.custom.properties).toBeUndefined()
      })
      it("should not change the instance if the before's custom properties field is not defined", async () => {
        const groupSchemaBeforeInstanceCopy = groupSchemaBeforeInstance.clone()
        delete groupSchemaBeforeInstanceCopy.value.definitions.custom.properties
        const groupSchemaAfterInstanceCopy = groupSchemaAfterInstance.clone()
        const changes = [toChange({ before: groupSchemaBeforeInstanceCopy, after: groupSchemaAfterInstanceCopy })]
        await filter.preDeploy(changes)
        expect(groupSchemaAfterInstanceCopy.value.definitions.custom.properties).toEqual({
          property1: {},
        })
        await filter.onDeploy(changes)
        expect(groupSchemaAfterInstanceCopy.value.definitions.custom.properties).toEqual({
          property1: {},
        })
      })
    })

    describe('schemas without additional properties ', () => {
      const userSchemaBeforeInstance = new InstanceElement('defaultGroupSchema', userSchemaType, {
        definitions: {
          custom: {
            properties: {
              property1: {},
              property2: {},
            },
          },
        },
      })
      const userSchemaAfterInstance = new InstanceElement('defaultGroupSchema', userSchemaType, {
        definitions: {
          custom: {
            properties: {
              property1: {},
            },
          },
        },
      })
      describe('preDeploy', () => {
        it('should add null to removed Properties on preDeploy and remove it on onDeploy', async () => {
          const userSchemaBeforeInstanceCopy = userSchemaBeforeInstance.clone()
          const userSchemaAfterInstanceCopy = userSchemaAfterInstance.clone()
          const changes = [toChange({ before: userSchemaBeforeInstanceCopy, after: userSchemaAfterInstanceCopy })]
          await filter.preDeploy(changes)
          expect(userSchemaAfterInstanceCopy.value.definitions.custom.properties.property2).toBeNull()
          await filter.onDeploy(changes)
          expect(userSchemaAfterInstanceCopy.value.definitions.custom.properties.property2).toBeUndefined()
        })
        it('should add null to all properties when removing custom properties on preDeploy and remove it on onDeploy', async () => {
          const userSchemaBeforeInstanceCopy = userSchemaBeforeInstance.clone()
          const userSchemaAfterInstanceCopy = userSchemaAfterInstance.clone()
          delete userSchemaAfterInstanceCopy.value.definitions.custom.properties
          const changes = [toChange({ before: userSchemaBeforeInstanceCopy, after: userSchemaAfterInstanceCopy })]
          await filter.preDeploy(changes)
          expect(userSchemaAfterInstanceCopy.value.definitions.custom.properties.property1).toBeNull()
          expect(userSchemaAfterInstanceCopy.value.definitions.custom.properties.property2).toBeNull()
          await filter.onDeploy(changes)
          expect(userSchemaAfterInstanceCopy.value.definitions.custom.properties).toBeUndefined()
        })
        it('should add null when changing property name', async () => {
          const userSchemaAfterModifyedInstance = new InstanceElement('defaultGroupSchema', userSchemaType, {
            definitions: {
              custom: {
                properties: {
                  property1: {},
                  property3: {},
                },
              },
            },
          })
          await filter.preDeploy([
            toChange({ before: userSchemaBeforeInstance, after: userSchemaAfterModifyedInstance }),
          ])
          expect(userSchemaAfterModifyedInstance.value.definitions.custom.properties.property2).toBeNull()
        })
      })
      it('should log an error when custom properties is not a record', async () => {
        const userSchemaAfterInstanceThree = new InstanceElement('defaultGroupSchema', userSchemaType, {
          definitions: {
            custom: {
              properties: 0,
            },
          },
        })
        await filter.preDeploy([toChange({ before: userSchemaBeforeInstance, after: userSchemaAfterInstanceThree })])
        expect(logSpy).toHaveBeenCalledTimes(1)
        expect(logSpy).toHaveBeenCalledWith(
          'Custom properties should be a record. Instance: okta.UserSchema.instance.defaultGroupSchema',
        )
      })
      it('should create an empty object if the custom properties field is undefined on preDeploy and delete it on onDeploy', async () => {
        const userSchemaAfterInstanceFour = new InstanceElement('defaultGroupSchema', userSchemaType, {
          definitions: {
            custom: {},
          },
        })
        const changes = [toChange({ before: userSchemaBeforeInstance, after: userSchemaAfterInstanceFour })]
        await filter.preDeploy(changes)
        expect(userSchemaAfterInstanceFour.value.definitions.custom.properties).toEqual({
          property1: null,
          property2: null,
        })
        await filter.onDeploy(changes)
        expect(userSchemaAfterInstanceFour.value.definitions.custom.properties).toBeUndefined()
      })
    })
  })
})
