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
/* eslint-disable max-len */
/* eslint-disable camelcase */
import {
  BuiltinTypes, createRefToElmWithValue, CORE_ANNOTATIONS, ElemID, ObjectType, createRestriction, ListType,
} from '@salto-io/adapter-api'
import * as constants from '../../../constants'
import { TypeAndInnerTypes } from '../../../types/object_types'
import { enums } from '../enums'

export const entryFormType = (): TypeAndInnerTypes => {
  const innerTypes: Record<string, ObjectType> = {}

  const entryFormElemID = new ElemID(constants.NETSUITE, 'entryForm')
  const entryForm_actionbar_buttons_buttonElemID = new ElemID(constants.NETSUITE, 'entryForm_actionbar_buttons_button')

  const entryForm_actionbar_buttons_button = new ObjectType({
    elemID: entryForm_actionbar_buttons_buttonElemID,
    annotations: {
    },
    fields: {
      id: {
        refType: createRefToElmWithValue(enums.entryform_buttonid),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      }, /* Original description: For information about possible values, see entryform_buttonid. */
      label: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          // [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 40 }),
        },
      }, /* Original description: This field value can be up to 40 characters long. */
      visible: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {
        },
      }, /* Original description: The default value is T. */
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_actionbar_buttons_button = entryForm_actionbar_buttons_button

  const entryForm_actionbar_buttonsElemID = new ElemID(constants.NETSUITE, 'entryForm_actionbar_buttons')

  const entryForm_actionbar_buttons = new ObjectType({
    elemID: entryForm_actionbar_buttonsElemID,
    annotations: {
    },
    fields: {
      button: {
        refType: createRefToElmWithValue(new ListType(entryForm_actionbar_buttons_button)),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_actionbar_buttons = entryForm_actionbar_buttons

  const entryForm_actionbar_customButtons_customButtonElemID = new ElemID(constants.NETSUITE, 'entryForm_actionbar_customButtons_customButton')

  const entryForm_actionbar_customButtons_customButton = new ObjectType({
    elemID: entryForm_actionbar_customButtons_customButtonElemID,
    annotations: {
    },
    fields: {
      label: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          // [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 99 }),
        },
      }, /* Original description: This field value can be up to 99 characters long. */
      function: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          // [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 200 }),
        },
      }, /* Original description: This field value can be up to 200 characters long. */
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_actionbar_customButtons_customButton = entryForm_actionbar_customButtons_customButton

  const entryForm_actionbar_customButtonsElemID = new ElemID(constants.NETSUITE, 'entryForm_actionbar_customButtons')

  const entryForm_actionbar_customButtons = new ObjectType({
    elemID: entryForm_actionbar_customButtonsElemID,
    annotations: {
    },
    fields: {
      customButton: {
        refType: createRefToElmWithValue(new ListType(entryForm_actionbar_customButtons_customButton)),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_actionbar_customButtons = entryForm_actionbar_customButtons

  const entryForm_actionbar_customMenu_customMenuItemElemID = new ElemID(constants.NETSUITE, 'entryForm_actionbar_customMenu_customMenuItem')

  const entryForm_actionbar_customMenu_customMenuItem = new ObjectType({
    elemID: entryForm_actionbar_customMenu_customMenuItemElemID,
    annotations: {
    },
    fields: {
      label: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          // [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 99 }),
        },
      }, /* Original description: This field value can be up to 99 characters long. */
      function: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          // [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 200 }),
        },
      }, /* Original description: This field value can be up to 200 characters long. */
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_actionbar_customMenu_customMenuItem = entryForm_actionbar_customMenu_customMenuItem

  const entryForm_actionbar_customMenuElemID = new ElemID(constants.NETSUITE, 'entryForm_actionbar_customMenu')

  const entryForm_actionbar_customMenu = new ObjectType({
    elemID: entryForm_actionbar_customMenuElemID,
    annotations: {
    },
    fields: {
      customMenuItem: {
        refType: createRefToElmWithValue(new ListType(entryForm_actionbar_customMenu_customMenuItem)),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_actionbar_customMenu = entryForm_actionbar_customMenu

  const entryForm_actionbar_menu_menuitemElemID = new ElemID(constants.NETSUITE, 'entryForm_actionbar_menu_menuitem')

  const entryForm_actionbar_menu_menuitem = new ObjectType({
    elemID: entryForm_actionbar_menu_menuitemElemID,
    annotations: {
    },
    fields: {
      id: {
        refType: createRefToElmWithValue(enums.entryform_buttonid),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      }, /* Original description: For information about possible values, see entryform_buttonid. */
      label: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          // [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 40 }),
        },
      }, /* Original description: This field value can be up to 40 characters long. */
      visible: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {
        },
      }, /* Original description: The default value is T. */
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_actionbar_menu_menuitem = entryForm_actionbar_menu_menuitem

  const entryForm_actionbar_menuElemID = new ElemID(constants.NETSUITE, 'entryForm_actionbar_menu')

  const entryForm_actionbar_menu = new ObjectType({
    elemID: entryForm_actionbar_menuElemID,
    annotations: {
    },
    fields: {
      menuitem: {
        refType: createRefToElmWithValue(new ListType(entryForm_actionbar_menu_menuitem)),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_actionbar_menu = entryForm_actionbar_menu

  const entryForm_actionbarElemID = new ElemID(constants.NETSUITE, 'entryForm_actionbar')

  const entryForm_actionbar = new ObjectType({
    elemID: entryForm_actionbarElemID,
    annotations: {
    },
    fields: {
      buttons: {
        refType: createRefToElmWithValue(entryForm_actionbar_buttons),
        annotations: {
        },
      },
      customButtons: {
        refType: createRefToElmWithValue(entryForm_actionbar_customButtons),
        annotations: {
        },
      },
      customMenu: {
        refType: createRefToElmWithValue(entryForm_actionbar_customMenu),
        annotations: {
        },
      },
      menu: {
        refType: createRefToElmWithValue(entryForm_actionbar_menu),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_actionbar = entryForm_actionbar

  const entryForm_buttons_standardButtons_buttonElemID = new ElemID(constants.NETSUITE, 'entryForm_buttons_standardButtons_button')

  const entryForm_buttons_standardButtons_button = new ObjectType({
    elemID: entryForm_buttons_standardButtons_buttonElemID,
    annotations: {
    },
    fields: {
      id: {
        refType: createRefToElmWithValue(enums.entryform_buttonid),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      }, /* Original description: For information about possible values, see entryform_buttonid. */
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
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_buttons_standardButtons_button = entryForm_buttons_standardButtons_button

  const entryForm_buttons_standardButtonsElemID = new ElemID(constants.NETSUITE, 'entryForm_buttons_standardButtons')

  const entryForm_buttons_standardButtons = new ObjectType({
    elemID: entryForm_buttons_standardButtonsElemID,
    annotations: {
    },
    fields: {
      button: {
        refType: createRefToElmWithValue(new ListType(entryForm_buttons_standardButtons_button)),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_buttons_standardButtons = entryForm_buttons_standardButtons

  const entryForm_buttonsElemID = new ElemID(constants.NETSUITE, 'entryForm_buttons')

  const entryForm_buttons = new ObjectType({
    elemID: entryForm_buttonsElemID,
    annotations: {
    },
    fields: {
      standardButtons: {
        refType: createRefToElmWithValue(entryForm_buttons_standardButtons),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_buttons = entryForm_buttons

  const entryForm_customCodeElemID = new ElemID(constants.NETSUITE, 'entryForm_customCode')

  const entryForm_customCode = new ObjectType({
    elemID: entryForm_customCodeElemID,
    annotations: {
    },
    fields: {
      scriptFile: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was filereference */),
        annotations: {
        },
      }, /* Original description: This field must reference a .js file. */
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_customCode = entryForm_customCode

  const entryForm_mainFields_defaultFieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'entryForm_mainFields_defaultFieldGroup_fields_field')

  const entryForm_mainFields_defaultFieldGroup_fields_field = new ObjectType({
    elemID: entryForm_mainFields_defaultFieldGroup_fields_fieldElemID,
    annotations: {
    },
    fields: {
      id: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see entryform_fieldid. */
      label: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
        },
      }, /* Original description: This field accepts references to the string custom type. */
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
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_mainFields_defaultFieldGroup_fields_field = entryForm_mainFields_defaultFieldGroup_fields_field

  const entryForm_mainFields_defaultFieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'entryForm_mainFields_defaultFieldGroup_fields')

  const entryForm_mainFields_defaultFieldGroup_fields = new ObjectType({
    elemID: entryForm_mainFields_defaultFieldGroup_fieldsElemID,
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
        refType: createRefToElmWithValue(new ListType(entryForm_mainFields_defaultFieldGroup_fields_field)),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_mainFields_defaultFieldGroup_fields = entryForm_mainFields_defaultFieldGroup_fields

  const entryForm_mainFields_defaultFieldGroupElemID = new ElemID(constants.NETSUITE, 'entryForm_mainFields_defaultFieldGroup')

  const entryForm_mainFields_defaultFieldGroup = new ObjectType({
    elemID: entryForm_mainFields_defaultFieldGroupElemID,
    annotations: {
    },
    fields: {
      fields: {
        refType: createRefToElmWithValue(new ListType(entryForm_mainFields_defaultFieldGroup_fields)),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_mainFields_defaultFieldGroup = entryForm_mainFields_defaultFieldGroup

  const entryForm_mainFields_fieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'entryForm_mainFields_fieldGroup_fields_field')

  const entryForm_mainFields_fieldGroup_fields_field = new ObjectType({
    elemID: entryForm_mainFields_fieldGroup_fields_fieldElemID,
    annotations: {
    },
    fields: {
      id: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see entryform_fieldid. */
      label: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
        },
      }, /* Original description: This field accepts references to the string custom type. */
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
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_mainFields_fieldGroup_fields_field = entryForm_mainFields_fieldGroup_fields_field

  const entryForm_mainFields_fieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'entryForm_mainFields_fieldGroup_fields')

  const entryForm_mainFields_fieldGroup_fields = new ObjectType({
    elemID: entryForm_mainFields_fieldGroup_fieldsElemID,
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
        refType: createRefToElmWithValue(new ListType(entryForm_mainFields_fieldGroup_fields_field)),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_mainFields_fieldGroup_fields = entryForm_mainFields_fieldGroup_fields

  const entryForm_mainFields_fieldGroupElemID = new ElemID(constants.NETSUITE, 'entryForm_mainFields_fieldGroup')

  const entryForm_mainFields_fieldGroup = new ObjectType({
    elemID: entryForm_mainFields_fieldGroupElemID,
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
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      }, /* Original description: This field accepts references to the string custom type. */
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
        refType: createRefToElmWithValue(new ListType(entryForm_mainFields_fieldGroup_fields)),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_mainFields_fieldGroup = entryForm_mainFields_fieldGroup

  const entryForm_mainFieldsElemID = new ElemID(constants.NETSUITE, 'entryForm_mainFields')

  const entryForm_mainFields = new ObjectType({
    elemID: entryForm_mainFieldsElemID,
    annotations: {
    },
    fields: {
      fieldGroup: {
        refType: createRefToElmWithValue(new ListType(entryForm_mainFields_fieldGroup)),
        annotations: {
        },
      },
      defaultFieldGroup: {
        refType: createRefToElmWithValue(entryForm_mainFields_defaultFieldGroup),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_mainFields = entryForm_mainFields

  const entryForm_quickViewFields_fieldElemID = new ElemID(constants.NETSUITE, 'entryForm_quickViewFields_field')

  const entryForm_quickViewFields_field = new ObjectType({
    elemID: entryForm_quickViewFields_fieldElemID,
    annotations: {
    },
    fields: {
      id: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see entryform_fieldid. */
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_quickViewFields_field = entryForm_quickViewFields_field

  const entryForm_quickViewFieldsElemID = new ElemID(constants.NETSUITE, 'entryForm_quickViewFields')

  const entryForm_quickViewFields = new ObjectType({
    elemID: entryForm_quickViewFieldsElemID,
    annotations: {
    },
    fields: {
      field: {
        refType: createRefToElmWithValue(new ListType(entryForm_quickViewFields_field)),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_quickViewFields = entryForm_quickViewFields

  const entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_field')

  const entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_field = new ObjectType({
    elemID: entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
    annotations: {
    },
    fields: {
      id: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see entryform_fieldid. */
      label: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
        },
      }, /* Original description: This field accepts references to the string custom type. */
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
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_field = entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_field

  const entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields')

  const entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields = new ObjectType({
    elemID: entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fieldsElemID,
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
        refType: createRefToElmWithValue(new ListType(entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields_field)),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields = entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields

  const entryForm_tabs_tab_fieldGroups_defaultFieldGroupElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_fieldGroups_defaultFieldGroup')

  const entryForm_tabs_tab_fieldGroups_defaultFieldGroup = new ObjectType({
    elemID: entryForm_tabs_tab_fieldGroups_defaultFieldGroupElemID,
    annotations: {
    },
    fields: {
      fields: {
        refType: createRefToElmWithValue(new ListType(entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields)),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_tabs_tab_fieldGroups_defaultFieldGroup = entryForm_tabs_tab_fieldGroups_defaultFieldGroup

  const entryForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_fieldGroups_fieldGroup_fields_field')

  const entryForm_tabs_tab_fieldGroups_fieldGroup_fields_field = new ObjectType({
    elemID: entryForm_tabs_tab_fieldGroups_fieldGroup_fields_fieldElemID,
    annotations: {
    },
    fields: {
      id: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see entryform_fieldid. */
      label: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
        },
      }, /* Original description: This field accepts references to the string custom type. */
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
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_tabs_tab_fieldGroups_fieldGroup_fields_field = entryForm_tabs_tab_fieldGroups_fieldGroup_fields_field

  const entryForm_tabs_tab_fieldGroups_fieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_fieldGroups_fieldGroup_fields')

  const entryForm_tabs_tab_fieldGroups_fieldGroup_fields = new ObjectType({
    elemID: entryForm_tabs_tab_fieldGroups_fieldGroup_fieldsElemID,
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
        refType: createRefToElmWithValue(new ListType(entryForm_tabs_tab_fieldGroups_fieldGroup_fields_field)),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_tabs_tab_fieldGroups_fieldGroup_fields = entryForm_tabs_tab_fieldGroups_fieldGroup_fields

  const entryForm_tabs_tab_fieldGroups_fieldGroupElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_fieldGroups_fieldGroup')

  const entryForm_tabs_tab_fieldGroups_fieldGroup = new ObjectType({
    elemID: entryForm_tabs_tab_fieldGroups_fieldGroupElemID,
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
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      }, /* Original description: This field accepts references to the string custom type. */
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
        refType: createRefToElmWithValue(new ListType(entryForm_tabs_tab_fieldGroups_fieldGroup_fields)),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_tabs_tab_fieldGroups_fieldGroup = entryForm_tabs_tab_fieldGroups_fieldGroup

  const entryForm_tabs_tab_fieldGroupsElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_fieldGroups')

  const entryForm_tabs_tab_fieldGroups = new ObjectType({
    elemID: entryForm_tabs_tab_fieldGroupsElemID,
    annotations: {
    },
    fields: {
      fieldGroup: {
        refType: createRefToElmWithValue(new ListType(entryForm_tabs_tab_fieldGroups_fieldGroup)),
        annotations: {
        },
      },
      defaultFieldGroup: {
        refType: createRefToElmWithValue(entryForm_tabs_tab_fieldGroups_defaultFieldGroup),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_tabs_tab_fieldGroups = entryForm_tabs_tab_fieldGroups

  const entryForm_tabs_tab_subItems_subListElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_subItems_subList')

  const entryForm_tabs_tab_subItems_subList = new ObjectType({
    elemID: entryForm_tabs_tab_subItems_subListElemID,
    annotations: {
    },
    fields: {
      id: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      }, /* Original description: This field accepts references to the following custom types:   transactionbodycustomfield   itemcustomfield   entitycustomfield   recordsublist   customrecordcustomfield   crmcustomfield   For information about other possible values, see entryform_sublistid. */
      label: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      }, /* Original description: This field accepts references to the string custom type. */
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
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_tabs_tab_subItems_subList = entryForm_tabs_tab_subItems_subList

  const entryForm_tabs_tab_subItems_subLists_subListElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_subItems_subLists_subList')

  const entryForm_tabs_tab_subItems_subLists_subList = new ObjectType({
    elemID: entryForm_tabs_tab_subItems_subLists_subListElemID,
    annotations: {
    },
    fields: {
      id: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      }, /* Original description: This field accepts references to the following custom types:   transactionbodycustomfield   itemcustomfield   entitycustomfield   recordsublist   customrecordcustomfield   crmcustomfield   For information about other possible values, see entryform_sublistid. */
      label: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      }, /* Original description: This field accepts references to the string custom type. */
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
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_tabs_tab_subItems_subLists_subList = entryForm_tabs_tab_subItems_subLists_subList

  const entryForm_tabs_tab_subItems_subListsElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_subItems_subLists')

  const entryForm_tabs_tab_subItems_subLists = new ObjectType({
    elemID: entryForm_tabs_tab_subItems_subListsElemID,
    annotations: {
    },
    fields: {
      subList: {
        refType: createRefToElmWithValue(new ListType(entryForm_tabs_tab_subItems_subLists_subList)),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_tabs_tab_subItems_subLists = entryForm_tabs_tab_subItems_subLists

  const entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_field')

  const entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_field = new ObjectType({
    elemID: entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_fieldElemID,
    annotations: {
    },
    fields: {
      id: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see entryform_fieldid. */
      label: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
        },
      }, /* Original description: This field accepts references to the string custom type. */
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
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_field = entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_field

  const entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields')

  const entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields = new ObjectType({
    elemID: entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fieldsElemID,
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
        refType: createRefToElmWithValue(new ListType(entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields_field)),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields = entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields

  const entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroupElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup')

  const entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup = new ObjectType({
    elemID: entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroupElemID,
    annotations: {
    },
    fields: {
      fields: {
        refType: createRefToElmWithValue(new ListType(entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields)),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup = entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup

  const entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_field')

  const entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_field = new ObjectType({
    elemID: entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_fieldElemID,
    annotations: {
    },
    fields: {
      id: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see entryform_fieldid. */
      label: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
        },
      }, /* Original description: This field accepts references to the string custom type. */
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
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_field = entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_field

  const entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields')

  const entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields = new ObjectType({
    elemID: entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fieldsElemID,
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
        refType: createRefToElmWithValue(new ListType(entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields_field)),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields = entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields

  const entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroupElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup')

  const entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup = new ObjectType({
    elemID: entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroupElemID,
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
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      }, /* Original description: This field accepts references to the string custom type. */
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
        refType: createRefToElmWithValue(new ListType(entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields)),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup = entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup

  const entryForm_tabs_tab_subItems_subTab_fieldGroupsElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_subItems_subTab_fieldGroups')

  const entryForm_tabs_tab_subItems_subTab_fieldGroups = new ObjectType({
    elemID: entryForm_tabs_tab_subItems_subTab_fieldGroupsElemID,
    annotations: {
    },
    fields: {
      fieldGroup: {
        refType: createRefToElmWithValue(new ListType(entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup)),
        annotations: {
        },
      },
      defaultFieldGroup: {
        refType: createRefToElmWithValue(entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_tabs_tab_subItems_subTab_fieldGroups = entryForm_tabs_tab_subItems_subTab_fieldGroups

  const entryForm_tabs_tab_subItems_subTab_subLists_subListElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_subItems_subTab_subLists_subList')

  const entryForm_tabs_tab_subItems_subTab_subLists_subList = new ObjectType({
    elemID: entryForm_tabs_tab_subItems_subTab_subLists_subListElemID,
    annotations: {
    },
    fields: {
      id: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      }, /* Original description: This field accepts references to the following custom types:   transactionbodycustomfield   itemcustomfield   entitycustomfield   recordsublist   customrecordcustomfield   crmcustomfield   For information about other possible values, see entryform_sublistid. */
      label: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      }, /* Original description: This field accepts references to the string custom type. */
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
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_tabs_tab_subItems_subTab_subLists_subList = entryForm_tabs_tab_subItems_subTab_subLists_subList

  const entryForm_tabs_tab_subItems_subTab_subListsElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_subItems_subTab_subLists')

  const entryForm_tabs_tab_subItems_subTab_subLists = new ObjectType({
    elemID: entryForm_tabs_tab_subItems_subTab_subListsElemID,
    annotations: {
    },
    fields: {
      subList: {
        refType: createRefToElmWithValue(new ListType(entryForm_tabs_tab_subItems_subTab_subLists_subList)),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_tabs_tab_subItems_subTab_subLists = entryForm_tabs_tab_subItems_subTab_subLists

  const entryForm_tabs_tab_subItems_subTabElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_subItems_subTab')

  const entryForm_tabs_tab_subItems_subTab = new ObjectType({
    elemID: entryForm_tabs_tab_subItems_subTabElemID,
    annotations: {
    },
    fields: {
      id: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      }, /* Original description: This field accepts references to the following custom types:   subtab   subtab   For information about other possible values, see entryform_subtabid. */
      label: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      }, /* Original description: This field accepts references to the string custom type. */
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
        refType: createRefToElmWithValue(entryForm_tabs_tab_subItems_subTab_fieldGroups),
        annotations: {
        },
      },
      subLists: {
        refType: createRefToElmWithValue(entryForm_tabs_tab_subItems_subTab_subLists),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_tabs_tab_subItems_subTab = entryForm_tabs_tab_subItems_subTab

  const entryForm_tabs_tab_subItemsElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab_subItems')

  const entryForm_tabs_tab_subItems = new ObjectType({
    elemID: entryForm_tabs_tab_subItemsElemID,
    annotations: {
    },
    fields: {
      subList: {
        refType: createRefToElmWithValue(new ListType(entryForm_tabs_tab_subItems_subList)),
        annotations: {
        },
      },
      subLists: {
        refType: createRefToElmWithValue(entryForm_tabs_tab_subItems_subLists),
        annotations: {
        },
      },
      subTab: {
        refType: createRefToElmWithValue(new ListType(entryForm_tabs_tab_subItems_subTab)),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_tabs_tab_subItems = entryForm_tabs_tab_subItems

  const entryForm_tabs_tabElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs_tab')

  const entryForm_tabs_tab = new ObjectType({
    elemID: entryForm_tabs_tabElemID,
    annotations: {
    },
    fields: {
      id: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      }, /* Original description: This field accepts references to the following custom types:   subtab   subtab   For information about other possible values, see entryform_tabid. */
      label: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      }, /* Original description: This field accepts references to the string custom type. */
      visible: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {
        },
      }, /* Original description: The default value is T. */
      fieldGroups: {
        refType: createRefToElmWithValue(entryForm_tabs_tab_fieldGroups),
        annotations: {
        },
      },
      subItems: {
        refType: createRefToElmWithValue(entryForm_tabs_tab_subItems),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_tabs_tab = entryForm_tabs_tab

  const entryForm_tabsElemID = new ElemID(constants.NETSUITE, 'entryForm_tabs')

  const entryForm_tabs = new ObjectType({
    elemID: entryForm_tabsElemID,
    annotations: {
    },
    fields: {
      tab: {
        refType: createRefToElmWithValue(new ListType(entryForm_tabs_tab)),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })

  innerTypes.entryForm_tabs = entryForm_tabs


  const entryForm = new ObjectType({
    elemID: entryFormElemID,
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
        refType: createRefToElmWithValue(enums.entryform_standard),
        annotations: {
          [constants.IS_ATTRIBUTE]: true,
        },
      }, /* Original description: This attribute value can be up to 99 characters long.   For information about possible values, see entryform_standard. */
      name: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      }, /* Original description: This field accepts references to the string custom type. */
      recordType: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
        },
      }, /* Original description: This field accepts references to the customrecordtype custom type. */
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
        refType: createRefToElmWithValue(entryForm_mainFields),
        annotations: {
        },
      },
      tabs: {
        refType: createRefToElmWithValue(entryForm_tabs),
        annotations: {
        },
      },
      customCode: {
        refType: createRefToElmWithValue(entryForm_customCode),
        annotations: {
        },
      },
      quickViewFields: {
        refType: createRefToElmWithValue(entryForm_quickViewFields),
        annotations: {
        },
      },
      actionbar: {
        refType: createRefToElmWithValue(entryForm_actionbar),
        annotations: {
        },
      },
      useForPopup: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {
        },
      }, /* Original description: The default value is F. */
      editingInList: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {
        },
      }, /* Original description: The default value is T. */
      buttons: {
        refType: createRefToElmWithValue(entryForm_buttons),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, entryFormElemID.name],
  })


  return { type: entryForm, innerTypes }
}
