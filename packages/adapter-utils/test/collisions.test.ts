/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ObjectType, ElemID, InstanceElement, ReferenceExpression, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { getInstancesWithCollidingElemID, getCollisionWarnings } from '../src/collisions'

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
  describe('getCollisionWarnings', () => {
    it('should return the correct warning messages', async () => {
      const detailedMessage = `2 Salto elements were not fetched, as they were mapped to a single ID salto.obj.instance.test:
aliasName - open in Salto: someUrl,
QuackAliasName - open in Salto: QuackUrl .

Usually, this happens because of duplicate configuration names in the service. Make sure these element names are unique, and try fetching again.
Learn about additional ways to resolve this issue at https://help.salto.io/en/articles/6927157-salto-id-collisions .`

      const errors = getCollisionWarnings({
        instances: [instance, collidedInstance],
        adapterName: 'Salto',
      })
      expect(errors).toHaveLength(1)
      expect(errors[0]).toEqual({
        severity: 'Warning',
        message: COLLISION_MESSAGE,
        detailedMessage,
      })
    })

    it('should add children message when addChildrenMessage is true', async () => {
      const detailedMessage = `2 Salto elements and their child elements were not fetched, as they were mapped to a single ID salto.obj.instance.test:
aliasName - open in Salto: someUrl,
QuackAliasName - open in Salto: QuackUrl .

Usually, this happens because of duplicate configuration names in the service. Make sure these element names are unique, and try fetching again.
Learn about additional ways to resolve this issue at https://help.salto.io/en/articles/6927157-salto-id-collisions .`

      const errors = getCollisionWarnings({
        instances: [instance, collidedInstance],
        adapterName: 'Salto',
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
      const detailedMessage = `2 Salto elements were not fetched, as they were mapped to a single ID salto.obj.instance.test:
test - open in Salto: someUrl,
QuackAliasName - open in Salto: QuackUrl .

Usually, this happens because of duplicate configuration names in the service. Make sure these element names are unique, and try fetching again.
Learn about additional ways to resolve this issue at https://help.salto.io/en/articles/6927157-salto-id-collisions .`

      const errors = getCollisionWarnings({
        instances: [instance, collidedInstance],
        adapterName: 'Salto',
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

      const detailedMessage = `2 Salto elements were not fetched, as they were mapped to a single ID salto.obj.instance.test:
aliasName,
QuackAliasName .

Usually, this happens because of duplicate configuration names in the service. Make sure these element names are unique, and try fetching again.
Learn about additional ways to resolve this issue at https://help.salto.io/en/articles/6927157-salto-id-collisions .`

      const errors = getCollisionWarnings({
        instances: [instance, collidedInstance],
        adapterName: 'Salto',
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
        adapterName: 'Salto',
      })
      expect(errors).toHaveLength(0)
    })
    it('should return a message for each duplicated elemID', async () => {
      const firstDetailedMessage = `3 Salto elements were not fetched, as they were mapped to a single ID salto.obj.instance.test:
aliasName - open in Salto: someUrl,
aliasName - open in Salto: someUrl,
QuackAliasName - open in Salto: QuackUrl .

Usually, this happens because of duplicate configuration names in the service. Make sure these element names are unique, and try fetching again.
Learn about additional ways to resolve this issue at https://help.salto.io/en/articles/6927157-salto-id-collisions .`

      const secondDetailedMessage = `2 Salto elements were not fetched, as they were mapped to a single ID salto.obj.instance.test1:
anotherAliasName - open in Salto: anotherUrl,
anotherAliasName - open in Salto: anotherUrl .

Usually, this happens because of duplicate configuration names in the service. Make sure these element names are unique, and try fetching again.
Learn about additional ways to resolve this issue at https://help.salto.io/en/articles/6927157-salto-id-collisions .`

      const errors = getCollisionWarnings({
        instances: [instance, instance.clone(), collidedInstance.clone(), differentInstance, differentInstance.clone()],
        adapterName: 'Salto',
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
