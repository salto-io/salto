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

import { ElemID } from '@salto-io/adapter-api'
import { DetailedDependency } from '@salto-io/adapter-utils'
import { WORKATO } from '../src/constants'
import { defaultAddMatchReferences, dependencyFinder } from '../src/filters/cross_service/recipe_conditions'
import { ConditionBlock, ConditionReferenceFinder, ConditionsFullBlock } from '../src/filters/cross_service/reference_finders'

const getValidConditionsBlock = (
  conditionBlocks : ConditionBlock[],
  globalOperand = 'and',
): ConditionsFullBlock => ({
  keyword: 'if',
  input: {
    operand: globalOperand,
    conditions: conditionBlocks,
  },
})

describe('defaultAddMatchReferences', () => {
  const dereferenceDep = (dep: DetailedDependency): unknown => (dep.reference.elemID.getFullName())

  const lhsToDependenciesDefaultFunc: dependencyFinder = lhs => {
    if (lhs === 'formula_alpha') {
      return [{ key: 'a_key', elem: new ElemID('alpha_a') }, { key: 'both_key', elem: new ElemID('alpha_both') }]
    }
    if (lhs === 'formula_beta') {
      return [{ key: 'both_key', elem: new ElemID('beta_both') }, { key: 'c_key', elem: new ElemID('beta_c') }]
    }
    return []
  }

  const path1 = (new ElemID(WORKATO, 'path1', 'instance'))
  let matchReferences: ConditionReferenceFinder

  describe('conditions', () => {
    matchReferences = defaultAddMatchReferences(lhsToDependenciesDefaultFunc)
    describe('equals_to condition', () => { // TODO add support for other operands
      it('should return only a_key item', () => {
        expect(matchReferences(getValidConditionsBlock([
          { operand: 'equals_to', lhs: 'formula_alpha', rhs: 'a_key' },
          { operand: 'equals_to', lhs: 'formula_alpha', rhs: 'c_key' }, // no deoendency for formula_alpha equals c_key
        ]), path1).map(dereferenceDep)).toEqual(['alpha_a'])
      })
    })
    describe('contains condition', () => {
      it('should return items of all keys for \'key\' rhs and both_key item for \'ot\' rhs', () => {
        expect(matchReferences(getValidConditionsBlock([
          { operand: 'contains', lhs: 'formula_alpha', rhs: 'key' }, // all keys contains 'key'
          { operand: 'contains', lhs: 'formula_alpha', rhs: 'ot' }, // only 'both_key' contains 'ot'
          { operand: 'contains', lhs: 'formula_alpha', rhs: 'c' }, // no deoendency for formula_alpha and c_key contains 'c'
        ]), path1).map(dereferenceDep)).toEqual(['alpha_a', 'alpha_both', 'alpha_both'])
      })
    })
    describe('starts_with condition', () => {
      it('should return only both_key item', () => {
        expect(matchReferences(getValidConditionsBlock([
          { operand: 'starts_with', lhs: 'formula_alpha', rhs: 'bo' }, // only 'both_key' starts with 'bo'
          { operand: 'starts_with', lhs: 'formula_alpha', rhs: 'c' }, // no key starts with c
        ]), path1).map(dereferenceDep)).toEqual(['alpha_both'])
      })
    })
    describe('ends_with condition', () => {
      it('should return items of all keys for \'key\' rhs and non for \'notKey\' rhs', () => {
        expect(matchReferences(getValidConditionsBlock([
          { operand: 'ends_with', lhs: 'formula_alpha', rhs: 'key' }, // all keys ends with 'key'
          { operand: 'ends_with', lhs: 'formula_alpha', rhs: 'notKey' }, // no key ends with 'notKey'
        ]), path1).map(dereferenceDep)).toEqual(['alpha_a', 'alpha_both'])
      })
    })
  })

  describe('lhsToDependencies', () => {
    matchReferences = defaultAddMatchReferences(lhsToDependenciesDefaultFunc)
    const notMatchReferences = defaultAddMatchReferences(() => ([]))
    it('should not get any dependencies if lhsToDependencies return nothing', () => {
      expect(notMatchReferences(getValidConditionsBlock([
        { operand: 'equals_to', lhs: 'formula_alpha', rhs: 'a_key' },
      ]), path1)).toEqual([])
    })
    it('should not get any dependencies if lhs not match any key', () => {
      expect(matchReferences(getValidConditionsBlock([
        { operand: 'equals_to', lhs: 'unknown_formula', rhs: 'a_key' },
        { operand: 'equals_to', lhs: 'unknown_formula', rhs: 'unknown_formula' },
      ]), path1)).toEqual([])
    })
  })

  describe('conditions blocks validations', () => {
    matchReferences = defaultAddMatchReferences(lhsToDependenciesDefaultFunc)
    const invalidConditionBlockList = [{
      keyword: 'not if',
      input: {
        operand: 'and',
        conditions: [
          {
            operand: 'equals_to',
            lhs: 'formula_alpha',
            rhs: 'both_key',
          },
        ],
      },
    }, {
      keyword: 'if',
      input: {
        operand: 'not "and" or "or"',
        conditions: [
          {
            operand: 'equals_to',
            lhs: 'formula_alpha',
            rhs: 'both_key',
          },
        ],
      },
    }, {
      keyword: 'if',
      input: {
        operand: 'or',
        conditions: [
          {
            operand: 'unknown operand',
            lhs: 'formula_beta',
            rhs: 'both_key',
          },
        ],
      },
    }, {
      keyword: 'if',
      input: {
        operand: 'and',
        conditions: [
          {
            operand: 'unknown operand',
            lhs: 'formula_alpha',
            rhs: 'both_key',
          },
          {
            operand: 'one more unknown operand',
            lhs: 'formula_beta',
            rhs: 'both_key',
          },
        ],
      },
    }]
    const onlyOneValidConditionInConditionsBlock = {
      keyword: 'if',
      input: {
        operand: 'and',
        conditions: [
          {
            operand: 'unknown operand',
            lhs: 'formula_beta',
            rhs: 'both_key',
          },
          {
            operand: 'equals_to',
            lhs: 'formula_alpha',
            rhs: 'both_key',
          },
          {
            operand: 'one more unknown operand',
            lhs: 'formula_beta',
            rhs: 'both_key',
          },
        ],
      },
    }
    it('should return empty list for all invalid conditions blocks', () => {
      expect(
        invalidConditionBlockList.map(block => matchReferences(block, path1)).flat().map(dereferenceDep)
      ).toEqual([])
    })
    it('should return dependency if at least one condition is valid', () => {
      expect(matchReferences(onlyOneValidConditionInConditionsBlock, path1).map(
        dereferenceDep
      )).toEqual([
        'alpha_both',
      ])
    })
  })
})
