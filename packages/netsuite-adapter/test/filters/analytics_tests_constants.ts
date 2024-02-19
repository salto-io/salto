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

/* eslint-disable camelcase */
import _ from 'lodash'
import { InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { parsedDatasetType } from '../../src/type_parsers/analytics_parsers/parsed_dataset'
import * as constants from '../../src/constants'
import { translationcollectionType } from '../../src/autogen/types/standard_types/translationcollection'
import { parsedWorkbookType } from '../../src/type_parsers/analytics_parsers/parsed_workbook'
import {
  DATA_VIEWS,
  DATA_VIEW_IDS,
  FIELD_DEFINITION,
  FIELD_TYPE,
  PIVOTS,
  PIVOT_IDS,
} from '../../src/type_parsers/analytics_parsers/analytics_constants'

const dataset = parsedDatasetType().type
const workbook = parsedWorkbookType().type

// basic definition
const basicDatasetDefinitionOriginal = `
<root>
<_T_>dataSet</_T_>
<id type="null"/>
<scriptId type="null"/>
<applicationId type="null"/>
<version type="string">0.1</version>
<name>
  <translationScriptId>custcollectiontranslations_dataset_27_55a834ce148445fd9a604.dataset_name_1141_1</translationScriptId>
</name>
<audience>
  <AudienceItems type="array"/>
  <isPublic type="boolean">false</isPublic>
</audience>
<ownerId>5</ownerId>
<description type="null"/>
<baseRecord>
  <id>account</id>
  <label>Account</label>
</baseRecord>
<columns type="array">
  <_ITEM_>
    <columnId>5</columnId>
    <label type="null"/>
    <field>
      <_T_>fieldReference</_T_>
      <id>id</id>
      <label>Internal ID</label>
      <joinTrail>
        <baseRecord>
          <id>account</id>
          <label>Account</label>
        </baseRecord>
        <joins type="array"/>
      </joinTrail>
      <uniqueId>id</uniqueId>
    </field>
    <alias>id</alias>
  </_ITEM_>
  <_ITEM_>
    <columnId>6</columnId>
    <label type="null"/>
    <field>
      <_T_>fieldReference</_T_>
      <id>id</id>
      <label>Internal ID</label>
      <joinTrail>
        <baseRecord>
          <id>account</id>
          <label>Account</label>
        </baseRecord>
        <joins type="array"/>
      </joinTrail>
      <uniqueId>id</uniqueId>
    </field>
    <alias>id</alias>
  </_ITEM_>
</columns>
<criteria>
  <_T_>condition</_T_>
  <operator>
    <code>AND</code>
  </operator>
  <children type="array"/>
  <meta type="null"/>
  <field type="null"/>
  <targetFieldContext>
    <name>DEFAULT</name>
  </targetFieldContext>
  <fieldStateName type="null"/>
</criteria>
<formulas type="array"/>
</root>
`
const basicDatasetValue = {
  name: 'seggev test basic',
  scriptid: 'seggevTestBasic',
  definition: basicDatasetDefinitionOriginal,
}
export const basicDataset = new InstanceElement('seggev basic', dataset, basicDatasetValue, [
  constants.NETSUITE,
  constants.DATASET,
])
export const parsedBasicDatasetValue = {
  scriptid: basicDatasetValue.scriptid,
  name: basicDatasetValue.name,
  version: '0.1',
  audience: {
    isPublic: false,
  },
  ownerId: 5,
  baseRecord: {
    id: 'account',
    label: 'Account',
  },
  columns: [
    {
      columnId: 5,
      field: {
        fieldReference: {
          id: 'id',
          label: 'Internal ID',
          joinTrail: {
            baseRecord: {
              id: 'account',
              label: 'Account',
            },
          },
          uniqueId: 'id',
        },
      },
      alias: 'id',
    },
    {
      columnId: 6,
      field: {
        fieldReference: {
          id: 'id',
          label: 'Internal ID',
          joinTrail: {
            baseRecord: {
              id: 'account',
              label: 'Account',
            },
          },
          uniqueId: 'id',
        },
      },
      alias: 'id',
    },
  ],
  criteria: {
    condition: {
      operator: {
        code: 'AND',
      },
      targetFieldContext: {
        name: 'DEFAULT',
      },
    },
  },
}

export const parsedBasicDataset = new InstanceElement('seggev parsed basic', dataset, parsedBasicDatasetValue, [
  constants.NETSUITE,
  constants.DATASET,
])

// definition with unknown attribute
const originalUnknownDefinition = `
<root>
<_T_>dataSet</_T_>
<audience>
  <_T_>audience</_T_>
  <Stam_Field type="boolean">true</Stam_Field>
  <isPublic type="boolean">true</isPublic>
  <AudienceItems type="array"></AudienceItems>
</audience>
<strangeAttribute>
  <_T_>type</_T_>
  <num type="string">0.5</num>
</strangeAttribute>
</root>
`
const unknownDatasetValue = {
  name: 'seggev test unknown',
  scriptid: 'seggevTestUnknown',
  definition: originalUnknownDefinition,
}
export const unknownDataset = new InstanceElement('seggev unknown', dataset, unknownDatasetValue, [
  constants.NETSUITE,
  constants.DATASET,
])

export const parsedUnknownDatasetValue = {
  name: unknownDatasetValue.name,
  scriptid: unknownDatasetValue.scriptid,
  audience: {
    [FIELD_DEFINITION]: 'audience',
    Stam_Field: true,
    isPublic: true,
  },
  strangeAttribute: {
    [FIELD_TYPE]: 'type',
    num: '0.5',
  },
}

export const parsedUnknownDatasetValueForFetch = {
  name: unknownDatasetValue.name,
  scriptid: unknownDatasetValue.scriptid,
  audience: {
    [FIELD_TYPE]: 'audience',
    Stam_Field: true,
    isPublic: true,
  },
  strangeAttribute: {
    [FIELD_TYPE]: 'type',
    num: '0.5',
  },
}

export const parsedUnknownDataset = new InstanceElement(
  'seggev parsed strange references dataset',
  dataset,
  parsedUnknownDatasetValue,
  [constants.NETSUITE, constants.DATASET],
)

export const unknownDefinition = `<root>
  <audience>
    <_T_>audience</_T_>
    <Stam_Field type="boolean">true</Stam_Field>
    <isPublic type="boolean">true</isPublic>
    <AudienceItems type="array"></AudienceItems>
  </audience>
  <_T_>dataSet</_T_>
  <scriptid type="null"></scriptid>
  <name>seggev test unknown</name>
  <applicationId type="null"></applicationId>
  <baseRecord type="null"></baseRecord>
  <columns type="array"></columns>
  <criteria type="null"></criteria>
  <description type="null"></description>
  <formulas type="array"></formulas>
  <id type="null"></id>
  <ownerId type="null"></ownerId>
  <version type="null"></version>
</root>
`

// types check
const typesDefinition = `
<root>
<A>1</A>
<B type="string">1</B>
<C type="array">
  <_ITEM_>2</_ITEM_>
</C>
<D type="boolean">true</D>
<E type="null"/>
</root>
`
const typesValue = {
  name: 'seggev test types',
  scriptid: 'seggevTestTypes',
  definition: typesDefinition,
}
export const typesWorkbook = new InstanceElement('seggev types', workbook, typesValue, [
  constants.NETSUITE,
  constants.WORKBOOK,
])
export const parsedTypesWorkbook = {
  name: typesValue.name,
  scriptid: typesValue.scriptid,
  A: 1,
  B: '1',
  C: [2],
  D: true,
}

const emptyAnalyticValue = {
  scriptid: 'seggevTestEmpty',
}
export const emptyDataset = new InstanceElement('seggev empty', dataset, emptyAnalyticValue, [
  constants.NETSUITE,
  constants.DATASET,
])
export const emptyWorkbook = new InstanceElement('seggev empty', workbook, emptyAnalyticValue, [
  constants.NETSUITE,
  constants.WORKBOOK,
])

export const emptyDatasetDefinition =
  '<root>\n  <_T_>dataSet</_T_>\n  <scriptid type="null"></scriptid>\n  <applicationId type="null"></applicationId>\n  <audience type="null"></audience>\n  <baseRecord type="null"></baseRecord>\n  <columns type="array"></columns>\n  <criteria type="null"></criteria>\n  <description type="null"></description>\n  <formulas type="array"></formulas>\n  <id type="null"></id>\n  <ownerId type="null"></ownerId>\n  <version type="null"></version>\n</root>\n'

export const basicDatasetDefinition = `<root>
  <audience>
    <isPublic type="boolean">false</isPublic>
    <AudienceItems type="array"></AudienceItems>
  </audience>
  <baseRecord>
    <id>account</id>
    <label>Account</label>
  </baseRecord>
  <columns type="array">
    <_ITEM_>
      <columnId>5</columnId>
      <field>
        <_T_>fieldReference</_T_>
        <id>id</id>
        <label>Internal ID</label>
        <joinTrail>
          <baseRecord>
            <id>account</id>
            <label>Account</label>
          </baseRecord>
          <joins type="array"></joins>
        </joinTrail>
        <uniqueId>id</uniqueId>
      </field>
      <alias>id</alias>
      <label type="null"></label>
    </_ITEM_>
    <_ITEM_>
      <columnId>6</columnId>
      <field>
        <_T_>fieldReference</_T_>
        <id>id</id>
        <label>Internal ID</label>
        <joinTrail>
          <baseRecord>
            <id>account</id>
            <label>Account</label>
          </baseRecord>
          <joins type="array"></joins>
        </joinTrail>
        <uniqueId>id</uniqueId>
      </field>
      <alias>id</alias>
      <label type="null"></label>
    </_ITEM_>
  </columns>
  <criteria>
    <_T_>condition</_T_>
    <operator>
      <code>AND</code>
    </operator>
    <targetFieldContext>
      <name>DEFAULT</name>
    </targetFieldContext>
    <children type="array"></children>
    <meta type="null"></meta>
    <field type="null"></field>
    <fieldStateName type="null"></fieldStateName>
  </criteria>
  <ownerId>5</ownerId>
  <version type="string">0.1</version>
  <_T_>dataSet</_T_>
  <scriptid type="null"></scriptid>
  <name>seggev test basic</name>
  <applicationId type="null"></applicationId>
  <description type="null"></description>
  <formulas type="array"></formulas>
  <id type="null"></id>
</root>
`
export const emptyWorkbookDefinition = `<root>
  <scriptid type="null"></scriptid>
  <charts type="array"></charts>
  <datasetLinks type="array"></datasetLinks>
  <dataViews type="array"></dataViews>
  <pivots type="array"></pivots>
  <Workbook type="null"></Workbook>
</root>
`

const custcollectiontranslations_tableValue = {
  scriptid: 'custcollectiontranslations_tableValue',
  defaultlanguage: 'en-US',
  name: 'table name',
  strings: {
    string: {
      tableview_name: {
        scriptid: 'tableview_name',
        defaulttranslation: 'Table 1',
        description: 'Name in tableView',
        index: 0,
      },
    },
  },
}

const custcollectiontranslations_table = new InstanceElement(
  'custcollectiontranslations_tableValue',
  translationcollectionType().type,
  custcollectiontranslations_tableValue,
  [constants.NETSUITE, constants.TRANSLATION_COLLECTION],
)

export const workbookDependencies = {
  dependency: new ReferenceExpression(
    custcollectiontranslations_table.elemID.createNestedID('strings', 'string', 'tableview_name', 'scriptid'),
    _.get(custcollectiontranslations_table, ['strings', 'string', 'tableview_name', 'scriptid']),
    custcollectiontranslations_table.clone(),
  ),
}

export const parsedBasicWorkbookValue = {
  scriptid: 'custworkbook_basic',
  name: {
    '#text': '[scriptid=name]',
  },
  dependencies: workbookDependencies,
  Workbook: {
    version: '1.1.1',
    name: {
      translationScriptId: 'seggev basic workbook name',
    },
    audience: {
      isPublic: false,
    },
    ownerId: 5,
    dataViewIDs: ['custview72_16951029801843995215'],
  },
  dataViews: [
    {
      dataView: {
        id: 'string',
        scriptId: 'custview72_16951029801843995215',
        version: '1.2021.2',
        name: {
          translationScriptId: 'name_of_the_table',
        },
        workbook: 'custworkbook_basic',
        datasets: ['stddatasetMyTransactionsDataSet'],
        columns: [
          {
            datasetScriptId: 'stddatasetMyTransactionsDataSet',
            dataSetColumnId: 10,
            targetFieldContext: {
              name: 'DISPLAY',
            },
            fieldStateName: 'display',
          },
        ],
        order: 0,
      },
    },
  ],
}
export const parsedBasicWorkbook = new InstanceElement(
  'seggev parsed basic workbook',
  workbook,
  parsedBasicWorkbookValue,
  [constants.NETSUITE, constants.WORKBOOK],
)

export const basicWorkbookDefinition = `<root>
  <dataViews type="array">
    <_ITEM_>
      <_T_>dataView</_T_>
      <id>string</id>
      <scriptId>custview72_16951029801843995215</scriptId>
      <version>1.2021.2</version>
      <name>
        <translationScriptId>name_of_the_table</translationScriptId>
      </name>
      <workbook>custworkbook_basic</workbook>
      <datasets type="array">
        <_ITEM_>stddatasetMyTransactionsDataSet</_ITEM_>
      </datasets>
      <columns type="array">
        <_ITEM_>
          <datasetScriptId>stddatasetMyTransactionsDataSet</datasetScriptId>
          <dataSetColumnId>10</dataSetColumnId>
          <targetFieldContext>
            <name>DISPLAY</name>
          </targetFieldContext>
          <fieldStateName>display</fieldStateName>
          <conditionalFormat type="array"></conditionalFormat>
          <criterion type="null"></criterion>
          <customLabel type="null"></customLabel>
          <sorting type="null"></sorting>
          <width type="null"></width>
        </_ITEM_>
      </columns>
      <order>0</order>
      <applicationId type="null"></applicationId>
    </_ITEM_>
  </dataViews>
  <Workbook>
    <version>1.1.1</version>
    <name>
      <translationScriptId>seggev basic workbook name</translationScriptId>
    </name>
    <audience>
      <isPublic type="boolean">false</isPublic>
      <AudienceItems type="array"></AudienceItems>
    </audience>
    <ownerId>5</ownerId>
    <dataViewIDs type="array">
      <_ITEM_>custview72_16951029801843995215</_ITEM_>
    </dataViewIDs>
    <_T_>workbook</_T_>
    <id type="null"></id>
    <scriptId type="null"></scriptId>
    <applicationId type="null"></applicationId>
    <description type="null"></description>
    <pivotIDs type="array"></pivotIDs>
    <chartIDs type="array"></chartIDs>
  </Workbook>
  <scriptid type="null"></scriptid>
  <name>
    <translationScriptId>name</translationScriptId>
  </name>
  <charts type="array"></charts>
  <datasetLinks type="array"></datasetLinks>
  <pivots type="array"></pivots>
</root>
`
const basicWorkbookValue = {
  scriptid: 'custworkbook_basic',
  name: {
    '#text': '[scriptid=name]',
  },
  dependencies: workbookDependencies,
  definition: basicWorkbookDefinition,
  tables: {
    table: {
      custview72_16951029801843995215: {
        scriptid: 'custview72_16951029801843995215',
        index: 0,
      },
    },
  },
}

export const basicWorkbook = new InstanceElement('seggev basic workbook', workbook, basicWorkbookValue, [
  constants.NETSUITE,
  constants.WORKBOOK,
])

const parsedDatasetWithDefaultCompletionValue = {
  name: 'default test',
  scriptid: 'default_test',
  criteria: {
    condition: {
      operator: {},
      targetFieldContext: {},
    },
  },
}

export const parsedDatasetWithDefaultCompletion = new InstanceElement(
  'seggev parsed default dataset',
  dataset,
  parsedDatasetWithDefaultCompletionValue,
  [constants.NETSUITE, constants.DATASET],
)

export const defaultValuesDatasetDefinition = `<root>
  <criteria>
    <_T_>condition</_T_>
    <operator>
      <code>AND</code>
    </operator>
    <targetFieldContext>
      <name>DEFAULT</name>
    </targetFieldContext>
    <children type="array"></children>
    <meta type="null"></meta>
    <field type="null"></field>
    <fieldStateName type="null"></fieldStateName>
  </criteria>
  <_T_>dataSet</_T_>
  <scriptid type="null"></scriptid>
  <name>default test</name>
  <applicationId type="null"></applicationId>
  <audience type="null"></audience>
  <baseRecord type="null"></baseRecord>
  <columns type="array"></columns>
  <description type="null"></description>
  <formulas type="array"></formulas>
  <id type="null"></id>
  <ownerId type="null"></ownerId>
  <version type="null"></version>
</root>
`

const parsedWorkbookWithArraysValue = {
  name: 'arrays test',
  scriptid: 'custworkbook_with_arrays',
  [DATA_VIEWS]: [
    {
      dataView: {
        scriptId: '1',
      },
    },
    {
      dataView: {
        scriptId: 2,
      },
    },
  ],
  [PIVOTS]: [
    {
      pivot: {
        scriptId: '4',
        datasets: ['a', 'b'],
        definition:
          '<root><version>1</version><columnAxis><dimensionTree><_T_>dataDimension</_T_><id>6</id><children type="array"><_ITEM_><ref>3</ref></_ITEM_></children><items type="array"><_ITEM_><id>2</id><expression><function>field</function><args><type><_T_>textType</_T_></type><dataSourceId>custdataset_dilly_1</dataSourceId><fieldId>displaynamewithhierarchy</fieldId></args></expression></_ITEM_></items></dimensionTree><uiSettings><headerAlwaysVisible type="boolean">true</headerAlwaysVisible></uiSettings></columnAxis><rowAxis><dimensionTree><_T_>section</_T_><id>5</id><children type="array"><_ITEM_><_T_>dataDimension</_T_><id>4</id><items type="array"><_ITEM_><id>1</id><expression><function>field</function><args><type><_T_>textType</_T_></type><dataSourceId>custdataset_dilly_1</dataSourceId><fieldId>description</fieldId></args></expression></_ITEM_></items></_ITEM_></children></dimensionTree></rowAxis><measures type="array"><_ITEM_><_T_>dataMeasure</_T_><id>3</id><aggregation>count</aggregation><expression><function>field</function><args><type><_T_>recordType</_T_><id>record_accttype</id></type><dataSourceId>custdataset_dilly_1</dataSourceId><fieldId>accttype</fieldId></args></expression></_ITEM_></measures></root>',
      },
    },
  ],
  Workbook: {
    [DATA_VIEW_IDS]: ['1', 2],
    [PIVOT_IDS]: ['3'],
  },
}

export const tablesArray = [{ [constants.SCRIPT_ID]: '1' }]
export const pivotArray = [{ [constants.SCRIPT_ID]: '3' }]
export const parsedWorkbookWithArrays = new InstanceElement(
  'custworkbook_with_arrays',
  workbook,
  parsedWorkbookWithArraysValue,
  [constants.NETSUITE, constants.WORKBOOK],
)

export const definitionWithArrays = `<root>
  <dataViews type="array">
    <_ITEM_>
      <_T_>dataView</_T_>
      <scriptId type="string">1</scriptId>
      <id type="null"></id>
      <applicationId type="null"></applicationId>
      <version type="null"></version>
      <name type="null"></name>
      <workbook type="null"></workbook>
      <datasets type="array"></datasets>
      <columns type="array"></columns>
      <order type="null"></order>
    </_ITEM_>
    <_ITEM_>
      <_T_>dataView</_T_>
      <scriptId>2</scriptId>
      <id type="null"></id>
      <applicationId type="null"></applicationId>
      <version type="null"></version>
      <name type="null"></name>
      <workbook type="null"></workbook>
      <datasets type="array"></datasets>
      <columns type="array"></columns>
      <order type="null"></order>
    </_ITEM_>
  </dataViews>
  <pivots type="array">
    <_ITEM_>
      <_T_>pivot</_T_>
      <scriptId type="string">4</scriptId>
      <datasets type="array">
        <_ITEM_>a</_ITEM_>
        <_ITEM_>b</_ITEM_>
      </datasets>
      <definition>&#x3C;root&#x3E;&#x3C;version&#x3E;1&#x3C;/version&#x3E;&#x3C;columnAxis&#x3E;&#x3C;dimensionTree&#x3E;&#x3C;_T_&#x3E;dataDimension&#x3C;/_T_&#x3E;&#x3C;id&#x3E;6&#x3C;/id&#x3E;&#x3C;children type=&#x22;array&#x22;&#x3E;&#x3C;_ITEM_&#x3E;&#x3C;ref&#x3E;3&#x3C;/ref&#x3E;&#x3C;/_ITEM_&#x3E;&#x3C;/children&#x3E;&#x3C;items type=&#x22;array&#x22;&#x3E;&#x3C;_ITEM_&#x3E;&#x3C;id&#x3E;2&#x3C;/id&#x3E;&#x3C;expression&#x3E;&#x3C;function&#x3E;field&#x3C;/function&#x3E;&#x3C;args&#x3E;&#x3C;type&#x3E;&#x3C;_T_&#x3E;textType&#x3C;/_T_&#x3E;&#x3C;/type&#x3E;&#x3C;dataSourceId&#x3E;custdataset_dilly_1&#x3C;/dataSourceId&#x3E;&#x3C;fieldId&#x3E;displaynamewithhierarchy&#x3C;/fieldId&#x3E;&#x3C;/args&#x3E;&#x3C;/expression&#x3E;&#x3C;/_ITEM_&#x3E;&#x3C;/items&#x3E;&#x3C;/dimensionTree&#x3E;&#x3C;uiSettings&#x3E;&#x3C;headerAlwaysVisible type=&#x22;boolean&#x22;&#x3E;true&#x3C;/headerAlwaysVisible&#x3E;&#x3C;/uiSettings&#x3E;&#x3C;/columnAxis&#x3E;&#x3C;rowAxis&#x3E;&#x3C;dimensionTree&#x3E;&#x3C;_T_&#x3E;section&#x3C;/_T_&#x3E;&#x3C;id&#x3E;5&#x3C;/id&#x3E;&#x3C;children type=&#x22;array&#x22;&#x3E;&#x3C;_ITEM_&#x3E;&#x3C;_T_&#x3E;dataDimension&#x3C;/_T_&#x3E;&#x3C;id&#x3E;4&#x3C;/id&#x3E;&#x3C;items type=&#x22;array&#x22;&#x3E;&#x3C;_ITEM_&#x3E;&#x3C;id&#x3E;1&#x3C;/id&#x3E;&#x3C;expression&#x3E;&#x3C;function&#x3E;field&#x3C;/function&#x3E;&#x3C;args&#x3E;&#x3C;type&#x3E;&#x3C;_T_&#x3E;textType&#x3C;/_T_&#x3E;&#x3C;/type&#x3E;&#x3C;dataSourceId&#x3E;custdataset_dilly_1&#x3C;/dataSourceId&#x3E;&#x3C;fieldId&#x3E;description&#x3C;/fieldId&#x3E;&#x3C;/args&#x3E;&#x3C;/expression&#x3E;&#x3C;/_ITEM_&#x3E;&#x3C;/items&#x3E;&#x3C;/_ITEM_&#x3E;&#x3C;/children&#x3E;&#x3C;/dimensionTree&#x3E;&#x3C;/rowAxis&#x3E;&#x3C;measures type=&#x22;array&#x22;&#x3E;&#x3C;_ITEM_&#x3E;&#x3C;_T_&#x3E;dataMeasure&#x3C;/_T_&#x3E;&#x3C;id&#x3E;3&#x3C;/id&#x3E;&#x3C;aggregation&#x3E;count&#x3C;/aggregation&#x3E;&#x3C;expression&#x3E;&#x3C;function&#x3E;field&#x3C;/function&#x3E;&#x3C;args&#x3E;&#x3C;type&#x3E;&#x3C;_T_&#x3E;recordType&#x3C;/_T_&#x3E;&#x3C;id&#x3E;record_accttype&#x3C;/id&#x3E;&#x3C;/type&#x3E;&#x3C;dataSourceId&#x3E;custdataset_dilly_1&#x3C;/dataSourceId&#x3E;&#x3C;fieldId&#x3E;accttype&#x3C;/fieldId&#x3E;&#x3C;/args&#x3E;&#x3C;/expression&#x3E;&#x3C;/_ITEM_&#x3E;&#x3C;/measures&#x3E;&#x3C;/root&#x3E;</definition>
      <id type="null"></id>
      <applicationId type="null"></applicationId>
      <version type="null"></version>
      <name type="null"></name>
      <workbook type="null"></workbook>
      <format type="null"></format>
      <order type="null"></order>
    </_ITEM_>
  </pivots>
  <Workbook>
    <dataViewIDs type="array">
      <_ITEM_ type="string">1</_ITEM_>
      <_ITEM_>2</_ITEM_>
    </dataViewIDs>
    <pivotIDs type="array">
      <_ITEM_ type="string">3</_ITEM_>
    </pivotIDs>
    <_T_>workbook</_T_>
    <id type="null"></id>
    <scriptId type="null"></scriptId>
    <applicationId type="null"></applicationId>
    <version type="null"></version>
    <name type="null"></name>
    <audience type="null"></audience>
    <ownerId type="null"></ownerId>
    <description type="null"></description>
    <chartIDs type="array"></chartIDs>
  </Workbook>
  <scriptid type="null"></scriptid>
  <name>arrays test</name>
  <charts type="array"></charts>
  <datasetLinks type="array"></datasetLinks>
</root>
`

const newDefinitionWithArrays = `<root>
  <dataViews type="array">
    <_ITEM_>
      <_T_>dataView</_T_>
      <scriptId type="string">1</scriptId>
      <id type="null"></id>
      <applicationId type="null"></applicationId>
      <version type="null"></version>
      <name type="null"></name>
      <workbook type="null"></workbook>
      <datasets type="array"></datasets>
      <columns type="array"></columns>
      <order type="null"></order>
    </_ITEM_>
    <_ITEM_>
      <_T_>dataView</_T_>
      <scriptId>2</scriptId>
      <id type="null"></id>
      <applicationId type="null"></applicationId>
      <version type="null"></version>
      <name type="null"></name>
      <workbook type="null"></workbook>
      <datasets type="array"></datasets>
      <columns type="array"></columns>
      <order type="null"></order>
    </_ITEM_>
  </dataViews>
  <pivots type="array">
    <_ITEM_>
      <_T_>pivot</_T_>
      <scriptId type="string">4</scriptId>
      <datasets type="array">
        <_ITEM_>b</_ITEM_>
        <_ITEM_>a</_ITEM_>
      </datasets>
      <id type="null"></id>
      <applicationId type="null"></applicationId>
      <version type="null"></version>
      <name type="null"></name>
      <workbook type="null"></workbook>
      <format type="null"></format>
      <order type="null"></order>
      <definition>&lt;root>&lt;version>1&lt;/version>&lt;rowAxis>&lt;dimensionTree>&lt;_T_>section&lt;/_T_>&lt;id>5&lt;/id>&lt;children type="array">&lt;_ITEM_>&lt;_T_>dataDimension&lt;/_T_>&lt;id>4&lt;/id>&lt;items type="array">&lt;_ITEM_>&lt;id>1&lt;/id>&lt;expression>&lt;function>field&lt;/function>&lt;args>&lt;type>&lt;_T_>textType&lt;/_T_>&lt;/type>&lt;dataSourceId>custdataset_dilly_1&lt;/dataSourceId>&lt;fieldId>description&lt;/fieldId>&lt;/args>&lt;/expression>&lt;/_ITEM_>&lt;/items>&lt;/_ITEM_>&lt;/children>&lt;/dimensionTree>&lt;/rowAxis>&lt;columnAxis>&lt;dimensionTree>&lt;_T_>dataDimension&lt;/_T_>&lt;id>6&lt;/id>&lt;children type="array">&lt;_ITEM_>&lt;ref>3&lt;/ref>&lt;/_ITEM_>&lt;/children>&lt;items type="array">&lt;_ITEM_>&lt;id>2&lt;/id>&lt;expression>&lt;function>field&lt;/function>&lt;args>&lt;type>&lt;_T_>textType&lt;/_T_>&lt;/type>&lt;dataSourceId>custdataset_dilly_1&lt;/dataSourceId>&lt;fieldId>displaynamewithhierarchy&lt;/fieldId>&lt;/args>&lt;/expression>&lt;/_ITEM_>&lt;/items>&lt;/dimensionTree>&lt;uiSettings>&lt;headerAlwaysVisible type="boolean">true&lt;/headerAlwaysVisible>&lt;/uiSettings>&lt;/columnAxis>&lt;measures type="array">&lt;_ITEM_>&lt;_T_>dataMeasure&lt;/_T_>&lt;id>3&lt;/id>&lt;aggregation>count&lt;/aggregation>&lt;expression>&lt;function>field&lt;/function>&lt;args>&lt;type>&lt;_T_>recordType&lt;/_T_>&lt;id>record_accttype&lt;/id>&lt;/type>&lt;dataSourceId>custdataset_dilly_1&lt;/dataSourceId>&lt;fieldId>accttype&lt;/fieldId>&lt;/args>&lt;/expression>&lt;/_ITEM_>&lt;/measures>&lt;/root></definition>
    </_ITEM_>
  </pivots>
  <Workbook>
    <dataViewIDs type="array">
      <_ITEM_ type="string">1</_ITEM_>
      <_ITEM_>2</_ITEM_>
    </dataViewIDs>
    <pivotIDs type="array">
      <_ITEM_ type="string">3</_ITEM_>
    </pivotIDs>
    <_T_>workbook</_T_>
    <id type="null"></id>
    <scriptId type="null"></scriptId>
    <applicationId type="null"></applicationId>
    <version type="null"></version>
    <name type="null"></name>
    <audience type="null"></audience>
    <ownerId type="null"></ownerId>
    <description type="null"></description>
    <chartIDs type="array"></chartIDs>
  </Workbook>
  <scriptid type="null"></scriptid>
  <name>arrays test</name>
  <charts type="array"></charts>
  <datasetLinks type="array"></datasetLinks>
</root>
`

const newWorkbookWithArraysValue = {
  scriptid: 'custworkbook_with_arrays',
  name: {
    '#text': '[scriptid=name]',
  },
  definition: newDefinitionWithArrays,
}

export const newWorkbookWithArrays = new InstanceElement(
  'custworkbook_with_arrays',
  workbook,
  newWorkbookWithArraysValue,
  [constants.NETSUITE, constants.WORKBOOK],
)
