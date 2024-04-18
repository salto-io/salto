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
import { ElemID, FixElementsFunc, ObjectType } from '@salto-io/adapter-api'
import { combineElementFixers } from '../../src/references/element_fixers'

describe('combineElementFixers', () => {
  let type1: ObjectType
  let type2: ObjectType
  let fixers: Record<string, FixElementsFunc>

  beforeEach(() => {
    type1 = new ObjectType({
      elemID: new ElemID('adapter', 'type1'),
    })

    type2 = new ObjectType({
      elemID: new ElemID('adapter', 'type2'),
    })

    fixers = {
      fixer1: async elements => {
        const type1AfterFix = elements[0].clone()
        type1AfterFix.annotations.fix1 = true

        const type2AfterFix = elements[1].clone()
        type2AfterFix.annotations.fix1 = true

        return {
          fixedElements: [type1AfterFix, type2AfterFix],
          errors: [
            {
              elemID: type1.elemID,
              severity: 'Info',
              message: 'message1',
              detailedMessage: 'detailedMessage1',
            },
          ],
        }
      },

      fixer2: async elements => {
        const type1AfterFix = elements[0].clone()
        type1AfterFix.annotations.fix2 = true

        return {
          fixedElements: [type1AfterFix],
          errors: [
            {
              elemID: type1.elemID,
              severity: 'Info',
              message: 'message2',
              detailedMessage: 'detailedMessage2',
            },
          ],
        }
      },
    }
  })

  describe('with no config', () => {
    it('should run all the element fixers', async () => {
      const fixElementsFunc = combineElementFixers(fixers)

      const fixes = await fixElementsFunc([type1, type2])

      expect(fixes.errors).toEqual([
        {
          elemID: type1.elemID,
          severity: 'Info',
          message: 'message1',
          detailedMessage: 'detailedMessage1',
        },
        {
          elemID: type1.elemID,
          severity: 'Info',
          message: 'message2',
          detailedMessage: 'detailedMessage2',
        },
      ])

      const [type1AfterFix, type2AfterFix] = fixes.fixedElements

      expect(type1AfterFix.annotations).toEqual({
        fix1: true,
        fix2: true,
      })

      expect(type2AfterFix.annotations).toEqual({
        fix1: true,
      })
    })
  })

  describe('with some enabled', () => {
    it('should run only enabled element fixers', async () => {
      const fixElementsFunc = combineElementFixers(fixers, {
        fixer1: true,
        fixer2: false,
      })

      const fixes = await fixElementsFunc([type1, type2])

      expect(fixes.errors).toEqual([
        {
          elemID: type1.elemID,
          severity: 'Info',
          message: 'message1',
          detailedMessage: 'detailedMessage1',
        },
      ])

      const [type1AfterFix, type2AfterFix] = fixes.fixedElements

      expect(type1AfterFix.annotations).toEqual({
        fix1: true,
      })

      expect(type2AfterFix.annotations).toEqual({
        fix1: true,
      })
    })
  })
})
