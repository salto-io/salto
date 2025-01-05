/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ObjectType,
  ElemID,
  InstanceElement,
  ReferenceExpression,
  SaltoError,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { getAndLogCollisionWarnings, getInstancesWithCollidingElemID, getCollisionWarnings } from '../src/collisions'

const COLLISION_MESSAGE = 'Some elements were not fetched due to Salto ID collisions'

describe('collisions', () => {
  let instType: ObjectType
  let instance: InstanceElement
  let collidedInstance: InstanceElement
  let differentInstance: InstanceElement
  beforeEach(() => {
    instType = new ObjectType({
      elemID: new ElemID('salto', 'obj'),
    })
    instance = new InstanceElement(
      'test',
      instType,
      {
        title: 'test',
        ref: new ReferenceExpression(new ElemID('salto', 'something'), 'some value'),
      },
      undefined,
      {
        [CORE_ANNOTATIONS.SERVICE_URL]: 'someUrl',
        [CORE_ANNOTATIONS.ALIAS]: 'aliasName',
      },
    )
    collidedInstance = new InstanceElement('test', instType, { title: 'test', val: 'val' }, undefined, {
      [CORE_ANNOTATIONS.SERVICE_URL]: 'QuackUrl',
      [CORE_ANNOTATIONS.ALIAS]: 'QuackAliasName',
    })
    differentInstance = new InstanceElement('test1', instType, { title: 'test1' }, undefined, {
      [CORE_ANNOTATIONS.SERVICE_URL]: 'anotherUrl',
      [CORE_ANNOTATIONS.ALIAS]: 'anotherAliasName',
    })
  })
  describe('getInstancesWithCollidingElemID', () => {
    it('should return empty lists if there is no collisions', () => {
      const collidedElements = getInstancesWithCollidingElemID([instance, differentInstance])
      expect(collidedElements).toHaveLength(0)
    })
    it('should return only the collided instances', () => {
      const collidedElements = getInstancesWithCollidingElemID([instance, collidedInstance, differentInstance])
      expect(collidedElements).toHaveLength(2)
      expect(collidedElements).toEqual([instance, collidedInstance])
    })
  })
  describe('getAndLogCollisionWarnings', () => {
    const baseExpectedWarningMessage = `Omitted 2 instances of obj due to Salto ID collisions.
Current Salto ID configuration for obj is defined as [title].

Breakdown per colliding Salto ID:
- test:
\t* Instance with Id - test. View in the service - someUrl
\t* Instance with Id - test. View in the service - someUrl

To resolve these collisions please take one of the following actions and fetch again:
\t1. Change obj's unique fields to include all fields that uniquely identify the type's instances.
\t2. Delete duplicate instances from your salto account.

Alternatively, you can exclude obj from the default configuration in salto.nacl`

    it('should return the correct warning messages', async () => {
      const errors = await getAndLogCollisionWarnings({
        instances: [instance, instance.clone()],
        adapterName: 'salto',
        configurationName: 'default',
        getInstanceName: async inst => inst.elemID.name,
        getTypeName: async inst => inst.elemID.typeName,
        getIdFieldsByType: () => ['title'],
        idFieldsName: 'unique fields',
      })
      expect(errors).toHaveLength(1)
      expect(errors[0]).toEqual({
        severity: 'Warning',
        message: COLLISION_MESSAGE,
        detailedMessage: baseExpectedWarningMessage,
      })
    })

    it('should return the correct warning messages when docsUrl is provided', async () => {
      const docsUrl = 'https://help.salto.io/en/articles/6927217-salto-for-salesforce-cpq-support'
      const errors = await getAndLogCollisionWarnings({
        instances: [instance, instance.clone()],
        adapterName: 'salto',
        configurationName: 'default',
        getInstanceName: async inst => inst.elemID.name,
        getTypeName: async inst => inst.elemID.typeName,
        getIdFieldsByType: () => ['title'],
        idFieldsName: 'unique fields',
        docsUrl,
      })
      expect(errors).toHaveLength(1)
      expect(errors[0]).toEqual({
        severity: 'Warning',
        message: COLLISION_MESSAGE,
        detailedMessage: `${baseExpectedWarningMessage}\n\nLearn more at: ${docsUrl}`,
      })
    })

    it('should return no errors when there are no collided instances', async () => {
      const errors = await getAndLogCollisionWarnings({
        instances: [],
        adapterName: 'salto',
        configurationName: 'default',
        getInstanceName: async inst => inst.elemID.name,
        getTypeName: async inst => inst.elemID.typeName,
        getIdFieldsByType: () => ['title'],
        idFieldsName: 'unique fields',
      })
      expect(errors).toHaveLength(0)
    })
  })
  describe('when collision occurs due to instances with empty name', () => {
    let collisionWarnings: SaltoError[]
    beforeEach(async () => {
      const instanceWithEmptyName = new InstanceElement(ElemID.CONFIG_NAME, instType)
      collisionWarnings = await getAndLogCollisionWarnings({
        instances: [instanceWithEmptyName, instanceWithEmptyName.clone()],
        adapterName: 'salto',
        configurationName: 'default',
        getInstanceName: async inst => inst.elemID.name,
        getTypeName: async inst => inst.elemID.typeName,
        getIdFieldsByType: () => ['title'],
        idFieldsName: 'unique fields',
      })
    })
    it('should create indicative warning', () => {
      expect(collisionWarnings).toEqual([
        expect.objectContaining({
          severity: 'Warning',
          message: expect.stringContaining(COLLISION_MESSAGE),
          detailedMessage: expect.stringContaining(
            'Instances with empty name (Due to no values in any of the provided ID fields)',
          ),
        }),
      ])
    })
  })
  describe('getAndLogCollisionWarningsV2', () => {
    it('should return the correct warning messages', async () => {
      const detailedMessage = `2 salto elements were not fetched, as they were mapped to a single ID salto.obj.instance.test:
[aliasName](someUrl), [QuackAliasName](QuackUrl)

Usually, this happens because of duplicate configuration names in the service. Make sure these element names are unique, and try fetching again.
[Learn about additional ways to resolve this issue](https://help.salto.io/en/articles/6927157-salto-id-collisions)`

      const errors = getCollisionWarnings({
        instances: [instance, collidedInstance],
      })
      expect(errors).toHaveLength(1)
      expect(errors[0]).toEqual({
        severity: 'Warning',
        message: COLLISION_MESSAGE,
        detailedMessage,
      })
    })

    it('should add children message when addChildrenMessage is true', async () => {
      const detailedMessage = `2 salto elements and their child elements were not fetched, as they were mapped to a single ID salto.obj.instance.test:
[aliasName](someUrl), [QuackAliasName](QuackUrl)

Usually, this happens because of duplicate configuration names in the service. Make sure these element names are unique, and try fetching again.
[Learn about additional ways to resolve this issue](https://help.salto.io/en/articles/6927157-salto-id-collisions)`

      const errors = getCollisionWarnings({
        instances: [instance, collidedInstance],
        addChildrenMessage: true,
      })
      expect(errors).toHaveLength(1)
      expect(errors[0]).toEqual({
        severity: 'Warning',
        message: COLLISION_MESSAGE,
        detailedMessage,
      })
    })

    it('should use the elemID name when alias is not defined', async () => {
      instance.annotations[CORE_ANNOTATIONS.ALIAS] = undefined
      const detailedMessage = `2 salto elements were not fetched, as they were mapped to a single ID salto.obj.instance.test:
[test](someUrl), [QuackAliasName](QuackUrl)

Usually, this happens because of duplicate configuration names in the service. Make sure these element names are unique, and try fetching again.
[Learn about additional ways to resolve this issue](https://help.salto.io/en/articles/6927157-salto-id-collisions)`

      const errors = getCollisionWarnings({
        instances: [instance, collidedInstance],
      })
      expect(errors).toHaveLength(1)
      expect(errors[0]).toEqual({
        severity: 'Warning',
        message: COLLISION_MESSAGE,
        detailedMessage,
      })
    })

    it('should not create links when serviceUrl is not defined', async () => {
      instance.annotations[CORE_ANNOTATIONS.SERVICE_URL] = undefined
      collidedInstance.annotations[CORE_ANNOTATIONS.SERVICE_URL] = undefined

      const detailedMessage = `2 salto elements were not fetched, as they were mapped to a single ID salto.obj.instance.test:
aliasName, QuackAliasName

Usually, this happens because of duplicate configuration names in the service. Make sure these element names are unique, and try fetching again.
[Learn about additional ways to resolve this issue](https://help.salto.io/en/articles/6927157-salto-id-collisions)`

      const errors = getCollisionWarnings({
        instances: [instance, collidedInstance],
      })
      expect(errors).toHaveLength(1)
      expect(errors[0]).toEqual({
        severity: 'Warning',
        message: COLLISION_MESSAGE,
        detailedMessage,
      })
    })
    it('should return no errors when there are no collided instances', async () => {
      const errors = getCollisionWarnings({
        instances: [instance, differentInstance],
      })
      expect(errors).toHaveLength(0)
    })
    it('should return a message for each duplicated elemID', async () => {
      const firstDetailedMessage = `3 salto elements were not fetched, as they were mapped to a single ID salto.obj.instance.test:
[aliasName](someUrl), [aliasName](someUrl), [QuackAliasName](QuackUrl)

Usually, this happens because of duplicate configuration names in the service. Make sure these element names are unique, and try fetching again.
[Learn about additional ways to resolve this issue](https://help.salto.io/en/articles/6927157-salto-id-collisions)`

      const secondDetailedMessage = `2 salto elements were not fetched, as they were mapped to a single ID salto.obj.instance.test1:
[anotherAliasName](anotherUrl), [anotherAliasName](anotherUrl)

Usually, this happens because of duplicate configuration names in the service. Make sure these element names are unique, and try fetching again.
[Learn about additional ways to resolve this issue](https://help.salto.io/en/articles/6927157-salto-id-collisions)`

      const errors = getCollisionWarnings({
        instances: [instance, instance.clone(), collidedInstance.clone(), differentInstance, differentInstance.clone()],
      })
      expect(errors).toHaveLength(2)
      expect(errors[0]).toEqual({
        severity: 'Warning',
        message: COLLISION_MESSAGE,
        detailedMessage: firstDetailedMessage,
      })
      expect(errors[1]).toEqual({
        severity: 'Warning',
        message: COLLISION_MESSAGE,
        detailedMessage: secondDetailedMessage,
      })
    })
  })
})
