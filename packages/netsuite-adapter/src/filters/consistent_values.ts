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
import { InstanceElement, isInstanceElement, Value } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { ENTRY_FORM, TRANSACTION_FORM, RECORD_TYPE } from '../constants'

type InconsistentFieldMapping = {
  field: string
  inconsistentValues: Value[]
  consistentValue: Value
}

const entryFormRecordType = {
  field: RECORD_TYPE,
  inconsistentValues: ['DISCOUNTITEM', 'MARKUPITEM'],
  consistentValue: 'DISCOUNTITEM',
}

const transactionFormRecordType = {
  field: RECORD_TYPE,
  inconsistentValues: ['JOURNALENTRY', 'INTERCOMPANYJOURNALENTRY', 'ADVINTERCOMPANYJOURNALENTRY', 'STATISTICALJOURNALENTRY'],
  consistentValue: 'JOURNALENTRY',
}

const typeToFieldsMapping: Record<string, InconsistentFieldMapping[]> = {
  [ENTRY_FORM]: [entryFormRecordType],
  [TRANSACTION_FORM]: [transactionFormRecordType],
}

const setConsistentValues = (instance: InstanceElement): void => {
  const fieldsMappings = typeToFieldsMapping[instance.type.elemID.name]
  if (!fieldsMappings) return
  fieldsMappings.forEach(fieldMapping => {
    if (fieldMapping.inconsistentValues.includes(instance.value[fieldMapping.field])) {
      instance.value[fieldMapping.field] = fieldMapping.consistentValue
    }
  })
}

const filterCreator: FilterCreator = () => ({
  /**
   * Upon fetch, set fields that are randomly returned with different values but have the same
   * meaning to have a consistent equivalent  value so there won't be irrelevant changes upon fetch
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
