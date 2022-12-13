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

const customrecordtypeMapping = {
  customrecordtype_links_link: 'linkcategory',
  customrecordtype_permissions_permission: 'permittedrole',
}

const customsegmentMapping = {
  customsegment_permissions_permission: 'role',
  customsegment_segmentapplication_crm_applications_application: 'id',
  customsegment_segmentapplication_customrecords_applications_application: 'id',
  customsegment_segmentapplication_otherrecords_applications_application: 'id',
  customsegment_segmentapplication_transactionbody_applications_application: 'id',
  customsegment_segmentapplication_transactionline_applications_application: 'id',
  customsegment_segmentapplication_entities_applications_application: 'id',
  customsegment_segmentapplication_items_applications_application: 'id',
}

const savedcsvimportMapping = {
  savedcsvimport_filemappings_filemapping: 'file',
  savedcsvimport_recordmappings_recordmapping: 'record',
  savedcsvimport_recordmappings_recordmapping_fieldmappings_fieldmapping: 'field',
}

const customtransactiontypeMapping = {
  customtransactiontype_permissions_permission: 'permittedrole',
}

const roleMapping = {
  role_permissions_permission: 'permkey',
  role_recordrestrictions_recordrestriction: 'segment',
}

const roleAccessMapping = {
  sdfinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess: 'role',
  workflow_workflowcustomfields_workflowcustomfield_roleaccesses_roleaccess: 'role',
  workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses_roleaccess: 'role',
  entitycustomfield_roleaccesses_roleaccess: 'role',
  itemoptioncustomfield_roleaccesses_roleaccess: 'role',
  crmcustomfield_roleaccesses_roleaccess: 'role',
  itemcustomfield_roleaccesses_roleaccess: 'role',
  customrecordactionscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess: 'role',
  workflowactionscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess: 'role',
  mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess: 'role',
  clientscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess: 'role',
  usereventscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess: 'role',
  transactionbodycustomfield_roleaccesses_roleaccess: 'role',
  scheduledscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess: 'role',
  itemnumbercustomfield_roleaccesses_roleaccess: 'role',
  suitelet_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess: 'role',
  massupdatescript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess: 'role',
  bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess: 'role',
  portlet_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess: 'role',
  transactioncolumncustomfield_roleaccesses_roleaccess: 'role',
  restlet_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess: 'role',
  customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses_roleaccess: 'role',
  othercustomfield_roleaccesses_roleaccess: 'role',
}

const translationsMapping = {
  translation: ['locale', 'language'],
  classTranslation: ['locale', 'language'],
  customRecordTranslations: ['locale', 'language'],
}

export const dataTypesToConvert: ReadonlySet<string> = new Set(
  Object.keys(translationsMapping).map(key => `${key}List`)
)

