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
from constants import LICENSE_HEADER, LINE_SEPERATOR, TABLE_ROW, TABLE_DATA

SCRIPT_DIR = os.path.dirname(__file__)
SRC_DIR = os.path.join(SCRIPT_DIR, '../../src/autogen/')
BUNDLE_COMPONENTS_DIR = os.path.join(SRC_DIR, 'bundle_components/')
FULL_LINE_LENGTH = 4
BUNDLE_IDS = [39609, 53195, 233251]
PRIVATE_BUNDLE = 'Private'

search_bundles_link_template = 'https://{account_id}.app.netsuite.com/app/bundler/installbundle.nl?whence='

bundle_components_file_template = LICENSE_HEADER + '''

export const BUNDLE_ID_TO_COMPONENTS: Readonly<Record<number, ReadonlySet<string>>> = {{
  {bundle_id_to_components}
}}
'''
def wait_on_element(webpage):
  element = webpage.find_element(By.XPATH, '//*[@id="div__lab1"]')
  if element:
    return element
  return False

def parse_components_table(bundle_id_to_components, bundle_id, components_table, webpage, driverWait):
  # wait until loading row disappears and the table is fully loaded.
  driverWait.until(wait_on_element)
  for row in components_table.find_elements(By.TAG_NAME, TABLE_ROW)[3:]:
    cells = row.find_elements(By.TAG_NAME, TABLE_DATA)
    if len(cells) >= FULL_LINE_LENGTH and cells[3].text.strip()!= '' :
      bundle_id_to_components[bundle_id].append(cells[3].text)
  webpage.back()


def parse_bundle_components(account_id, username, password, secret_key_2fa, webpage, driverWait):
  logging.info('Starting to parse bundles')
  try:
    webpage.get(search_bundles_link_template.format(account_id = account_id))
    login(username, password, secret_key_2fa, webpage)
    bundle_id_to_components = defaultdict(lambda: [])
    for bundle_id in BUNDLE_IDS:
      search_field = driverWait.until(lambda driver: driver.find_element(By.XPATH, '//*[@id="keywords"]'))
      search_field.clear() # clear previous input if it exits
      search_field.send_keys(bundle_id)
      webpage.find_element(By.XPATH, '//*[@id="search"]').click()
      driverWait.until(lambda driver: driver.find_element(By.XPATH, '//*[@id="name1href"]')).click()
      try:
        driverWait.until(EC.text_to_be_present_in_element((By.TAG_NAME, 'body'), 'You have not been granted access to the bundle.'))
        bundle_id_to_components[bundle_id].append(PRIVATE_BUNDLE)
        webpage.back()
      except TimeoutException:
        driverWait.until(lambda driver: driver.find_element(By.XPATH, '//*[@id="componentstabtxt"]')).click()
        components_table = driverWait.until(lambda d: d.find_element(By.XPATH, '//*[@id="contentslist__tab"]')) 
        parse_components_table(bundle_id_to_components, bundle_id, components_table, webpage, driverWait)
  finally:
    webpage.quit()
  return bundle_id_to_components

def generate_bundle_map_file(bundle_id_to_components):
  formatted_components = ["{key}: new Set({value}),".format(key = bundle_id, value = bundle_id_to_components[bundle_id]) for bundle_id in bundle_id_to_components]
  file_content = bundle_components_file_template.format(bundle_id_to_components = LINE_SEPERATOR.join(formatted_components))
  Path(BUNDLE_COMPONENTS_DIR).mkdir(parents=True, exist_ok=True)
  with open(BUNDLE_COMPONENTS_DIR + 'bundle_components.ts', 'w') as file:
    file.write(file_content)

def main():
  webpage = webdriver.Chrome()
  driverWait = wait.WebDriverWait(webpage, 15)
  account_id, username, password, secret_key_2fa = (sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
  bundle_to_components = parse_bundle_components(account_id, username, password, secret_key_2fa, webpage, driverWait)
  generate_bundle_map_file(bundle_to_components)

if __name__=='__main__':
  main()