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
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType, createRestriction, ListType,
} from '@salto-io/adapter-api'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
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
      refType: createRefToElmWithValue(enums.transactionform_buttonid),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see transactionform_buttonid. */
    label: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    }, /* Original description: This field value can be up to 40 characters long. */
    visible: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
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
      refType: createRefToElmWithValue(new ListType(transactionForm_actionbar_buttons_button)),
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
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 99,
      },
    }, /* Original description: This field value can be up to 99 characters long. */
    function: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
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
      refType: createRefToElmWithValue(new ListType(transactionForm_actionbar_customButtons_customButton)),
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
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 99,
      },
    }, /* Original description: This field value can be up to 99 characters long. */
    function: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
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
      refType: createRefToElmWithValue(new ListType(transactionForm_actionbar_customMenu_customMenuItem)),
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
      refType: createRefToElmWithValue(enums.transactionform_buttonid),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see transactionform_buttonid. */
    label: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    }, /* Original description: This field value can be up to 40 characters long. */
    visible: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
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
      refType: createRefToElmWithValue(new ListType(transactionForm_actionbar_menu_menuitem)),
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
      refType: createRefToElmWithValue(transactionForm_actionbar_buttons),
      annotations: {
      },
    },
    customButtons: {
      refType: createRefToElmWithValue(transactionForm_actionbar_customButtons),
      annotations: {
      },
    },
    customMenu: {
      refType: createRefToElmWithValue(transactionForm_actionbar_customMenu),
      annotations: {
      },
    },
    menu: {
      refType: createRefToElmWithValue(transactionForm_actionbar_menu),
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
      refType: createRefToElmWithValue(enums.transactionform_buttonid),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see transactionform_buttonid. */
    label: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    visible: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    style: {
      refType: createRefToElmWithValue(enums.form_buttonstyle),
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
      refType: createRefToElmWithValue(new ListType(transactionForm_buttons_standardButtons_button)),
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
      refType: createRefToElmWithValue(transactionForm_buttons_standardButtons),
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
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was filereference */),
      annotations: {
      },
    }, /* Original description: This field must reference a .js file. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_customCode)

const transactionForm_linkedForms_linkedFormElemID = new ElemID(constants.NETSUITE, 'transactionForm_linkedForms_linkedForm')

const transactionForm_linkedForms_linkedForm = new ObjectType({
  elemID: transactionForm_linkedForms_linkedFormElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the customtransactiontype custom type.   For information about other possible values, see transactionform_trantype. */
    form: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the custom type.   For information about other possible values, see transactionform_standard. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_linkedForms_linkedForm)

const transactionForm_linkedFormsElemID = new ElemID(constants.NETSUITE, 'transactionForm_linkedForms')

