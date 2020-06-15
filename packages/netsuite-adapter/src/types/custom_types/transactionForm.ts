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
  fields: {
    id: {
      type: BuiltinTypes.STRING /* Original type was enums.transactionform_buttonid but it can also be APPROVERETURN */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see transactionform_buttonid. */
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    }, /* Original description: This field value can be up to 40 characters long. */
    visible: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar_buttons_button)

const transactionForm_actionbar_buttonsElemID = new ElemID(constants.NETSUITE, 'transactionForm_actionbar_buttons')

const transactionForm_actionbar_buttons = new ObjectType({
  elemID: transactionForm_actionbar_buttonsElemID,
  annotations: {
  },
  fields: {
    button: {
      type: new ListType(transactionForm_actionbar_buttons_button),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar_buttons)

const transactionForm_actionbar_customButtons_customButtonElemID = new ElemID(constants.NETSUITE, 'transactionForm_actionbar_customButtons_customButton')

const transactionForm_actionbar_customButtons_customButton = new ObjectType({
  elemID: transactionForm_actionbar_customButtons_customButtonElemID,
  annotations: {
  },
  fields: {
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 99,
      },
    }, /* Original description: This field value can be up to 99 characters long. */
    function: {
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    }, /* Original description: This field value can be up to 200 characters long. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar_customButtons_customButton)

const transactionForm_actionbar_customButtonsElemID = new ElemID(constants.NETSUITE, 'transactionForm_actionbar_customButtons')

const transactionForm_actionbar_customButtons = new ObjectType({
  elemID: transactionForm_actionbar_customButtonsElemID,
  annotations: {
  },
  fields: {
    customButton: {
      type: new ListType(transactionForm_actionbar_customButtons_customButton),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar_customButtons)

const transactionForm_actionbar_customMenu_customMenuItemElemID = new ElemID(constants.NETSUITE, 'transactionForm_actionbar_customMenu_customMenuItem')

const transactionForm_actionbar_customMenu_customMenuItem = new ObjectType({
  elemID: transactionForm_actionbar_customMenu_customMenuItemElemID,
  annotations: {
  },
  fields: {
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 99,
      },
    }, /* Original description: This field value can be up to 99 characters long. */
    function: {
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    }, /* Original description: This field value can be up to 200 characters long. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar_customMenu_customMenuItem)

const transactionForm_actionbar_customMenuElemID = new ElemID(constants.NETSUITE, 'transactionForm_actionbar_customMenu')

const transactionForm_actionbar_customMenu = new ObjectType({
  elemID: transactionForm_actionbar_customMenuElemID,
  annotations: {
  },
  fields: {
    customMenuItem: {
      type: new ListType(transactionForm_actionbar_customMenu_customMenuItem),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar_customMenu)

const transactionForm_actionbar_menu_menuitemElemID = new ElemID(constants.NETSUITE, 'transactionForm_actionbar_menu_menuitem')

const transactionForm_actionbar_menu_menuitem = new ObjectType({
  elemID: transactionForm_actionbar_menu_menuitemElemID,
  annotations: {
  },
  fields: {
    id: {
      type: BuiltinTypes.STRING /* Original type was enums.transactionform_buttonid but it can also be APPROVERETURN */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see transactionform_buttonid. */
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    }, /* Original description: This field value can be up to 40 characters long. */
    visible: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar_menu_menuitem)

const transactionForm_actionbar_menuElemID = new ElemID(constants.NETSUITE, 'transactionForm_actionbar_menu')

const transactionForm_actionbar_menu = new ObjectType({
  elemID: transactionForm_actionbar_menuElemID,
  annotations: {
  },
  fields: {
    menuitem: {
      type: new ListType(transactionForm_actionbar_menu_menuitem),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar_menu)

const transactionForm_actionbarElemID = new ElemID(constants.NETSUITE, 'transactionForm_actionbar')

const transactionForm_actionbar = new ObjectType({
  elemID: transactionForm_actionbarElemID,
  annotations: {
  },
  fields: {
    buttons: {
      type: transactionForm_actionbar_buttons,
      annotations: {
      },
    },
    customButtons: {
      type: transactionForm_actionbar_customButtons,
      annotations: {
      },
    },
    customMenu: {
      type: transactionForm_actionbar_customMenu,
      annotations: {
      },
    },
    menu: {
      type: transactionForm_actionbar_menu,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_actionbar)

const transactionForm_buttons_standardButtons_buttonElemID = new ElemID(constants.NETSUITE, 'transactionForm_buttons_standardButtons_button')

const transactionForm_buttons_standardButtons_button = new ObjectType({
  elemID: transactionForm_buttons_standardButtons_buttonElemID,
  annotations: {
  },
  fields: {
    id: {
      type: BuiltinTypes.STRING /* Original type was enums.transactionform_buttonid but it can also be APPROVERETURN */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see transactionform_buttonid. */
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    visible: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    style: {
      type: enums.form_buttonstyle,
      annotations: {
      },
    }, /* Original description: For information about possible values, see form_buttonstyle.   The default value is 'BUTTON'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_buttons_standardButtons_button)

const transactionForm_buttons_standardButtonsElemID = new ElemID(constants.NETSUITE, 'transactionForm_buttons_standardButtons')

const transactionForm_buttons_standardButtons = new ObjectType({
  elemID: transactionForm_buttons_standardButtonsElemID,
  annotations: {
  },
  fields: {
    button: {
      type: new ListType(transactionForm_buttons_standardButtons_button),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_buttons_standardButtons)

const transactionForm_buttonsElemID = new ElemID(constants.NETSUITE, 'transactionForm_buttons')

const transactionForm_buttons = new ObjectType({
  elemID: transactionForm_buttonsElemID,
  annotations: {
  },
  fields: {
    standardButtons: {
      type: transactionForm_buttons_standardButtons,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_buttons)

const transactionForm_customCodeElemID = new ElemID(constants.NETSUITE, 'transactionForm_customCode')

const transactionForm_customCode = new ObjectType({
  elemID: transactionForm_customCodeElemID,
  annotations: {
  },
  fields: {
    scriptFile: {
      type: BuiltinTypes.STRING /* Original type was filereference */,
      annotations: {
      },
    }, /* Original description: This field must reference a .js file. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_customCode)

const transactionForm_mainFields_defaultFieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'transactionForm_mainFields_defaultFieldGroup_fields_field')

const transactionForm_mainFields_defaultFieldGroup_fields_field = new ObjectType({
  elemID: transactionForm_mainFields_defaultFieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: {
    id: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    visible: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    mandatory: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    displayType: {
      type: enums.form_displaytype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    spaceBefore: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    sameRowAsPrevious: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    quickAdd: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    checkBoxDefault: {
      type: enums.transactionform_checkboxdefault,
      annotations: {
      },
    }, /* Original description: For information about possible values, see transactionform_checkboxdefault.   The default value is 'UNCHECKED'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_mainFields_defaultFieldGroup_fields_field)

const transactionForm_mainFields_defaultFieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'transactionForm_mainFields_defaultFieldGroup_fields')

const transactionForm_mainFields_defaultFieldGroup_fields = new ObjectType({
  elemID: transactionForm_mainFields_defaultFieldGroup_fieldsElemID,
  annotations: {
  },
  fields: {
    position: {
      type: enums.form_fieldposition,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: {
      type: new ListType(transactionForm_mainFields_defaultFieldGroup_fields_field),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_mainFields_defaultFieldGroup_fields)

const transactionForm_mainFields_defaultFieldGroupElemID = new ElemID(constants.NETSUITE, 'transactionForm_mainFields_defaultFieldGroup')

const transactionForm_mainFields_defaultFieldGroup = new ObjectType({
  elemID: transactionForm_mainFields_defaultFieldGroupElemID,
  annotations: {
  },
  fields: {
    fields: {
      type: new ListType(transactionForm_mainFields_defaultFieldGroup_fields),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_mainFields_defaultFieldGroup)

const transactionForm_mainFields_fieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'transactionForm_mainFields_fieldGroup_fields_field')

const transactionForm_mainFields_fieldGroup_fields_field = new ObjectType({
  elemID: transactionForm_mainFields_fieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: {
    id: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    visible: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    mandatory: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    displayType: {
      type: enums.form_displaytype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    spaceBefore: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    sameRowAsPrevious: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    quickAdd: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    checkBoxDefault: {
      type: enums.transactionform_checkboxdefault,
      annotations: {
      },
    }, /* Original description: For information about possible values, see transactionform_checkboxdefault.   The default value is 'UNCHECKED'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_mainFields_fieldGroup_fields_field)

const transactionForm_mainFields_fieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'transactionForm_mainFields_fieldGroup_fields')

const transactionForm_mainFields_fieldGroup_fields = new ObjectType({
  elemID: transactionForm_mainFields_fieldGroup_fieldsElemID,
  annotations: {
  },
  fields: {
    position: {
      type: enums.form_fieldposition,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: {
      type: new ListType(transactionForm_mainFields_fieldGroup_fields_field),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_mainFields_fieldGroup_fields)

const transactionForm_mainFields_fieldGroupElemID = new ElemID(constants.NETSUITE, 'transactionForm_mainFields_fieldGroup')

const transactionForm_mainFields_fieldGroup = new ObjectType({
  elemID: transactionForm_mainFields_fieldGroupElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 99 characters long. */
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    visible: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    showTitle: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    singleColumn: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fields: {
      type: new ListType(transactionForm_mainFields_fieldGroup_fields),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_mainFields_fieldGroup)

const transactionForm_mainFieldsElemID = new ElemID(constants.NETSUITE, 'transactionForm_mainFields')

const transactionForm_mainFields = new ObjectType({
  elemID: transactionForm_mainFieldsElemID,
  annotations: {
  },
  fields: {
    fieldGroup: {
      type: new ListType(transactionForm_mainFields_fieldGroup),
      annotations: {
      },
    },
    defaultFieldGroup: {
      type: transactionForm_mainFields_defaultFieldGroup,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_mainFields)

const transactionForm_printingType_advancedElemID = new ElemID(constants.NETSUITE, 'transactionForm_printingType_advanced')

const transactionForm_printingType_advanced = new ObjectType({
  elemID: transactionForm_printingType_advancedElemID,
  annotations: {
  },
  fields: {
    printTemplate: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the advancedpdftemplate custom type.   For information about other possible values, see transactionform_advancedtemplate.   If this field appears in the project, you must reference the ADVANCEDPRINTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ADVANCEDPRINTING must be enabled for this field to appear in your account. */
    emailTemplate: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the advancedpdftemplate custom type.   For information about other possible values, see transactionform_advancedtemplate.   If this field appears in the project, you must reference the ADVANCEDPRINTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ADVANCEDPRINTING must be enabled for this field to appear in your account. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_printingType_advanced)

const transactionForm_printingType_basicElemID = new ElemID(constants.NETSUITE, 'transactionForm_printingType_basic')

const transactionForm_printingType_basic = new ObjectType({
  elemID: transactionForm_printingType_basicElemID,
  annotations: {
  },
  fields: {
    pdfLayout: {
      type: enums.transactionform_pdflayout,
      annotations: {
      },
    }, /* Original description: For information about possible values, see transactionform_pdflayout. */
    htmlLayout: {
      type: enums.transactionform_htmllayout,
      annotations: {
      },
    }, /* Original description: For information about possible values, see transactionform_htmllayout. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_printingType_basic)

const transactionForm_printingTypeElemID = new ElemID(constants.NETSUITE, 'transactionForm_printingType')

const transactionForm_printingType = new ObjectType({
  elemID: transactionForm_printingTypeElemID,
  annotations: {
  },
  fields: {
    advanced: {
      type: transactionForm_printingType_advanced,
      annotations: {
      },
    },
    basic: {
      type: transactionForm_printingType_basic,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_printingType)

const transactionForm_quickViewFields_fieldElemID = new ElemID(constants.NETSUITE, 'transactionForm_quickViewFields_field')

const transactionForm_quickViewFields_field = new ObjectType({
  elemID: transactionForm_quickViewFields_fieldElemID,
  annotations: {
  },
  fields: {
    id: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_quickViewFields_field)

const transactionForm_quickViewFieldsElemID = new ElemID(constants.NETSUITE, 'transactionForm_quickViewFields')

const transactionForm_quickViewFields = new ObjectType({
  elemID: transactionForm_quickViewFieldsElemID,
  annotations: {
  },
  fields: {
    field: {
      type: new ListType(transactionForm_quickViewFields_field),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_quickViewFields)

const transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_field')

const transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_field = new ObjectType({
  elemID: transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: {
    id: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    visible: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    mandatory: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    displayType: {
      type: enums.form_displaytype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    spaceBefore: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    sameRowAsPrevious: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    quickAdd: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    checkBoxDefault: {
      type: enums.transactionform_checkboxdefault,
      annotations: {
      },
    }, /* Original description: For information about possible values, see transactionform_checkboxdefault.   The default value is 'USE_FIELD_DEFAULT'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_field)

const transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields')

const transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields = new ObjectType({
  elemID: transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fieldsElemID,
  annotations: {
  },
  fields: {
    position: {
      type: enums.form_fieldposition,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: {
      type: new ListType(transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_field),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields)

const transactionForm_tabs_tab_fieldGroups_defaultFieldGroupElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_fieldGroups_defaultFieldGroup')

const transactionForm_tabs_tab_fieldGroups_defaultFieldGroup = new ObjectType({
  elemID: transactionForm_tabs_tab_fieldGroups_defaultFieldGroupElemID,
  annotations: {
  },
  fields: {
    fields: {
      type: new ListType(transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_fieldGroups_defaultFieldGroup)

const transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_field')

const transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_field = new ObjectType({
  elemID: transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: {
    id: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    visible: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    mandatory: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    displayType: {
      type: enums.form_displaytype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    spaceBefore: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    sameRowAsPrevious: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    quickAdd: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    checkBoxDefault: {
      type: enums.transactionform_checkboxdefault,
      annotations: {
      },
    }, /* Original description: For information about possible values, see transactionform_checkboxdefault.   The default value is 'USE_FIELD_DEFAULT'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_field)

const transactionForm_tabs_tab_fieldGroups_fieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_fieldGroups_fieldGroup_fields')

const transactionForm_tabs_tab_fieldGroups_fieldGroup_fields = new ObjectType({
  elemID: transactionForm_tabs_tab_fieldGroups_fieldGroup_fieldsElemID,
  annotations: {
  },
  fields: {
    position: {
      type: enums.form_fieldposition,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: {
      type: new ListType(transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_field),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_fieldGroups_fieldGroup_fields)

const transactionForm_tabs_tab_fieldGroups_fieldGroupElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_fieldGroups_fieldGroup')

const transactionForm_tabs_tab_fieldGroups_fieldGroup = new ObjectType({
  elemID: transactionForm_tabs_tab_fieldGroups_fieldGroupElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 99 characters long. */
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    visible: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    showTitle: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    singleColumn: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fields: {
      type: new ListType(transactionForm_tabs_tab_fieldGroups_fieldGroup_fields),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_fieldGroups_fieldGroup)

const transactionForm_tabs_tab_fieldGroupsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_fieldGroups')

const transactionForm_tabs_tab_fieldGroups = new ObjectType({
  elemID: transactionForm_tabs_tab_fieldGroupsElemID,
  annotations: {
  },
  fields: {
    fieldGroup: {
      type: new ListType(transactionForm_tabs_tab_fieldGroups_fieldGroup),
      annotations: {
      },
    },
    defaultFieldGroup: {
      type: transactionForm_tabs_tab_fieldGroups_defaultFieldGroup,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_fieldGroups)

const transactionForm_tabs_tab_subItems_subList_columns_columnElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subList_columns_column')

const transactionForm_tabs_tab_subItems_subList_columns_column = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subList_columns_columnElemID,
  annotations: {
  },
  fields: {
    id: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the transactioncolumncustomfield custom type.   For information about other possible values, see transactionform_columnid. */
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    visible: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subList_columns_column)

const transactionForm_tabs_tab_subItems_subList_columnsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subList_columns')

const transactionForm_tabs_tab_subItems_subList_columns = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subList_columnsElemID,
  annotations: {
  },
  fields: {
    column: {
      type: new ListType(transactionForm_tabs_tab_subItems_subList_columns_column),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subList_columns)

const transactionForm_tabs_tab_subItems_subListElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subList')

const transactionForm_tabs_tab_subItems_subList = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subListElemID,
  annotations: {
  },
  fields: {
    id: {
      type: BuiltinTypes.STRING /* Original type was enums.transactionform_sublistid but it can also be CRMCONTACTS */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see transactionform_sublistid. */
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    visible: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    columns: {
      type: transactionForm_tabs_tab_subItems_subList_columns,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subList)

const transactionForm_tabs_tab_subItems_subLists_subListElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subLists_subList')

const transactionForm_tabs_tab_subItems_subLists_subList = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subLists_subListElemID,
  annotations: {
  },
  fields: {
    id: {
      type: BuiltinTypes.STRING /* Original type was enums.transactionform_sublistid but it can also be CRMCONTACTS */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see transactionform_sublistid. */
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    visible: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subLists_subList)

const transactionForm_tabs_tab_subItems_subListsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subLists')

const transactionForm_tabs_tab_subItems_subLists = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subListsElemID,
  annotations: {
  },
  fields: {
    subList: {
      type: new ListType(transactionForm_tabs_tab_subItems_subLists_subList),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subLists)

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_field')

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_field = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: {
    id: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    visible: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    mandatory: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    displayType: {
      type: enums.form_displaytype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    spaceBefore: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    sameRowAsPrevious: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    quickAdd: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    checkBoxDefault: {
      type: enums.transactionform_checkboxdefault,
      annotations: {
      },
    }, /* Original description: For information about possible values, see transactionform_checkboxdefault.   The default value is 'USE_FIELD_DEFAULT'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_field)

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields')

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fieldsElemID,
  annotations: {
  },
  fields: {
    position: {
      type: enums.form_fieldposition,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: {
      type: new ListType(transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_field),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields)

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroupElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup')

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroupElemID,
  annotations: {
  },
  fields: {
    fields: {
      type: new ListType(transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup)

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_field')

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_field = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: {
    id: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    visible: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    mandatory: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    displayType: {
      type: enums.form_displaytype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    spaceBefore: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    sameRowAsPrevious: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    quickAdd: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    checkBoxDefault: {
      type: enums.transactionform_checkboxdefault,
      annotations: {
      },
    }, /* Original description: For information about possible values, see transactionform_checkboxdefault.   The default value is 'USE_FIELD_DEFAULT'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_field)

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields')

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fieldsElemID,
  annotations: {
  },
  fields: {
    position: {
      type: enums.form_fieldposition,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: {
      type: new ListType(transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_field),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields)

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroupElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup')

const transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroupElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 99 characters long. */
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    visible: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    showTitle: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    singleColumn: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fields: {
      type: new ListType(transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup)

const transactionForm_tabs_tab_subItems_subTab_fieldGroupsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subTab_fieldGroups')

const transactionForm_tabs_tab_subItems_subTab_fieldGroups = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subTab_fieldGroupsElemID,
  annotations: {
  },
  fields: {
    fieldGroup: {
      type: new ListType(transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup),
      annotations: {
      },
    },
    defaultFieldGroup: {
      type: transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subTab_fieldGroups)

const transactionForm_tabs_tab_subItems_subTabElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems_subTab')

const transactionForm_tabs_tab_subItems_subTab = new ObjectType({
  elemID: transactionForm_tabs_tab_subItems_subTabElemID,
  annotations: {
  },
  fields: {
    id: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   subtab   subtab   For information about other possible values, see transactionform_subtabid. */
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    visible: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    fieldGroups: {
      type: transactionForm_tabs_tab_subItems_subTab_fieldGroups,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems_subTab)

const transactionForm_tabs_tab_subItemsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_subItems')

const transactionForm_tabs_tab_subItems = new ObjectType({
  elemID: transactionForm_tabs_tab_subItemsElemID,
  annotations: {
  },
  fields: {
    subList: {
      type: new ListType(transactionForm_tabs_tab_subItems_subList),
      annotations: {
      },
    },
    subLists: {
      type: new ListType(transactionForm_tabs_tab_subItems_subLists),
      annotations: {
      },
    },
    subTab: {
      type: new ListType(transactionForm_tabs_tab_subItems_subTab),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab_subItems)

const transactionForm_tabs_tabElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab')

const transactionForm_tabs_tab = new ObjectType({
  elemID: transactionForm_tabs_tabElemID,
  annotations: {
  },
  fields: {
    id: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   subtab   subtab   For information about other possible values, see transactionform_tabid. */
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    visible: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    fieldGroups: {
      type: transactionForm_tabs_tab_fieldGroups,
      annotations: {
      },
    },
    subItems: {
      type: transactionForm_tabs_tab_subItems,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs_tab)

const transactionForm_tabsElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs')

const transactionForm_tabs = new ObjectType({
  elemID: transactionForm_tabsElemID,
  annotations: {
  },
  fields: {
    tab: {
      type: new ListType(transactionForm_tabs_tab),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs)


export const transactionForm = new ObjectType({
  elemID: transactionFormElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'custform_',
  },
  fields: {
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custform’. */
    standard: {
      type: BuiltinTypes.STRING /* Original type was enums.transactionform_standard but it can also be STANDARDOPPORTUNITY */,
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 99,
      },
    }, /* Original description: This attribute value can be up to 99 characters long.   For information about possible values, see transactionform_standard. */
    name: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
      },
    },
    recordType: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    },
    inactive: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    preferred: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    storedWithRecord: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    mainFields: {
      type: transactionForm_mainFields,
      annotations: {
      },
    },
    tabs: {
      type: transactionForm_tabs,
      annotations: {
      },
    },
    quickViewFields: {
      type: transactionForm_quickViewFields,
      annotations: {
      },
    },
    actionbar: {
      type: transactionForm_actionbar,
      annotations: {
      },
    },
    disclaimer: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    address: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    allowAddMultiple: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    printingType: {
      type: transactionForm_printingType,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})
