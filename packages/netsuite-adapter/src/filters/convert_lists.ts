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
/* eslint-disable camelcase */
import {
  Field, isInstanceElement, isListType, ObjectType, Values, Value,
} from '@salto-io/adapter-api'
import { applyRecursive } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FilterWith } from '../filter'
import { SCRIPT_ID } from '../constants'

const { awu } = collections.asynciterable

type FieldFullNameToOrderBy = Map<string, string | undefined>

const unorderedListFields: FieldFullNameToOrderBy = new Map([
  ['netsuite.dataset_dependencies.field.dependency', undefined],
  ['netsuite.savedcsvimport_filemappings.field.filemapping', 'file'],
  ['netsuite.customsegment_segmentapplication_transactionbody_applications.field.application', 'id'],
  ['netsuite.customsegment_segmentapplication_transactionline_applications.field.application', 'id'],
  ['netsuite.bundleinstallationscript_scriptdeployments.field.scriptdeployment', SCRIPT_ID],
  ['netsuite.clientscript_scriptdeployments.field.scriptdeployment', SCRIPT_ID],
  ['netsuite.customrecordactionscript_scriptdeployments.field.scriptdeployment', SCRIPT_ID],
  ['netsuite.mapreducescript_scriptdeployments.field.scriptdeployment', SCRIPT_ID],
  ['netsuite.massupdatescript_scriptdeployments.field.scriptdeployment', SCRIPT_ID],
  ['netsuite.portlet_scriptdeployments.field.scriptdeployment', SCRIPT_ID],
  ['netsuite.restlet_scriptdeployments.field.scriptdeployment', SCRIPT_ID],
  ['netsuite.scheduledscript_scriptdeployments.field.scriptdeployment', SCRIPT_ID],
  ['netsuite.sdfinstallationscript_scriptdeployments.field.scriptdeployment', SCRIPT_ID],
  ['netsuite.suitelet_scriptdeployments.field.scriptdeployment', SCRIPT_ID],
  ['netsuite.usereventscript_scriptdeployments.field.scriptdeployment', SCRIPT_ID],
  ['netsuite.workflowactionscript_scriptdeployments.field.scriptdeployment', SCRIPT_ID],
])

const castAndOrderListsRecursively = async (
  type: ObjectType,
  values: Values,
): Promise<void> => {
  // Cast all values of list type to list and order lists according to unorderedListFields
  const castAndOrderLists = async (field: Field, value: Value): Promise<Value> => {
    if (!isListType(await field.getType())) {
      return value
    }
    if (!_.isArray(value)) {
      return [value]
    }
    // order lists
    return unorderedListFields.has(field.elemID.getFullName())
      ? _.orderBy(value, unorderedListFields.get(field.elemID.getFullName()))
      : value
  }
  await applyRecursive(type, values, castAndOrderLists)
}


const filterCreator = (): FilterWith<'onFetch'> => ({
  /**
   * Upon fetch, mark values of list type as list and order lists that are fetched unordered
   *
   * @param elements the already fetched elements
   */
  onFetch: async elements => {
    await awu(elements)
      .filter(isInstanceElement)
      .forEach(async inst => castAndOrderListsRecursively(await inst.getType(), inst.value))
  },
})

export default filterCreator
