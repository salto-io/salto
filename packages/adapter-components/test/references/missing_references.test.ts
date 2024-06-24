/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { createMissingInstance, MISSING_ANNOTATION, checkMissingRef } from '../../src/references/missing_references'

describe('missingReferences', () => {
  describe('createMissingInstance', () => {
    it('should create missing instance with the correct elemID, type and annotations', () => {
      const result = createMissingInstance('adapterTest', 'someType', '123456')
      expect(result.elemID.getFullName()).toEqual('adapterTest.someType.instance.missing_123456')
      expect(result.refType.elemID.typeName).toEqual('someType')
      expect(result.annotations[MISSING_ANNOTATION]).toEqual(true)
    })
  })

  describe('checkMissingRef', () => {
    const type = new ObjectType({ elemID: new ElemID('adapter', 'type') })
    type.annotations[MISSING_ANNOTATION] = true
    const instance = new InstanceElement('inst', type, {}, undefined, { [MISSING_ANNOTATION]: true })
    it('should check missing ref annotation', () => {
      expect(checkMissingRef(instance)).toEqual(true)
      expect(checkMissingRef(type)).toEqual(true)
    })
  })
})
