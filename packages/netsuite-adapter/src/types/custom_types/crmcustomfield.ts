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
/* eslint-disable max-len */
/* eslint-disable camelcase */
import {
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType, createRestriction, ListType,
} from '@salto-io/adapter-api'
import * as constants from '../../constants'
import { enums } from '../enums'

export const crmcustomfieldInnerTypes: ObjectType[] = []

const crmcustomfieldElemID = new ElemID(constants.NETSUITE, 'crmcustomfield')
const crmcustomfield_customfieldfilters_customfieldfilterElemID = new ElemID(constants.NETSUITE, 'crmcustomfield_customfieldfilters_customfieldfilter')

const crmcustomfield_customfieldfilters_customfieldfilter = new ObjectType({
  elemID: crmcustomfield_customfieldfilters_customfieldfilterElemID,
  annotations: {
  },
  fields: {
    fldfilter: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fldfilterchecked: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fldfiltercomparetype: {
      refType: enums.generic_customfield_fldfiltercomparetype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_fldfiltercomparetype.   The default value is 'EQ'. */
    fldfiltersel: {
      refType: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    fldfilterval: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    fldfilternotnull: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fldfilternull: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fldcomparefield: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, crmcustomfieldElemID.name],
})

crmcustomfieldInnerTypes.push(crmcustomfield_customfieldfilters_customfieldfilter)

const crmcustomfield_customfieldfiltersElemID = new ElemID(constants.NETSUITE, 'crmcustomfield_customfieldfilters')

const crmcustomfield_customfieldfilters = new ObjectType({
  elemID: crmcustomfield_customfieldfiltersElemID,
  annotations: {
  },
  fields: {
    customfieldfilter: {
      refType: new ListType(crmcustomfield_customfieldfilters_customfieldfilter),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, crmcustomfieldElemID.name],
})

crmcustomfieldInnerTypes.push(crmcustomfield_customfieldfilters)

const crmcustomfield_roleaccesses_roleaccessElemID = new ElemID(constants.NETSUITE, 'crmcustomfield_roleaccesses_roleaccess')

const crmcustomfield_roleaccesses_roleaccess = new ObjectType({
  elemID: crmcustomfield_roleaccesses_roleaccessElemID,
  annotations: {
  },
  fields: {
    role: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    accesslevel: {
      refType: enums.generic_accesslevel_searchlevel,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
    searchlevel: {
      refType: enums.generic_accesslevel_searchlevel,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, crmcustomfieldElemID.name],
})

crmcustomfieldInnerTypes.push(crmcustomfield_roleaccesses_roleaccess)

const crmcustomfield_roleaccessesElemID = new ElemID(constants.NETSUITE, 'crmcustomfield_roleaccesses')

const crmcustomfield_roleaccesses = new ObjectType({
  elemID: crmcustomfield_roleaccessesElemID,
  annotations: {
  },
  fields: {
    roleaccess: {
      refType: new ListType(crmcustomfield_roleaccesses_roleaccess),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, crmcustomfieldElemID.name],
})

crmcustomfieldInnerTypes.push(crmcustomfield_roleaccesses)


export const crmcustomfield = new ObjectType({
  elemID: crmcustomfieldElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^custevent[0-9a-z_]+' }),
      },
    }, /* Original description: This attribute value can be up to 39 characters long.   The default value is ‘custevent’. */
    fieldtype: {
      refType: enums.generic_customfield_fieldtype,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_customfield_fieldtype.   The default value is 'TEXT'. */
    label: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 200 }),
      },
    }, /* Original description: This field value can be up to 200 characters long.   This field accepts references to the string custom type. */
    selectrecordtype: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the fieldtype value is equal to any of the following lists or values: SELECT, MULTISELECT.   This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
    applyformatting: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    defaultchecked: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    defaultselection: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    defaultvalue: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    description: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    displaytype: {
      refType: enums.generic_customfield_displaytype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_displaytype.   The default value is 'NORMAL'. */
    dynamicdefault: {
      refType: enums.generic_customfield_dynamicdefault,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_dynamicdefault. */
    help: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the string custom type. */
    linktext: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    minvalue: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    maxvalue: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    storevalue: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    accesslevel: {
      refType: enums.generic_accesslevel_searchlevel,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    checkspelling: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    encryptatrest: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    displayheight: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
      },
    }, /* Original description: This field value must be greater than or equal to 0. */
    displaywidth: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
      },
    }, /* Original description: This field value must be greater than or equal to 0. */
    globalsearch: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    isformula: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    ismandatory: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    maxlength: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    onparentdelete: {
      refType: enums.generic_customfield_onparentdelete,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_onparentdelete. */
    searchcomparefield: {
      refType: enums.generic_standard_field,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_standard_field. */
    searchdefault: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    searchlevel: {
      refType: enums.generic_accesslevel_searchlevel,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    showhierarchy: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    showinlist: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    sourcefilterby: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the crmcustomfield custom type.   For information about other possible values, see generic_standard_field. */
    sourcefrom: {
      refType: enums.generic_standard_field,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_standard_field. */
    sourcelist: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the crmcustomfield custom type.   For information about other possible values, see generic_standard_field. */
    isparent: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    parentsubtab: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   subtab   subtab   For information about other possible values, see generic_tab_parent. */
    subtab: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the subtab custom type.   For information about other possible values, see generic_crm_tab. */
    appliestocampaign: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the MARKETING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. MARKETING must be enabled for this field to appear in your account. */
    appliestocase: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the SUPPORT feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. SUPPORT must be enabled for this field to appear in your account. */
    appliestoevent: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    appliestoissue: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the ISSUEDB feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ISSUEDB must be enabled for this field to appear in your account. */
    appliestomfgprojecttask: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the MFGROUTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. MFGROUTING must be enabled for this field to appear in your account. */
    appliesperkeyword: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the MARKETING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. MARKETING must be enabled for this field to appear in your account. */
    appliestophonecall: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    appliestoprojecttask: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the ADVANCEDJOBS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ADVANCEDJOBS must be enabled for this field to appear in your account. */
    appliestoresourceallocation: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the RESOURCEALLOCATIONS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. RESOURCEALLOCATIONS must be enabled for this field to appear in your account. */
    appliestosolution: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the KNOWLEDGEBASE feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. KNOWLEDGEBASE must be enabled for this field to appear in your account. */
    appliestotask: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    availableexternally: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    showissuechanges: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the ISSUEDB feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ISSUEDB must be enabled for this field to appear in your account. */
    customfieldfilters: {
      refType: crmcustomfield_customfieldfilters,
      annotations: {
      },
    },
    roleaccesses: {
      refType: crmcustomfield_roleaccesses,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, crmcustomfieldElemID.name],
})
