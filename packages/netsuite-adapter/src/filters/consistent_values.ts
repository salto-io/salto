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
/* eslint-disable @typescript-eslint/camelcase */
import { Field, InstanceElement, isInstanceElement, Value } from '@salto-io/adapter-api'
import { TransformFunc, transformValues } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import {
  CUSTOM_RECORD_TYPE, ENTRY_FORM, TRANSACTION_FORM, PERMITTED_ROLE, RECORD_TYPE,
} from '../constants'
import { customrecordtype_permissions_permission } from '../types/custom_types/customrecordtype'
import { entryForm } from '../types/custom_types/entryForm'
import { transactionForm } from '../types/custom_types/transactionForm'

type InconsistentFieldMapping = {
  field: Field
  inconsistentValues: Value[]
  consistentValue: Value
}

const customRecordTypeApClerkPermittedRole = {
  field: customrecordtype_permissions_permission.fields[PERMITTED_ROLE],
  inconsistentValues: ['CUSTOMROLEAP_CLERK', 'AP_CLERK'],
  consistentValue: 'AP_CLERK',
}

const customRecordTypeCeoHandsOffPermittedRole = {
  field: customrecordtype_permissions_permission.fields[PERMITTED_ROLE],
  inconsistentValues: ['CUSTOMROLEATHENA_NS_VIEW_ALL', 'CEO_HANDS_OFF'],
  consistentValue: 'CEO_HANDS_OFF',
}

const entryFormDiscountItemRecordType = {
  field: entryForm.fields[RECORD_TYPE],
  inconsistentValues: ['DISCOUNTITEM', 'MARKUPITEM'],
  consistentValue: 'DISCOUNTITEM',
}

const entryFormItemGroupRecordType = {
  field: entryForm.fields[RECORD_TYPE],
  inconsistentValues: ['ASSEMBLYITEM', 'KITITEM', 'ITEMGROUP'],
  consistentValue: 'ITEMGROUP',
}

const entryFormJobRecordType = {
  field: entryForm.fields[RECORD_TYPE],
  inconsistentValues: ['MFGPROJECT', 'JOB'],
  consistentValue: 'JOB',
}

const entryFormServiceItemRecordType = {
  field: entryForm.fields[RECORD_TYPE],
  inconsistentValues: ['OTHERCHARGEPURCHASEITEM', 'OTHERCHARGERESALEITEM', 'NONINVENTORYSALEITEM', 'SERVICEPURCHASEITEM', 'GIFTCERTIFICATEITEM', 'DOWNLOADITEM', 'SERVICERESALEITEM', 'OTHERCHARGEITEM', 'SERVICEITEM', 'NONINVENTORYPURCHASEITEM', 'OTHERCHARGESALEITEM', 'NONINVENTORYRESALEITEM', 'SERVICESALEITEM'],
  consistentValue: 'SERVICEITEM',
}

const transactionFormRecordType = {
  field: transactionForm.fields[RECORD_TYPE],
  inconsistentValues: ['JOURNALENTRY', 'INTERCOMPANYJOURNALENTRY', 'ADVINTERCOMPANYJOURNALENTRY', 'STATISTICALJOURNALENTRY'],
  consistentValue: 'JOURNALENTRY',
}

const typeToFieldMappings: Record<string, InconsistentFieldMapping[]> = {
  [CUSTOM_RECORD_TYPE]: [
    customRecordTypeApClerkPermittedRole,
    customRecordTypeCeoHandsOffPermittedRole,
  ],
  [ENTRY_FORM]: [
    entryFormDiscountItemRecordType,
    entryFormItemGroupRecordType,
    entryFormJobRecordType,
    entryFormServiceItemRecordType,
  ],
  [TRANSACTION_FORM]: [transactionFormRecordType],
}

const setConsistentValues = (instance: InstanceElement): void => {
  const transformFunc = (
    fieldMappings: InconsistentFieldMapping[]
  ): TransformFunc => ({ value, field }) => {
    const matchingFieldMapping = fieldMappings.find(fieldMapping =>
      field && fieldMapping.field.isEqual(field) && fieldMapping.inconsistentValues.includes(value))
    if (matchingFieldMapping) {
      return matchingFieldMapping.consistentValue
    }
    return value
  }

  const fieldMappings = typeToFieldMappings[instance.type.elemID.name]
  if (!fieldMappings) return
  instance.value = transformValues({
    values: instance.value,
    type: instance.type,
    transformFunc: transformFunc(fieldMappings),
    strict: false,
  }) ?? instance.value
}

const filterCreator: FilterCreator = () => ({
  /**
   * Upon fetch, set fields that are randomly returned with different values but have the same
   * meaning to have a consistent equivalent value so there won't be irrelevant changes upon fetch
   * even if nothing hasn't really changed in the service.
   *
   * @param elements the already fetched elements
   */
  onFetch: async ({ elements }) => {
    elements
      .filter(isInstanceElement)
      .forEach(setConsistentValues)
  },
})

export default filterCreator
