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
import { Element, BuiltinTypes, Change, ChangeDataType, ChangeId, DependencyChange, dependencyChange, ElemID, Field, ObjectType, toChange } from '@salto-io/adapter-api'
import { dependencyChanger } from '../src/dependency_changer'
import { NETSUITE } from '../src/constants'

const toChangeNodesMap = (elements: ChangeDataType[]): Map<ChangeId, Change> =>
  new Map(elements.map((element): [ChangeId, Change] => [
    element.elemID.getFullName(),
    toChange({ after: element }),
  ]))

const toDependencyChange = (
  action: 'add' | 'remove',
  sourceElem: Element,
  targetElement: Element
): DependencyChange =>
  dependencyChange(action, sourceElem.elemID.getFullName(), targetElement.elemID.getFullName())

describe('dependency changer', () => {
  const defaultDependencies = new Map()

  describe('create dependency between type and fields', () => {
    const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
    const field = new Field(type, 'field', BuiltinTypes.BOOLEAN)
    const secondField = new Field(type, 'secondField', BuiltinTypes.BOOLEAN)
    const anotherType = new ObjectType({ elemID: new ElemID(NETSUITE, 'anotherType') })
    const anotherField = new Field(anotherType, 'anotherField', BuiltinTypes.BOOLEAN)
    it('should create dependency from each type to its fields', async () => {
      const changesMap = toChangeNodesMap([
        type,
        field,
        secondField,
        anotherType,
        anotherField,
      ])
      await expect(dependencyChanger(changesMap, defaultDependencies)).resolves.toEqual([
        toDependencyChange('add', type, field),
        toDependencyChange('add', type, secondField),
        toDependencyChange('add', anotherType, anotherField),
      ])
    })
    it('should not create dependency if the type is not a change', async () => {
      const changesMap = toChangeNodesMap([
        field,
        anotherType,
        anotherField,
      ])
      await expect(dependencyChanger(changesMap, defaultDependencies)).resolves.toEqual([
        toDependencyChange('add', anotherType, anotherField),
      ])
    })
    it('should not create dependency if the field is not a change', async () => {
      const changesMap = toChangeNodesMap([
        type,
        anotherType,
        anotherField,
      ])
      await expect(dependencyChanger(changesMap, defaultDependencies)).resolves.toEqual([
        toDependencyChange('add', anotherType, anotherField),
      ])
    })
  })
})