export const listMappedByFieldMapping: Record<string, string | string[]> = {
  ...customrecordtypeMapping,
  ...customsegmentMapping,
  ...savedcsvimportMapping,
  ...customtransactiontypeMapping,
  ...roleMapping,
  ...roleAccessMapping,
  ...translationsMapping,

  // addressForm
  addressForm_mainFields_defaultFieldGroup_fields: 'position',
  addressForm_mainFields_defaultFieldGroup_fields_field: 'id',
  addressForm_mainFields_fieldGroup_fields: 'position',
  addressForm_mainFields_fieldGroup_fields_field: 'id',

  // centercategory
  // NOTE: Instances of this type would have the first OR the second fields lists here.
  // On the transformation from lists to maps there is a check of which field to use for each item.
  centercategory_links_link: ['linkid', 'linkobject'],

  // clientscript
  clientscript_buttons_button: 'buttonlabel',

  // entryForm
  entryForm_actionbar_buttons_button: 'id',
  entryForm_actionbar_customButtons_customButton: 'label',
  entryForm_actionbar_menu_menuitem: 'id',
  entryForm_mainFields_fieldGroup_fields: 'position',
  entryForm_mainFields_fieldGroup_fields_field: 'id',
  entryForm_mainFields_defaultFieldGroup_fields: 'position',
  entryForm_mainFields_defaultFieldGroup_fields_field: 'id',
  entryForm_quickViewFields_field: 'id',
  entryForm_tabs_tab: 'id',
  entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields: 'position',
  entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_field: 'id',
  entryForm_tabs_tab_fieldGroups_fieldGroup_fields: 'position',
  entryForm_tabs_tab_fieldGroups_fieldGroup_fields_field: 'id',
  entryForm_tabs_tab_subItems_subList: 'id',
  entryForm_tabs_tab_subItems_subTab: 'id',
  entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields: 'position',
  entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_field: 'id',

  // transactionbodycustomfield
  transactionbodycustomfield_customfieldfilters_customfieldfilter: 'fldfilter',

  // transactionForm
  transactionForm_mainFields_defaultFieldGroup_fields: 'position',
  transactionForm_mainFields_defaultFieldGroup_fields_field: 'id',
  transactionForm_mainFields_fieldGroup_fields: 'position',
  transactionForm_mainFields_fieldGroup_fields_field: 'id',
  transactionForm_actionbar_buttons_button: 'id',
  transactionForm_actionbar_menu_menuitem: 'id',
  transactionForm_quickViewFields_field: 'id',
  transactionForm_roles_role: 'id',
  transactionForm_tabs_tab: 'id',
  transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields: 'position',
  transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_field: 'id',
  transactionForm_tabs_tab_fieldGroups_fieldGroup_fields: 'position',
  transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_field: 'id',
  transactionForm_tabs_tab_subItems_subList: 'id',
  transactionForm_tabs_tab_subItems_subList_columns_column: 'id',
  transactionForm_tabs_tab_subItems_subTab: 'id',
  transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields: 'position',
  transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_field: 'id',
  transactionForm_totalBox_totalBoxField: 'id',

  // workflow parameters
  workflow_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters_parameter: 'name',
  workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters_parameter: 'name',

  // workflow field filters
  workflow_workflowcustomfields_workflowcustomfield_customfieldfilters_customfieldfilter: 'fldfilter',
  workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters_customfieldfilter: 'fldfilter',

  // workflow actions
  workflow_workflowstates_workflowstate_workflowactions: 'triggertype',

  // workflow settings
  workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings_workflowfieldsetting: 'targetworkflowfield',
  workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings_workflowfieldsetting: 'targetworkflowfield',
  workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings_fieldsetting: 'targetfield',
  workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings_fieldsetting: 'targetfield',
  workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings_fieldsetting: 'targetfield',
  workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings_fieldsetting: 'targetfield',
  workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings_fieldsetting: 'targetfield',
  workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings_fieldsetting: 'targetfield',
  workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings_fieldsetting: 'targetfield',
  workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings_fieldsetting: 'targetfield',
  workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings_fieldsetting: 'targetfield',
  workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings_parametersetting: 'targetparameter',
  workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings_parametersetting: 'targetparameter',
}

const scriptdeploymentsTypes = [
  'bundleinstallationscript_scriptdeployments_scriptdeployment',
  'clientscript_scriptdeployments_scriptdeployment',
  'customrecordactionscript_scriptdeployments_scriptdeployment',
  'mapreducescript_scriptdeployments_scriptdeployment',
  'massupdatescript_scriptdeployments_scriptdeployment',
  'portlet_scriptdeployments_scriptdeployment',
  'restlet_scriptdeployments_scriptdeployment',
  'scheduledscript_scriptdeployments_scriptdeployment',
  'sdfinstallationscript_scriptdeployments_scriptdeployment',
  'suitelet_scriptdeployments_scriptdeployment',
  'usereventscript_scriptdeployments_scriptdeployment',
  'workflowactionscript_scriptdeployments_scriptdeployment',
]

export const mapsWithoutIndex: ReadonlySet<string> = new Set(
  scriptdeploymentsTypes
    .concat(Object.keys(customrecordtypeMapping))
    .concat(Object.keys(customsegmentMapping))
    .concat(Object.keys(savedcsvimportMapping))
    .concat(Object.keys(customtransactiontypeMapping))
    .concat(Object.keys(roleMapping))
    .concat(Object.keys(roleAccessMapping))
    .concat(Object.keys(translationsMapping))
)
