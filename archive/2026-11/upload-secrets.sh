#!/bin/bash
while IFS='=' read -r key value; do
  # Skip comments and empty lines
  if [[ $key == \#* ]] || [[ -z $key ]]; then
    continue
  fi
  # remove carriage returns if any
  key=$(echo "$key" | tr -d '\r')
  value=$(echo "$value" | tr -d '\r')
  echo "Uploading secret: $key"
  echo "$value" | npx wrangler pages secret put "$key" --project-name=qualitour-astro
done < .env
