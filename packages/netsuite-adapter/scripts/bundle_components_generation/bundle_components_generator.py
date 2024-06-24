#!/usr/bin/python3

import os
import sys
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import wait, expected_conditions as EC
from selenium.common.exceptions import TimeoutException
import logging
from pathlib import Path
from collections import defaultdict
from types_generation.types_generator import login
from constants import LICENSE_HEADER, TABLE_ROW, TABLE_DATA
from bundles_info import BUNDLES_INFO
import json
import logging
logging.basicConfig(filename='bundle_generation.log', level=logging.DEBUG)

SCRIPT_DIR = os.path.dirname(__file__)
SRC_DIR = os.path.join(SCRIPT_DIR, '../../src/autogen/')
BUNDLE_COMPONENTS_DIR = os.path.join(SRC_DIR, 'bundle_components/')
FULL_LINE_LENGTH = 4

NO_VERSION = 'NO_VERSION'
NO_ACCESS_ERROR_MESSAGE = 'You have not been granted access to the bundle.'
UNEXPECTED_ERROR_MESSAGE = 'An unexpected error has occurred'
bundles_link_template = 'https://{account_id}.app.netsuite.com/app/bundler/bundledetails.nl?sourcecompanyid={publisher_id}&domain={installed_from}&config=F&id={bundle_id}'

bundle_components_file_template = LICENSE_HEADER + '''

type BundleVersionToComponents = Readonly<Record<string, Set<string>>>

export const BUNDLE_ID_TO_COMPONENTS: Readonly<Record<string, BundleVersionToComponents>> = {{
{bundle_id_to_components}
}}
'''
def wait_on_element(webpage):
  element = webpage.find_element(By.XPATH, '//*[@id="div__lab1"]')
  if element:
    return element
  return False

def parse_components_table(bundle_id_to_components, bundle_id, components_table, webpage, driverWait):
  version_element = webpage.find_element(By.CSS_SELECTOR, 'div[data-nsps-label="Version"] .uir-field.inputreadonly')
  version = version_element.text.strip() if version_element.text.strip() != '' else NO_VERSION
  print('Bundle id is: ', bundle_id, 'with version: ',version)
  # wait until loading row disappears and the table is fully loaded.
  driverWait.until(wait_on_element)
  for row in components_table.find_elements(By.TAG_NAME, TABLE_ROW)[3:]:
    cells = row.find_elements(By.TAG_NAME, TABLE_DATA)
    if len(cells) >= FULL_LINE_LENGTH and cells[3].text.strip()!= '' and (not cells[3].text.strip().isdigit()):
      bundle_id_to_components[bundle_id][version].append(cells[3].text)
  webpage.back()


def parse_bundle_components(account_id, username, password, secret_key_2fa, webpage, driverWait):
  logging.info('Starting to parse bundles')
  try:
    webpage.get('https://{account_id}.app.netsuite.com/app/center/card.nl?sc=-29&whence='.format(account_id = account_id))
    login(username, password, secret_key_2fa, webpage)
    bundle_id_to_components = defaultdict(lambda: defaultdict(list))
    unfetched_bundles = []
    for bundle_info in BUNDLES_INFO:
      bundle_id, installed_from, publisher_id = bundle_info
      if (not (installed_from and publisher_id)):
        unfetched_bundles.append((bundle_id, installed_from, publisher_id))
        continue
      webpage.get(bundles_link_template.format(account_id = account_id, publisher_id = publisher_id, installed_from = installed_from, bundle_id = bundle_id))
      try:
        error_conditions = lambda driver: NO_ACCESS_ERROR_MESSAGE in driver.find_element(By.TAG_NAME, 'body').text or UNEXPECTED_ERROR_MESSAGE in driver.find_element(By.TAG_NAME, 'body').text
        driverWait.until(error_conditions)
        # for private bundles we return an empty Record
        bundle_id_to_components[bundle_id] = {}
      except TimeoutException:
        try:
          driverWait.until(lambda driver: driver.find_element(By.XPATH, '//*[@id="componentstabtxt"]')).click()
          components_table = driverWait.until(lambda d: d.find_element(By.XPATH, '//*[@id="contentslist__tab"]')) 
          parse_components_table(bundle_id_to_components, bundle_id, components_table, webpage, driverWait)
        except TimeoutException:
          unfetched_bundles.append((bundle_id, installed_from, publisher_id))
          continue
  finally:
    webpage.quit()
  logging.info(f'The following bundles were not fetched due to missing required fields: {" ".join(map(str, unfetched_bundles))}')
  return bundle_id_to_components

def format_components(bundle_id_to_components):
  table_content = ""

  for bundle_id, bundle_versions in bundle_id_to_components.items():
    table_content += f'  {bundle_id}: {{\n'
    for version, files in bundle_versions.items():
      if version == NO_VERSION:
        table_content += f'    {version}: new Set({files}),\n'
      else:
        table_content += f'    \'{version}\': new Set({files}),\n'
    table_content += "  },\n"
  return table_content

def generate_bundle_map_file(bundle_id_to_components):
  formatted_components = format_components(bundle_id_to_components)
  file_content = bundle_components_file_template.format(bundle_id_to_components = formatted_components)
  Path(BUNDLE_COMPONENTS_DIR).mkdir(parents=True, exist_ok=True)
  with open(BUNDLE_COMPONENTS_DIR + 'bundle_components.ts', 'w') as file:
    file.write(file_content)

def create_merged_map(bundle_id_to_components):
  file_path = 'bundle_component.json'
  logging.info('Creating merged map')
  if not os.path.exists(file_path):
    json_data = json.dumps(bundle_id_to_components)
    with open('bundle_component.json', 'w') as file:
      file.write(json_data)
    return bundle_id_to_components

  else:
    with open(file_path, 'r') as file:
      existing_data = json.load(file)
    
    merged_data = merge_dictionaries(existing_data, bundle_id_to_components)

    with open(file_path, 'w') as file:
      file.write(json.dumps(merged_data))
    return merged_data

def merge_dictionaries(existing_data, new_bundle_dict):
  merged_dict = {}
  for bundle_id in new_bundle_dict:
    new_bundle_data = new_bundle_dict[bundle_id]
    
    if bundle_id not in existing_data:
      merged_dict[bundle_id] = new_bundle_data

    else:
      existing_bundle_data = existing_data[bundle_id]

      for version in new_bundle_data:
        if version not in existing_bundle_data:
          existing_bundle_data[version] = new_bundle_data
          
      merged_dict[bundle_id] = existing_bundle_data

  return merged_dict

def main():
# Running headless chrome speeds the script, but it's not required. To view the browser, remove the headless option.
  op = webdriver.ChromeOptions()
  op.add_argument('headless')
  webpage = webdriver.Chrome(options=op)
  driverWait = wait.WebDriverWait(webpage, 20)
  account_id, username, password, secret_key_2fa = (sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
  bundle_to_components = parse_bundle_components(account_id, username, password, secret_key_2fa, webpage, driverWait)
  merged_bundle_map = create_merged_map(bundle_to_components)
  generate_bundle_map_file(merged_bundle_map)

if __name__=='__main__':
  main()