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
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, ObjectType, ListType,
} from '@salto-io/adapter-api'
import * as constants from '../../constants'
import { enums } from '../enums'

export const kpiscorecardInnerTypes: ObjectType[] = []

const kpiscorecardElemID = new ElemID(constants.NETSUITE, 'kpiscorecard')
const kpiscorecard_audienceElemID = new ElemID(constants.NETSUITE, 'kpiscorecard_audience')

const kpiscorecard_audience = new ObjectType({
  elemID: kpiscorecard_audienceElemID,
  annotations: {
  },
  fields: {
    allroles: new Field(
      kpiscorecard_audienceElemID,
      'allroles',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    allpartners: new Field(
      kpiscorecard_audienceElemID,
      'allpartners',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the CRM feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CRM must be enabled for this field to appear in your account. */
    allemployees: new Field(
      kpiscorecard_audienceElemID,
      'allemployees',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    audslctrole: new Field(
      kpiscorecard_audienceElemID,
      'audslctrole',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: This field is available when the allroles value is not equal to T.   You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the role custom type.   For information about other possible values, see generic_role. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})

kpiscorecardInnerTypes.push(kpiscorecard_audience)

const kpiscorecard_customElemID = new ElemID(constants.NETSUITE, 'kpiscorecard_custom')

const kpiscorecard_custom = new ObjectType({
  elemID: kpiscorecard_customElemID,
  annotations: {
  },
  fields: {
    kpi1: new Field(
      kpiscorecard_customElemID,
      'kpi1',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    kpi2: new Field(
      kpiscorecard_customElemID,
      'kpi2',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    kpi3: new Field(
      kpiscorecard_customElemID,
      'kpi3',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    kpi4: new Field(
      kpiscorecard_customElemID,
      'kpi4',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    kpi5: new Field(
      kpiscorecard_customElemID,
      'kpi5',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    kpi6: new Field(
      kpiscorecard_customElemID,
      'kpi6',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    kpi7: new Field(
      kpiscorecard_customElemID,
      'kpi7',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    kpi8: new Field(
      kpiscorecard_customElemID,
      'kpi8',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    kpi9: new Field(
      kpiscorecard_customElemID,
      'kpi9',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    kpi10: new Field(
      kpiscorecard_customElemID,
      'kpi10',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})

kpiscorecardInnerTypes.push(kpiscorecard_custom)

const kpiscorecard_highlightings_highlightingElemID = new ElemID(constants.NETSUITE, 'kpiscorecard_highlightings_highlighting')

const kpiscorecard_highlightings_highlighting = new ObjectType({
  elemID: kpiscorecard_highlightings_highlightingElemID,
  annotations: {
  },
  fields: {
    kpiindex: new Field(
      kpiscorecard_highlightings_highlightingElemID,
      'kpiindex',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: The default value is 'ALL'. */
    condition: new Field(
      kpiscorecard_highlightings_highlightingElemID,
      'condition',
      enums.kpiscorecards_highlight_conditions,
      {
      },
    ), /* Original description: For information about possible values, see kpiscorecards_highlight_conditions. */
    threshold: new Field(
      kpiscorecard_highlightings_highlightingElemID,
      'threshold',
      BuiltinTypes.NUMBER,
      {
      },
    ),
    rangeindex: new Field(
      kpiscorecard_highlightings_highlightingElemID,
      'rangeindex',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: The default value is 'ALL'. */
    icon: new Field(
      kpiscorecard_highlightings_highlightingElemID,
      'icon',
      enums.kpiscorecards_highlight_icons,
      {
      },
    ), /* Original description: For information about possible values, see kpiscorecards_highlight_icons. */
    foregroundcolor: new Field(
      kpiscorecard_highlightings_highlightingElemID,
      'foregroundcolor',
      BuiltinTypes.STRING /* Original type was rgb   RGB field types must be set to a valid 6–digit hexadecimal value between #000000 and #FFFFFF. The # prefix is optional. */,
      {
      },
    ), /* Original description: The default value is '#000000'. */
    backgroundcolor: new Field(
      kpiscorecard_highlightings_highlightingElemID,
      'backgroundcolor',
      BuiltinTypes.STRING /* Original type was rgb   RGB field types must be set to a valid 6–digit hexadecimal value between #000000 and #FFFFFF. The # prefix is optional. */,
      {
      },
    ), /* Original description: The default value is '#FFFFFF'. */
    bold: new Field(
      kpiscorecard_highlightings_highlightingElemID,
      'bold',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    headline: new Field(
      kpiscorecard_highlightings_highlightingElemID,
      'headline',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})

kpiscorecardInnerTypes.push(kpiscorecard_highlightings_highlighting)

const kpiscorecard_highlightingsElemID = new ElemID(constants.NETSUITE, 'kpiscorecard_highlightings')

const kpiscorecard_highlightings = new ObjectType({
  elemID: kpiscorecard_highlightingsElemID,
  annotations: {
  },
  fields: {
    highlighting: new Field(
      kpiscorecard_highlightingsElemID,
      'highlighting',
      new ListType(kpiscorecard_highlightings_highlighting),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})

kpiscorecardInnerTypes.push(kpiscorecard_highlightings)

const kpiscorecard_kpis_kpiElemID = new ElemID(constants.NETSUITE, 'kpiscorecard_kpis_kpi')

const kpiscorecard_kpis_kpi = new ObjectType({
  elemID: kpiscorecard_kpis_kpiElemID,
  annotations: {
  },
  fields: {
    kpi: new Field(
      kpiscorecard_kpis_kpiElemID,
      'kpi',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see the following lists:   kpi_snapshots_formula   kpi_snapshots_daterange_or_period   kpi_snapshots_daterange   kpi_snapshots_custom */
    comparevalueto: new Field(
      kpiscorecard_kpis_kpiElemID,
      'comparevalueto',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is available when the kpi value is not present in kpi_snapshots_formula.   For information about possible values, see the following lists:   kpi_snapshots_formula   kpi_snapshots_daterange_or_period   kpi_snapshots_daterange   kpi_snapshots_custom */
    comparewithprevious: new Field(
      kpiscorecard_kpis_kpiElemID,
      'comparewithprevious',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: This field is available when the kpi value is not present in kpi_snapshots_formula.   The default value is F. */
    comparisontype: new Field(
      kpiscorecard_kpis_kpiElemID,
      'comparisontype',
      enums.kpiscorecards_comparisons,
      {
      },
    ), /* Original description: This field is available when the kpi value is not present in kpi_snapshots_formula.   For information about possible values, see kpiscorecards_comparisons. */
    invertcomparison: new Field(
      kpiscorecard_kpis_kpiElemID,
      'invertcomparison',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: This field is available when the kpi value is not present in kpi_snapshots_formula.   The default value is F. */
    formula: new Field(
      kpiscorecard_kpis_kpiElemID,
      'formula',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    ), /* Original description: This field value can be up to 200 characters long.   This field is available when the kpi value is present in kpi_snapshots_formula. */
    lessismore: new Field(
      kpiscorecard_kpis_kpiElemID,
      'lessismore',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: This field is available when the kpi value is present in kpi_snapshots_formula.   The default value is F. */
    hidden: new Field(
      kpiscorecard_kpis_kpiElemID,
      'hidden',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    label: new Field(
      kpiscorecard_kpis_kpiElemID,
      'label',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 99,
      },
    ), /* Original description: This field value can be up to 99 characters long. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})

kpiscorecardInnerTypes.push(kpiscorecard_kpis_kpi)

const kpiscorecard_kpisElemID = new ElemID(constants.NETSUITE, 'kpiscorecard_kpis')

const kpiscorecard_kpis = new ObjectType({
  elemID: kpiscorecard_kpisElemID,
  annotations: {
  },
  fields: {
    kpi: new Field(
      kpiscorecard_kpisElemID,
      'kpi',
      new ListType(kpiscorecard_kpis_kpi),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})

kpiscorecardInnerTypes.push(kpiscorecard_kpis)

const kpiscorecard_ranges_rangeElemID = new ElemID(constants.NETSUITE, 'kpiscorecard_ranges_range')

const kpiscorecard_ranges_range = new ObjectType({
  elemID: kpiscorecard_ranges_rangeElemID,
  annotations: {
  },
  fields: {
    range: new Field(
      kpiscorecard_ranges_rangeElemID,
      'range',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see the following lists:   kpi_ranges_period   kpi_ranges_daterange_report   kpi_ranges_daterange_or_period   kpi_ranges_daterange */
    comparevalueto: new Field(
      kpiscorecard_ranges_rangeElemID,
      'comparevalueto',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: For information about possible values, see the following lists:   kpi_ranges_period   kpi_ranges_daterange_report   kpi_ranges_daterange_or_period   kpi_ranges_daterange */
    comparewithprevious: new Field(
      kpiscorecard_ranges_rangeElemID,
      'comparewithprevious',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    comparisontype: new Field(
      kpiscorecard_ranges_rangeElemID,
      'comparisontype',
      enums.kpiscorecards_comparisons,
      {
      },
    ), /* Original description: For information about possible values, see kpiscorecards_comparisons. */
    invertcomparison: new Field(
      kpiscorecard_ranges_rangeElemID,
      'invertcomparison',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    label: new Field(
      kpiscorecard_ranges_rangeElemID,
      'label',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 99,
      },
    ), /* Original description: This field value can be up to 99 characters long. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})

kpiscorecardInnerTypes.push(kpiscorecard_ranges_range)

const kpiscorecard_rangesElemID = new ElemID(constants.NETSUITE, 'kpiscorecard_ranges')

const kpiscorecard_ranges = new ObjectType({
  elemID: kpiscorecard_rangesElemID,
  annotations: {
  },
  fields: {
    range: new Field(
      kpiscorecard_rangesElemID,
      'range',
      new ListType(kpiscorecard_ranges_range),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})

kpiscorecardInnerTypes.push(kpiscorecard_ranges)


export const kpiscorecard = new ObjectType({
  elemID: kpiscorecardElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'custkpiscorecard_',
  },
  fields: {
    scriptid: new Field(
      kpiscorecardElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custkpiscorecard’. */
    name: new Field(
      kpiscorecardElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 25,
      },
    ), /* Original description: This field value can be up to 25 characters long. */
    useperiods: new Field(
      kpiscorecardElemID,
      'useperiods',
      enums.kpiscorecards_useperiods,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see kpiscorecards_useperiods. */
    description: new Field(
      kpiscorecardElemID,
      'description',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    ), /* Original description: This field value can be up to 999 characters long. */
    audience: new Field(
      kpiscorecardElemID,
      'audience',
      kpiscorecard_audience,
      {
      },
    ),
    custom: new Field(
      kpiscorecardElemID,
      'custom',
      kpiscorecard_custom,
      {
      },
    ),
    highlightings: new Field(
      kpiscorecardElemID,
      'highlightings',
      kpiscorecard_highlightings,
      {
      },
    ),
    kpis: new Field(
      kpiscorecardElemID,
      'kpis',
      kpiscorecard_kpis,
      {
      },
    ),
    ranges: new Field(
      kpiscorecardElemID,
      'ranges',
      kpiscorecard_ranges,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})
