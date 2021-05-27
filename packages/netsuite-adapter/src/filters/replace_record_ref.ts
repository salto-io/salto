/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { BuiltinTypes, ElemID, Field, isObjectType, ListType, ObjectType, TypeElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { getAllTypes } from '../types'
import { NETSUITE } from '../constants'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable

const fieldNameToTypeName: Record<string, string | undefined> = {
  taxEngine: undefined,
  billableExpensesAcct: undefined,
  pageLogo: 'file',
  restrictToAccountingBookList: undefined,
  accountingContext: undefined,
  nexusId: 'Nexus',
  nexus: 'Nexus',
  logo: 'file',
  location: 'Location',
  unitsType: 'UnitsType',
  interCoAccount: undefined,
  unit: undefined,
  checkLayout: undefined,
  taxFiscalCalendar: undefined,
  taxAgency: undefined,
  fiscalCalendar: undefined,
  currency: 'Currency',
  accountingBook: undefined,
  class: 'Classification',
  deferralAcct: undefined,
  subsidiaryList: 'Subsidiary',
  category1099misc: undefined,
  contact: 'Contact',
  terms: 'Term',
  department: 'Department',
  region: undefined,
}

const getFieldType = (
  type: ObjectType,
  field: Field,
  typeMap: Record<string, TypeElement>
): TypeElement | undefined => {
  if (field.name === 'parent') {
    return type
  }
  const typeName = fieldNameToTypeName[field.name]
  return typeName !== undefined ? typeMap[typeName] : undefined
}

const filterCreator: FilterCreator = () => ({
  onFetch: async ({ elements }) => {
    const recordRefElemId = new ElemID(NETSUITE, 'RecordRef')

    const recordRefType = elements.filter(isObjectType).find(e => e.elemID.isEqual(recordRefElemId))
    if (recordRefType === undefined) {
      return
    }

    recordRefType.fields.id = new Field(recordRefType, 'id', BuiltinTypes.STRING)

    const types = elements.filter(isObjectType)
    const typeMap = _.keyBy([...types, ...getAllTypes()], e => e.elemID.name)

    await awu(types).forEach(async element => {
      element.fields = Object.fromEntries(await awu(Object.entries(element.fields))
        .map(async ([name, field]) => {
          let newField = field
          const fieldRealType = getFieldType(element, field, typeMap)
          if (fieldRealType !== undefined) {
            if ((await field.getType()).elemID.isEqual(recordRefElemId)) {
              newField = new Field(element, name, fieldRealType, field.annotations)
            }
            if ((await field.getType()).elemID.isEqual(new ElemID(NETSUITE, 'RecordRefList'))) {
              newField = new Field(element, name, new ListType(fieldRealType), field.annotations)
            }
          }
          return [name, newField]
        }).toArray())
    })
  },
})

export default filterCreator
