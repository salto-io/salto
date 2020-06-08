/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { ObjectType, InstanceElement, PrimitiveType, PrimitiveTypes, Field } from '../src/elements'
import { ElemID } from '../src/element_id'
import { BuiltinTypes } from '../src/builtins'
import { getChangeElement, Change, isInstanceChange, isObjectTypeChange, isFieldChange } from '../src/change'

describe('change.ts', () => {
  const objElemID = new ElemID('adapter', 'type')
  const obj = new ObjectType({
    elemID: objElemID,
    fields: { field: { type: BuiltinTypes.STRING } },
  })
  const inst = new InstanceElement('inst', obj, { field: 'val' })

  it('should getChangeElement for removal change', () => {
    const elem = getChangeElement({
      action: 'remove',
      data: { before: obj },
    })
    expect(elem).toBe(obj)
  })

  it('should getChangeElement for add change', () => {
    const elem = getChangeElement({
      action: 'add',
      data: { after: inst },
    })
    expect(elem).toBe(inst)
  })

  it('should getChangeElement for modification change', () => {
    const { field } = obj.fields
    const elem = getChangeElement({
      action: 'modify',
      data: { before: field, after: field },
    })
    expect(elem).toBe(field)
  })

  describe('isChange Functions', () => {
    let instChange: Change<InstanceElement>
    let objChange: Change<ObjectType>
    let fieldChange: Change<Field>
    let typeChange: Change<PrimitiveType>

    beforeEach(() => {
      const primType = new PrimitiveType({
        elemID: new ElemID('test', 'prim'),
        primitive: PrimitiveTypes.STRING,
      })
      const objType = new ObjectType({
        elemID: new ElemID('test', 'type'),
        fields: { field: { type: primType } },
      })
      const instance = new InstanceElement('inst', objType)
      const createChange = <T>(elem: T): Change<T> => ({ action: 'add', data: { after: elem } })

      instChange = createChange(instance)
      objChange = createChange(objType)
      fieldChange = createChange(objType.fields.field)
      typeChange = createChange(primType)
    })

    describe('isInstanceChange', () => {
      it('should return true for changes of instance elements', () => {
        expect(isInstanceChange(instChange)).toBeTruthy()
      })

      it('should return false for changes of non instance elements', () => {
        [objChange, fieldChange, typeChange].forEach(
          change => expect(isInstanceChange(change)).toBeFalsy()
        )
      })
    })

    describe('isObjectTypeChange', () => {
      it('should return true for changes of object type elements', () => {
        expect(isObjectTypeChange(objChange)).toBeTruthy()
      })

      it('should return false for changes of non object type elements', () => {
        [instChange, fieldChange, typeChange].forEach(
          change => expect(isObjectTypeChange(change)).toBeFalsy()
        )
      })
    })

    describe('isFieldChange', () => {
      it('should return true for changes of field elements', () => {
        expect(isFieldChange(fieldChange)).toBeTruthy()
      })

      it('should return false for changes of non field elements', () => {
        [objChange, instChange, typeChange].forEach(
          change => expect(isFieldChange(change)).toBeFalsy()
        )
      })
    })
  })
})
