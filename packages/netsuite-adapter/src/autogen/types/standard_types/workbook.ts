/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
/* eslint-disable max-len */
/* eslint-disable camelcase */
import {
  BuiltinTypes,
  createRefToElmWithValue,
  CORE_ANNOTATIONS,
  ElemID,
  ObjectType,
  createRestriction,
  ListType,
} from '@salto-io/adapter-api'
import * as constants from '../../../constants'
import { TypeAndInnerTypes } from '../../../types/object_types'
import { fieldTypes } from '../../../types/field_types'

export const workbookType = (): TypeAndInnerTypes => {
  const innerTypes: Record<string, ObjectType> = {}

  const workbookElemID = new ElemID(constants.NETSUITE, 'workbook')
  const workbook_charts_chartElemID = new ElemID(constants.NETSUITE, 'workbook_charts_chart')

  const workbook_charts_chart = new ObjectType({
    elemID: workbook_charts_chartElemID,
    annotations: {},
    fields: {
      scriptid: {
        refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [constants.IS_ATTRIBUTE]: true,
        },
      } /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custchart’. */,
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, workbookElemID.name],
  })

  innerTypes.workbook_charts_chart = workbook_charts_chart

  const workbook_chartsElemID = new ElemID(constants.NETSUITE, 'workbook_charts')

  const workbook_charts = new ObjectType({
    elemID: workbook_chartsElemID,
    annotations: {},
    fields: {
      chart: {
        refType: createRefToElmWithValue(new ListType(workbook_charts_chart)),
        annotations: {},
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, workbookElemID.name],
  })

  innerTypes.workbook_charts = workbook_charts

  const workbook_dependenciesElemID = new ElemID(constants.NETSUITE, 'workbook_dependencies')

  const workbook_dependencies = new ObjectType({
    elemID: workbook_dependenciesElemID,
    annotations: {},
    fields: {
      dependency: {
        refType: createRefToElmWithValue(new ListType(BuiltinTypes.STRING)),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      } /* Original description: This field accepts references to the dataset custom type. */,
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, workbookElemID.name],
  })

  innerTypes.workbook_dependencies = workbook_dependencies

  const workbook_pivots_pivotElemID = new ElemID(constants.NETSUITE, 'workbook_pivots_pivot')

  const workbook_pivots_pivot = new ObjectType({
    elemID: workbook_pivots_pivotElemID,
    annotations: {},
    fields: {
      scriptid: {
        refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [constants.IS_ATTRIBUTE]: true,
        },
      } /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custpivot’. */,
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, workbookElemID.name],
  })

  innerTypes.workbook_pivots_pivot = workbook_pivots_pivot

  const workbook_pivotsElemID = new ElemID(constants.NETSUITE, 'workbook_pivots')

  const workbook_pivots = new ObjectType({
    elemID: workbook_pivotsElemID,
    annotations: {},
    fields: {
      pivot: {
        refType: createRefToElmWithValue(new ListType(workbook_pivots_pivot)),
        annotations: {},
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, workbookElemID.name],
  })

  innerTypes.workbook_pivots = workbook_pivots

  const workbook_tables_tableElemID = new ElemID(constants.NETSUITE, 'workbook_tables_table')

  const workbook_tables_table = new ObjectType({
    elemID: workbook_tables_tableElemID,
    annotations: {},
    fields: {
      scriptid: {
        refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [constants.IS_ATTRIBUTE]: true,
        },
      } /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custview’. */,
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, workbookElemID.name],
  })

  innerTypes.workbook_tables_table = workbook_tables_table

  const workbook_tablesElemID = new ElemID(constants.NETSUITE, 'workbook_tables')

  const workbook_tables = new ObjectType({
    elemID: workbook_tablesElemID,
    annotations: {},
    fields: {
      table: {
        refType: createRefToElmWithValue(new ListType(workbook_tables_table)),
        annotations: {},
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, workbookElemID.name],
  })

  innerTypes.workbook_tables = workbook_tables

  const workbook = new ObjectType({
    elemID: workbookElemID,
    annotations: {},
    fields: {
      scriptid: {
        refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [constants.IS_ATTRIBUTE]: true,
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^custworkbook[0-9a-z_]+' }),
        },
      } /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custworkbook’. */,
      name: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          // [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 50 }),
        },
      } /* Original description: This field value can be up to 50 characters long.   This field accepts references to the string custom type. */,
      definition: {
        refType: createRefToElmWithValue(fieldTypes.cdata),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      } /* Original description:   */,
      charts: {
        refType: createRefToElmWithValue(workbook_charts),
        annotations: {},
      },
      dependencies: {
        refType: createRefToElmWithValue(workbook_dependencies),
        annotations: {},
      },
      pivots: {
        refType: createRefToElmWithValue(workbook_pivots),
        annotations: {},
      },
      tables: {
        refType: createRefToElmWithValue(workbook_tables),
        annotations: {},
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, workbookElemID.name],
  })

  return { type: workbook, innerTypes }
}
