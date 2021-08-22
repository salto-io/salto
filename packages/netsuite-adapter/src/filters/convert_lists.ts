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
/* eslint-disable camelcase */
import {
  Field, isInstanceElement, isListType, ObjectType, Values, Value,
} from '@salto-io/adapter-api'
import { applyRecursive } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FilterWith } from '../filter'
import { dataset_dependencies } from '../autogen/types/custom_types/dataset'
import { savedcsvimport_filemappings } from '../autogen/types/custom_types/savedcsvimport'
import {
  customsegment_segmentapplication_transactionbody_applications,
  customsegment_segmentapplication_transactionline_applications,
} from '../autogen/types/custom_types/customsegment'
import { SCRIPT_ID } from '../constants'
import { bundleinstallationscript_scriptdeployments } from '../autogen/types/custom_types/bundleinstallationscript'
import { clientscript_scriptdeployments } from '../autogen/types/custom_types/clientscript'
import { customrecordactionscript_scriptdeployments } from '../autogen/types/custom_types/customrecordactionscript'
import { mapreducescript_scriptdeployments } from '../autogen/types/custom_types/mapreducescript'
import { portlet_scriptdeployments } from '../autogen/types/custom_types/portlet'
import { massupdatescript_scriptdeployments } from '../autogen/types/custom_types/massupdatescript'
import { restlet_scriptdeployments } from '../autogen/types/custom_types/restlet'
import { scheduledscript_scriptdeployments } from '../autogen/types/custom_types/scheduledscript'
import { sdfinstallationscript_scriptdeployments } from '../autogen/types/custom_types/sdfinstallationscript'
import { suitelet_scriptdeployments } from '../autogen/types/custom_types/suitelet'
import { usereventscript_scriptdeployments } from '../autogen/types/custom_types/usereventscript'
import { workflowactionscript_scriptdeployments } from '../autogen/types/custom_types/workflowactionscript'

const { awu } = collections.asynciterable

type FieldFullNameToOrderBy = Map<string, string | undefined>

const unorderedListFields: FieldFullNameToOrderBy = new Map([
  [dataset_dependencies.fields.dependency.elemID.getFullName(), undefined],
  [savedcsvimport_filemappings.fields.filemapping.elemID.getFullName(), 'file'],
  [customsegment_segmentapplication_transactionbody_applications.fields.application.elemID.getFullName(), 'id'],
  [customsegment_segmentapplication_transactionline_applications.fields.application.elemID.getFullName(), 'id'],
  [bundleinstallationscript_scriptdeployments.fields.scriptdeployment.elemID.getFullName(),
    SCRIPT_ID],
  [clientscript_scriptdeployments.fields.scriptdeployment.elemID.getFullName(), SCRIPT_ID],
  [customrecordactionscript_scriptdeployments.fields.scriptdeployment.elemID.getFullName(),
    SCRIPT_ID],
  [mapreducescript_scriptdeployments.fields.scriptdeployment.elemID.getFullName(), SCRIPT_ID],
  [massupdatescript_scriptdeployments.fields.scriptdeployment.elemID.getFullName(), SCRIPT_ID],
  [portlet_scriptdeployments.fields.scriptdeployment.elemID.getFullName(), SCRIPT_ID],
  [restlet_scriptdeployments.fields.scriptdeployment.elemID.getFullName(), SCRIPT_ID],
  [scheduledscript_scriptdeployments.fields.scriptdeployment.elemID.getFullName(), SCRIPT_ID],
  [sdfinstallationscript_scriptdeployments.fields.scriptdeployment.elemID.getFullName(), SCRIPT_ID],
  [suitelet_scriptdeployments.fields.scriptdeployment.elemID.getFullName(), SCRIPT_ID],
  [usereventscript_scriptdeployments.fields.scriptdeployment.elemID.getFullName(), SCRIPT_ID],
  [workflowactionscript_scriptdeployments.fields.scriptdeployment.elemID.getFullName(), SCRIPT_ID],
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
