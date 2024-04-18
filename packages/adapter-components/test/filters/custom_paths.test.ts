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
import _ from 'lodash'
import {
  ObjectType,
  ElemID,
  Element,
  InstanceElement,
  ReferenceExpression,
  isInstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { FilterWith } from '../../src/filter_utils'
import { PathMapperFunc, customPathsFilterCreator } from '../../src/filters/custom_paths'

describe('custom paths filter', () => {
  let elements: Element[]

  const generateElements = (): Element[] => {
    const constantType = new ObjectType({ elemID: new ElemID('salto', 'constant') })
    const c1 = new InstanceElement('c1', constantType, {}, ['Records', 'constant', 'c1', 'c1'])
    const c2 = new InstanceElement('c2', constantType, {}, ['Records', 'constant', 'c2', 'c2'])
    const noPath = new InstanceElement('noPath', constantType, {})

    const recursiveType = new ObjectType({ elemID: new ElemID('salto', 'recursive') })
    const r1 = new InstanceElement('r1', recursiveType, { myParent: new ReferenceExpression(c1.elemID) }, [
      'Records',
      'recursive',
      'r1',
    ])
    const r12 = new InstanceElement('r12', recursiveType, { myParent: new ReferenceExpression(r1.elemID) }, [
      'Records',
      'recursive',
      'r12_custom',
    ])
    const noParentPath = new InstanceElement(
      'noParentPath',
      recursiveType,
      { myParent: new ReferenceExpression(noPath.elemID) },
      ['Records', 'recursive', 'noParentPath'],
    )
    const invalidParent = new InstanceElement(
      'invalidParent',
      recursiveType,
      { myParent: new ReferenceExpression(new ElemID('salto', 'constant', 'instance', 'aaa')) },
      ['Records', 'recursive', 'invalidParent'],
    )

    return [recursiveType, r12, r1, noParentPath, invalidParent, constantType, c1, c2, noPath]
  }

  describe('onFetch', () => {
    beforeEach(async () => {
      elements = generateElements()
    })
    it('should not update paths if there are no mappers', async () => {
      const func: PathMapperFunc = () => undefined
      const filter = customPathsFilterCreator(func)({}) as FilterWith<'onFetch'>

      await filter.onFetch(elements)
      expect(
        Object.fromEntries(elements.filter(isInstanceElement).map(inst => [inst.elemID.getFullName(), inst.path])),
      ).toEqual({
        'salto.constant.instance.c1': ['Records', 'constant', 'c1', 'c1'],
        'salto.constant.instance.c2': ['Records', 'constant', 'c2', 'c2'],
        'salto.constant.instance.noPath': undefined,
        'salto.recursive.instance.r1': ['Records', 'recursive', 'r1'],
        'salto.recursive.instance.r12': ['Records', 'recursive', 'r12_custom'],
        'salto.recursive.instance.invalidParent': ['Records', 'recursive', 'invalidParent'],
        'salto.recursive.instance.noParentPath': ['Records', 'recursive', 'noParentPath'],
      })
    })
    it('should update paths recursively based on mappers', async () => {
      const func: PathMapperFunc = inst => {
        if (inst.elemID.typeName !== 'recursive') {
          return undefined
        }
        const { myParent } = inst.value
        if (!isReferenceExpression(myParent)) {
          return undefined
        }
        const currentFileName = _.last(inst.path)
        if (currentFileName === undefined) {
          return undefined
        }
        if (myParent.elemID.typeName === 'constant') {
          return {
            nestUnder: myParent.elemID,
            pathSuffix: ['recursive', currentFileName, currentFileName],
          }
        }
        return {
          nestUnder: myParent.elemID,
          pathSuffix: [currentFileName, currentFileName],
        }
      }
      const filter = customPathsFilterCreator(func)({}) as FilterWith<'onFetch'>

      await filter.onFetch(elements)
      expect(
        Object.fromEntries(elements.filter(isInstanceElement).map(inst => [inst.elemID.getFullName(), inst.path])),
      ).toEqual({
        'salto.constant.instance.c1': ['Records', 'constant', 'c1', 'c1'],
        'salto.constant.instance.c2': ['Records', 'constant', 'c2', 'c2'],
        'salto.constant.instance.noPath': undefined,
        'salto.recursive.instance.r1': ['Records', 'constant', 'c1', 'recursive', 'r1', 'r1'],
        'salto.recursive.instance.r12': ['Records', 'constant', 'c1', 'recursive', 'r1', 'r12_custom', 'r12_custom'],
        'salto.recursive.instance.invalidParent': ['Records', 'recursive', 'invalidParent'],
        'salto.recursive.instance.noParentPath': ['Records', 'recursive', 'noParentPath'],
      })
    })
  })
})
