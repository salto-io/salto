/*
*                      Copyright 2023 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import { ObjectType, ElemID, InstanceElement, ReferenceExpression, SaltoError } from '@salto-io/adapter-api'
import { getAndLogCollisionWarnings, getInstancesWithCollidingElemID } from '../src/collisions'

describe('collisions', () => {
  const instType = new ObjectType({
    elemID: new ElemID('salto', 'obj'),
  })
  const instance = new InstanceElement(
    'test',
    instType,
    { title: 'test', ref: new ReferenceExpression(new ElemID('salto', 'something'), 'some value') },
  )
  const collidedInstance = new InstanceElement('test', instType, { title: 'test', val: 'val' })
  const differentInstance = new InstanceElement('test1', instType, { title: 'test1' })
  describe('getInstancesWithCollidingElemID', () => {
    it('should return empty lists if there is no collisions', () => {
      const collidedElements = getInstancesWithCollidingElemID([instance, differentInstance])
      expect(collidedElements).toHaveLength(0)
    })
    it('should return only the collided instances', () => {
      const collidedElements = getInstancesWithCollidingElemID(
        [instance, collidedInstance, differentInstance]
      )
      expect(collidedElements).toHaveLength(2)
      expect(collidedElements).toEqual([instance, collidedInstance])
    })
  })
  describe('getAndLogCollisionWarnings', () => {
    const baseExpectedWarningMessage = `Omitted 2 instances of obj due to Salto ID collisions.
Current Salto ID configuration for obj is defined as [title].

Breakdown per colliding Salto ID:
- test:
\t* Instance with Id - test
\t* Instance with Id - test

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
        message: baseExpectedWarningMessage,
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
        message: `${baseExpectedWarningMessage}\n\nLearn more at: ${docsUrl}`,
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
      const instanceWithEmptyName = new InstanceElement(
        ElemID.CONFIG_NAME,
        instType,
      )
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
      expect(collisionWarnings).toEqual(([
        expect.objectContaining({
          severity: 'Warning',
          message: expect.stringContaining('Instances with empty name (Due to no values in any of the provided ID fields)'),
        }),
      ]))
    })
  })
})
