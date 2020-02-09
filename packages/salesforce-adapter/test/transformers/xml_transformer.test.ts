import jszip from 'jszip'
import { BuiltinTypes, ElemID, Field, InstanceElement, ObjectType } from 'adapter-api'
import _ from 'lodash'
import { MetadataInfo, RetrieveResult } from 'jsforce'
import { fromRetrieveResult, toMetadataPackageZip } from '../../src/transformers/xml_transformer'
import { INSTANCE_FULL_NAME_FIELD, METADATA_TYPE, SALESFORCE } from '../../src/constants'
import { ASSIGNMENT_RULES_TYPE_ID } from '../../src/filters/assignment_rules'
import { apiName, metadataType } from '../../src/transformers/transformer'
import { API_VERSION } from '../../src/client/client'
import { createEncodedZipContent } from '../utils'


describe('XML Transformer', () => {
  const PACKAGE = 'unpackaged'

  describe('toMetadataPackageZip in creation flow', () => {
    describe('assignment rule', () => {
      const assignmentRulesType = new ObjectType({
        elemID: ASSIGNMENT_RULES_TYPE_ID,
        annotations: {
          [METADATA_TYPE]: 'AssignmentRules',
        },
        fields: {
          str: new Field(ASSIGNMENT_RULES_TYPE_ID, 'str', BuiltinTypes.STRING),
          lst: new Field(ASSIGNMENT_RULES_TYPE_ID, 'lst', BuiltinTypes.NUMBER, {}, true),
          bool: new Field(ASSIGNMENT_RULES_TYPE_ID, 'bool', BuiltinTypes.BOOLEAN),
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
          `<Package xmlns="http://soap.sforce.com/2006/04/metadata">
           <version>47.0</version>
           <types><members>Instance</members><name>AssignmentRules</name></types>
         </Package>`.replace(/>\s+</gs, '><')
        )
      })

      it('should contain instance xml', async () => {
        const instanceXml = (await zip).files[`${PACKAGE}/assignmentRules/Instance.assignmentRules`]
        expect(instanceXml).toBeDefined()
        expect(await instanceXml.async('text')).toMatch(
          `<AssignmentRules xmlns="http://soap.sforce.com/2006/04/metadata">
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
          [apiVersion]: new Field(apexTypeElemID, apiVersion, BuiltinTypes.NUMBER),
          content: new Field(apexTypeElemID, 'content', BuiltinTypes.STRING),
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
        apexClassInstance.value, false)
        .then(buf => jszip.loadAsync(buf as Buffer))

      it('should contain package xml', async () => {
        const packageXml = (await zip).files[`${PACKAGE}/package.xml`]
        expect(packageXml).toBeDefined()
        expect(await packageXml.async('text')).toMatch(
          `<Package xmlns="http://soap.sforce.com/2006/04/metadata">
           <version>47.0</version>
           <types><members>MyApexClass</members><name>ApexClass</name></types>
         </Package>`.replace(/>\s+</gs, '><')
        )
      })

      it('should contain metadata xml', async () => {
        const instanceXml = (await zip).files[`${PACKAGE}/classes/MyApexClass.cls-meta.xml`]
        expect(instanceXml).toBeDefined()
        expect(await instanceXml.async('text')).toMatch(
          `<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
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
          name: new Field(emailFolderElemID, 'name', BuiltinTypes.STRING),
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
          `<Package xmlns="http://soap.sforce.com/2006/04/metadata">
           <version>${API_VERSION}</version>
           <types><members>MyEmailFolder</members><name>EmailTemplate</name></types>
         </Package>`.replace(/>\s+</gs, '><')
        )
      })

      it('should contain metadata xml', async () => {
        const instanceXml = (await zip).files[`${PACKAGE}/email/MyEmailFolder-meta.xml`]
        expect(instanceXml).toBeDefined()
        expect(await instanceXml.async('text')).toMatch(
          `<EmailFolder xmlns="http://soap.sforce.com/2006/04/metadata">
           <name>Folder Name</name>
         </EmailFolder>`.replace(/>\s+</gs, '><')
        )
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
          [apiVersion]: new Field(apexTypeElemID, apiVersion, BuiltinTypes.NUMBER),
          content: new Field(apexTypeElemID, 'content', BuiltinTypes.STRING),
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
          `<Package xmlns="http://soap.sforce.com/2006/04/metadata">
           <version>${API_VERSION}</version>
         </Package>`.replace(/>\s+</gs, '><')
        )
      })

      it('should contain destructive changes xml', async () => {
        const packageXml = (await zip).files[`${PACKAGE}/destructiveChanges.xml`]
        expect(packageXml).toBeDefined()
        expect(await packageXml.async('text')).toMatch(
          `<Package xmlns="http://soap.sforce.com/2006/04/metadata">
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
          name: new Field(emailFolderElemID, 'name', BuiltinTypes.STRING),
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
          `<Package xmlns="http://soap.sforce.com/2006/04/metadata">
           <version>${API_VERSION}</version>
         </Package>`.replace(/>\s+</gs, '><')
        )
      })

      it('should contain destructive changes xml', async () => {
        const packageXml = (await zip).files[`${PACKAGE}/destructiveChanges.xml`]
        expect(packageXml).toBeDefined()
        expect(await packageXml.async('text')).toMatch(
          `<Package xmlns="http://soap.sforce.com/2006/04/metadata">
           <types><members>MyEmailFolder</members><name>EmailTemplate</name></types>
         </Package>`.replace(/>\s+</gs, '><')
        )
      })
    })
  })

  describe('fromRetrieveResult', () => {
    describe('apex class', () => {
      let retrieveResult: RetrieveResult
      beforeAll(async () => {
        retrieveResult = {
          fileProperties:
            [{
              createdById: '0054J000002KGspQAG',
              createdByName: 'createdBy',
              createdDate: '2019-12-01T14:31:36.000Z',
              fileName: 'classes/MyApexClass.cls',
              fullName: 'MyApexClass',
              id: '01p4J00000JcCoFQAV',
              lastModifiedById: '0054J000002KGspQAG',
              lastModifiedByName: 'modifiedBy',
              lastModifiedDate: '2019-12-01T14:31:36.000Z',
              manageableState: 'unmanaged',
              type: 'ApexClass',
            }],
          id: '09S4J000001dSRcUAM',
          messages: [],
          zipFile: await createEncodedZipContent([{ path: 'unpackaged/classes/MyApexClass.cls-meta.xml',
            content: '<?xml version="1.0" encoding="UTF-8"?>\n'
              + '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">\n'
              + '    <apiVersion>47.0</apiVersion>\n'
              + '    <status>Active</status>\n'
              + '</ApexClass>\n' }, { path: 'unpackaged/classes/MyApexClass.cls',
            content: 'public class MyApexClass {\n'
              + '    public void printLog() {\n'
              + '        System.debug(\'Created\');\n'
              + '    }\n'
              + '}' }]),
        }
      })

      it('should transform zip to MetadataInfo', async () => {
        const typeNameToInstanceInfos = await fromRetrieveResult(retrieveResult, ['ApexClass'])
        const [metadataInfo] = typeNameToInstanceInfos.ApexClass
        expect(metadataInfo.fullName).toEqual('MyApexClass')
        expect(_.get(metadataInfo, 'apiVersion')).toEqual(47)
        expect(_.get(metadataInfo, 'status')).toEqual('Active')
        expect(_.get(metadataInfo, 'content'))
          .toEqual('public class MyApexClass {\n    public void printLog() {\n        System.debug(\'Created\');\n    }\n}')
      })
    })

    describe('email template & folder', () => {
      let retrieveResult: RetrieveResult
      let typeNameToInstanceInfos: Record<string, MetadataInfo[]>
      beforeAll(async () => {
        retrieveResult = {
          fileProperties: [
            {
              createdById: '0054J000002KGG5QAO',
              createdByName: 'Omri Litvak',
              createdDate: '2019-12-29T11:53:53.000Z',
              fileName: 'unpackaged/email/MyFolder/MyEmailTemplate.email',
              fullName: 'MyFolder/MyEmailTemplate',
              id: '00X4J000001BNHGUA4',
              lastModifiedById: '0054J000002KGG5QAO',
              lastModifiedByName: 'Omri Litvak',
              lastModifiedDate: '2019-12-29T11:53:53.000Z',
              manageableState: 'unmanaged',
              type: 'EmailTemplate',
            },
            {
              createdById: '0054J000002KGG5QAO',
              createdByName: 'Omri Litvak',
              createdDate: '2019-12-23T09:26:25.000Z',
              fileName: 'unpackaged/email/MyFolder',
              fullName: 'MyFolder',
              id: '00l4J000001AHd1QAG',
              lastModifiedById: '0054J000002KGG5QAO',
              lastModifiedByName: 'Omri Litvak',
              lastModifiedDate: '2019-12-29T11:44:14.000Z',
              manageableState: 'unmanaged',
              type: 'EmailTemplate',
            },
            {
              createdById: '0054J000002KGG5QAO',
              createdByName: 'Omri Litvak',
              createdDate: '2019-12-29T11:55:12.251Z',
              fileName: 'unpackaged/package.xml',
              fullName: 'unpackaged/package.xml',
              id: '',
              lastModifiedById: '0054J000002KGG5QAO',
              lastModifiedByName: 'Omri Litvak',
              lastModifiedDate: '2019-12-29T11:55:12.251Z',
              manageableState: 'unmanaged',
              type: 'Package',
            },
          ],
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
        typeNameToInstanceInfos = await fromRetrieveResult(retrieveResult,
          ['EmailTemplate', 'EmailFolder'])
      })

      it('should transform EmailFolder zip to MetadataInfo', async () => {
        const [metadataInfo] = typeNameToInstanceInfos.EmailFolder
        expect(metadataInfo.fullName).toEqual('MyFolder')
        expect(_.get(metadataInfo, 'name')).toEqual('My folder')
        expect(_.get(metadataInfo, 'accessType')).toEqual('Public')
      })

      it('should transform EmailTemplate zip to MetadataInfo', async () => {
        const [metadataInfo] = typeNameToInstanceInfos.EmailTemplate
        expect(metadataInfo.fullName).toEqual('MyFolder/MyEmailTemplate')
        expect(_.get(metadataInfo, 'name')).toEqual('My Email Template')
        expect(_.get(metadataInfo, 'content')).toEqual('Email Body')
      })
    })
  })
})
