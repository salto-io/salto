/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { getAndLogCollisionWarnings, getInstancesWithCollidingElemID } from '../src/collisions'

describe('collisions', () => {
  const instType = new ObjectType({
    elemID: new ElemID('salto', 'obj'),
  })
  const instance = new InstanceElement('test', instType, { title: 'test' })
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
        message: `Omitted 2 instances of obj due to Salto ID collisions.
Current Salto ID configuration for obj is defined as [title].

Breakdown per colliding Salto ID:
- test:
\t* Instance with Id - test
\t* Instance with Id - test

To resolve these collisions please take one of the following actions and fetch again:
\t1. Change obj's unique fields to include all fields that uniquely identify the type's instances.
\t2. Delete duplicate instances from your salto account.

Alternatively, you can exclude obj from the default configuration in salto.nacl`,
      })
    })
    it('should return no errors when there are no collided instnaces', async () => {
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
})
