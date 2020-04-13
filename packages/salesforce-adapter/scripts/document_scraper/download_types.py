#!/usr/bin/python3

# Note: This script was created for personal use - hence is very scrappy.

from selenium import webdriver

SETTINGS_PAGE_LINK = 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_settings.htm#!'

# Get settings pages links
def get_settings_links():
    settings_page = webdriver.Chrome()
    settings_page.get(SETTINGS_PAGE_LINK)
    settings_elements = settings_page.find_element_by_xpath('//*[@id="sfdc:seealso"]/ul') 
    settings_links = []
    for settings in settings_elements.find_elements_by_xpath('//li/strong/a'): 
        settings_links.append(settings.get_attribute('href'))
    
    return settings_links

def print_fields(link):
    webpage = webdriver.Chrome()
    webpage.get(link)
    table = webpage.find_element_by_xpath("//table[@class='featureTable sort_table']") 
    fields = []
    i = 0
    for row in table.find_elements_by_xpath(".//tr/td"): 
        if i % 3 == 0:
            fields.append([row.text]) # new field
        elif i % 3 == 1:
            fields[int(i / 3)].append([row.text]) # field type
        i += 1
    print(link + '\n' + str(fields))
    webpage.quit()

links = [
    'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_accountintelligencesettings.htm',
    'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_automatedcontactssettings.htm',
    'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_chatteranswerssettings.htm',
    'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_chatteremailmdsettings.htm',
    'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_highvelocitysalessettings.htm'
    'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_iotsettings.htm',
    'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_mapandlocationsettings.htm',
    'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_objectlinkingsettings.htm',
    'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_predictionbuildersettings.htm',
    'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_socialcustomerservicesettings.htm',

]
def change_case(str): 
    return ''.join(['_'+i.lower() if i.isupper()  
               else i for i in str]).lstrip('_') 

def generate_camel_case(link):
    return link.split('_')[-1:][0][:-4]

def create_field_dict(webpage):
    camel_case = generate_camel_case(webpage.current_url)
    product = 'export const {snail_case} = {{\n'.format(snail_case=change_case(camel_case).upper())
    
    try: 
        table = webpage.find_element_by_xpath("//table[@class='featureTable sort_table']")
    except:
        print(camel_case)
        return
    for i, row in enumerate(table.find_elements_by_xpath(".//tr/td")):
        if i % 3 == 0:
            product = ''.join([product, '  {camel}: '.format(
                snail=change_case(row.text).upper(),
                camel=row.text
            )])
        if i % 3 == 1:
            product = ''.join([product, 'BuiltinTypes.{type},\n'.format(type=row.text.upper())]) 
    
    print(product + '}')
    
def create_object(webpage):
    try:
        camel_case = webpage.find_element_by_xpath('//*[@id="topic-title"]').text
    except:
        camel_case = 'SocialCustomerServiceSettings'
    product =  '''{camel1}: new ObjectType({{
      elemID: {camel2}Id,
      fields: {{
    '''.format(camel1=camel_case, camel2=camel_case)
    suffix = '''  },
    }),'''

    field = '''    [{snail_type}.{snail_field}]: new TypeField(
          {camel_case}Id,
          {snail_type}.{snail_field},
          BuiltinTypes.BOOLEAN
        ),
    '''

    table = webpage.find_element_by_xpath("//table[@class='featureTable sort_table']") 
    for i, row in enumerate(table.find_elements_by_xpath(".//tr/td")):
        if i % 3 == 0:
            product = ''.join([product, field.format(
                snail_type=change_case(camel_case).upper(),
                snail_field=change_case(row.text).upper(),
                camel_case=camel_case
            )])
    
    print(product + suffix)

for link in links:
    webpage = webdriver.Chrome()
    webpage.get(link)
    create_field_dict(webpage)
    create_object(webpage)
    webpage.quit() 