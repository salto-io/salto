/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { isStaticFile, StaticFile } from '@salto-io/adapter-api'
import { promises } from '@salto-io/lowerdash'
import _ from 'lodash'
import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'
import { RetrieveResult, FileProperties } from '@salto-io/jsforce'
import {
  fromRetrieveResult,
  createDeployPackage,
  DeployPackage,
  CONTENT_FILENAME_OVERRIDE,
  xmlToValues,
} from '../../src/transformers/xml_transformer'
import { MetadataValues, createInstanceElement } from '../../src/transformers/transformer'
import { API_VERSION } from '../../src/client/client'
import { createEncodedZipContent } from '../utils'
import { mockFileProperties } from '../connection'
import { mockTypes, mockDefaultValues } from '../mock_elements'
import {
  GEN_AI_FUNCTION_METADATA_TYPE,
  LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE,
  XML_ATTRIBUTE_PREFIX,
} from '../../src/constants'
import { FetchProfile } from '../../src/types'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'

describe('XML Transformer', () => {
  let fetchProfile: FetchProfile
  beforeEach(() => {
    fetchProfile = buildFetchProfile({
      fetchParams: {},
    })
  })
  describe('createDeployPackage', () => {
    const xmlParser = new XMLParser()
    const getZipFiles = async (pkg: DeployPackage): Promise<Record<string, string>> => {
      const zip = await JSZip.loadAsync(await pkg.getZip())
      return promises.object.mapValuesAsync(zip.files, zipFile => zipFile.async('string'))
    }

    const packageName = 'unpackaged'
    const addManifestPath = `${packageName}/package.xml`
    const deleteManifestPath = `${packageName}/destructiveChangesPost.xml`
    let pkg: DeployPackage
    let zipFiles: Record<string, string>

    describe('getDeletionsPackageName', () => {
      it('get the right package name when deleteBeforeUpdate is true', () => {
        expect(createDeployPackage(true).getDeletionsPackageName()).toBe('destructiveChanges.xml')
      })

      it('get the right package name when deleteBeforeUpdate is false', () => {
        expect(createDeployPackage(false).getDeletionsPackageName()).toBe('destructiveChangesPost.xml')
      })

      it('get the right package name when deleteBeforeUpdate is undefined', () => {
        expect(createDeployPackage(undefined).getDeletionsPackageName()).toBe('destructiveChangesPost.xml')
      })
    })

    beforeEach(() => {
      pkg = createDeployPackage()
    })

    describe('empty package', () => {
      beforeEach(async () => {
        zipFiles = await getZipFiles(pkg)
      })
      it('should have empty manifest', () => {
        expect(zipFiles).toHaveProperty(
          [addManifestPath],
          `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <version>${API_VERSION}</version>
</Package>
`,
        )
      })
    })

    describe('with simple types', () => {
      const profileValues = {
        fullName: 'TestProfile',
        num: 12,
        str: 'str <&> bla',
        b: true,
      }
      beforeEach(async () => {
        await pkg.add(createInstanceElement({ fullName: 'TestLayout' }, mockTypes.Layout))
        await pkg.add(createInstanceElement({ fullName: 'TestLayout2' }, mockTypes.Layout))
        await pkg.add(createInstanceElement(profileValues, mockTypes.Profile))
        pkg.delete(mockTypes.Profile, 'foo')
        zipFiles = await getZipFiles(pkg)
      })
      it('should have manifest with all added instances', () => {
        expect(zipFiles).toHaveProperty([addManifestPath])
        const manifest = xmlParser.parse(zipFiles[addManifestPath])
        expect(manifest).toHaveProperty('Package.types')
        expect(manifest.Package.types).toContainEqual({
          name: 'Layout',
          members: ['TestLayout', 'TestLayout2'],
        })
        expect(manifest.Package.types).toContainEqual({
          name: 'Profile',
          members: 'TestProfile',
        })
      })
      it('should have manifest with all removed instances', () => {
        expect(zipFiles).toHaveProperty([deleteManifestPath])
        const manifest = xmlParser.parse(zipFiles[deleteManifestPath])
        expect(manifest).toHaveProperty('Package.types')
        expect(manifest.Package.types).toEqual({
          name: 'Profile',
          members: 'foo',
        })
      })
      it('should have xml files for each instance', () => {
        expect(zipFiles).toHaveProperty([`${packageName}/layouts/TestLayout.layout`])
        expect(zipFiles).toHaveProperty([`${packageName}/layouts/TestLayout2.layout`])
        expect(zipFiles).toHaveProperty([`${packageName}/profiles/TestProfile.profile`])
      })
      describe('serialized xml file', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let values: any
        let zipFile: string
        beforeEach(() => {
          zipFile = zipFiles[`${packageName}/profiles/TestProfile.profile`]
          values = xmlParser.parse(zipFile)
        })
        it('should write serialized values to instance xml file', () => {
          expect(values).toMatchObject({
            Profile: _.omit(profileValues, ['fullName', 'str']),
          })
        })
        it('should support special XML characters', () => {
          expect(zipFile).toMatch(/&lt;&amp;&gt;/)
          expect(values.Profile.str).toEqual('str <&> bla')
        })
      })
    })

    describe('with types that have a meta file', () => {
      const apexClassValues = {
        fullName: 'MyClass',
        someVal: 'asd',
        content: Buffer.from('some data'),
      }
      beforeEach(async () => {
        await pkg.add(createInstanceElement(apexClassValues, mockTypes.ApexClass))
        await pkg.add(createInstanceElement({ fullName: 'TestFolder' }, mockTypes.EmailFolder))
        zipFiles = await getZipFiles(pkg)
      })
      describe('for metadata with content', () => {
        it('should put values other than content in meta file', () => {
          const metaFilePath = `${packageName}/classes/MyClass.cls-meta.xml`
          expect(zipFiles).toHaveProperty([metaFilePath])
          const values = xmlParser.parse(zipFiles[metaFilePath])
          expect(values).toMatchObject({
            ApexClass: _.omit(apexClassValues, ['fullName', 'content']),
          })
        })
        it('should put content in its own file', () => {
          expect(zipFiles).toHaveProperty([`${packageName}/classes/MyClass.cls`], apexClassValues.content.toString())
        })
      })
      describe('for folder type', () => {
        it('should appear in manifest under its content type name', () => {
          expect(zipFiles).toHaveProperty([addManifestPath])
          const manifest = xmlParser.parse(zipFiles[addManifestPath])
          expect(manifest).toHaveProperty('Package.types')
          expect(manifest.Package.types).toContainEqual({
            name: 'EmailTemplate',
            members: 'TestFolder',
          })
        })
        it('should write values to meta file', () => {
          expect(zipFiles).toHaveProperty([`${packageName}/email/TestFolder-meta.xml`])
        })
      })
    })

    describe('with complex types', () => {
      describe('AuraDefinitionBundle', () => {
        beforeEach(async () => {
          await pkg.add(createInstanceElement(mockDefaultValues.AuraDefinitionBundle, mockTypes.AuraDefinitionBundle))
          zipFiles = await getZipFiles(pkg)
        })
        it('should contain metadata xml', () => {
          const filePath = `${packageName}/aura/TestAuraDefinitionBundle/TestAuraDefinitionBundle.cmp-meta.xml`
          expect(zipFiles).toHaveProperty([filePath])
          const data = xmlParser.parse(zipFiles[filePath])
          expect(data).toMatchObject({
            AuraDefinitionBundle: _.pick(mockDefaultValues.AuraDefinitionBundle, ['apiVersion', 'description', 'type']),
          })
        })
        it('should contain component content files', () => {
          const checkContentFile = (
            fieldName: keyof typeof mockDefaultValues.AuraDefinitionBundle,
            suffix: string,
          ): void => {
            const filePath = `${packageName}/aura/TestAuraDefinitionBundle/TestAuraDefinitionBundle${suffix}`
            expect(zipFiles).toHaveProperty([filePath])
            const data = zipFiles[filePath]
            expect(data).toEqual(mockDefaultValues.AuraDefinitionBundle[fieldName])
          }

          checkContentFile('documentationContent', '.auradoc')
          checkContentFile('designContent', '.design')
          checkContentFile('controllerContent', 'Controller.js')
          checkContentFile('SVGContent', '.svg')
          checkContentFile('helperContent', 'Helper.js')
          checkContentFile('rendererContent', 'Renderer.js')
          checkContentFile('styleContent', '.css')
        })
        describe('when a field is missing', () => {
          beforeEach(async () => {
            pkg = createDeployPackage()
            await pkg.add(
              createInstanceElement(
                _.omit(mockDefaultValues.AuraDefinitionBundle, 'designContent'),
                mockTypes.AuraDefinitionBundle,
              ),
            )
            zipFiles = await getZipFiles(pkg)
          })
          it('should not create file for missing field', () => {
            const filePath = `${packageName}/aura/TestAuraDefinitionBundle/TestAuraDefinitionBundle.design`
            expect(zipFiles[filePath]).toBeUndefined()
          })
        })
      })
      describe('LightningComponentBundle', () => {
        beforeEach(async () => {
          const mockLightningComponentBundleValues = _.clone(mockDefaultValues.LightningComponentBundle)
          _.set(mockLightningComponentBundleValues.targetConfigs.targetConfig[0], 'property', [
            {
              name: 'testTrueProp',
              default: 'true',
            },
            {
              name: 'testFalseProp',
              default: 'false',
            },
          ])
          await pkg.add(createInstanceElement(mockLightningComponentBundleValues, mockTypes.LightningComponentBundle))
          zipFiles = await getZipFiles(pkg)
        })
        it('should contain metadata xml', () => {
          const filePath = `${packageName}/lwc/testLightningComponentBundle/testLightningComponentBundle.js-meta.xml`
          expect(zipFiles).toHaveProperty([filePath])
          expect(zipFiles[filePath]).toMatch(
            `<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>49</apiVersion>
    <isExposed>true</isExposed>
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
            <property name="testTrueProp" default="true"></property>
            <property name="testFalseProp" default="false"></property>
        </targetConfig>
        <targetConfig targets="lightning__AppPage,lightning__HomePage">
            <supportedFormFactors>
                <supportedFormFactor type="Small"></supportedFormFactor>
            </supportedFormFactors>
        </targetConfig>
    </targetConfigs>
</LightningComponentBundle>
`,
          )
        })
      })
      describe('namespaced LightningComponentBundle', () => {
        beforeEach(async () => {
          const mockLightningComponentBundleValues = _.clone(mockDefaultValues.LightningComponentBundle)
          mockLightningComponentBundleValues.fullName = 'namespace__testLightningComponentBundle'
          _.set(mockLightningComponentBundleValues.targetConfigs.targetConfig[0], 'property', [
            {
              name: 'testTrueProp',
              default: 'true',
            },
            {
              name: 'testFalseProp',
              default: 'false',
            },
          ])
          await pkg.add(createInstanceElement(mockLightningComponentBundleValues, mockTypes.LightningComponentBundle))
          zipFiles = await getZipFiles(pkg)
        })
        it('should contain metadata xml without the namespace', () => {
          const filePath = `${packageName}/lwc/testLightningComponentBundle/testLightningComponentBundle.js-meta.xml`
          expect(zipFiles).toHaveProperty([filePath])
        })
      })
    })

    describe('with Settings types', () => {
      beforeEach(async () => {
        await pkg.add(createInstanceElement({ fullName: 'TestSettings', testField: true }, mockTypes.TestSettings))
        zipFiles = await getZipFiles(pkg)
      })
      it('manifest should include "Settings"', () => {
        expect(zipFiles).toHaveProperty([addManifestPath])
        const manifest = xmlParser.parse(zipFiles[addManifestPath])
        expect(manifest).toHaveProperty('Package.types')
        expect(manifest.Package.types).toMatchObject({
          name: 'Settings',
          members: 'TestSettings',
        })

        const filePath = `${packageName}/settings/TestSettings.settings`
        expect(zipFiles).toHaveProperty([filePath])
        const manifest2 = xmlParser.parse(zipFiles[filePath])
        expect(manifest2).toHaveProperty('TestSettings.testField')
        expect(manifest2.TestSettings.testField).toEqual(true)
      })
    })

    describe('content file name override for territory types', () => {
      describe('Territory2Model type', () => {
        beforeEach(async () => {
          await pkg.add(
            createInstanceElement({ fullName: 'testTerModel' }, mockTypes.TerritoryModel, undefined, {
              [CONTENT_FILENAME_OVERRIDE]: ['testTerModel', 'testTerModel.territory2Model'],
            }),
          )
          zipFiles = await getZipFiles(pkg)
        })
        it('manifest should include Territory2Model and override path correctly', () => {
          expect(zipFiles).toHaveProperty([addManifestPath])
          const manifest = xmlParser.parse(zipFiles[addManifestPath])
          expect(manifest).toHaveProperty('Package.types')
          expect(manifest.Package.types).toMatchObject({
            name: 'Territory2Model',
            members: 'testTerModel',
          })

          const filePath = `${packageName}/territory2Models/testTerModel/testTerModel.territory2Model`
          expect(zipFiles).toHaveProperty([filePath])
        })
      })

      describe('Territory2Rule type', () => {
        beforeEach(async () => {
          await pkg.add(
            createInstanceElement({ fullName: 'testTerModel.testTerRule' }, mockTypes.TerritoryRule, undefined, {
              [CONTENT_FILENAME_OVERRIDE]: ['testTerModel', 'rules', 'testTerRule.territory2Rule'],
            }),
          )
          zipFiles = await getZipFiles(pkg)
        })

        it('manifest should include Territory2Rule and override path correctly', () => {
          expect(zipFiles).toHaveProperty([addManifestPath])
          const manifest = xmlParser.parse(zipFiles[addManifestPath])
          expect(manifest).toHaveProperty('Package.types')
          expect(manifest.Package.types).toMatchObject({
            name: 'Territory2Rule',
            members: 'testTerModel.testTerRule',
          })

          const filePath = `${packageName}/territory2Models/testTerModel/rules/testTerRule.territory2Rule`
          expect(zipFiles).toHaveProperty([filePath])
        })
      })
    })
  })

  describe('fromRetrieveResult', () => {
    const toResultProperties = (requestProperties: FileProperties[]): FileProperties[] =>
      requestProperties.map(props => ({
        ...props,
        fileName: `unpackaged/${props.fileName}`,
      }))
    describe('apex class', () => {
      let retrieveResult: RetrieveResult
      let fileProperties: FileProperties[]
      beforeAll(async () => {
        fileProperties = [
          mockFileProperties({
            fileName: 'classes/MyApexClass.cls',
            fullName: 'MyApexClass',
            type: 'ApexClass',
          }),
        ]
        retrieveResult = {
          fileProperties: toResultProperties(fileProperties),
          id: '09S4J000001dSRcUAM',
          messages: [],
          zipFile: await createEncodedZipContent([
            {
              path: 'unpackaged/classes/MyApexClass.cls-meta.xml',
              content:
                '<?xml version="1.0" encoding="UTF-8"?>\n' +
                '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n' +
                '    <apiVersion>47.0</apiVersion>\n' +
                '    <status>Active</status>\n' +
                "    <description>An Apex class to read &amp; enjoy.\r\nIt's sure nice to have some special characters &lt;here&gt;.\rVery nice.</description>\n" +
                '</ApexClass>\n',
            },
            {
              path: 'unpackaged/classes/MyApexClass.cls',
              content:
                'public class MyApexClass {\n' +
                '    public void printLog() {\n' +
                "        System.debug('Created');\n" +
                '    }\n' +
                '}',
            },
          ]),
        }
      })

      it('should transform zip to MetadataInfo', async () => {
        const values = await fromRetrieveResult({
          zip: await new JSZip().loadAsync(Buffer.from(retrieveResult.zipFile, 'base64')),
          fileProps: fileProperties,
          typesWithMetaFile: new Set(['ApexClass']),
          typesWithContent: new Set(['ApexClass']),
          fetchProfile,
        })
        expect(values).toHaveLength(1)
        const [apex] = values
        expect(apex.file).toEqual(fileProperties[0])
        const metadataInfo = apex.values
        expect(metadataInfo.fullName).toEqual('MyApexClass')
        expect(metadataInfo.apiVersion).toEqual('47.0')
        expect(metadataInfo.status).toEqual('Active')
        expect(metadataInfo.description).toEqual(
          "An Apex class to read & enjoy.\r\nIt's sure nice to have some special characters <here>.\rVery nice.",
        )
        expect(isStaticFile(metadataInfo.content)).toEqual(true)
        const contentStaticFile = metadataInfo.content as StaticFile
        expect(await contentStaticFile.getContent()).toEqual(
          Buffer.from(
            "public class MyApexClass {\n    public void printLog() {\n        System.debug('Created');\n    }\n}",
          ),
        )
        expect(contentStaticFile.filepath).toEqual('salesforce/Records/ApexClass/MyApexClass.cls')
        expect(Object.keys(metadataInfo).every(key => !key.startsWith(XML_ATTRIBUTE_PREFIX))).toBeTruthy()
      })
    })

    describe('apex class with hidden content', () => {
      let retrieveResult: RetrieveResult
      let fileProperties: FileProperties[]
      beforeAll(async () => {
        fileProperties = [
          mockFileProperties({
            fileName: 'classes/MyApexClass.cls',
            fullName: 'MyApexClass',
            type: 'ApexClass',
          }),
        ]
        retrieveResult = {
          fileProperties: toResultProperties(fileProperties),
          id: '09S4J000001dSRcUAM',
          messages: [],
          zipFile: await createEncodedZipContent([
            {
              path: 'unpackaged/classes/MyApexClass.cls-meta.xml',
              content:
                '<?xml version="1.0" encoding="UTF-8"?>\n' +
                '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">\n' +
                '    <apiVersion>47.0</apiVersion>\n' +
                '    <status>Active</status>\n' +
                '</ApexClass>\n',
            },
            { path: 'unpackaged/classes/MyApexClass.cls', content: '(hidden)' },
          ]),
        }
      })

      it('should transform zip to MetadataInfo', async () => {
        const values = await fromRetrieveResult({
          zip: await new JSZip().loadAsync(Buffer.from(retrieveResult.zipFile, 'base64')),
          fileProps: fileProperties,
          typesWithMetaFile: new Set(['ApexClass']),
          typesWithContent: new Set(['ApexClass']),
          fetchProfile,
        })
        expect(values).toHaveLength(1)
        const [apex] = values
        expect(apex.file).toEqual(fileProperties[0])
        const metadataInfo = apex.values
        expect(metadataInfo.fullName).toEqual('MyApexClass')
        expect(metadataInfo.apiVersion).toEqual('47.0')
        expect(metadataInfo.status).toEqual('Active')
        expect(metadataInfo.content).toEqual('(hidden)')
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
            props => ({ ...props, type: 'EmailTemplate' }),
          ),
          id: '09S4J000001e2eLUAQ',
          messages: [],
          zipFile: await createEncodedZipContent([
            {
              path: 'unpackaged/email/MyFolder-meta.xml',
              content:
                '<?xml version="1.0" encoding="UTF-8"?>\n' +
                '<EmailFolder xmlns="http://soap.sforce.com/2006/04/metadata">\n' +
                '    <accessType>Public</accessType>\n' +
                '    <name>My folder</name>\n' +
                '    <publicFolderAccess>ReadWrite</publicFolderAccess>\n' +
                '</EmailFolder>\n',
            },
            {
              path: 'unpackaged/email/MyFolder/MyEmailTemplate.email-meta.xml',
              content:
                '<?xml version="1.0" encoding="UTF-8"?>\n' +
                '<EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">\n' +
                '    <available>false</available>\n' +
                '    <encodingKey>ISO-8859-1</encodingKey>\n' +
                '    <name>My Email Template</name>\n' +
                '    <style>none</style>\n' +
                '    <subject>MySubject &amp; title</subject>\n' +
                '    <type>text</type>\n' +
                '    <uiType>Aloha</uiType>\n' +
                '</EmailTemplate>\n',
            },
            {
              path: 'unpackaged/email/MyFolder/MyEmailTemplate.email',
              content: 'Email Body',
            },
          ]),
        }

        const values = await fromRetrieveResult({
          zip: await new JSZip().loadAsync(Buffer.from(retrieveResult.zipFile, 'base64')),
          fileProps: fileProperties,
          typesWithMetaFile: new Set(['EmailTemplate', 'EmailFolder']),
          typesWithContent: new Set(['EmailTemplate']),
          fetchProfile,
        })
        emailFolder = values.find(value => value.file.type === 'EmailFolder')?.values
        emailTemplate = values.find(value => value.file.type === 'EmailTemplate')?.values
      })

      it('should transform EmailFolder zip to MetadataInfo', () => {
        expect(emailFolder).toBeDefined()
        expect(emailFolder?.fullName).toEqual('MyFolder')
        expect(emailFolder?.name).toEqual('My folder')
        expect(emailFolder?.accessType).toEqual('Public')
      })

      it('should transform EmailTemplate zip to MetadataInfo', async () => {
        expect(emailTemplate).toBeDefined()
        expect(emailTemplate?.fullName).toEqual('MyFolder/MyEmailTemplate')
        expect(emailTemplate?.name).toEqual('My Email Template')
        expect(isStaticFile(emailTemplate?.content)).toEqual(true)
        const contentStaticFile = emailTemplate?.content as StaticFile
        expect(await contentStaticFile.getContent()).toEqual(Buffer.from('Email Body'))
        expect(contentStaticFile.filepath).toEqual('salesforce/Records/EmailTemplate/MyFolder/MyEmailTemplate.email')
      })

      it('should decode XML encoded values', () => {
        expect(emailTemplate?.subject).toEqual('MySubject & title')
      })
    })

    describe('complex types', () => {
      describe('lightning component bundle', () => {
        const createFileProperties = (namespacePrefix?: string): FileProperties =>
          mockFileProperties({
            fileName: 'lwc/myLightningComponentBundle',
            fullName: 'myLightningComponentBundle',
            type: LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE,
            namespacePrefix,
          })

        const createRetrieveResult = async (fileProperties: FileProperties[]): Promise<RetrieveResult> => ({
          fileProperties: toResultProperties(fileProperties),
          id: '09S4J000001dSRcUAM',
          messages: [],
          zipFile: await createEncodedZipContent([
            {
              path: 'unpackaged/lwc/myLightningComponentBundle/myLightningComponentBundle.js-meta.xml',
              content:
                '<?xml version="1.0" encoding="UTF-8"?>\n' +
                '<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">\n' +
                '    <apiVersion>47.0</apiVersion>\n' +
                '</LightningComponentBundle>\n',
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
        })

        const verifyMetadataValues = async (
          values: { file: FileProperties; values: MetadataValues }[],
          fileProperties: FileProperties,
          staticFilesExpectedFolder: string,
        ): Promise<void> => {
          expect(values).toHaveLength(1)
          const [lwc] = values
          expect(lwc.file).toEqual(fileProperties)
          const metadataInfo = lwc.values
          expect(metadataInfo.fullName).toEqual('myLightningComponentBundle')
          expect(_.get(metadataInfo, 'apiVersion')).toEqual('47.0')
          const jsResource = metadataInfo.lwcResources.lwcResource['myLightningComponentBundle_js@v']
          expect(jsResource).toBeDefined()
          expect(isStaticFile(jsResource.source)).toBe(true)
          const jsResourceStaticFile = jsResource.source as StaticFile
          expect(await jsResourceStaticFile.getContent()).toEqual(Buffer.from('// some javascript content'))
          expect(jsResourceStaticFile.filepath).toEqual(`${staticFilesExpectedFolder}/myLightningComponentBundle.js`)
          const htmlResource = metadataInfo.lwcResources.lwcResource['myLightningComponentBundle_html@v']
          expect(htmlResource).toBeDefined()
          expect(isStaticFile(htmlResource.source)).toBe(true)
          const htmlResourceStaticFile = htmlResource.source as StaticFile
          expect(await htmlResourceStaticFile.getContent()).toEqual(Buffer.from('// some html content'))
          expect(htmlResourceStaticFile.filepath).toEqual(
            `${staticFilesExpectedFolder}/myLightningComponentBundle.html`,
          )
        }

        it('should transform zip to MetadataInfo', async () => {
          const fileProperties = createFileProperties()
          const retrieveResult = await createRetrieveResult([fileProperties])
          const values = await fromRetrieveResult({
            zip: await new JSZip().loadAsync(Buffer.from(retrieveResult.zipFile, 'base64')),
            fileProps: [fileProperties],
            typesWithMetaFile: new Set(),
            typesWithContent: new Set(),
            fetchProfile,
          })
          await verifyMetadataValues(
            values,
            fileProperties,
            'salesforce/Records/LightningComponentBundle/myLightningComponentBundle',
          )
        })

        it('should transform zip to MetadataInfo for instance with namespace', async () => {
          const fileProperties = createFileProperties('myNamespace')
          const retrieveResult = await createRetrieveResult([fileProperties])
          const values = await fromRetrieveResult({
            zip: await new JSZip().loadAsync(Buffer.from(retrieveResult.zipFile, 'base64')),
            fileProps: [fileProperties],
            typesWithMetaFile: new Set(),
            typesWithContent: new Set(),
            fetchProfile,
          })
          await verifyMetadataValues(
            values,
            fileProperties,
            'salesforce/InstalledPackages/myNamespace/Records/LightningComponentBundle/myLightningComponentBundle',
          )
        })
      })

      describe('aura definition bundle', () => {
        const createRetrieveResult = async (fileProperties: FileProperties[]): Promise<RetrieveResult> => ({
          fileProperties: toResultProperties(fileProperties),
          id: '09S4J000001dSRcUAM',
          messages: [],
          zipFile: await createEncodedZipContent([
            {
              path: 'unpackaged/aura/myAuraDefinitionBundle/myAuraDefinitionBundle.cmp-meta.xml',
              content:
                '<?xml version="1.0" encoding="UTF-8"?>\n' +
                '<AuraDefinitionBundle xmlns="http://soap.sforce.com/2006/04/metadata">\n' +
                '    <apiVersion>47.0</apiVersion>\n' +
                '    <description>myAuraDefinitionBundle description</description>\n' +
                '</AuraDefinitionBundle>\n',
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
        })

        const createFileProperties = (namespacePrefix?: string): FileProperties =>
          mockFileProperties({
            fileName: 'aura/myAuraDefinitionBundle',
            fullName: 'myAuraDefinitionBundle',
            type: 'AuraDefinitionBundle',
            namespacePrefix,
          })

        const verifyMetadataValues = async (
          values: { file: FileProperties; values: MetadataValues }[],
          fileProperties: FileProperties,
          staticFilesExpectedFolder: string,
        ): Promise<void> => {
          expect(values).toHaveLength(1)
          const [auraInstance] = values
          expect(auraInstance.file).toEqual(fileProperties)
          const metadataInfo = auraInstance.values
          expect(metadataInfo.fullName).toEqual('myAuraDefinitionBundle')
          expect(metadataInfo.apiVersion).toEqual('47.0')
          expect(metadataInfo.type).toEqual('Component')
          expect(isStaticFile(metadataInfo.markup)).toBe(true)
          const markupStaticFile = metadataInfo.markup as StaticFile
          expect(await markupStaticFile.getContent()).toEqual(Buffer.from('// some component content'))
          expect(markupStaticFile.filepath).toEqual(`${staticFilesExpectedFolder}/myAuraDefinitionBundle.cmp`)
          expect(isStaticFile(metadataInfo.controllerContent)).toBe(true)
          const controllerStaticFile = metadataInfo.controllerContent as StaticFile
          expect(await controllerStaticFile.getContent()).toEqual(Buffer.from('// some controller content'))
          expect(controllerStaticFile.filepath).toEqual(
            `${staticFilesExpectedFolder}/myAuraDefinitionBundleController.js`,
          )
          expect(isStaticFile(metadataInfo.designContent)).toBe(true)
          const designStaticFile = metadataInfo.designContent as StaticFile
          expect(await designStaticFile.getContent()).toEqual(Buffer.from('// some design content'))
          expect(designStaticFile.filepath).toEqual(`${staticFilesExpectedFolder}/myAuraDefinitionBundle.design`)
          expect(isStaticFile(metadataInfo.documentationContent)).toBe(true)
          const documentationStaticFile = metadataInfo.documentationContent as StaticFile
          expect(await documentationStaticFile.getContent()).toEqual(Buffer.from('// some documentation content'))
          expect(documentationStaticFile.filepath).toEqual(
            `${staticFilesExpectedFolder}/myAuraDefinitionBundle.auradoc`,
          )
          expect(isStaticFile(metadataInfo.helperContent)).toBe(true)
          const helperStaticFile = metadataInfo.helperContent as StaticFile
          expect(await helperStaticFile.getContent()).toEqual(Buffer.from('// some helper content'))
          expect(helperStaticFile.filepath).toEqual(`${staticFilesExpectedFolder}/myAuraDefinitionBundleHelper.js`)
          expect(isStaticFile(metadataInfo.rendererContent)).toBe(true)
          const rendererStaticFile = metadataInfo.rendererContent as StaticFile
          expect(await rendererStaticFile.getContent()).toEqual(Buffer.from('// some renderer content'))
          expect(rendererStaticFile.filepath).toEqual(`${staticFilesExpectedFolder}/myAuraDefinitionBundleRenderer.js`)
          expect(isStaticFile(metadataInfo.styleContent)).toBe(true)
          const styleStaticFile = metadataInfo.styleContent as StaticFile
          expect(await styleStaticFile.getContent()).toEqual(Buffer.from('// some style content'))
          expect(styleStaticFile.filepath).toEqual(`${staticFilesExpectedFolder}/myAuraDefinitionBundle.css`)
          expect(isStaticFile(metadataInfo.SVGContent)).toBe(true)
          const svgStaticFile = metadataInfo.SVGContent as StaticFile
          expect(await svgStaticFile.getContent()).toEqual(Buffer.from('// some svg content'))
          expect(svgStaticFile.filepath).toEqual(`${staticFilesExpectedFolder}/myAuraDefinitionBundle.svg`)
        }

        it('should transform zip to MetadataInfo', async () => {
          const fileProperties = createFileProperties()
          const retrieveResult = await createRetrieveResult([fileProperties])
          const values = await fromRetrieveResult({
            zip: await new JSZip().loadAsync(Buffer.from(retrieveResult.zipFile, 'base64')),
            fileProps: [fileProperties],
            typesWithMetaFile: new Set(),
            typesWithContent: new Set(),
            fetchProfile,
          })
          await verifyMetadataValues(
            values,
            fileProperties,
            'salesforce/Records/AuraDefinitionBundle/myAuraDefinitionBundle',
          )
        })

        it('should transform zip to MetadataInfo for instance with namespace', async () => {
          const fileProperties = createFileProperties('myNamespace')
          const retrieveResult = await createRetrieveResult([fileProperties])
          const values = await fromRetrieveResult({
            zip: await new JSZip().loadAsync(Buffer.from(retrieveResult.zipFile, 'base64')),
            fileProps: [fileProperties],
            typesWithMetaFile: new Set(),
            typesWithContent: new Set(),
            fetchProfile,
          })
          await verifyMetadataValues(
            values,
            fileProperties,
            'salesforce/InstalledPackages/myNamespace/Records/AuraDefinitionBundle/myAuraDefinitionBundle',
          )
        })
      })

      describe('GenAi function', () => {
        const createFileProperties = (namespacePrefix?: string): FileProperties =>
          mockFileProperties({
            fileName: 'genAiFunctions/myGenAiFunction.genAiFunction',
            fullName: 'myGenAiFunction',
            type: GEN_AI_FUNCTION_METADATA_TYPE,
            namespacePrefix,
          })

        const createRetrieveResult = async (fileProperties: FileProperties[]): Promise<RetrieveResult> => ({
          fileProperties: toResultProperties(fileProperties),
          id: '09S4J000001dSRcUAM',
          messages: [],
          zipFile: await createEncodedZipContent([
            {
              path: 'unpackaged/genAiFunctions/myGenAiFunction/myGenAiFunction.genAiFunction-meta.xml',
              content:
                '<?xml version="1.0" encoding="UTF-8"?>\n' +
                '<GenAiFunction xmlns="http://soap.sforce.com/2006/04/metadata">\n' +
                '<description>Get a role name from the user and display the details</description>\n' +
                '<invocationTarget>Get_Role_Details</invocationTarget>\n' +
                '<invocationTargetType>flow</invocationTargetType>\n' +
                '<isConfirmationRequired>false</isConfirmationRequired>\n' +
                '<masterLabel>Get Role Details</masterLabel>\n' +
                '</GenAiFunction>',
            },
            {
              path: 'unpackaged/genAiFunctions/myGenAiFunction/input/schema.json',
              content: '// input schema',
            },
            {
              path: 'unpackaged/genAiFunctions/myGenAiFunction/output/schema.json',
              content: '// output schema',
            },
          ]),
        })

        const verifyMetadataValues = async (
          values: { file: FileProperties; values: MetadataValues }[],
          fileProperties: FileProperties,
          staticFilesExpectedFolder: string,
        ): Promise<void> => {
          expect(values).toHaveLength(1)
          const [genAiFunction] = values
          expect(genAiFunction.file).toEqual(fileProperties)
          const metadataInfo = genAiFunction.values
          expect(metadataInfo.fullName).toEqual('myGenAiFunction')
          expect(metadataInfo.invocationTargetType).toEqual('flow')
          const inputSchema = metadataInfo.schemas['input_schema_json@dv']
          expect(inputSchema).toBeDefined()
          expect(isStaticFile(inputSchema.source)).toBe(true)
          const inputSchemaStaticFile = inputSchema.source as StaticFile
          expect(await inputSchemaStaticFile.getContent()).toEqual(Buffer.from('// input schema'))
          expect(inputSchemaStaticFile.filepath).toEqual(`${staticFilesExpectedFolder}/input/schema.json`)
          const outputSchema = metadataInfo.schemas['output_schema_json@dv']
          expect(outputSchema).toBeDefined()
          expect(isStaticFile(outputSchema.source)).toBe(true)
          const outputSchemaStaticFile = outputSchema.source as StaticFile
          expect(await outputSchemaStaticFile.getContent()).toEqual(Buffer.from('// output schema'))
          expect(outputSchemaStaticFile.filepath).toEqual(`${staticFilesExpectedFolder}/output/schema.json`)
        }

        it('should transform zip to MetadataInfo', async () => {
          const fileProperties = createFileProperties()
          const retrieveResult = await createRetrieveResult([fileProperties])
          const values = await fromRetrieveResult({
            zip: await new JSZip().loadAsync(Buffer.from(retrieveResult.zipFile, 'base64')),
            fileProps: [fileProperties],
            typesWithMetaFile: new Set(),
            typesWithContent: new Set(),
            fetchProfile,
          })
          await verifyMetadataValues(values, fileProperties, 'salesforce/Records/GenAiFunction/myGenAiFunction')
        })

        it('should transform zip to MetadataInfo for instance with namespace', async () => {
          const fileProperties = createFileProperties('myNamespace')
          const retrieveResult = await createRetrieveResult([fileProperties])
          const values = await fromRetrieveResult({
            zip: await new JSZip().loadAsync(Buffer.from(retrieveResult.zipFile, 'base64')),
            fileProps: [fileProperties],
            typesWithMetaFile: new Set(),
            typesWithContent: new Set(),
            fetchProfile,
          })
          await verifyMetadataValues(
            values,
            fileProperties,
            'salesforce/InstalledPackages/myNamespace/Records/GenAiFunction/myGenAiFunction',
          )
        })
      })
    })

    describe('with empty XML', () => {
      let fileProperties: FileProperties[]
      let retrieveResult: RetrieveResult
      beforeEach(async () => {
        fileProperties = [
          mockFileProperties({
            fileName: 'reportTypes/MyReportType.reportType',
            fullName: 'MyReportType',
            type: 'ReportType',
          }),
        ]
        retrieveResult = {
          fileProperties: toResultProperties(fileProperties),
          id: '09S4J000001dSRcUAM',
          messages: [],
          zipFile: await createEncodedZipContent([
            {
              path: 'unpackaged/reportTypes/MyReportType.reportType',
              content: '<?xml version="1.0" encoding="UTF-8"?>\n',
            },
          ]),
        }
      })
      it('should return empty object', async () => {
        const values = await fromRetrieveResult({
          zip: await new JSZip().loadAsync(Buffer.from(retrieveResult.zipFile, 'base64')),
          fileProps: fileProperties,
          typesWithMetaFile: new Set(),
          typesWithContent: new Set(),
          fetchProfile,
        })
        expect(values).toContainEqual(
          expect.objectContaining({
            values: expect.objectContaining({ fullName: 'MyReportType' }),
          }),
        )
      })
    })
    describe('with number values', () => {
      const XML_STRING =
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<InstalledPackage xmlns="http://soap.sforce.com/2006/04/metadata">\n' +
        '    <version>47.0</version>\n' +
        '    <fullName>SBQQ</fullName>\n' +
        '</AuraDefinitionBundle>\n'

      it('should not attempt to convert the string to number', () => {
        expect(xmlToValues(XML_STRING).values).toEqual({
          version: '47.0',
          fullName: 'SBQQ',
        })
      })
    })
  })
})
