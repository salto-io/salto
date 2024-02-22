/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  ObjectType,
  createRestriction,
  ListType,
  createRefToElmWithValue,
} from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { types } from '@salto-io/lowerdash'
import { TypeAndInnerTypes } from '../../types/object_types'
import * as constants from '../../constants'
import { fieldTypes } from '../../types/field_types'
import {
  AnalyticOriginalFields,
  ApplicationId,
  Audience,
  BaseRecord,
  Condition,
  ConditionOrFilter,
  DEFAULT_VALUE,
  DEFAULT_XML_TYPE,
  DO_NOT_ADD,
  DefinitionId,
  Dependencies,
  Expression,
  ExpressionValue,
  FieldOrFormula,
  FieldReference,
  Filter,
  Formula,
  FormulaFormula,
  IGNORE_T_VALUE,
  Join,
  JoinTrail,
  Meta,
  Operator,
  TargetFieldContext,
  TranslationType,
  XML_TYPE,
} from './analytics_constants'

type Column = {
  alias?: string
  columnId?: number
  field?: FieldOrFormula
  label?: TranslationType
}

type DatasetDefinitionType = {
  applicationId?: ApplicationId
  audience?: Audience
  baseRecord?: BaseRecord
  columns?: Column[]
  criteria?: ConditionOrFilter
  description?: TranslationType
  formulas?: Formula[]
  id?: DefinitionId
  ownerId?: number
  version?: string
}

export const datasetDefinitionFields: types.TypeKeysEnum<DatasetDefinitionType> = {
  applicationId: 'applicationId',
  audience: 'audience',
  baseRecord: 'baseRecord',
  columns: 'columns',
  criteria: 'criteria',
  description: 'description',
  formulas: 'formulas',
  id: 'id',
  ownerId: 'ownerId',
  version: 'version',
}

export type Dataset = AnalyticOriginalFields & DatasetDefinitionType

