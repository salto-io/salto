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
import { datasetType } from '../autogen/types/custom_types/dataset'
import { savedcsvimportType } from '../autogen/types/custom_types/savedcsvimport'
import { customsegmentType } from '../autogen/types/custom_types/customsegment'
import { bundleinstallationscriptType } from '../autogen/types/custom_types/bundleinstallationscript'
import { clientscriptType } from '../autogen/types/custom_types/clientscript'
import { customrecordactionscriptType } from '../autogen/types/custom_types/customrecordactionscript'
import { mapreducescriptType } from '../autogen/types/custom_types/mapreducescript'
import { massupdatescriptType } from '../autogen/types/custom_types/massupdatescript'
import { portletType } from '../autogen/types/custom_types/portlet'
import { restletType } from '../autogen/types/custom_types/restlet'
import { scheduledscriptType } from '../autogen/types/custom_types/scheduledscript'
import { sdfinstallationscriptType } from '../autogen/types/custom_types/sdfinstallationscript'
import { suiteletType } from '../autogen/types/custom_types/suitelet'
import { usereventscriptType } from '../autogen/types/custom_types/usereventscript'
import { workflowactionscriptType } from '../autogen/types/custom_types/workflowactionscript'

const { awu } = collections.asynciterable

type FieldFullNameToOrderBy = Map<string, string | undefined>

const unorderedListFields: FieldFullNameToOrderBy = new Map([
  [datasetType().innerTypes.dataset_dependencies
    .fields.dependency.elemID.getFullName(), undefined],
  [savedcsvimportType().innerTypes.savedcsvimport_filemappings
    .fields.filemapping.elemID.getFullName(), 'file'],
  [customsegmentType().innerTypes.customsegment_segmentapplication_transactionbody_applications
    .fields.application.elemID.getFullName(), 'id'],
  [customsegmentType().innerTypes.customsegment_segmentapplication_transactionline_applications
    .fields.application.elemID.getFullName(), 'id'],
  [bundleinstallationscriptType().innerTypes.bundleinstallationscript_scriptdeployments
    .fields.scriptdeployment.elemID.getFullName(), SCRIPT_ID],
  [clientscriptType().innerTypes.clientscript_scriptdeployments
    .fields.scriptdeployment.elemID.getFullName(), SCRIPT_ID],
  [customrecordactionscriptType().innerTypes.customrecordactionscript_scriptdeployments
    .fields.scriptdeployment.elemID.getFullName(), SCRIPT_ID],
  [mapreducescriptType().innerTypes.mapreducescript_scriptdeployments
    .fields.scriptdeployment.elemID.getFullName(), SCRIPT_ID],
  [massupdatescriptType().innerTypes.massupdatescript_scriptdeployments
    .fields.scriptdeployment.elemID.getFullName(), SCRIPT_ID],
  [portletType().innerTypes.portlet_scriptdeployments
    .fields.scriptdeployment.elemID.getFullName(), SCRIPT_ID],
  [restletType().innerTypes.restlet_scriptdeployments
    .fields.scriptdeployment.elemID.getFullName(), SCRIPT_ID],
  [scheduledscriptType().innerTypes.scheduledscript_scriptdeployments
    .fields.scriptdeployment.elemID.getFullName(), SCRIPT_ID],
  [sdfinstallationscriptType().innerTypes.sdfinstallationscript_scriptdeployments
    .fields.scriptdeployment.elemID.getFullName(), SCRIPT_ID],
  [suiteletType().innerTypes.suitelet_scriptdeployments
    .fields.scriptdeployment.elemID.getFullName(), SCRIPT_ID],
  [usereventscriptType().innerTypes.usereventscript_scriptdeployments
    .fields.scriptdeployment.elemID.getFullName(), SCRIPT_ID],
  [workflowactionscriptType().innerTypes.workflowactionscript_scriptdeployments
    .fields.scriptdeployment.elemID.getFullName(), SCRIPT_ID],
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
