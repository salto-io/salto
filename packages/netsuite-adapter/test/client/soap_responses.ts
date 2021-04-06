
/*
*                      Copyright 2021 Salto Labs Ltd.
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
export const READ_SUCCESS_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <soapenv:Header>
        <platformMsgs:documentInfo xmlns:platformMsgs="urn:messages_2020_2.platform.webservices.netsuite.com">
            <platformMsgs:nsId>WEBSERVICES_TSTDRV2259448_032420211672409845160737639_5a9a98</platformMsgs:nsId>
        </platformMsgs:documentInfo>
    </soapenv:Header>
    <soapenv:Body>
        <getResponse xmlns="">
            <platformMsgs:readResponse xmlns:platformMsgs="urn:messages_2020_2.platform.webservices.netsuite.com">
                <platformCore:status isSuccess="true" xmlns:platformCore="urn:core_2020_2.platform.webservices.netsuite.com"/>
                <platformMsgs:record internalId="5846" xsi:type="docFileCab:File" xmlns:docFileCab="urn:filecabinet_2020_2.documents.webservices.netsuite.com">
                    <docFileCab:name>demo2.txt</docFileCab:name>
                    <docFileCab:mediaTypeName>Other Binary File</docFileCab:mediaTypeName>
                    <docFileCab:fileType>_MISCBINARY</docFileCab:fileType>
                    <docFileCab:content>ZGVtbwoK
</docFileCab:content>
                    <docFileCab:folder internalId="-6" xmlns:platformCore="urn:core_2020_2.platform.webservices.netsuite.com">
                        <platformCore:name>Templates : E-mail Templates</platformCore:name>
                    </docFileCab:folder>
                    <docFileCab:fileSize>6.0</docFileCab:fileSize>
                    <docFileCab:url>https://tstdrv2259448.app.netsuite.com/core/media/media.nl?id=5846&amp;c=TSTDRV2259448&amp;h=rCvF1ci0VbmCRfJ04BqD8KsS_Y4-1WaVMEO80PBTpD6_4qf7&amp;_xt=.bin</docFileCab:url>
                    <docFileCab:textFileEncoding>_utf8</docFileCab:textFileEncoding>
                    <docFileCab:description>description3&lt;br&gt;aaaa&lt;br&gt;bbb&lt;br&gt;cc&lt;br&gt;d&lt;br&gt;ee&lt;br&gt;fff&lt;br&gt;gggg</docFileCab:description>
                    <docFileCab:isOnline>false</docFileCab:isOnline>
                    <docFileCab:isInactive>false</docFileCab:isInactive>
                    <docFileCab:class>none</docFileCab:class>
                    <docFileCab:bundleable>false</docFileCab:bundleable>
                    <docFileCab:department>none</docFileCab:department>
                    <docFileCab:hideInBundle>false</docFileCab:hideInBundle>
                    <docFileCab:isPrivate>false</docFileCab:isPrivate>
                    <docFileCab:caption>demo2</docFileCab:caption>
                    <docFileCab:siteDescription>3</docFileCab:siteDescription>
                    <docFileCab:lastModifiedDate>2021-03-18T02:31:47.000-07:00</docFileCab:lastModifiedDate>
                    <docFileCab:createdDate>2021-02-03T01:02:15.000-08:00</docFileCab:createdDate>
                    <docFileCab:siteCategoryList>
                        <docFileCab:siteCategory>
                            <docFileCab:isDefault>true</docFileCab:isDefault>
                            <docFileCab:category internalId="-101" xmlns:platformCore="urn:core_2020_2.platform.webservices.netsuite.com">
                                <platformCore:name>Home</platformCore:name>
                            </docFileCab:category>
                            <docFileCab:categoryDescription>&lt;table border=&quot;0&quot; cellpadding=&quot;0&quot; cellspacing=&quot;0&quot; width=&quot;100%&quot;&gt; &lt;tbody&gt; &lt;tr</docFileCab:categoryDescription>
                            <docFileCab:website internalId="1" xmlns:platformCore="urn:core_2020_2.platform.webservices.netsuite.com">
                                <platformCore:name>Ramsey Inc.</platformCore:name>
                            </docFileCab:website>
                        </docFileCab:siteCategory>
                    </docFileCab:siteCategoryList>
                </platformMsgs:record>
            </platformMsgs:readResponse>
        </getResponse>
    </soapenv:Body>
</soapenv:Envelope>`

export const READ_SUCCESS_RESPONSE_NO_CONTENT = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <soapenv:Header>
        <platformMsgs:documentInfo xmlns:platformMsgs="urn:messages_2020_2.platform.webservices.netsuite.com">
            <platformMsgs:nsId>WEBSERVICES_TSTDRV2259448_032420211672409845160737639_5a9a98</platformMsgs:nsId>
        </platformMsgs:documentInfo>
    </soapenv:Header>
    <soapenv:Body>
        <getResponse xmlns="">
            <platformMsgs:readResponse xmlns:platformMsgs="urn:messages_2020_2.platform.webservices.netsuite.com">
                <platformCore:status isSuccess="true" xmlns:platformCore="urn:core_2020_2.platform.webservices.netsuite.com"/>
                <platformMsgs:record internalId="5846" xsi:type="docFileCab:File" xmlns:docFileCab="urn:filecabinet_2020_2.documents.webservices.netsuite.com">
                    <docFileCab:name>demo2.txt</docFileCab:name>
                    <docFileCab:mediaTypeName>Other Binary File</docFileCab:mediaTypeName>
                    <docFileCab:fileType>_MISCBINARY</docFileCab:fileType>
                    <docFileCab:content></docFileCab:content>
                    <docFileCab:folder internalId="-6" xmlns:platformCore="urn:core_2020_2.platform.webservices.netsuite.com">
                        <platformCore:name>Templates : E-mail Templates</platformCore:name>
                    </docFileCab:folder>
                    <docFileCab:fileSize>6.0</docFileCab:fileSize>
                    <docFileCab:url>https://tstdrv2259448.app.netsuite.com/core/media/media.nl?id=5846&amp;c=TSTDRV2259448&amp;h=rCvF1ci0VbmCRfJ04BqD8KsS_Y4-1WaVMEO80PBTpD6_4qf7&amp;_xt=.bin</docFileCab:url>
                    <docFileCab:textFileEncoding>_utf8</docFileCab:textFileEncoding>
                    <docFileCab:description>description3&lt;br&gt;aaaa&lt;br&gt;bbb&lt;br&gt;cc&lt;br&gt;d&lt;br&gt;ee&lt;br&gt;fff&lt;br&gt;gggg</docFileCab:description>
                    <docFileCab:isOnline>false</docFileCab:isOnline>
                    <docFileCab:isInactive>false</docFileCab:isInactive>
                    <docFileCab:class>none</docFileCab:class>
                    <docFileCab:bundleable>false</docFileCab:bundleable>
                    <docFileCab:department>none</docFileCab:department>
                    <docFileCab:hideInBundle>false</docFileCab:hideInBundle>
                    <docFileCab:isPrivate>false</docFileCab:isPrivate>
                    <docFileCab:caption>demo2</docFileCab:caption>
                    <docFileCab:siteDescription>3</docFileCab:siteDescription>
                    <docFileCab:lastModifiedDate>2021-03-18T02:31:47.000-07:00</docFileCab:lastModifiedDate>
                    <docFileCab:createdDate>2021-02-03T01:02:15.000-08:00</docFileCab:createdDate>
                    <docFileCab:siteCategoryList>
                        <docFileCab:siteCategory>
                            <docFileCab:isDefault>true</docFileCab:isDefault>
                            <docFileCab:category internalId="-101" xmlns:platformCore="urn:core_2020_2.platform.webservices.netsuite.com">
                                <platformCore:name>Home</platformCore:name>
                            </docFileCab:category>
                            <docFileCab:categoryDescription>&lt;table border=&quot;0&quot; cellpadding=&quot;0&quot; cellspacing=&quot;0&quot; width=&quot;100%&quot;&gt; &lt;tbody&gt; &lt;tr</docFileCab:categoryDescription>
                            <docFileCab:website internalId="1" xmlns:platformCore="urn:core_2020_2.platform.webservices.netsuite.com">
                                <platformCore:name>Ramsey Inc.</platformCore:name>
                            </docFileCab:website>
                        </docFileCab:siteCategory>
                    </docFileCab:siteCategoryList>
                </platformMsgs:record>
            </platformMsgs:readResponse>
        </getResponse>
    </soapenv:Body>
</soapenv:Envelope>`

export const READ_FAILURE_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <soapenv:Header>
        <platformMsgs:documentInfo xmlns:platformMsgs="urn:messages_2020_2.platform.webservices.netsuite.com">
            <platformMsgs:nsId>WEBSERVICES_TSTDRV2259448_0324202116735338402072580352_3a3eb</platformMsgs:nsId>
        </platformMsgs:documentInfo>
    </soapenv:Header>
    <soapenv:Body>
        <getResponse xmlns="">
            <platformMsgs:readResponse xmlns:platformMsgs="urn:messages_2020_2.platform.webservices.netsuite.com">
                <platformCore:status isSuccess="false" xmlns:platformCore="urn:core_2020_2.platform.webservices.netsuite.com">
                    <platformCore:statusDetail type="ERROR">
                        <platformCore:code>FILE_NOT_DOWNLOADABLE</platformCore:code>
                        <platformCore:message>Illegal request for a file that isn't downloadable</platformCore:message>
                    </platformCore:statusDetail>
                </platformCore:status>
            </platformMsgs:readResponse>
        </getResponse>
    </soapenv:Body>
</soapenv:Envelope>`

export const READ_INVALID_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <soapenv:Header>
        <platformMsgs:documentInfo xmlns:platformMsgs="urn:messages_2020_2.platform.webservices.netsuite.com">
            <platformMsgs:nsId>WEBSERVICES_TSTDRV2259448_032420211672409845160737639_5a9a98</platformMsgs:nsId>
        </platformMsgs:documentInfo>
    </soapenv:Header>
    <soapenv:Body>
        <getResponse xmlns="">
            <platformMsgs:readResponse xmlns:platformMsgs="urn:messages_2020_2.platform.webservices.netsuite.com">
                <platformCore:status isSuccess="true" xmlns:platformCore="urn:core_2020_2.platform.webservices.netsuite.com"/>
                <platformMsgs:record internalId="5846" xsi:type="docFileCab:File" xmlns:docFileCab="urn:filecabinet_2020_2.documents.webservices.netsuite.com">
                </platformMsgs:record>
            </platformMsgs:readResponse>
        </getResponse>
    </soapenv:Body>
</soapenv:Envelope>`

export const UPDATE_FILE_CABINET_SUCCESS_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://www.w3.org/2003/05/soap-envelope" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <soapenv:Header>
        <platformMsgs:documentInfo xmlns:platformMsgs="urn:messages_2020_2.platform.webservices.netsuite.com">
            <platformMsgs:nsId>WEBSERVICES_TSTDRV2259448_040420211679021275384972772_5a58ea</platformMsgs:nsId>
        </platformMsgs:documentInfo>
    </soapenv:Header>
    <soapenv:Body>
        <updateListResponse xmlns="">
            <writeResponseList xmlns:platformMsgs="urn:messages_2020_2.platform.webservices.netsuite.com">
                <platformCore:status isSuccess="true" xmlns:platformCore="urn:core_2020_2.platform.webservices.netsuite.com"/>
                <writeResponse>
                    <platformCore:status isSuccess="true" xmlns:platformCore="urn:core_2020_2.platform.webservices.netsuite.com">
                        <platformCore:statusDetail>
                            <platformCore:afterSubmitFailed>false</platformCore:afterSubmitFailed>
                        </platformCore:statusDetail>
                    </platformCore:status>
                    <baseRef internalId="6233" type="file" xsi:type="platformCore:RecordRef" xmlns:platformCore="urn:core_2020_2.platform.webservices.netsuite.com"/>
                </writeResponse>
                <writeResponse>
                    <platformCore:status isSuccess="false" xmlns:platformCore="urn:core_2020_2.platform.webservices.netsuite.com">
                        <platformCore:statusDetail type="ERROR">
                            <platformCore:code>MEDIA_NOT_FOUND</platformCore:code>
                            <platformCore:message>Media item not found 62330</platformCore:message>
                        </platformCore:statusDetail>
                    </platformCore:status>
                    <baseRef internalId="62330" type="file" xsi:type="platformCore:RecordRef" xmlns:platformCore="urn:core_2020_2.platform.webservices.netsuite.com"/>
                </writeResponse>
            </writeResponseList>
        </updateListResponse>
    </soapenv:Body>
</soapenv:Envelope>`

export const UPDATE_FILE_CABINET_ERROR_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://www.w3.org/2003/05/soap-envelope" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <soapenv:Header>
        <platformMsgs:documentInfo xmlns:platformMsgs="urn:messages_2020_2.platform.webservices.netsuite.com">
            <platformMsgs:nsId>WEBSERVICES_TSTDRV2259448_040420211679021275384972772_5a58ea</platformMsgs:nsId>
        </platformMsgs:documentInfo>
    </soapenv:Header>
    <soapenv:Body>
        <updateListResponse xmlns="">
            <writeResponseList xmlns:platformMsgs="urn:messages_2020_2.platform.webservices.netsuite.com">
              <platformCore:status isSuccess="false" xmlns:platformCore="urn:core_2020_2.platform.webservices.netsuite.com">
                <platformCore:statusDetail type="ERROR">
                  <platformCore:code>SOME_ERROR</platformCore:code>
                  <platformCore:message>SOME_ERROR</platformCore:message>
                </platformCore:statusDetail>
              </platformCore:status>
            </writeResponseList>
        </updateListResponse>
    </soapenv:Body>
</soapenv:Envelope>`

export const UPDATE_FILE_CABINET_INVALID_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://www.w3.org/2003/05/soap-envelope" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <soapenv:Header>
        <platformMsgs:documentInfo xmlns:platformMsgs="urn:messages_2020_2.platform.webservices.netsuite.com">
            <platformMsgs:nsId>WEBSERVICES_TSTDRV2259448_040420211679021275384972772_5a58ea</platformMsgs:nsId>
        </platformMsgs:documentInfo>
    </soapenv:Header>
    <soapenv:Body>
        <updateListResponse xmlns="">
            <writeResponseList xmlns:platformMsgs="urn:messages_2020_2.platform.webservices.netsuite.com">
                <platformCore:status isSuccess="true" xmlns:platformCore="urn:core_2020_2.platform.webservices.netsuite.com"/>
                <writeResponse>
                    <platformCore:status isSuccess="false" xmlns:platformCore="urn:core_2020_2.platform.webservices.netsuite.com">
                    </platformCore:status>
                    <baseRef internalId="62330" type="file" xsi:type="platformCore:RecordRef" xmlns:platformCore="urn:core_2020_2.platform.webservices.netsuite.com"/>
                </writeResponse>
            </writeResponseList>
        </updateListResponse>
    </soapenv:Body>
</soapenv:Envelope>`

export const ADD_FILE_CABINET_SUCCESS_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://www.w3.org/2003/05/soap-envelope" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <soapenv:Header>
        <platformMsgs:documentInfo xmlns:platformMsgs="urn:messages_2020_2.platform.webservices.netsuite.com">
            <platformMsgs:nsId>WEBSERVICES_TSTDRV2259448_0404202116668635922013689574_7ac6b</platformMsgs:nsId>
        </platformMsgs:documentInfo>
    </soapenv:Header>
    <soapenv:Body>
        <addListResponse xmlns="urn:messages_2020_2.platform.webservices.netsuite.com">
            <writeResponseList>
                <platformCore:status isSuccess="true" xmlns:platformCore="urn:core_2020_2.platform.webservices.netsuite.com"/>
                <writeResponse>
                    <platformCore:status isSuccess="true" xmlns:platformCore="urn:core_2020_2.platform.webservices.netsuite.com">
                        <platformCore:statusDetail>
                            <platformCore:afterSubmitFailed>false</platformCore:afterSubmitFailed>
                        </platformCore:statusDetail>
                    </platformCore:status>
                    <baseRef internalId="6334" type="file" xsi:type="platformCore:RecordRef" xmlns:platformCore="urn:core_2020_2.platform.webservices.netsuite.com"/>
                </writeResponse>
                <writeResponse>
                    <platformCore:status isSuccess="false" xmlns:platformCore="urn:core_2020_2.platform.webservices.netsuite.com">
                        <platformCore:statusDetail type="ERROR">
                            <platformCore:code>INVALID_KEY_OR_REF</platformCore:code>
                            <platformCore:message>Invalid folder reference key -600.</platformCore:message>
                        </platformCore:statusDetail>
                    </platformCore:status>
                </writeResponse>
            </writeResponseList>
        </addListResponse>
    </soapenv:Body>
</soapenv:Envelope>`

export const ADD_FILE_CABINET_ERROR_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://www.w3.org/2003/05/soap-envelope" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <soapenv:Header>
        <platformMsgs:documentInfo xmlns:platformMsgs="urn:messages_2020_2.platform.webservices.netsuite.com">
            <platformMsgs:nsId>WEBSERVICES_TSTDRV2259448_0404202116668635922013689574_7ac6b</platformMsgs:nsId>
        </platformMsgs:documentInfo>
    </soapenv:Header>
    <soapenv:Body>
        <addListResponse xmlns="urn:messages_2020_2.platform.webservices.netsuite.com">
          <writeResponseList xmlns:platformMsgs="urn:messages_2020_2.platform.webservices.netsuite.com">
            <platformCore:status isSuccess="false" xmlns:platformCore="urn:core_2020_2.platform.webservices.netsuite.com">
              <platformCore:statusDetail type="ERROR">
                <platformCore:code>SOME_ERROR</platformCore:code>
                <platformCore:message>SOME_ERROR</platformCore:message>
              </platformCore:statusDetail>
            </platformCore:status>
          </writeResponseList>
        </addListResponse>
    </soapenv:Body>
</soapenv:Envelope>`

export const ADD_FILE_CABINET_INVALID_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://www.w3.org/2003/05/soap-envelope" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <soapenv:Header>
        <platformMsgs:documentInfo xmlns:platformMsgs="urn:messages_2020_2.platform.webservices.netsuite.com">
            <platformMsgs:nsId>WEBSERVICES_TSTDRV2259448_0404202116668635922013689574_7ac6b</platformMsgs:nsId>
        </platformMsgs:documentInfo>
    </soapenv:Header>
    <soapenv:Body>
        <addListResponse xmlns="urn:messages_2020_2.platform.webservices.netsuite.com">
          <writeResponseList xmlns:platformMsgs="urn:messages_2020_2.platform.webservices.netsuite.com">
            <platformCore:status isSuccess="false" xmlns:platformCore="urn:core_2020_2.platform.webservices.netsuite.com">
            </platformCore:status>
          </writeResponseList>
        </addListResponse>
    </soapenv:Body>
</soapenv:Envelope>`