export const parsedDatasetType = (): TypeAndInnerTypes => {
  const innerTypes: Record<string, ObjectType> = {}

  const datasetAudienceElemID = new ElemID(constants.NETSUITE, 'dataset_audience')
  const datasetAudience = createMatchingObjectType<Audience>({
    elemID: datasetAudienceElemID,
    annotations: {},
    fields: {
      AudienceItems: { refType: new ListType(BuiltinTypes.UNKNOWN) },
      isPublic: { refType: BuiltinTypes.BOOLEAN },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.DATASET],
  })
  innerTypes.datasetAudience = datasetAudience

  const datasetDependenciesElemID = new ElemID(constants.NETSUITE, 'dataset_dependencies')
  const datasetDependencies = createMatchingObjectType<Dependencies>({
    elemID: datasetDependenciesElemID,
    annotations: {},
    fields: {
      dependency: {
        refType: new ListType(BuiltinTypes.STRING),
        annotations: {
          _required: true,
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.DATASET],
  })
  innerTypes.datasetDependencies = datasetDependencies

  const datasetBaseRecordElemID = new ElemID(constants.NETSUITE, 'dataset_base_record')
  const datasetBaseRecord = createMatchingObjectType<BaseRecord>({
    elemID: datasetBaseRecordElemID,
    annotations: {},
    fields: {
      id: { refType: BuiltinTypes.STRING },
      label: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.DATASET],
  })
  innerTypes.datasetBaseRecord = datasetBaseRecord

  const datasetJoinElemID = new ElemID(constants.NETSUITE, 'dataset_join')
  const datasetJoin = createMatchingObjectType<Join>({
    elemID: datasetJoinElemID,
    annotations: {},
    fields: {
      id: { refType: BuiltinTypes.STRING },
      targetRecordType: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.DATASET],
  })
  innerTypes.datasetJoin = datasetJoin

  const datasetJoinTrailElemID = new ElemID(constants.NETSUITE, 'dataset_join_trail')
  const datasetJoinTrail = createMatchingObjectType<JoinTrail>({
    elemID: datasetJoinTrailElemID,
    annotations: {},
    fields: {
      baseRecord: { refType: datasetBaseRecord },
      joins: { refType: new ListType(datasetJoin) },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.DATASET],
  })
  innerTypes.joinTrail = datasetJoinTrail

  const datasetFieldReferenceElemID = new ElemID(constants.NETSUITE, 'dataset_field_reference')
  const datasetFieldReference = createMatchingObjectType<FieldReference>({
    elemID: datasetFieldReferenceElemID,
    annotations: {},
    fields: {
      id: { refType: BuiltinTypes.STRING },
      joinTrail: { refType: datasetJoinTrail },
      label: { refType: BuiltinTypes.STRING },
      uniqueId: { refType: BuiltinTypes.STRING },
      fieldValidityState: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [DO_NOT_ADD]: true,
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.DATASET],
  })
  innerTypes.fieldReference = datasetFieldReference

  const datasetTranslationElemID = new ElemID(constants.NETSUITE, 'dataset_translation')
  const datasetTranslation = createMatchingObjectType<TranslationType>({
    elemID: datasetTranslationElemID,
    annotations: {},
    fields: {
      translationScriptId: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.DATASET],
  })
  innerTypes.datasetTranslation = datasetTranslation

  const datasetFormulaFormulaElemID = new ElemID(constants.NETSUITE, 'dataset_formula_formula')
  const datasetFormulaFormula = createMatchingObjectType<FormulaFormula>({
    elemID: datasetFormulaFormulaElemID,
    annotations: {
      [XML_TYPE]: true,
      [DEFAULT_XML_TYPE]: 'formula',
      [IGNORE_T_VALUE]: true,
    },
    fields: {
      dataType: { refType: BuiltinTypes.STRING },
      formulaSQL: { refType: BuiltinTypes.STRING },
      id: { refType: BuiltinTypes.STRING },
      label: { refType: datasetTranslation },
      uniqueId: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.DATASET],
  })
  innerTypes.formulaFormula = datasetFormulaFormula

  const datasetFormulaElemID = new ElemID(constants.NETSUITE, 'dataset_formula')
  const datasetFormula = createMatchingObjectType<Formula>({
    elemID: datasetFormulaElemID,
    annotations: {},
    fields: {
      fields: { refType: BuiltinTypes.UNKNOWN },
      formula: { refType: datasetFormulaFormula },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.DATASET],
  })
  innerTypes.formula = datasetFormula

  const datasetFieldOrFormulaElemID = new ElemID(constants.NETSUITE, 'dataset_field_or_formula')
  const datasetFieldOrFormula = createMatchingObjectType<FieldOrFormula>({
    elemID: datasetFieldOrFormulaElemID,
    annotations: {
      [XML_TYPE]: true,
    },
    fields: {
      fieldReference: {
        refType: datasetFieldReference,
        annotations: {
          [DO_NOT_ADD]: true,
        },
      },
      dataSetFormula: {
        refType: datasetFormula,
        annotations: {
          [DO_NOT_ADD]: true,
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.DATASET],
  })
  innerTypes.fieldOrFormula = datasetFieldOrFormula

  const datasetColumnElemID = new ElemID(constants.NETSUITE, 'dataset_column')
  const datasetColumn = createMatchingObjectType<Column>({
    elemID: datasetColumnElemID,
    annotations: {},
    fields: {
      alias: { refType: BuiltinTypes.STRING },
      columnId: { refType: BuiltinTypes.NUMBER },
      field: { refType: datasetFieldOrFormula },
      label: { refType: datasetTranslation },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.DATASET],
  })
  innerTypes.column = datasetColumn

  const expressionValueElemID = new ElemID(constants.NETSUITE, 'dataset_criteria_expression_value')
  const expressionValue = createMatchingObjectType<ExpressionValue>({
    elemID: expressionValueElemID,
    annotations: {},
    fields: {
      type: { refType: BuiltinTypes.STRING },
      value: { refType: BuiltinTypes.UNKNOWN },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.DATASET],
  })
  innerTypes.expressionValue = expressionValue

  const expressionElemID = new ElemID(constants.NETSUITE, 'dataset_criteria_expression')
  const expression = createMatchingObjectType<Expression>({
    elemID: expressionElemID,
    annotations: {},
    fields: {
      label: { refType: BuiltinTypes.STRING },
      subType: { refType: BuiltinTypes.UNKNOWN },
      uiData: { refType: new ListType(BuiltinTypes.STRING) },
      value: { refType: expressionValue },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.DATASET],
  })
  innerTypes.expression = expression

  const datasetMetaElemID = new ElemID(constants.NETSUITE, 'dataset_meta')
  const datasetMeta = createMatchingObjectType<Meta>({
    elemID: datasetMetaElemID,
    annotations: {},
    fields: {
      selectorType: { refType: BuiltinTypes.STRING },
      subType: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.DATASET],
  })
  innerTypes.criteriaMeta = datasetMeta

  const datasetOperatorElemID = new ElemID(constants.NETSUITE, 'dataset_operator')
  const datasetOperator = createMatchingObjectType<Operator>({
    elemID: datasetOperatorElemID,
    annotations: {},
    fields: {
      code: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [DEFAULT_VALUE]: 'AND',
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.DATASET],
  })
  innerTypes.operator = datasetOperator

  const datasetTargetFieldContextElemID = new ElemID(constants.NETSUITE, 'dataset_criteria_target_field_context')
  const datasetTargetFieldContext = createMatchingObjectType<TargetFieldContext>({
    elemID: datasetTargetFieldContextElemID,
    annotations: {},
    fields: {
      name: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [DEFAULT_VALUE]: 'DEFAULT',
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.DATASET],
  })
  innerTypes.context = datasetTargetFieldContext

  const datasetFilterElemID = new ElemID(constants.NETSUITE, 'dataset_filter')
  const datasetFilter = createMatchingObjectType<Filter>({
    elemID: datasetFilterElemID,
    annotations: {},
    fields: {
      caseSensitive: { refType: BuiltinTypes.BOOLEAN },
      expressions: { refType: new ListType(expression) },
      operator: {
        refType: datasetOperator,
      },
      targetFieldContext: { refType: datasetTargetFieldContext },
      field: { refType: datasetFieldOrFormula },
      fieldStateName: { refType: BuiltinTypes.STRING },
      meta: { refType: datasetMeta },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.DATASET],
  })
  innerTypes.filter = datasetFilter

  const datasetConditionElemID = new ElemID(constants.NETSUITE, 'dataset_condition')
  const datasetCondition = createMatchingObjectType<Condition>({
    elemID: datasetConditionElemID,
    annotations: {},
    fields: {
      children: { refType: BuiltinTypes.UNKNOWN },
      operator: { refType: datasetOperator },
      targetFieldContext: { refType: datasetTargetFieldContext },
      meta: { refType: datasetMeta },
      field: { refType: datasetFieldOrFormula },
      fieldStateName: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.DATASET],
  })
  innerTypes.condition = datasetCondition

  const datasetCriteriaElemID = new ElemID(constants.NETSUITE, 'dataset_criteria')
  const datasetCriteria = createMatchingObjectType<ConditionOrFilter>({
    elemID: datasetCriteriaElemID,
    annotations: {
      [XML_TYPE]: true,
    },
    fields: {
      condition: {
        refType: datasetCondition,
        annotations: {
          [DO_NOT_ADD]: true,
        },
      },
      filter: {
        refType: datasetFilter,
        annotations: {
          [DO_NOT_ADD]: true,
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.DATASET],
  })
  innerTypes.criteria = datasetCriteria

  datasetFormula.fields.fields.refType = createRefToElmWithValue(new ListType(datasetFieldOrFormula))
  datasetCondition.fields.children.refType = createRefToElmWithValue(new ListType(datasetCriteria))

  const datasetElemID = new ElemID(constants.NETSUITE, 'dataset')
  const dataset = createMatchingObjectType<Dataset>({
    elemID: datasetElemID,
    annotations: {
      [XML_TYPE]: true,
      [DEFAULT_XML_TYPE]: 'dataSet',
      [IGNORE_T_VALUE]: true,
    },
    fields: {
      scriptid: {
        refType: BuiltinTypes.SERVICE_ID,
        annotations: {
          _required: true,
          [constants.IS_ATTRIBUTE]: true,
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^custdataset[0-9a-z_]+' }),
        },
      },
      name: {
        refType: BuiltinTypes.STRING,
        annotations: {
          _required: true,
        },
      },
      dependencies: {
        refType: createRefToElmWithValue(datasetDependencies),
        annotations: {
          [DO_NOT_ADD]: true,
        },
      },
      definition: {
        refType: createRefToElmWithValue(fieldTypes.cdata),
        annotations: {
          [DO_NOT_ADD]: true,
        },
      },
      applicationId: { refType: BuiltinTypes.UNKNOWN },
      audience: { refType: datasetAudience },
      baseRecord: { refType: datasetBaseRecord },
      columns: { refType: new ListType(datasetColumn) },
      criteria: { refType: datasetCriteria },
      description: { refType: datasetTranslation },
      formulas: { refType: new ListType(datasetFieldOrFormula) },
      id: { refType: BuiltinTypes.UNKNOWN },
      ownerId: { refType: BuiltinTypes.NUMBER },
      version: { refType: BuiltinTypes.STRING },
      application_id: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [DO_NOT_ADD]: true,
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.DATASET],
  })
  return { type: dataset, innerTypes }
}
