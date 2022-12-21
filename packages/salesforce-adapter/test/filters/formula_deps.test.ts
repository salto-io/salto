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

import { BuiltinTypes, ElemID, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { FlatDetailedDependency } from '@salto-io/adapter-utils'
import formulaDepsFilter from '../../src/filters/formula_deps'
import { defaultFilterContext } from '../utils'
import { FilterWith } from '../../src/filter'
import { formulaTypeName, Types } from '../../src/transformers/transformer'
import { FIELD_TYPE_NAMES, FORMULA, SALESFORCE } from '../../src/constants'

const depNameToRefExpr = (typeName: string, fieldName: string|undefined = undefined): FlatDetailedDependency => {
  const additionalParams = fieldName ? [fieldName] : []
  const refExpr = new ReferenceExpression(new ElemID(SALESFORCE, typeName, fieldName ? 'field' : undefined, ...additionalParams))
  return {
    reference: refExpr,
  }
}

describe('Formula dependencies', () => {
  let filter: FilterWith<'onFetch'>

  beforeAll(() => {
    filter = formulaDepsFilter({ config: defaultFilterContext }) as FilterWith<'onFetch'>
  })

  describe('When the formula has a reference', () => {
    let typeWithFormula: ObjectType

    beforeAll(() => {
      expect(Types.formulaDataTypes).not.toBeEmpty()
      expect(Types.formulaDataTypes[formulaTypeName(FIELD_TYPE_NAMES.CHECKBOX)]).toBeDefined()
      typeWithFormula = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'Account'),
        annotations: { apiName: 'Account', metadataType: 'CustomObject' },
        fields: {
          someField__c: {
            refType: BuiltinTypes.STRING,
          },
          someFormulaField__c: {
            refType: Types.formulaDataTypes[formulaTypeName(FIELD_TYPE_NAMES.CHECKBOX)],
            annotations: {
              [FORMULA]: 'ISBLANK(someField)',
            },
          },
        },
      })
    })

    it('Should return the reference as a dependency', async () => {
      const elements = [typeWithFormula.clone()]
      await filter.onFetch(elements)
      // eslint-disable-next-line no-underscore-dangle
      const deps = elements[0].fields.someFormulaField__c.annotations._generated_dependencies
      expect(deps).toBeDefined()
      expect(deps).toHaveLength(2)
      expect(deps[0]).toEqual(depNameToRefExpr(typeWithFormula.elemID.typeName))
      expect(deps[1]).toEqual(depNameToRefExpr(typeWithFormula.elemID.typeName, 'someField'))
    })
  })
})
