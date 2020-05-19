/*
*                      Copyright 2020 Salto Labs Ltd.
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
/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/camelcase */
import {
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType, ListType,
} from '@salto-io/adapter-api'
import * as constants from '../../constants'
import { enums } from '../enums'

export const entitycustomfieldInnerTypes: ObjectType[] = []

const entitycustomfieldElemID = new ElemID(constants.NETSUITE, 'entitycustomfield')
const entitycustomfield_customfieldfilters_customfieldfilterElemID = new ElemID(constants.NETSUITE, 'entitycustomfield_customfieldfilters_customfieldfilter')

const entitycustomfield_customfieldfilters_customfieldfilter = new ObjectType({
  elemID: entitycustomfield_customfieldfilters_customfieldfilterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'fldfilter',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'fldfilterchecked',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'fldfiltercomparetype',
      type: enums.generic_customfield_fldfiltercomparetype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_fldfiltercomparetype.   The default value is 'EQ'. */
    {
      name: 'fldfiltersel',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'fldfilterval',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'fldfilternotnull',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'fldfilternull',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'fldcomparefield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, entitycustomfieldElemID.name],
})

entitycustomfieldInnerTypes.push(entitycustomfield_customfieldfilters_customfieldfilter)

const entitycustomfield_customfieldfiltersElemID = new ElemID(constants.NETSUITE, 'entitycustomfield_customfieldfilters')

const entitycustomfield_customfieldfilters = new ObjectType({
  elemID: entitycustomfield_customfieldfiltersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'customfieldfilter',
      type: new ListType(entitycustomfield_customfieldfilters_customfieldfilter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, entitycustomfieldElemID.name],
})

entitycustomfieldInnerTypes.push(entitycustomfield_customfieldfilters)

const entitycustomfield_roleaccesses_roleaccessElemID = new ElemID(constants.NETSUITE, 'entitycustomfield_roleaccesses_roleaccess')

const entitycustomfield_roleaccesses_roleaccess = new ObjectType({
  elemID: entitycustomfield_roleaccesses_roleaccessElemID,
  annotations: {
  },
  fields: [
    {
      name: 'role',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    {
      name: 'accesslevel',
      type: enums.generic_accesslevel_searchlevel,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
    {
      name: 'searchlevel',
      type: enums.generic_accesslevel_searchlevel,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, entitycustomfieldElemID.name],
})

entitycustomfieldInnerTypes.push(entitycustomfield_roleaccesses_roleaccess)

const entitycustomfield_roleaccessesElemID = new ElemID(constants.NETSUITE, 'entitycustomfield_roleaccesses')

const entitycustomfield_roleaccesses = new ObjectType({
  elemID: entitycustomfield_roleaccessesElemID,
  annotations: {
  },
  fields: [
    {
      name: 'roleaccess',
      type: new ListType(entitycustomfield_roleaccesses_roleaccess),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, entitycustomfieldElemID.name],
})

entitycustomfieldInnerTypes.push(entitycustomfield_roleaccesses)


export const entitycustomfield = new ObjectType({
  elemID: entitycustomfieldElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'custentity_',
  },
  fields: [
    {
      name: 'scriptid',
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘custentity’. */
    {
      name: 'fieldtype',
      type: enums.generic_customfield_fieldtype,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_customfield_fieldtype.   The default value is 'TEXT'. */
    {
      name: 'label',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    }, /* Original description: This field value can be up to 200 characters long. */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the fieldtype value is equal to any of the following lists or values: SELECT, MULTISELECT.   This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
    {
      name: 'applyformatting',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'defaultchecked',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'defaultselection',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'defaultvalue',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'description',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'displaytype',
      type: enums.generic_customfield_displaytype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_displaytype.   The default value is 'NORMAL'. */
    {
      name: 'dynamicdefault',
      type: enums.generic_customfield_dynamicdefault,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_dynamicdefault. */
    {
      name: 'help',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'linktext',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'minvalue',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'maxvalue',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'storevalue',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'accesslevel',
      type: enums.generic_accesslevel_searchlevel,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    {
      name: 'checkspelling',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'encryptatrest',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'displayheight',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    }, /* Original description: This field value must be greater than or equal to 0. */
    {
      name: 'displaywidth',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    }, /* Original description: This field value must be greater than or equal to 0. */
    {
      name: 'globalsearch',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'isformula',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'ismandatory',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'maxlength',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'onparentdelete',
      type: enums.generic_customfield_onparentdelete,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_onparentdelete. */
    {
      name: 'searchcomparefield',
      type: enums.generic_standard_field,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_standard_field. */
    {
      name: 'searchdefault',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'searchlevel',
      type: enums.generic_accesslevel_searchlevel,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    {
      name: 'showhierarchy',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'showinlist',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'sourcefilterby',
      type: enums.generic_standard_field,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_standard_field. */
    {
      name: 'sourcefrom',
      type: BuiltinTypes.STRING /* Original type was enums.generic_standard_field but it can also be reference */,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_standard_field. */
    {
      name: 'sourcelist',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the entitycustomfield custom type.   For information about other possible values, see generic_standard_field. */
    {
      name: 'isparent',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'parentsubtab',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   subtab   subtab   For information about other possible values, see generic_tab_parent. */
    {
      name: 'subtab',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the subtab custom type.   For information about other possible values, see generic_entity_tab. */
    {
      name: 'appliestocontact',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'appliestocustomer',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'appliestoemployee',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'appliestogenericrsrc',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the ADVANCEDJOBS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ADVANCEDJOBS must be enabled for this field to appear in your account. */
    {
      name: 'appliestogroup',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'appliestoothername',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'appliestopartner',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the CRM feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CRM must be enabled for this field to appear in your account. */
    {
      name: 'appliestopricelist',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'appliestoproject',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the JOBS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. JOBS must be enabled for this field to appear in your account. */
    {
      name: 'appliestoprojecttemplate',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'appliestostatement',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'appliestovendor',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the ACCOUNTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ACCOUNTING must be enabled for this field to appear in your account. */
    {
      name: 'appliestowebsite',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the WEBSITE feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. WEBSITE must be enabled for this field to appear in your account. */
    {
      name: 'availableexternally',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'availabletosso',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the SUITESIGNON feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. SUITESIGNON must be enabled for this field to appear in your account. */
    {
      name: 'customfieldfilters',
      type: entitycustomfield_customfieldfilters,
      annotations: {
      },
    },
    {
      name: 'roleaccesses',
      type: entitycustomfield_roleaccesses,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, entitycustomfieldElemID.name],
})
