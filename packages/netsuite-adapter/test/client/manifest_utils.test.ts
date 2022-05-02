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
import { WORKFLOW } from '../../src/constants'
import { fixManifest } from '../../src/client/manifest_utils'
import { CustomizationInfo } from '../../src/client/types'

const DEFAULT_ADDITIONAL_DEPS = {
  include: { features: [], objects: [] },
  exclude: { features: [], objects: [] },
}

describe('manifest.xml utils', () => {
  const custInfos: CustomizationInfo[] = [
    {
      typeName: 'someType',
      values: {
        '@_scriptid': 'scriptid1',
        key: '__STDRECORDSUBSIDIARYDEFAULTACCTCORPCARDEXP__',
        ref: '[scriptid=somescriptid]',
      },
    },
    {
      typeName: WORKFLOW,
      values: {
        '@_scriptid': 'workflow1',
        key: '__STDRECORDSUBSIDIARYDEFAULTACCTCORPCARDEXP__',
        ref: '[scriptid=secondscriptid]',
        ref2: '[scriptid=scriptid1]',
        ref3: '[scriptid=workflow1.innerscriptid]',
        ref4: '[appid=com.salto, scriptid=external_script_id]',
        fileRef: '[/SuiteScripts/test.js]',
      },
    },
  ]

  it('should return with no dependencies tag', () => {
    const manifest = `<manifest projecttype="ACCOUNTCUSTOMIZATION">
<projectname>TempSdfProject-56067b34-18db-4372-a35b-e2ed2c3aaeb3</projectname>
<frameworkversion>1.0</frameworkversion>
</manifest>`
    expect(fixManifest(manifest, custInfos, DEFAULT_ADDITIONAL_DEPS)).toEqual(manifest)
  })
  it('should fix empty dependencies tag', () => {
    const manifest = `<manifest projecttype="ACCOUNTCUSTOMIZATION">
<projectname>TempSdfProject-56067b34-18db-4372-a35b-e2ed2c3aaeb3</projectname>
<frameworkversion>1.0</frameworkversion>
<dependencies>
  <files>
    <file>/SuiteScripts/clientScript_2_0.js</file>
  </files>
</dependencies>
</manifest>`
    const fixedManifest = `<manifest projecttype="ACCOUNTCUSTOMIZATION">
<projectname>TempSdfProject-56067b34-18db-4372-a35b-e2ed2c3aaeb3</projectname>
<frameworkversion>1.0</frameworkversion>
<dependencies>
  <files>
    <file>/SuiteScripts/clientScript_2_0.js</file>
  </files>
  <features>
    <feature required="true">EXPREPORTS</feature>
  </features>
  <objects>
    <object>somescriptid</object>
    <object>secondscriptid</object>
  </objects>
</dependencies>
</manifest>`
    expect(fixManifest(manifest, custInfos, DEFAULT_ADDITIONAL_DEPS)).toEqual(fixedManifest)
  })
  it('should remove invalid dependencies', () => {
    const manifest = `<manifest projecttype="ACCOUNTCUSTOMIZATION">
<projectname>TempSdfProject-56067b34-18db-4372-a35b-e2ed2c3aaeb3</projectname>
<frameworkversion>1.0</frameworkversion>
<dependencies>
  <features>
    <feature required="true">ADVANCEDEXPENSEMANAGEMENT</feature>
    <feature required="true">SFA</feature>
    <feature required="true">MULTICURRENCYVENDOR</feature>
    <feature required="true">ACCOUNTING</feature>
    <feature required="true">SUBSCRIPTIONBILLING</feature>
    <feature required="true">ADDRESSCUSTOMIZATION</feature>
    <feature required="true">WMSSYSTEM</feature>
    <feature required="true">SUBSIDIARIES</feature>
    <feature required="true">RECEIVABLES</feature>
    <feature required="true">BILLINGACCOUNTS</feature>
  </features>
  <objects>
    <object>custentity2edited</object>
    <object>custentity13</object>
    <object>custentity_14</object>
    <object>custentity10</object>
    <object>custentitycust_active</object>
    <object>custentity11</object>
    <object>custentity_slt_tax_reg</object>
  </objects>
  <files>
    <file>/SuiteScripts/clientScript_2_0.js</file>
  </files>
</dependencies>
</manifest>`
    const fixedManifest = `<manifest projecttype="ACCOUNTCUSTOMIZATION">
<projectname>TempSdfProject-56067b34-18db-4372-a35b-e2ed2c3aaeb3</projectname>
<frameworkversion>1.0</frameworkversion>
<dependencies>
  <features>
    <feature required="true">SFA</feature>
    <feature required="true">MULTICURRENCYVENDOR</feature>
    <feature required="true">ACCOUNTING</feature>
    <feature required="true">ADDRESSCUSTOMIZATION</feature>
    <feature required="true">SUBSIDIARIES</feature>
    <feature required="true">RECEIVABLES</feature>
  </features>
  <objects>
    <object>custentity2edited</object>
    <object>custentity13</object>
    <object>custentity_14</object>
    <object>custentity10</object>
    <object>custentitycust_active</object>
    <object>custentity11</object>
    <object>custentity_slt_tax_reg</object>
  </objects>
  <files>
    <file>/SuiteScripts/clientScript_2_0.js</file>
  </files>
</dependencies>
</manifest>`
    expect(fixManifest(manifest, [], DEFAULT_ADDITIONAL_DEPS))
      .toEqual(fixedManifest)
  })
  it('should add required dependencies to manifest.xml', () => {
    const manifest = `<manifest projecttype="ACCOUNTCUSTOMIZATION">
<projectname>TempSdfProject-56067b34-18db-4372-a35b-e2ed2c3aaeb3</projectname>
<frameworkversion>1.0</frameworkversion>
<dependencies>
  <features>
    <feature required="true">ADVANCEDEXPENSEMANAGEMENT</feature>
    <feature required="true">SFA</feature>
    <feature required="true">MULTICURRENCYVENDOR</feature>
    <feature required="true">ACCOUNTING</feature>
    <feature required="true">SUBSCRIPTIONBILLING</feature>
    <feature required="true">ADDRESSCUSTOMIZATION</feature>
    <feature required="true">WMSSYSTEM</feature>
    <feature required="true">SUBSIDIARIES</feature>
    <feature required="true">RECEIVABLES</feature>
    <feature required="true">BILLINGACCOUNTS</feature>
  </features>
  <objects>
    <object>custentity2edited</object>
    <object>custentity13</object>
    <object>custentity_14</object>
    <object>custentity10</object>
    <object>custentitycust_active</object>
    <object>custentity11</object>
    <object>custentity_slt_tax_reg</object>
  </objects>
  <files>
    <file>/SuiteScripts/clientScript_2_0.js</file>
  </files>
</dependencies>
</manifest>`
    const fixedManifest = `<manifest projecttype="ACCOUNTCUSTOMIZATION">
<projectname>TempSdfProject-56067b34-18db-4372-a35b-e2ed2c3aaeb3</projectname>
<frameworkversion>1.0</frameworkversion>
<dependencies>
  <features>
    <feature required="true">SFA</feature>
    <feature required="true">MULTICURRENCYVENDOR</feature>
    <feature required="true">ACCOUNTING</feature>
    <feature required="true">ADDRESSCUSTOMIZATION</feature>
    <feature required="true">SUBSIDIARIES</feature>
    <feature required="true">RECEIVABLES</feature>
    <feature required="true">EXPREPORTS</feature>
  </features>
  <objects>
    <object>custentity2edited</object>
    <object>custentity13</object>
    <object>custentity_14</object>
    <object>custentity10</object>
    <object>custentitycust_active</object>
    <object>custentity11</object>
    <object>custentity_slt_tax_reg</object>
    <object>somescriptid</object>
    <object>secondscriptid</object>
  </objects>
  <files>
    <file>/SuiteScripts/clientScript_2_0.js</file>
  </files>
</dependencies>
</manifest>`
    expect(fixManifest(manifest, custInfos, DEFAULT_ADDITIONAL_DEPS))
      .toEqual(fixedManifest)
  })
  it('should add additional dependencies', () => {
    const manifest = `<manifest projecttype="ACCOUNTCUSTOMIZATION">
<projectname>TempSdfProject-56067b34-18db-4372-a35b-e2ed2c3aaeb3</projectname>
<frameworkversion>1.0</frameworkversion>
<dependencies>
  <features>
    <feature required="true">ADVANCEDEXPENSEMANAGEMENT</feature>
    <feature required="true">SFA</feature>
    <feature required="true">MULTICURRENCYVENDOR</feature>
    <feature required="true">ACCOUNTING</feature>
    <feature required="true">SUBSCRIPTIONBILLING</feature>
    <feature required="true">ADDRESSCUSTOMIZATION</feature>
    <feature required="true">WMSSYSTEM</feature>
    <feature required="true">SUBSIDIARIES</feature>
    <feature required="true">RECEIVABLES</feature>
    <feature required="true">BILLINGACCOUNTS</feature>
  </features>
  <objects>
    <object>custentity2edited</object>
    <object>custentity13</object>
    <object>custentity_14</object>
    <object>custentity10</object>
    <object>custentitycust_active</object>
    <object>custentity11</object>
    <object>custentity_slt_tax_reg</object>
  </objects>
  <files>
    <file>/SuiteScripts/clientScript_2_0.js</file>
  </files>
</dependencies>
</manifest>`
    const fixedManifest = `<manifest projecttype="ACCOUNTCUSTOMIZATION">
<projectname>TempSdfProject-56067b34-18db-4372-a35b-e2ed2c3aaeb3</projectname>
<frameworkversion>1.0</frameworkversion>
<dependencies>
  <features>
    <feature required="true">SFA</feature>
    <feature required="true">MULTICURRENCYVENDOR</feature>
    <feature required="true">ACCOUNTING</feature>
    <feature required="true">ADDRESSCUSTOMIZATION</feature>
    <feature required="true">SUBSIDIARIES</feature>
    <feature required="true">addedFeature</feature>
  </features>
  <objects>
    <object>custentity13</object>
    <object>custentity_14</object>
    <object>custentity10</object>
    <object>custentitycust_active</object>
    <object>custentity11</object>
    <object>custentity_slt_tax_reg</object>
    <object>addedObject</object>
  </objects>
  <files>
    <file>/SuiteScripts/clientScript_2_0.js</file>
  </files>
</dependencies>
</manifest>`
    expect(fixManifest(manifest, [], {
      include: {
        objects: ['addedObject'],
        features: ['addedFeature'],
      },
      exclude: {
        objects: ['custentity2edited'],
        features: ['RECEIVABLES'],
      },
    }))
      .toEqual(fixedManifest)
  })
})
