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

export const transactionFormInnerTypes: ObjectType[] = []

const transactionFormElemID = new ElemID(constants.NETSUITE, 'transactionForm')
const transactionForm_actionbar_buttons_buttonElemID = new ElemID(constants.NETSUITE, 'transactionForm_actionbar_buttons_button')

const transactionForm_actionbar_buttons_button = new ObjectType({
  elemID: transactionForm_actionbar_buttons_buttonElemID,
  annotations: {
  },
  fields: [
    {
      name: 'id',
      type: enums.transactionform_buttonid,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see transactionform_buttonid. */
    {
      name: 'label',
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    }, /* Original description: This field value can be up to 40 characters long. */
    {
      name: 'visible',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar_buttons_button)

const transactionForm_actionbar_buttonsElemID = new ElemID(constants.NETSUITE, 'transactionForm_actionbar_buttons')

const transactionForm_actionbar_buttons = new ObjectType({
  elemID: transactionForm_actionbar_buttonsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'button',
      type: new ListType(transactionForm_actionbar_buttons_button),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar_buttons)

const transactionForm_actionbar_customButtons_customButtonElemID = new ElemID(constants.NETSUITE, 'transactionForm_actionbar_customButtons_customButton')

const transactionForm_actionbar_customButtons_customButton = new ObjectType({
  elemID: transactionForm_actionbar_customButtons_customButtonElemID,
  annotations: {
  },
  fields: [
    {
      name: 'label',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 99,
      },
    }, /* Original description: This field value can be up to 99 characters long. */
    {
      name: 'function',
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    }, /* Original description: This field value can be up to 200 characters long. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar_customButtons_customButton)

const transactionForm_actionbar_customButtonsElemID = new ElemID(constants.NETSUITE, 'transactionForm_actionbar_customButtons')

const transactionForm_actionbar_customButtons = new ObjectType({
  elemID: transactionForm_actionbar_customButtonsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'customButton',
      type: new ListType(transactionForm_actionbar_customButtons_customButton),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar_customButtons)

const transactionForm_actionbar_customMenu_customMenuItemElemID = new ElemID(constants.NETSUITE, 'transactionForm_actionbar_customMenu_customMenuItem')

const transactionForm_actionbar_customMenu_customMenuItem = new ObjectType({
  elemID: transactionForm_actionbar_customMenu_customMenuItemElemID,
  annotations: {
  },
  fields: [
    {
      name: 'label',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 99,
      },
    }, /* Original description: This field value can be up to 99 characters long. */
    {
      name: 'function',
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    }, /* Original description: This field value can be up to 200 characters long. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar_customMenu_customMenuItem)

const transactionForm_actionbar_customMenuElemID = new ElemID(constants.NETSUITE, 'transactionForm_actionbar_customMenu')

const transactionForm_actionbar_customMenu = new ObjectType({
  elemID: transactionForm_actionbar_customMenuElemID,
  annotations: {
  },
  fields: [
    {
      name: 'customMenuItem',
      type: new ListType(transactionForm_actionbar_customMenu_customMenuItem),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar_customMenu)

const transactionForm_actionbar_menu_menuitemElemID = new ElemID(constants.NETSUITE, 'transactionForm_actionbar_menu_menuitem')

const transactionForm_actionbar_menu_menuitem = new ObjectType({
  elemID: transactionForm_actionbar_menu_menuitemElemID,
  annotations: {
  },
  fields: [
    {
      name: 'id',
      type: enums.transactionform_buttonid,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see transactionform_buttonid. */
    {
      name: 'label',
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    }, /* Original description: This field value can be up to 40 characters long. */
    {
      name: 'visible',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar_menu_menuitem)

const transactionForm_actionbar_menuElemID = new ElemID(constants.NETSUITE, 'transactionForm_actionbar_menu')

const transactionForm_actionbar_menu = new ObjectType({
  elemID: transactionForm_actionbar_menuElemID,
  annotations: {
  },
  fields: [
    {
      name: 'menuitem',
      type: new ListType(transactionForm_actionbar_menu_menuitem),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar_menu)

const transactionForm_actionbarElemID = new ElemID(constants.NETSUITE, 'transactionForm_actionbar')

const transactionForm_actionbar = new ObjectType({
  elemID: transactionForm_actionbarElemID,
  annotations: {
  },
  fields: [
    {
      name: 'buttons',
      type: transactionForm_actionbar_buttons,
      annotations: {
      },
    },
    {
      name: 'customButtons',
      type: transactionForm_actionbar_customButtons,
      annotations: {
      },
    },
    {
      name: 'customMenu',
      type: transactionForm_actionbar_customMenu,
      annotations: {
      },
    },
    {
      name: 'menu',
      type: transactionForm_actionbar_menu,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar)

const transactionForm_buttons_standardButtons_buttonElemID = new ElemID(constants.NETSUITE, 'transactionForm_buttons_standardButtons_button')

const transactionForm_buttons_standardButtons_button = new ObjectType({
  elemID: transactionForm_buttons_standardButtons_buttonElemID,
  annotations: {
  },
  fields: [
    {
      name: 'id',
      type: enums.transactionform_buttonid,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see transactionform_buttonid. */
    {
      name: 'label',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'visible',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'style',
      type: enums.form_buttonstyle,
      annotations: {
      },
    }, /* Original description: For information about possible values, see form_buttonstyle.   The default value is 'BUTTON'. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_buttons_standardButtons_button)

const transactionForm_buttons_standardButtonsElemID = new ElemID(constants.NETSUITE, 'transactionForm_buttons_standardButtons')

const transactionForm_buttons_standardButtons = new ObjectType({
  elemID: transactionForm_buttons_standardButtonsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'button',
      type: new ListType(transactionForm_buttons_standardButtons_button),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_buttons_standardButtons)

const transactionForm_buttonsElemID = new ElemID(constants.NETSUITE, 'transactionForm_buttons')

const transactionForm_buttons = new ObjectType({
  elemID: transactionForm_buttonsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'standardButtons',
      type: transactionForm_buttons_standardButtons,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_buttons)

const transactionForm_customCodeElemID = new ElemID(constants.NETSUITE, 'transactionForm_customCode')

const transactionForm_customCode = new ObjectType({
  elemID: transactionForm_customCodeElemID,
  annotations: {
  },
  fields: [
    {
      name: 'scriptFile',
      type: BuiltinTypes.STRING /* Original type was filereference */,
      annotations: {
      },
    }, /* Original description: This field must reference a .js file. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_customCode)

const transactionForm_mainFields_defaultFieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'transactionForm_mainFields_defaultFieldGroup_fields_field')

const transactionForm_mainFields_defaultFieldGroup_fields_field = new ObjectType({
  elemID: transactionForm_mainFields_defaultFieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: [
    {
      name: 'id',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
    {
      name: 'label',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'visible',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'mandatory',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'displayType',
      type: enums.form_displaytype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    {
      name: 'columnBreak',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'spaceBefore',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'sameRowAsPrevious',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'quickAdd',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'checkBoxDefault',
      type: enums.transactionform_checkboxdefault,
      annotations: {
      },
    }, /* Original description: For information about possible values, see transactionform_checkboxdefault.   The default value is 'UNCHECKED'. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_mainFields_defaultFieldGroup_fields_field)

const transactionForm_mainFields_defaultFieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'transactionForm_mainFields_defaultFieldGroup_fields')

const transactionForm_mainFields_defaultFieldGroup_fields = new ObjectType({
  elemID: transactionForm_mainFields_defaultFieldGroup_fieldsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'position',
      type: enums.form_fieldposition,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    {
      name: 'field',
      type: new ListType(transactionForm_mainFields_defaultFieldGroup_fields_field),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_mainFields_defaultFieldGroup_fields)

const transactionForm_mainFields_defaultFieldGroupElemID = new ElemID(constants.NETSUITE, 'transactionForm_mainFields_defaultFieldGroup')

const transactionForm_mainFields_defaultFieldGroup = new ObjectType({
  elemID: transactionForm_mainFields_defaultFieldGroupElemID,
  annotations: {
  },
  fields: [
    {
      name: 'fields',
      type: transactionForm_mainFields_defaultFieldGroup_fields,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_mainFields_defaultFieldGroup)

const transactionForm_mainFields_fieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'transactionForm_mainFields_fieldGroup_fields_field')

const transactionForm_mainFields_fieldGroup_fields_field = new ObjectType({
  elemID: transactionForm_mainFields_fieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: [
    {
      name: 'id',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
    {
      name: 'label',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'visible',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'mandatory',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'displayType',
      type: enums.form_displaytype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    {
      name: 'columnBreak',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'spaceBefore',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'sameRowAsPrevious',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'quickAdd',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'checkBoxDefault',
      type: enums.transactionform_checkboxdefault,
      annotations: {
      },
    }, /* Original description: For information about possible values, see transactionform_checkboxdefault.   The default value is 'UNCHECKED'. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_mainFields_fieldGroup_fields_field)

const transactionForm_mainFields_fieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'transactionForm_mainFields_fieldGroup_fields')

const transactionForm_mainFields_fieldGroup_fields = new ObjectType({
  elemID: transactionForm_mainFields_fieldGroup_fieldsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'position',
      type: enums.form_fieldposition,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    {
      name: 'field',
      type: new ListType(transactionForm_mainFields_fieldGroup_fields_field),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_mainFields_fieldGroup_fields)

const transactionForm_mainFields_fieldGroupElemID = new ElemID(constants.NETSUITE, 'transactionForm_mainFields_fieldGroup')

const transactionForm_mainFields_fieldGroup = new ObjectType({
  elemID: transactionForm_mainFields_fieldGroupElemID,
  annotations: {
  },
  fields: [
    {
      name: 'scriptid',
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 99 characters long. */
    {
      name: 'label',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'visible',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'showTitle',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'singleColumn',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'fields',
      type: transactionForm_mainFields_fieldGroup_fields,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_mainFields_fieldGroup)

const transactionForm_mainFieldsElemID = new ElemID(constants.NETSUITE, 'transactionForm_mainFields')

const transactionForm_mainFields = new ObjectType({
  elemID: transactionForm_mainFieldsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'defaultFieldGroup',
      type: transactionForm_mainFields_defaultFieldGroup,
      annotations: {
      },
    },
    {
      name: 'fieldGroup',
      type: new ListType(transactionForm_mainFields_fieldGroup),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_mainFields)

const transactionForm_printingType_advancedElemID = new ElemID(constants.NETSUITE, 'transactionForm_printingType_advanced')

const transactionForm_printingType_advanced = new ObjectType({
  elemID: transactionForm_printingType_advancedElemID,
  annotations: {
  },
  fields: [
    {
      name: 'printTemplate',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the advancedpdftemplate custom type.   For information about other possible values, see transactionform_advancedtemplate.   If this field appears in the project, you must reference the ADVANCEDPRINTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ADVANCEDPRINTING must be enabled for this field to appear in your account. */
    {
      name: 'emailTemplate',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the advancedpdftemplate custom type.   For information about other possible values, see transactionform_advancedtemplate.   If this field appears in the project, you must reference the ADVANCEDPRINTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ADVANCEDPRINTING must be enabled for this field to appear in your account. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_printingType_advanced)

const transactionForm_printingType_basicElemID = new ElemID(constants.NETSUITE, 'transactionForm_printingType_basic')

const transactionForm_printingType_basic = new ObjectType({
  elemID: transactionForm_printingType_basicElemID,
  annotations: {
  },
  fields: [
    {
      name: 'pdfLayout',
      type: enums.transactionform_pdflayout,
      annotations: {
      },
    }, /* Original description: For information about possible values, see transactionform_pdflayout. */
    {
      name: 'htmlLayout',
      type: enums.transactionform_htmllayout,
      annotations: {
      },
    }, /* Original description: For information about possible values, see transactionform_htmllayout. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_printingType_basic)

const transactionForm_printingTypeElemID = new ElemID(constants.NETSUITE, 'transactionForm_printingType')

const transactionForm_printingType = new ObjectType({
  elemID: transactionForm_printingTypeElemID,
  annotations: {
  },
  fields: [
    {
      name: 'advanced',
      type: transactionForm_printingType_advanced,
      annotations: {
      },
    },
    {
      name: 'basic',
      type: transactionForm_printingType_basic,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_printingType)

const transactionForm_quickViewFields_fieldElemID = new ElemID(constants.NETSUITE, 'transactionForm_quickViewFields_field')

const transactionForm_quickViewFields_field = new ObjectType({
  elemID: transactionForm_quickViewFields_fieldElemID,
  annotations: {
  },
  fields: [
    {
      name: 'id',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_quickViewFields_field)

const transactionForm_quickViewFieldsElemID = new ElemID(constants.NETSUITE, 'transactionForm_quickViewFields')

const transactionForm_quickViewFields = new ObjectType({
  elemID: transactionForm_quickViewFieldsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'field',
      type: new ListType(transactionForm_quickViewFields_field),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_quickViewFields)

const transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_field')

const transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_field = new ObjectType({
  elemID: transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: [
    {
      name: 'id',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
    {
      name: 'label',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'visible',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'mandatory',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'displayType',
      type: enums.form_displaytype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    {
      name: 'columnBreak',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'spaceBefore',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'sameRowAsPrevious',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'quickAdd',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'checkBoxDefault',
      type: enums.transactionform_checkboxdefault,
      annotations: {
      },
    }, /* Original description: For information about possible values, see transactionform_checkboxdefault.   The default value is 'USE_FIELD_DEFAULT'. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_field)

const transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields')

const transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields = new ObjectType({
  elemID: transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fieldsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'position',
      type: enums.form_fieldposition,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    {
      name: 'field',
      type: new ListType(transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_field),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields)

const transactionForm_tabs_tab_fieldGroups_defaultFieldGroupElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_fieldGroups_defaultFieldGroup')

const transactionForm_tabs_tab_fieldGroups_defaultFieldGroup = new ObjectType({
  elemID: transactionForm_tabs_tab_fieldGroups_defaultFieldGroupElemID,
  annotations: {
  },
  fields: [
    {
      name: 'fields',
      type: transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_fieldGroups_defaultFieldGroup)

const transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_field')

const transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_field = new ObjectType({
  elemID: transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: [
    {
      name: 'id',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
    {
      name: 'label',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'visible',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'mandatory',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'displayType',
      type: enums.form_displaytype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    {
      name: 'columnBreak',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'spaceBefore',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'sameRowAsPrevious',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'quickAdd',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'checkBoxDefault',
      type: enums.transactionform_checkboxdefault,
      annotations: {
      },
    }, /* Original description: For information about possible values, see transactionform_checkboxdefault.   The default value is 'USE_FIELD_DEFAULT'. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_field)

const transactionForm_tabs_tab_fieldGroups_fieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_fieldGroups_fieldGroup_fields')

const transactionForm_tabs_tab_fieldGroups_fieldGroup_fields = new ObjectType({
  elemID: transactionForm_tabs_tab_fieldGroups_fieldGroup_fieldsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'position',
      type: enums.form_fieldposition,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    {
      name: 'field',
      type: new ListType(transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_field),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_fieldGroups_fieldGroup_fields)

const transactionForm_tabs_tab_fieldGroups_fieldGroupElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_fieldGroups_fieldGroup')

const transactionForm_tabs_tab_fieldGroups_fieldGroup = new ObjectType({
  elemID: transactionForm_tabs_tab_fieldGroups_fieldGroupElemID,
  annotations: {
  },
  fields: [
    {
      name: 'scriptid',
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 99 characters long. */
    {
      name: 'label',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'visible',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'showTitle',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'singleColumn',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'fields',
      type: transactionForm_tabs_tab_fieldGroups_fieldGroup_fields,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_fieldGroups_fieldGroup)

const transactionForm_tabs_tab_fieldGroupsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_fieldGroups')

const transactionForm_tabs_tab_fieldGroups = new ObjectType({
  elemID: transactionForm_tabs_tab_fieldGroupsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'defaultFieldGroup',
      type: transactionForm_tabs_tab_fieldGroups_defaultFieldGroup,
      annotations: {
      },
    },
    {
      name: 'fieldGroup',
      type: new ListType(transactionForm_tabs_tab_fieldGroups_fieldGroup),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_fieldGroups)

const transactionForm_tabs_tab_subItems_subList_columns_columnElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subList_columns_column')

const transactionForm_tabs_tab_subItems_subList_columns_column = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subList_columns_columnElemID,
  annotations: {
  },
  fields: [
    {
      name: 'id',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the transactioncolumncustomfield custom type.   For information about other possible values, see transactionform_columnid. */
    {
      name: 'label',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'visible',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subList_columns_column)

const transactionForm_tabs_tab_subItems_subList_columnsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subList_columns')

const transactionForm_tabs_tab_subItems_subList_columns = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subList_columnsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'column',
      type: new ListType(transactionForm_tabs_tab_subItems_subList_columns_column),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subList_columns)

const transactionForm_tabs_tab_subItems_subListElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subList')

const transactionForm_tabs_tab_subItems_subList = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subListElemID,
  annotations: {
  },
  fields: [
    {
      name: 'id',
      type: BuiltinTypes.STRING /* Original type was enums.transactionform_sublistid but it can also be CRMCONTACTS */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see transactionform_sublistid. */
    {
      name: 'label',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'visible',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'columns',
      type: transactionForm_tabs_tab_subItems_subList_columns,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subList)

const transactionForm_tabs_tab_subItems_subLists_subListElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subLists_subList')

const transactionForm_tabs_tab_subItems_subLists_subList = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subLists_subListElemID,
  annotations: {
  },
  fields: [
    {
      name: 'id',
      type: BuiltinTypes.STRING /* Original type was enums.transactionform_sublistid but it can also be CRMCONTACTS */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see transactionform_sublistid. */
    {
      name: 'label',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'visible',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subLists_subList)

const transactionForm_tabs_tab_subItems_subListsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subLists')

const transactionForm_tabs_tab_subItems_subLists = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subListsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'subList',
      type: new ListType(transactionForm_tabs_tab_subItems_subLists_subList),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subLists)

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_field')

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_field = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: [
    {
      name: 'id',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
    {
      name: 'label',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'visible',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'mandatory',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'displayType',
      type: enums.form_displaytype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    {
      name: 'columnBreak',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'spaceBefore',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'sameRowAsPrevious',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'quickAdd',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'checkBoxDefault',
      type: enums.transactionform_checkboxdefault,
      annotations: {
      },
    }, /* Original description: For information about possible values, see transactionform_checkboxdefault.   The default value is 'USE_FIELD_DEFAULT'. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_field)

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields')

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fieldsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'position',
      type: enums.form_fieldposition,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    {
      name: 'field',
      type: new ListType(transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_field),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields)

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroupElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup')

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroupElemID,
  annotations: {
  },
  fields: [
    {
      name: 'fields',
      type: transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup)

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_field')

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_field = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: [
    {
      name: 'id',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
    {
      name: 'label',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'visible',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'mandatory',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'displayType',
      type: enums.form_displaytype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    {
      name: 'columnBreak',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'spaceBefore',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'sameRowAsPrevious',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'quickAdd',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'checkBoxDefault',
      type: enums.transactionform_checkboxdefault,
      annotations: {
      },
    }, /* Original description: For information about possible values, see transactionform_checkboxdefault.   The default value is 'USE_FIELD_DEFAULT'. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_field)

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields')

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fieldsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'position',
      type: enums.form_fieldposition,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    {
      name: 'field',
      type: new ListType(transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_field),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields)

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroupElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup')

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroupElemID,
  annotations: {
  },
  fields: [
    {
      name: 'scriptid',
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 99 characters long. */
    {
      name: 'label',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'visible',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'showTitle',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'singleColumn',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'fields',
      type: transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup)

const transactionForm_tabs_tab_subItems_subTab_fieldGroupsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subTab_fieldGroups')

const transactionForm_tabs_tab_subItems_subTab_fieldGroups = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subTab_fieldGroupsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'defaultFieldGroup',
      type: transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup,
      annotations: {
      },
    },
    {
      name: 'fieldGroup',
      type: new ListType(transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subTab_fieldGroups)

const transactionForm_tabs_tab_subItems_subTabElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subTab')

const transactionForm_tabs_tab_subItems_subTab = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subTabElemID,
  annotations: {
  },
  fields: [
    {
      name: 'id',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   subtab   subtab   For information about other possible values, see transactionform_subtabid. */
    {
      name: 'label',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'visible',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'fieldGroups',
      type: transactionForm_tabs_tab_subItems_subTab_fieldGroups,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subTab)

const transactionForm_tabs_tab_subItemsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems')

const transactionForm_tabs_tab_subItems = new ObjectType({
  elemID: transactionForm_tabs_tab_subItemsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'subList',
      type: new ListType(transactionForm_tabs_tab_subItems_subList),
      annotations: {
      },
    },
    {
      name: 'subLists',
      type: new ListType(transactionForm_tabs_tab_subItems_subLists),
      annotations: {
      },
    },
    {
      name: 'subTab',
      type: new ListType(transactionForm_tabs_tab_subItems_subTab),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems)

const transactionForm_tabs_tabElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab')

const transactionForm_tabs_tab = new ObjectType({
  elemID: transactionForm_tabs_tabElemID,
  annotations: {
  },
  fields: [
    {
      name: 'id',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   subtab   subtab   For information about other possible values, see transactionform_tabid. */
    {
      name: 'label',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'visible',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'fieldGroups',
      type: transactionForm_tabs_tab_fieldGroups,
      annotations: {
      },
    },
    {
      name: 'subItems',
      type: transactionForm_tabs_tab_subItems,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab)

const transactionForm_tabsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs')

const transactionForm_tabs = new ObjectType({
  elemID: transactionForm_tabsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'tab',
      type: new ListType(transactionForm_tabs_tab),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs)


export const transactionForm = new ObjectType({
  elemID: transactionFormElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'custform_',
  },
  fields: [
    {
      name: 'scriptid',
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custform’. */
    {
      name: 'standard',
      type: enums.transactionform_standard,
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 99 characters long.   For information about possible values, see transactionform_standard. */
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
      },
    },
    {
      name: 'recordType',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    },
    {
      name: 'inactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'preferred',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'storedWithRecord',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'disclaimer',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'address',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'allowAddMultiple',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'actionbar',
      type: transactionForm_actionbar,
      annotations: {
      },
    },
    {
      name: 'buttons',
      type: transactionForm_buttons,
      annotations: {
      },
    },
    {
      name: 'customCode',
      type: transactionForm_customCode,
      annotations: {
      },
    },
    {
      name: 'mainFields',
      type: transactionForm_mainFields,
      annotations: {
      },
    },
    {
      name: 'printingType',
      type: transactionForm_printingType,
      annotations: {
      },
    },
    {
      name: 'quickViewFields',
      type: transactionForm_quickViewFields,
      annotations: {
      },
    },
    {
      name: 'tabs',
      type: transactionForm_tabs,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})