const transactionForm_linkedForms = new ObjectType({
  elemID: transactionForm_linkedFormsElemID,
  annotations: {
  },
  fields: {
    linkedForm: {
      refType: createRefToElmWithValue(new ListType(transactionForm_linkedForms_linkedForm)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_linkedForms)

const transactionForm_mainFields_defaultFieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'transactionForm_mainFields_defaultFieldGroup_fields_field')

const transactionForm_mainFields_defaultFieldGroup_fields_field = new ObjectType({
  elemID: transactionForm_mainFields_defaultFieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: {
    id: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
    label: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    visible: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    mandatory: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    displayType: {
      refType: createRefToElmWithValue(enums.form_displaytype),
      annotations: {
      },
    }, /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    spaceBefore: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    sameRowAsPrevious: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    quickAdd: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    checkBoxDefault: {
      refType: createRefToElmWithValue(enums.transactionform_checkboxdefault),
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
      refType: createRefToElmWithValue(enums.form_fieldposition),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: {
      refType: createRefToElmWithValue(new ListType(transactionForm_mainFields_defaultFieldGroup_fields_field)),
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
      refType: createRefToElmWithValue(new ListType(transactionForm_mainFields_defaultFieldGroup_fields)),
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
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
    label: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    visible: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    mandatory: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    displayType: {
      refType: createRefToElmWithValue(enums.form_displaytype),
      annotations: {
      },
    }, /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    spaceBefore: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    sameRowAsPrevious: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    quickAdd: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    checkBoxDefault: {
      refType: createRefToElmWithValue(enums.transactionform_checkboxdefault),
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
      refType: createRefToElmWithValue(enums.form_fieldposition),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: {
      refType: createRefToElmWithValue(new ListType(transactionForm_mainFields_fieldGroup_fields_field)),
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
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 99 characters long. */
    label: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    visible: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    showTitle: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    singleColumn: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fields: {
      refType: createRefToElmWithValue(new ListType(transactionForm_mainFields_fieldGroup_fields)),
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
      refType: createRefToElmWithValue(new ListType(transactionForm_mainFields_fieldGroup)),
      annotations: {
      },
    },
    defaultFieldGroup: {
      refType: createRefToElmWithValue(transactionForm_mainFields_defaultFieldGroup),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_mainFields)

const transactionForm_preferences_preferenceElemID = new ElemID(constants.NETSUITE, 'transactionForm_preferences_preference')

const transactionForm_preferences_preference = new ObjectType({
  elemID: transactionForm_preferences_preferenceElemID,
  annotations: {
  },
  fields: {
    id: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_preferences_preference)

const transactionForm_preferencesElemID = new ElemID(constants.NETSUITE, 'transactionForm_preferences')

const transactionForm_preferences = new ObjectType({
  elemID: transactionForm_preferencesElemID,
  annotations: {
  },
  fields: {
    preference: {
      refType: createRefToElmWithValue(new ListType(transactionForm_preferences_preference)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_preferences)

const transactionForm_printingType_advancedElemID = new ElemID(constants.NETSUITE, 'transactionForm_printingType_advanced')

const transactionForm_printingType_advanced = new ObjectType({
  elemID: transactionForm_printingType_advancedElemID,
  annotations: {
  },
  fields: {
    printTemplate: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the advancedpdftemplate custom type.   For information about other possible values, see transactionform_advancedtemplate.   If this field appears in the project, you must reference the ADVANCEDPRINTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ADVANCEDPRINTING must be enabled for this field to appear in your account. */
    emailTemplate: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
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
      refType: createRefToElmWithValue(enums.transactionform_pdflayout),
      annotations: {
      },
    }, /* Original description: For information about possible values, see transactionform_pdflayout. */
    htmlLayout: {
      refType: createRefToElmWithValue(enums.transactionform_htmllayout),
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
      refType: createRefToElmWithValue(transactionForm_printingType_advanced),
      annotations: {
      },
    },
    basic: {
      refType: createRefToElmWithValue(transactionForm_printingType_basic),
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
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
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
      refType: createRefToElmWithValue(new ListType(transactionForm_quickViewFields_field)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_quickViewFields)

const transactionForm_roles_roleElemID = new ElemID(constants.NETSUITE, 'transactionForm_roles_role')

const transactionForm_roles_role = new ObjectType({
  elemID: transactionForm_roles_roleElemID,
  annotations: {
  },
  fields: {
    id: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the role custom type.   For information about other possible values, see transactionform_roleid. */
    preferred: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_roles_role)

const transactionForm_rolesElemID = new ElemID(constants.NETSUITE, 'transactionForm_roles')

const transactionForm_roles = new ObjectType({
  elemID: transactionForm_rolesElemID,
  annotations: {
  },
  fields: {
    role: {
      refType: createRefToElmWithValue(new ListType(transactionForm_roles_role)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_roles)

const transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_field')

const transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_field = new ObjectType({
  elemID: transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: {
    id: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
    label: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    visible: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    mandatory: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    displayType: {
      refType: createRefToElmWithValue(enums.form_displaytype),
      annotations: {
      },
    }, /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    spaceBefore: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    sameRowAsPrevious: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    quickAdd: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    checkBoxDefault: {
      refType: createRefToElmWithValue(enums.transactionform_checkboxdefault),
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
      refType: createRefToElmWithValue(enums.form_fieldposition),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: {
      refType: createRefToElmWithValue(new ListType(transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_field)),
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
      refType: createRefToElmWithValue(new ListType(transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields)),
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
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
    label: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    visible: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    mandatory: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    displayType: {
      refType: createRefToElmWithValue(enums.form_displaytype),
      annotations: {
      },
    }, /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    spaceBefore: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    sameRowAsPrevious: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    quickAdd: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    checkBoxDefault: {
      refType: createRefToElmWithValue(enums.transactionform_checkboxdefault),
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
      refType: createRefToElmWithValue(enums.form_fieldposition),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: {
      refType: createRefToElmWithValue(new ListType(transactionForm_tabs_tab_fieldGroups_fieldGroup_fields_field)),
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
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 99 characters long. */
    label: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    visible: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    showTitle: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    singleColumn: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fields: {
      refType: createRefToElmWithValue(new ListType(transactionForm_tabs_tab_fieldGroups_fieldGroup_fields)),
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
      refType: createRefToElmWithValue(new ListType(transactionForm_tabs_tab_fieldGroups_fieldGroup)),
      annotations: {
      },
    },
    defaultFieldGroup: {
      refType: createRefToElmWithValue(transactionForm_tabs_tab_fieldGroups_defaultFieldGroup),
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
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the transactioncolumncustomfield custom type.   For information about other possible values, see transactionform_columnid. */
    label: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    visible: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
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
      refType: createRefToElmWithValue(new ListType(transactionForm_tabs_tab_subItems_subList_columns_column)),
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
      refType: createRefToElmWithValue(enums.transactionform_sublistid),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see transactionform_sublistid. */
    label: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    visible: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    neverEmpty: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    columns: {
      refType: createRefToElmWithValue(transactionForm_tabs_tab_subItems_subList_columns),
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
      refType: createRefToElmWithValue(enums.transactionform_sublistid),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see transactionform_sublistid. */
    label: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    visible: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    neverEmpty: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
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
      refType: createRefToElmWithValue(new ListType(transactionForm_tabs_tab_subItems_subLists_subList)),
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
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
    label: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    visible: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    mandatory: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    displayType: {
      refType: createRefToElmWithValue(enums.form_displaytype),
      annotations: {
      },
    }, /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    spaceBefore: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    sameRowAsPrevious: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    quickAdd: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    checkBoxDefault: {
      refType: createRefToElmWithValue(enums.transactionform_checkboxdefault),
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
      refType: createRefToElmWithValue(enums.form_fieldposition),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: {
      refType: createRefToElmWithValue(new ListType(transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_field)),
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
      refType: createRefToElmWithValue(new ListType(transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields)),
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
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see transactionform_fieldid. */
    label: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    visible: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    mandatory: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    displayType: {
      refType: createRefToElmWithValue(enums.form_displaytype),
      annotations: {
      },
    }, /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    spaceBefore: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    sameRowAsPrevious: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    quickAdd: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    checkBoxDefault: {
      refType: createRefToElmWithValue(enums.transactionform_checkboxdefault),
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
      refType: createRefToElmWithValue(enums.form_fieldposition),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: {
      refType: createRefToElmWithValue(new ListType(transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_field)),
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
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 99 characters long. */
    label: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    visible: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    showTitle: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    singleColumn: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fields: {
      refType: createRefToElmWithValue(new ListType(transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields)),
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
      refType: createRefToElmWithValue(new ListType(transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup)),
      annotations: {
      },
    },
    defaultFieldGroup: {
      refType: createRefToElmWithValue(transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup),
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
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   subtab   subtab   For information about other possible values, see transactionform_subtabid. */
    label: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    visible: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    neverEmpty: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fieldGroups: {
      refType: createRefToElmWithValue(transactionForm_tabs_tab_subItems_subTab_fieldGroups),
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
      refType: createRefToElmWithValue(new ListType(transactionForm_tabs_tab_subItems_subList)),
      annotations: {
      },
    },
    subLists: {
      refType: createRefToElmWithValue(new ListType(transactionForm_tabs_tab_subItems_subLists)),
      annotations: {
      },
    },
    subTab: {
      refType: createRefToElmWithValue(new ListType(transactionForm_tabs_tab_subItems_subTab)),
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
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   subtab   subtab   For information about other possible values, see transactionform_tabid. */
    label: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    visible: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    fieldGroups: {
      refType: createRefToElmWithValue(transactionForm_tabs_tab_fieldGroups),
      annotations: {
      },
    },
    subItems: {
      refType: createRefToElmWithValue(transactionForm_tabs_tab_subItems),
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
      refType: createRefToElmWithValue(new ListType(transactionForm_tabs_tab)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_tabs)

const transactionForm_totalBox_totalBoxFieldElemID = new ElemID(constants.NETSUITE, 'transactionForm_totalBox_totalBoxField')

const transactionForm_totalBox_totalBoxField = new ObjectType({
  elemID: transactionForm_totalBox_totalBoxFieldElemID,
  annotations: {
  },
  fields: {
    id: {
      refType: createRefToElmWithValue(enums.transactionform_totalboxid),
      annotations: {
      },
    }, /* Original description: For information about possible values, see transactionform_totalboxid. */
    label: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    visible: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_totalBox_totalBoxField)

const transactionForm_totalBoxElemID = new ElemID(constants.NETSUITE, 'transactionForm_totalBox')

const transactionForm_totalBox = new ObjectType({
  elemID: transactionForm_totalBoxElemID,
  annotations: {
  },
  fields: {
    totalBoxField: {
      refType: createRefToElmWithValue(new ListType(transactionForm_totalBox_totalBoxField)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})

transactionFormInnerTypes.push(transactionForm_totalBox)


export const transactionForm = new ObjectType({
  elemID: transactionFormElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^custform[0-9a-z_]+' }),
      },
    }, /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custform’. */
    standard: {
      refType: createRefToElmWithValue(enums.transactionform_standard),
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 99 characters long.   For information about possible values, see transactionform_standard. */
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    recordType: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    },
    inactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    preferred: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    storedWithRecord: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    mainFields: {
      refType: createRefToElmWithValue(transactionForm_mainFields),
      annotations: {
      },
    },
    tabs: {
      refType: createRefToElmWithValue(transactionForm_tabs),
      annotations: {
      },
    },
    customCode: {
      refType: createRefToElmWithValue(transactionForm_customCode),
      annotations: {
      },
    },
    quickViewFields: {
      refType: createRefToElmWithValue(transactionForm_quickViewFields),
      annotations: {
      },
    },
    actionbar: {
      refType: createRefToElmWithValue(transactionForm_actionbar),
      annotations: {
      },
    },
    disclaimer: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    address: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    allowAddMultiple: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    emailMessageTemplate: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the emailtemplate custom type. */
    printingType: {
      refType: createRefToElmWithValue(transactionForm_printingType),
      annotations: {
      },
    },
    totalBox: {
      refType: createRefToElmWithValue(transactionForm_totalBox),
      annotations: {
      },
    },
    linkedForms: {
      refType: createRefToElmWithValue(transactionForm_linkedForms),
      annotations: {
      },
    },
    roles: {
      refType: createRefToElmWithValue(transactionForm_roles),
      annotations: {
      },
    },
    preferences: {
      refType: createRefToElmWithValue(transactionForm_preferences),
      annotations: {
      },
    },
    buttons: {
      refType: createRefToElmWithValue(transactionForm_buttons),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionFormElemID.name],
})
