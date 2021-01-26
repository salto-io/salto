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
import {
  Field, isInstanceElement, isListType, ObjectType, Values, Value,
} from '@salto-io/adapter-api'
import { applyRecursive } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { dataset_dependencies } from '../types/custom_types/dataset'
import { savedcsvimport_filemappings } from '../types/custom_types/savedcsvimport'
import {
  customsegment_segmentapplication_transactionbody_applications,
  customsegment_segmentapplication_transactionline_applications,
} from '../types/custom_types/customsegment'
import { SCRIPT_ID } from '../constants'
import { bundleinstallationscript_scriptdeployments } from '../types/custom_types/bundleinstallationscript'
import { clientscript_scriptdeployments } from '../types/custom_types/clientscript'
import { customrecordactionscript_scriptdeployments } from '../types/custom_types/customrecordactionscript'
import { mapreducescript_scriptdeployments } from '../types/custom_types/mapreducescript'
import { portlet_scriptdeployments } from '../types/custom_types/portlet'
import { massupdatescript_scriptdeployments } from '../types/custom_types/massupdatescript'
import { restlet_scriptdeployments } from '../types/custom_types/restlet'
import { scheduledscript_scriptdeployments } from '../types/custom_types/scheduledscript'
import { sdfinstallationscript_scriptdeployments } from '../types/custom_types/sdfinstallationscript'
import { suitelet_scriptdeployments } from '../types/custom_types/suitelet'
import { usereventscript_scriptdeployments } from '../types/custom_types/usereventscript'
import { workflowactionscript_scriptdeployments } from '../types/custom_types/workflowactionscript'

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

const castAndOrderListsRecursively = (
  type: ObjectType,
  values: Values,
): void => {
  // Cast all values of list type to list and order lists according to unorderedListFields
  const castAndOrderLists = (field: Field, value: Value): Value => {
    if (!isListType(field.type)) {
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
  applyRecursive(type, values, castAndOrderLists)
}


const filterCreator: FilterCreator = () => ({
  /**
   * Upon fetch, mark values of list type as list and order lists that are fetched unordered
   *
   * @param elements the already fetched elements
   */
  onFetch: async ({ elements }) => {
    elements
      .filter(isInstanceElement)
      .forEach(inst => castAndOrderListsRecursively(inst.type, inst.value))
  },
})

export default filterCreator
