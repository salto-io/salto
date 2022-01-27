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

export const listMappedByFieldMapping: Record<string, string> = {
  // addressForm
  addressForm_mainFields_defaultFieldGroup_fields: 'position',
  addressForm_mainFields_defaultFieldGroup_fields_field: 'id',
  addressForm_mainFields_fieldGroup_fields: 'position',
  addressForm_mainFields_fieldGroup_fields_field: 'id',

  // centercategory
  centercategory_links_link: 'linkid',

  // clientscript
  clientscript_buttons_button: 'buttonlabel',

  // customrecordtype
  customrecordtype_links_link: 'linkcategory',
  customrecordtype_permissions_permission: 'permittedrole',

  // customsegment permissions
  customsegment_permissions_permission: 'role',

  // customsegment applications
  customsegment_segmentapplication_crm_applications_application: 'id',
  customsegment_segmentapplication_customrecords_applications_application: 'id',
  customsegment_segmentapplication_otherrecords_applications_application: 'id',
  customsegment_segmentapplication_transactionbody_applications_application: 'id',
  customsegment_segmentapplication_transactionline_applications_application: 'id',

  // customtransactiontype
  customtransactiontype_permissions_permission: 'permittedrole',

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

  // entitycustomfield
  entitycustomfield_roleaccesses_roleaccess: 'role',

  // othercustomfield
  othercustomfield_roleaccesses_roleaccess: 'role',

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

  // workflow role access
  workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses_roleaccess: 'role',
  workflow_workflowcustomfields_workflowcustomfield_roleaccesses_roleaccess: 'role',
}
