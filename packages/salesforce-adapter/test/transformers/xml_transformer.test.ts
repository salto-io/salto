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
import jszip from 'jszip'
import {
  BuiltinTypes, ElemID, InstanceElement, ObjectType, ListType, isStaticFile, StaticFile,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { RetrieveResult, FileProperties } from 'jsforce'
import { fromRetrieveResult, toMetadataPackageZip, MetadataValues } from '../../src/transformers/xml_transformer'
import {
  INSTANCE_FULL_NAME_FIELD, METADATA_TYPE, SALESFORCE, ASSIGNMENT_RULES_METADATA_TYPE,
} from '../../src/constants'
import { apiName, metadataType } from '../../src/transformers/transformer'
import { API_VERSION } from '../../src/client/client'
import { createEncodedZipContent } from '../utils'
import { mockFileProperties } from '../connection'


describe('XML Transformer', () => {
  const ASSIGNMENT_RULES_TYPE_ID = new ElemID(SALESFORCE, ASSIGNMENT_RULES_METADATA_TYPE)
  const PACKAGE = 'unpackaged'

  describe('toMetadataPackageZip in creation flow', () => {
    describe('assignment rule', () => {
      const assignmentRulesType = new ObjectType({
        elemID: ASSIGNMENT_RULES_TYPE_ID,
        annotations: {
          [METADATA_TYPE]: 'AssignmentRules',
        },
        fields: {
          str: { type: BuiltinTypes.STRING },
          lst: { type: new ListType(BuiltinTypes.NUMBER) },
          bool: { type: BuiltinTypes.BOOLEAN },
        },
      })
      const assignmentRuleInstance = new InstanceElement(
        'instance',
        assignmentRulesType,
        {
          [INSTANCE_FULL_NAME_FIELD]: 'Instance',
          str: 'val',
          lst: [1, 2],
          bool: true,
        },
      )

      const zip = toMetadataPackageZip(apiName(assignmentRuleInstance),
        metadataType(assignmentRuleInstance), assignmentRuleInstance.value, false)
        .then(buf => jszip.loadAsync(buf as Buffer))

      it('should contain package xml', async () => {
        const packageXml = (await zip).files[`${PACKAGE}/package.xml`]
        expect(packageXml).toBeDefined()
        expect(await packageXml.async('text')).toMatch(
          `<Package>
           <version>47.0</version>
           <types><members>Instance</members><name>AssignmentRules</name></types>
         </Package>`.replace(/>\s+</gs, '><')
        )
      })

      it('should contain instance xml', async () => {
        const instanceXml = (await zip).files[`${PACKAGE}/assignmentRules/Instance.assignmentRules`]
        expect(instanceXml).toBeDefined()
        expect(await instanceXml.async('text')).toMatch(
          `<AssignmentRules>
           <str>val</str>
           <lst>1</lst>
           <lst>2</lst>
           <bool>true</bool>
         </AssignmentRules>`.replace(/>\s+</gs, '><')
        )
      })
    })

    describe('apex class', () => {
      const apexTypeElemID = new ElemID(SALESFORCE, 'ApexClass')
      const apiVersion = 'apiVersion'
      const apexClassType = new ObjectType({
        elemID: apexTypeElemID,
        annotations: {
          [METADATA_TYPE]: 'ApexClass',
        },
        fields: {
          [apiVersion]: { type: BuiltinTypes.NUMBER },
          content: { type: BuiltinTypes.STRING },
        },
      })
      const apexClassInstance = new InstanceElement(
        'instance',
        apexClassType,
        {
          [INSTANCE_FULL_NAME_FIELD]: 'MyApexClass',
          [apiVersion]: 47.0,
          content: 'public class MyApexClass {\n    public void printLog() {\n        System.debug(\'Created\');\n    }\n}',
        },
      )

      const apexClassWithHiddenContentInstance = new InstanceElement(
        'instance',
        apexClassType,
        {
          [INSTANCE_FULL_NAME_FIELD]: 'MyApexClass',
          [apiVersion]: 47.0,
          content: '(hidden)',
        },
      )

      const zip = toMetadataPackageZip(apiName(apexClassInstance), metadataType(apexClassInstance),
        apexClassInstance.value, false)
        .then(buf => jszip.loadAsync(buf as Buffer))

      const zipWithHidden = toMetadataPackageZip(
        apiName(apexClassWithHiddenContentInstance),
        metadataType(apexClassWithHiddenContentInstance),
        apexClassWithHiddenContentInstance.value,
        false,
      )
        .then(buf => jszip.loadAsync(buf as Buffer))

      it('should contain package xml', async () => {
        const packageXml = (await zip).files[`${PACKAGE}/package.xml`]
        expect(packageXml).toBeDefined()
        expect(await packageXml.async('text')).toMatch(
          `<Package>
           <version>47.0</version>
           <types><members>MyApexClass</members><name>ApexClass</name></types>
         </Package>`.replace(/>\s+</gs, '><')
        )
      })

      it('should not fail on hidden content', async () => {
        const instanceXml = (await zipWithHidden).files[`${PACKAGE}/classes/MyApexClass.cls`]
        expect(instanceXml).toBeDefined()
        expect(await instanceXml.async('text'))
          .toMatch('(hidden)')
      })

      it('should contain metadata xml', async () => {
        const instanceXml = (await zip).files[`${PACKAGE}/classes/MyApexClass.cls-meta.xml`]
        expect(instanceXml).toBeDefined()
        expect(await instanceXml.async('text')).toMatch(
          `<ApexClass>
           <apiVersion>47</apiVersion>
         </ApexClass>`.replace(/>\s+</gs, '><')
        )
      })

      it('should contain instance content', async () => {
        const instanceXml = (await zip).files[`${PACKAGE}/classes/MyApexClass.cls`]
        expect(instanceXml).toBeDefined()
        expect(await instanceXml.async('text'))
          .toMatch('public class MyApexClass {\n    public void printLog() {\n        System.debug(\'Created\');\n    }\n}')
      })
    })

    describe('email folder', () => {
      const emailFolderElemID = new ElemID(SALESFORCE, 'EmailFolder')
      const emailFolderType = new ObjectType({
        elemID: emailFolderElemID,
        annotations: {
          [METADATA_TYPE]: 'EmailFolder',
        },
        fields: {
          name: { type: BuiltinTypes.STRING },
        },
      })
      const emailFolderInstance = new InstanceElement(
        'instance',
        emailFolderType,
        {
          [INSTANCE_FULL_NAME_FIELD]: 'MyEmailFolder',
          name: 'Folder Name',
        },
      )

      const zip = toMetadataPackageZip(apiName(emailFolderInstance),
        metadataType(emailFolderInstance), emailFolderInstance.value, false)
        .then(buf => jszip.loadAsync(buf as Buffer))

      it('should contain package xml', async () => {
        const packageXml = (await zip).files[`${PACKAGE}/package.xml`]
        expect(packageXml).toBeDefined()
        expect(await packageXml.async('text')).toMatch(
          `<Package>
           <version>${API_VERSION}</version>
           <types><members>MyEmailFolder</members><name>EmailTemplate</name></types>
         </Package>`.replace(/>\s+</gs, '><')
        )
      })

      it('should contain metadata xml', async () => {
        const instanceXml = (await zip).files[`${PACKAGE}/email/MyEmailFolder-meta.xml`]
        expect(instanceXml).toBeDefined()
        expect(await instanceXml.async('text')).toMatch(
          `<EmailFolder>
           <name>Folder Name</name>
         </EmailFolder>`.replace(/>\s+</gs, '><')
        )
      })
    })

    describe('lightning component bundle', () => {
      const lightningComponentBundleValues = {
        [INSTANCE_FULL_NAME_FIELD]: 'myLightningComponentBundle',
        apiVersion: 47.0,
        lwcResources: {
          lwcResource: [
            {
              source: '// some javascript content',
              filePath: 'lwc/myLightningComponentBundle/myLightningComponentBundle.js',
            },
            {
              source: '// some html content',
              filePath: 'lwc/myLightningComponentBundle/myLightningComponentBundle.html',
            },
          ],
        },
        targetConfigs: {
          targetConfig: [
            {
              objects: [
                {
                  object: 'Contact',
                },
              ],
              // eslint-disable-next-line @typescript-eslint/camelcase
              attr_targets: 'lightning__RecordPage',
            },
            {
              supportedFormFactors: {
                supportedFormFactor: [
                  {
                    // eslint-disable-next-line @typescript-eslint/camelcase
                    attr_type: 'Small',
                  },
                ],
              },
              // eslint-disable-next-line @typescript-eslint/camelcase
              attr_targets: 'lightning__AppPage,lightning__HomePage',
            },
          ],
        },
        targets: {
          target: [
            'lightning__AppPage',
            'lightning__RecordPage',
            'lightning__HomePage',
          ],
        },
      }

      const zip = toMetadataPackageZip('myLightningComponentBundle', 'LightningComponentBundle',
        lightningComponentBundleValues, false)
        .then(buf => jszip.loadAsync(buf as Buffer))

      it('should contain package xml', async () => {
        const packageXml = (await zip).files[`${PACKAGE}/package.xml`]
        expect(packageXml).toBeDefined()
        const actual = await packageXml.async('text')
        expect(actual).toMatch(
          `<Package>
           <version>47.0</version>
           <types><members>myLightningComponentBundle</members><name>LightningComponentBundle</name></types>
         </Package>`.replace(/>\s+</gs, '><')
        )
      })

      it('should contain metadata xml', async () => {
        const instanceXml = (await zip).files[`${PACKAGE}/lwc/myLightningComponentBundle/myLightningComponentBundle.js-meta.xml`]
        expect(instanceXml).toBeDefined()
        const instanceXmlString = await instanceXml.async('text')
        expect(instanceXmlString).toMatch(
          `<LightningComponentBundle>
            <apiVersion>47</apiVersion>
              <targets>
                <target>lightning__AppPage</target>
                <target>lightning__RecordPage</target>
                <target>lightning__HomePage</target>
              </targets>
              <targetConfigs>
                <targetConfig targets="lightning__RecordPage">
                  <objects>
                    <object>Contact</object>
                  </objects>
                </targetConfig>
                    <targetConfig targets="lightning__AppPage,lightning__HomePage">
                        <supportedFormFactors>
                            <supportedFormFactor type="Small"></supportedFormFactor>
                        </supportedFormFactors>
                    </targetConfig>
              </targetConfigs>
            </LightningComponentBundle>`.replace(/>\s+</gs, '><')
        )
      })

      it('should contain javascript content file', async () => {
        const jsContent = (await zip).files[`${PACKAGE}/lwc/myLightningComponentBundle/myLightningComponentBundle.js`]
        expect(jsContent).toBeDefined()
        expect(await jsContent.async('text'))
          .toMatch('// some javascript content')
      })

      it('should contain html content file', async () => {
        const htmlContent = (await zip).files[`${PACKAGE}/lwc/myLightningComponentBundle/myLightningComponentBundle.html`]
        expect(htmlContent).toBeDefined()
        expect(await htmlContent.async('text'))
          .toMatch('// some html content')
      })
    })

    describe('aura definition bundle', () => {
      const auraValues = {
        [INSTANCE_FULL_NAME_FIELD]: 'myAuraDefinitionBundle',
        SVGContent: '// some svg content',
        apiVersion: 47,
        controllerContent: '// some controller content',
        description: 'myAuraDefinitionBundle description',
        designContent: '// some design content',
        documentationContent: '// some documentation content',
        helperContent: '// some helper content',
        markup: '// some markup content',
        rendererContent: '// some renderer content',
        styleContent: '// some style content',
        type: 'Component',
      }

      const zip = toMetadataPackageZip('myAuraDefinitionBundle', 'AuraDefinitionBundle',
        auraValues, false)
        .then(buf => jszip.loadAsync(buf as Buffer))

      it('should contain package xml', async () => {
        const packageXml = (await zip).files[`${PACKAGE}/package.xml`]
        expect(packageXml).toBeDefined()
        const actual = await packageXml.async('text')
        expect(actual).toMatch(
          `<Package>
           <version>47.0</version>
           <types><members>myAuraDefinitionBundle</members><name>AuraDefinitionBundle</name></types>
         </Package>`.replace(/>\s+</gs, '><')
        )
      })

      it('should contain metadata xml', async () => {
        const instanceXml = (await zip).files[`${PACKAGE}/aura/myAuraDefinitionBundle/myAuraDefinitionBundle.cmp-meta.xml`]
        expect(instanceXml).toBeDefined()
        const instanceXmlString = await instanceXml.async('text')
        expect(instanceXmlString).toMatch(
          `<AuraDefinitionBundle>
            <apiVersion>47</apiVersion>
            <description>myAuraDefinitionBundle description</description>
            <type>Component</type>
            </AuraDefinitionBundle>`.replace(/>\s+</gs, '><')
        )
      })

      it('should contain component content file', async () => {
        const jsContent = (await zip).files[`${PACKAGE}/aura/myAuraDefinitionBundle/myAuraDefinitionBundle.cmp`]
        expect(jsContent).toBeDefined()
        expect(await jsContent.async('text'))
          .toMatch('// some markup content')
      })

      it('should contain documentation content file', async () => {
        const jsContent = (await zip).files[`${PACKAGE}/aura/myAuraDefinitionBundle/myAuraDefinitionBundle.auradoc`]
        expect(jsContent).toBeDefined()
        expect(await jsContent.async('text'))
          .toMatch('// some documentation content')
      })

      it('should contain design content file', async () => {
        const jsContent = (await zip).files[`${PACKAGE}/aura/myAuraDefinitionBundle/myAuraDefinitionBundle.design`]
        expect(jsContent).toBeDefined()
        expect(await jsContent.async('text'))
          .toMatch('// some design content')
      })

      it('should contain controller content file', async () => {
        const jsContent = (await zip).files[`${PACKAGE}/aura/myAuraDefinitionBundle/myAuraDefinitionBundleController.js`]
        expect(jsContent).toBeDefined()
        expect(await jsContent.async('text'))
          .toMatch('// some controller content')
      })

      it('should contain svg content file', async () => {
        const jsContent = (await zip).files[`${PACKAGE}/aura/myAuraDefinitionBundle/myAuraDefinitionBundle.svg`]
        expect(jsContent).toBeDefined()
        expect(await jsContent.async('text'))
          .toMatch('// some svg content')
      })

      it('should contain helper content file', async () => {
        const jsContent = (await zip).files[`${PACKAGE}/aura/myAuraDefinitionBundle/myAuraDefinitionBundleHelper.js`]
        expect(jsContent).toBeDefined()
        expect(await jsContent.async('text'))
          .toMatch('// some helper content')
      })

      it('should contain renderer content file', async () => {
        const jsContent = (await zip).files[`${PACKAGE}/aura/myAuraDefinitionBundle/myAuraDefinitionBundleRenderer.js`]
        expect(jsContent).toBeDefined()
        expect(await jsContent.async('text'))
          .toMatch('// some renderer content')
      })

      it('should contain style content file', async () => {
        const jsContent = (await zip).files[`${PACKAGE}/aura/myAuraDefinitionBundle/myAuraDefinitionBundle.css`]
        expect(jsContent).toBeDefined()
        expect(await jsContent.async('text'))
          .toMatch('// some style content')
      })
    })
  })

  describe('toMetadataPackageZip in deletion flow', () => {
    describe('apex class', () => {
      const apexTypeElemID = new ElemID(SALESFORCE, 'ApexClass')
      const apiVersion = 'apiVersion'
      const apexClassType = new ObjectType({
        elemID: apexTypeElemID,
        annotations: {
          [METADATA_TYPE]: 'ApexClass',
        },
        fields: {
          // eslint-disable-next-line @typescript-eslint/camelcase
          [apiVersion]: { type: BuiltinTypes.NUMBER },
          content: { type: BuiltinTypes.STRING },
        },
      })
      const apexClassInstance = new InstanceElement(
        'instance',
        apexClassType,
        {
          [INSTANCE_FULL_NAME_FIELD]: 'MyApexClass',
          [apiVersion]: 47.0,
          content: 'public class MyApexClass {\n    public void printLog() {\n        System.debug(\'Created\');\n    }\n}',
        },
      )

      const zip = toMetadataPackageZip(apiName(apexClassInstance), metadataType(apexClassInstance),
        apexClassInstance.value, true)
        .then(buf => jszip.loadAsync(buf as Buffer))

      it('should contain package xml', async () => {
        const packageXml = (await zip).files[`${PACKAGE}/package.xml`]
        expect(packageXml).toBeDefined()
        expect(await packageXml.async('text')).toMatch(
          `<Package>
           <version>${API_VERSION}</version>
         </Package>`.replace(/>\s+</gs, '><')
        )
      })

      it('should contain destructive changes xml', async () => {
        const packageXml = (await zip).files[`${PACKAGE}/destructiveChanges.xml`]
        expect(packageXml).toBeDefined()
        expect(await packageXml.async('text')).toMatch(
          `<Package>
           <types><members>MyApexClass</members><name>ApexClass</name></types>
         </Package>`.replace(/>\s+</gs, '><')
        )
      })
    })

    describe('email folder', () => {
      const emailFolderElemID = new ElemID(SALESFORCE, 'EmailFolder')
      const emailFolderType = new ObjectType({
        elemID: emailFolderElemID,
        annotations: {
          [METADATA_TYPE]: 'EmailFolder',
        },
        fields: {
          name: { type: BuiltinTypes.STRING },
        },
      })
      const emailFolderInstance = new InstanceElement(
        'instance',
        emailFolderType,
        {
          [INSTANCE_FULL_NAME_FIELD]: 'MyEmailFolder',
          name: 'Folder Name',
        },
      )

      const zip = toMetadataPackageZip(apiName(emailFolderInstance),
        metadataType(emailFolderInstance), emailFolderInstance.value, true)
        .then(buf => jszip.loadAsync(buf as Buffer))

      it('should contain package xml', async () => {
        const packageXml = (await zip).files[`${PACKAGE}/package.xml`]
        expect(packageXml).toBeDefined()
        expect(await packageXml.async('text')).toMatch(
          `<Package>
           <version>${API_VERSION}</version>
         </Package>`.replace(/>\s+</gs, '><')
        )
      })

      it('should contain destructive changes xml', async () => {
        const packageXml = (await zip).files[`${PACKAGE}/destructiveChanges.xml`]
        expect(packageXml).toBeDefined()
        expect(await packageXml.async('text')).toMatch(
          `<Package>
           <types><members>MyEmailFolder</members><name>EmailTemplate</name></types>
         </Package>`.replace(/>\s+</gs, '><')
        )
      })
    })

    describe('lightning component bundle', () => {
      const lightningComponentBundleValues = {
        [INSTANCE_FULL_NAME_FIELD]: 'myLightningComponentBundle',
        apiVersion: 47.0,
        content: 'public class MyApexClass {\n    public void printLog() {\n        System.debug(\'Created\');\n    }\n}',
      }

      const zip = toMetadataPackageZip('myLightningComponentBundle', 'LightningComponentBundle',
        lightningComponentBundleValues, true)
        .then(buf => jszip.loadAsync(buf as Buffer))

      it('should contain package xml', async () => {
        const packageXml = (await zip).files[`${PACKAGE}/package.xml`]
        expect(packageXml).toBeDefined()
        expect(await packageXml.async('text')).toMatch(
          `<Package>
           <version>${API_VERSION}</version>
         </Package>`.replace(/>\s+</gs, '><')
        )
      })

      it('should contain destructive changes xml', async () => {
        const packageXml = (await zip).files[`${PACKAGE}/destructiveChanges.xml`]
        expect(packageXml).toBeDefined()
        expect(await packageXml.async('text')).toMatch(
          `<Package>
           <types><members>myLightningComponentBundle</members><name>LightningComponentBundle</name></types>
         </Package>`.replace(/>\s+</gs, '><')
        )
      })
    })
  })

  describe('fromRetrieveResult', () => {
    const toResultProperties = (requestProperties: FileProperties[]): FileProperties[] => (
      requestProperties.map(props => ({
        ...props,
        fileName: `unpackaged/${props.fileName}`,
      }))
    )
    describe('apex class', () => {
      let retrieveResult: RetrieveResult
      let fileProperties: FileProperties[]
      beforeAll(async () => {
        fileProperties = [mockFileProperties({
          fileName: 'classes/MyApexClass.cls',
          fullName: 'MyApexClass',
          type: 'ApexClass',
        })]
        retrieveResult = {
          fileProperties: toResultProperties(fileProperties),
          id: '09S4J000001dSRcUAM',
          messages: [],
          zipFile: await createEncodedZipContent([
            {
              path: 'unpackaged/classes/MyApexClass.cls-meta.xml',
              content: '<?xml version="1.0" encoding="UTF-8"?>\n'
                + '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">\n'
                + '    <apiVersion>47.0</apiVersion>\n'
                + '    <status>Active</status>\n'
                + '</ApexClass>\n',
            },
            {
              path: 'unpackaged/classes/MyApexClass.cls',
              content: 'public class MyApexClass {\n'
                + '    public void printLog() {\n'
                + '        System.debug(\'Created\');\n'
                + '    }\n'
                + '}',
            },
          ]),
        }
      })

      it('should transform zip to MetadataInfo', async () => {
        const values = await fromRetrieveResult(
          retrieveResult, fileProperties, new Set(['ApexClass']), new Set(['ApexClass']),
        )
        expect(values).toHaveLength(1)
        const [apex] = values
        expect(apex.file).toEqual(fileProperties[0])
        const metadataInfo = apex.values
        expect(metadataInfo.fullName).toEqual('MyApexClass')
        expect(_.get(metadataInfo, 'apiVersion')).toEqual(47)
        expect(_.get(metadataInfo, 'status')).toEqual('Active')
        expect(_.get(metadataInfo, 'content.content').toString())
          .toEqual('public class MyApexClass {\n    public void printLog() {\n        System.debug(\'Created\');\n    }\n}')
      })
    })

    describe('apex class with hidden content', () => {
      let retrieveResult: RetrieveResult
      let fileProperties: FileProperties[]
      beforeAll(async () => {
        fileProperties = [mockFileProperties({
          fileName: 'classes/MyApexClass.cls',
          fullName: 'MyApexClass',
          type: 'ApexClass',
        })]
        retrieveResult = {
          fileProperties: toResultProperties(fileProperties),
          id: '09S4J000001dSRcUAM',
          messages: [],
          zipFile: await createEncodedZipContent([{ path: 'unpackaged/classes/MyApexClass.cls-meta.xml',
            content: '<?xml version="1.0" encoding="UTF-8"?>\n'
              + '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">\n'
              + '    <apiVersion>47.0</apiVersion>\n'
              + '    <status>Active</status>\n'
              + '</ApexClass>\n' }, { path: 'unpackaged/classes/MyApexClass.cls',
            content: '(hidden)' }]),
        }
      })

      it('should transform zip to MetadataInfo', async () => {
        const values = await fromRetrieveResult(
          retrieveResult, fileProperties, new Set(['ApexClass']), new Set(['ApexClass']),
        )
        expect(values).toHaveLength(1)
        const [apex] = values
        expect(apex.file).toEqual(fileProperties[0])
        const metadataInfo = apex.values
        expect(metadataInfo.fullName).toEqual('MyApexClass')
        expect(_.get(metadataInfo, 'apiVersion')).toEqual(47)
        expect(_.get(metadataInfo, 'status')).toEqual('Active')
        expect(_.get(metadataInfo, 'content').toString())
          .toEqual('(hidden)')
      })
    })

    describe('email template & folder', () => {
      let emailTemplate: MetadataValues | undefined
      let emailFolder: MetadataValues | undefined
      beforeAll(async () => {
        const fileProperties = [
          mockFileProperties({
            fileName: 'email/MyFolder/MyEmailTemplate.email',
            fullName: 'MyFolder/MyEmailTemplate',
            type: 'EmailTemplate',
          }),
          mockFileProperties({
            fileName: 'email/MyFolder',
            fullName: 'MyFolder',
            type: 'EmailFolder',
          }),
        ]
        const retrieveResult = {
          fileProperties: toResultProperties(fileProperties).map(
            // Due to a SF quirk we must ask for EmailTemplate type to get folders
            props => ({ ...props, type: 'EmailTemplate' })
          ),
          id: '09S4J000001e2eLUAQ',
          messages: [],
          zipFile: await createEncodedZipContent([{ path: 'unpackaged/email/MyFolder-meta.xml',
            content: '<?xml version="1.0" encoding="UTF-8"?>\n'
              + '<EmailFolder xmlns="http://soap.sforce.com/2006/04/metadata">\n'
              + '    <accessType>Public</accessType>\n'
              + '    <name>My folder</name>\n'
              + '    <publicFolderAccess>ReadWrite</publicFolderAccess>\n'
              + '</EmailFolder>\n' }, { path: 'unpackaged/email/MyFolder/MyEmailTemplate.email-meta.xml',
            content: '<?xml version="1.0" encoding="UTF-8"?>\n'
              + '<EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">\n'
              + '    <available>false</available>\n'
              + '    <encodingKey>ISO-8859-1</encodingKey>\n'
              + '    <name>My Email Template</name>\n'
              + '    <style>none</style>\n'
              + '    <subject>MySubject</subject>\n'
              + '    <type>text</type>\n'
              + '    <uiType>Aloha</uiType>\n'
              + '</EmailTemplate>\n' }, { path: 'unpackaged/email/MyFolder/MyEmailTemplate.email',
            content: 'Email Body' }]),
        }

        const values = await fromRetrieveResult(
          retrieveResult,
          fileProperties,
          new Set(['EmailTemplate', 'EmailFolder']),
          new Set(['EmailTemplate']),
        )
        emailFolder = values.find(value => value.file.type === 'EmailFolder')?.values
        emailTemplate = values.find(value => value.file.type === 'EmailTemplate')?.values
      })

      it('should transform EmailFolder zip to MetadataInfo', async () => {
        expect(emailFolder).toBeDefined()
        expect(emailFolder?.fullName).toEqual('MyFolder')
        expect(emailFolder?.name).toEqual('My folder')
        expect(emailFolder?.accessType).toEqual('Public')
      })

      it('should transform EmailTemplate zip to MetadataInfo', async () => {
        expect(emailTemplate).toBeDefined()
        expect(emailTemplate?.fullName).toEqual('MyFolder/MyEmailTemplate')
        expect(emailTemplate?.name).toEqual('My Email Template')
        expect(emailTemplate?.content.content.toString()).toEqual('Email Body')
      })
    })

    describe('lightning component bundle', () => {
      let retrieveResult: RetrieveResult
      let fileProperties: FileProperties[]
      beforeAll(async () => {
        fileProperties = [mockFileProperties({
          fileName: 'lwc/myLightningComponentBundle',
          fullName: 'myLightningComponentBundle',
          type: 'LightningComponentBundle',
        })]
        retrieveResult = {
          fileProperties: toResultProperties(fileProperties),
          id: '09S4J000001dSRcUAM',
          messages: [],
          zipFile: await createEncodedZipContent([
            {
              path: 'unpackaged/lwc/myLightningComponentBundle/myLightningComponentBundle.js-meta.xml',
              content: '<?xml version="1.0" encoding="UTF-8"?>\n'
              + '<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">\n'
              + '    <apiVersion>47.0</apiVersion>\n'
              + '</LightningComponentBundle>\n',
            },
            {
              path: 'unpackaged/lwc/myLightningComponentBundle/myLightningComponentBundle.js',
              content: '// some javascript content',
            },
            {
              path: 'unpackaged/lwc/myLightningComponentBundle/myLightningComponentBundle.html',
              content: '// some html content',
            },
          ]),
        }
      })

      it('should transform zip to MetadataInfo', async () => {
        const values = await fromRetrieveResult(
          retrieveResult, fileProperties, new Set(), new Set(),
        )
        expect(values).toHaveLength(1)
        const [lwc] = values
        expect(lwc.file).toEqual(fileProperties[0])
        const metadataInfo = lwc.values
        expect(metadataInfo.fullName).toEqual('myLightningComponentBundle')
        expect(_.get(metadataInfo, 'apiVersion')).toEqual(47)
        const jsResource = metadataInfo.lwcResources.lwcResource[0]
        expect(jsResource).toBeDefined()
        expect(isStaticFile(jsResource.source)).toBe(true)
        expect((jsResource.source as StaticFile).content?.toString())
          .toEqual('// some javascript content')
        const htmlResource = metadataInfo.lwcResources.lwcResource[1]
        expect(htmlResource).toBeDefined()
        expect(isStaticFile(htmlResource.source)).toBe(true)
        expect((htmlResource.source as StaticFile).content?.toString())
          .toEqual('// some html content')
      })
    })

    describe('aura definition bundle', () => {
      let retrieveResult: RetrieveResult
      let fileProperties: FileProperties[]
      beforeAll(async () => {
        fileProperties = [mockFileProperties({
          fileName: 'aura/myAuraDefinitionBundle',
          fullName: 'myAuraDefinitionBundle',
          type: 'AuraDefinitionBundle',
        })]
        retrieveResult = {
          fileProperties: toResultProperties(fileProperties),
          id: '09S4J000001dSRcUAM',
          messages: [],
          zipFile: await createEncodedZipContent([
            {
              path: 'unpackaged/aura/myAuraDefinitionBundle/myAuraDefinitionBundle.cmp-meta.xml',
              content: '<?xml version="1.0" encoding="UTF-8"?>\n'
              + '<AuraDefinitionBundle xmlns="http://soap.sforce.com/2006/04/metadata">\n'
              + '    <apiVersion>47.0</apiVersion>\n'
              + '    <description>myAuraDefinitionBundle description</description>\n'
              + '</AuraDefinitionBundle>\n',
            },
            {
              path: 'unpackaged/aura/myAuraDefinitionBundle/myAuraDefinitionBundle.cmp',
              content: '// some component content',
            },
            {
              path: 'unpackaged/aura/myAuraDefinitionBundle/myAuraDefinitionBundleController.js',
              content: '// some controller content',
            },
            {
              path: 'unpackaged/aura/myAuraDefinitionBundle/myAuraDefinitionBundle.design',
              content: '// some design content',
            },
            {
              path: 'unpackaged/aura/myAuraDefinitionBundle/myAuraDefinitionBundle.auradoc',
              content: '// some documentation content',
            },
            {
              path: 'unpackaged/aura/myAuraDefinitionBundle/myAuraDefinitionBundleHelper.js',
              content: '// some helper content',
            },
            {
              path: 'unpackaged/aura/myAuraDefinitionBundle/myAuraDefinitionBundleRenderer.js',
              content: '// some renderer content',
            },
            {
              path: 'unpackaged/aura/myAuraDefinitionBundle/myAuraDefinitionBundle.css',
              content: '// some style content',
            },
            {
              path: 'unpackaged/aura/myAuraDefinitionBundle/myAuraDefinitionBundle.svg',
              content: '// some svg content',
            },
          ]),
        }
      })

      it('should transform zip to MetadataInfo', async () => {
        const values = await fromRetrieveResult(
          retrieveResult, fileProperties, new Set(), new Set(),
        )
        expect(values).toHaveLength(1)
        const [aura] = values
        expect(aura.file).toEqual(fileProperties[0])
        const metadataInfo = aura.values
        expect(metadataInfo.fullName).toEqual('myAuraDefinitionBundle')
        expect(metadataInfo.apiVersion).toEqual(47)
        expect(metadataInfo.type).toEqual('Component')
        expect(isStaticFile(metadataInfo.markup)).toBe(true)
        expect((metadataInfo.markup as StaticFile).content?.toString())
          .toEqual('// some component content')
        expect(isStaticFile(metadataInfo.controllerContent)).toBe(true)
        expect((metadataInfo.controllerContent as StaticFile).content?.toString())
          .toEqual('// some controller content')
        expect(isStaticFile(metadataInfo.designContent)).toBe(true)
        expect((metadataInfo.designContent as StaticFile).content?.toString())
          .toEqual('// some design content')
        expect(isStaticFile(metadataInfo.documentationContent)).toBe(true)
        expect((metadataInfo.documentationContent as StaticFile).content?.toString())
          .toEqual('// some documentation content')
        expect(isStaticFile(metadataInfo.helperContent)).toBe(true)
        expect((metadataInfo.helperContent as StaticFile).content?.toString())
          .toEqual('// some helper content')
        expect(isStaticFile(metadataInfo.rendererContent)).toBe(true)
        expect((metadataInfo.rendererContent as StaticFile).content?.toString())
          .toEqual('// some renderer content')
        expect(isStaticFile(metadataInfo.styleContent)).toBe(true)
        expect((metadataInfo.styleContent as StaticFile).content?.toString())
          .toEqual('// some style content')
        expect(isStaticFile(metadataInfo.SVGContent)).toBe(true)
        expect((metadataInfo.SVGContent as StaticFile).content?.toString())
          .toEqual('// some svg content')
      })
    })
  })
})
