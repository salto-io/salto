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
import osPath from 'path'
import {
  ATTRIBUTES_FILE_SUFFIX,
  ATTRIBUTES_FOLDER_NAME,
  FOLDER_ATTRIBUTES_FILE_SUFFIX,
} from '../../src/client/sdf_parser'

export const MOCK_TEMPLATE_CONTENT = Buffer.from('Template Inner Content')
export const MOCK_FOLDER_PATH = `${osPath.sep}Templates${osPath.sep}E-mail Templates${osPath.sep}InnerFolder`
export const MOCK_FILE_PATH = `${MOCK_FOLDER_PATH}${osPath.sep}content.html`
export const MOCK_FILE_ATTRS_PATH = `${osPath.sep}Templates${osPath.sep}E-mail Templates${osPath.sep}InnerFolder${osPath.sep}${ATTRIBUTES_FOLDER_NAME}${osPath.sep}content.html${ATTRIBUTES_FILE_SUFFIX}`
export const MOCK_FILE_WITHOUT_ATTRIBUTES_PATH = `${MOCK_FOLDER_PATH}${osPath.sep}test.js`
export const MOCK_FOLDER_ATTRS_PATH = `${osPath.sep}Templates${osPath.sep}E-mail Templates${osPath.sep}InnerFolder${osPath.sep}${ATTRIBUTES_FOLDER_NAME}${osPath.sep}${FOLDER_ATTRIBUTES_FILE_SUFFIX}`
export const TIME_DATE_FORMAT = 'YYYY-MM-DD h:mm a'

export const MOCK_MANIFEST_INVALID_DEPENDENCIES = `<manifest projecttype="ACCOUNTCUSTOMIZATION">
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

export const MOCK_MANIFEST_VALID_DEPENDENCIES = `<manifest projecttype="ACCOUNTCUSTOMIZATION">
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
</manifest>
`

export const MOCK_FEATURES_XML =
  '<features><feature><id>SUITEAPPCONTROLCENTER</id><status>ENABLED</status></feature></features>'

export const MOCK_ORIGINAL_DEPLOY_XML = `<deploy>
    <configuration>
        <path>~/AccountConfiguration/*</path>
    </configuration>
    <files>
        <path>~/FileCabinet/*</path>
    </files>
    <objects>
        <path>~/Objects/*</path>
    </objects>
    <translationimports>
        <path>~/Translations/*</path>
    </translationimports>
</deploy>
`

export const OBJECT_XML_WITH_HTML_CHARS =
  '<entitycustomfield scriptid="custentity_my_script_id">' +
  '<label>Golf &#x26; Co&#x2019;Co element&#x200B;Name</label>' +
  '</entitycustomfield>'

export const OBJECTS_DIR_FILES = ['a.xml', 'b.xml', 'a.template.html']

export const readFileMockFunction = (filePath: string): string | Buffer => {
  if (filePath.includes('.template.')) {
    return MOCK_TEMPLATE_CONTENT
  }
  if (filePath.endsWith(MOCK_FILE_PATH)) {
    return 'dummy file content'
  }
  if (filePath.endsWith(MOCK_FILE_ATTRS_PATH)) {
    return '<file><description>file description</description></file>'
  }
  if (filePath.endsWith(MOCK_FOLDER_ATTRS_PATH)) {
    return '<folder><description>folder description</description></folder>'
  }
  if (filePath.endsWith(MOCK_FILE_WITHOUT_ATTRIBUTES_PATH)) {
    return 'console.log("Hello World!")'
  }

  if (filePath.endsWith('manifest.xml')) {
    return MOCK_MANIFEST_INVALID_DEPENDENCIES
  }
  if (filePath.endsWith('/features.xml')) {
    return MOCK_FEATURES_XML
  }
  if (filePath.endsWith('/deploy.xml')) {
    return MOCK_ORIGINAL_DEPLOY_XML
  }
  return `<addressForm filename="${filePath.split('/').pop()}">`
}

export const statMockFunction = (filePath: string): { size: number } => {
  if (filePath.endsWith(MOCK_FILE_PATH)) {
    return { size: 33 }
  }
  return { size: 0 }
}
