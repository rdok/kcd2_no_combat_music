#!/bin/bash

if [ ! -d "node_modules" ]; then
    npm ci
fi

exec "$@"